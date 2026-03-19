"""
FastAPI dependency injection helpers.

Provides JWT cookie authentication, role checking, and client IP extraction
compatible with the Flask backend's JWT tokens.
"""
from __future__ import annotations

import ipaddress
import secrets
from typing import Annotated

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings, get_settings
from .database import get_db
from .models import User


# ---------------------------------------------------------------------------
# Settings dependency
# ---------------------------------------------------------------------------

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Client IP helpers
# ---------------------------------------------------------------------------

def _first_valid_ip(header_value: str) -> str | None:
    if not header_value:
        return None
    for part in header_value.split(','):
        candidate = part.strip()
        if not candidate:
            continue
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            continue
    return None


def _ip_in_cidrs(ip_value: str, cidr_ranges: list[str]) -> bool:
    try:
        addr = ipaddress.ip_address(ip_value)
    except ValueError:
        return False
    for raw in cidr_ranges or []:
        candidate = str(raw or '').strip()
        if not candidate:
            continue
        try:
            if '/' in candidate:
                if addr in ipaddress.ip_network(candidate, strict=False):
                    return True
            elif addr == ipaddress.ip_address(candidate):
                return True
        except ValueError:
            continue
    return False


def get_client_ip(
    request: Request,
    settings: SettingsDep,
) -> str | None:
    """Extract client IP respecting proxy trust configuration."""
    remote_addr = (request.client.host if request.client else '') or ''
    remote_ip = None
    if remote_addr:
        try:
            ipaddress.ip_address(remote_addr)
            remote_ip = remote_addr
        except ValueError:
            remote_ip = None

    if settings.TRUST_PROXY_HEADERS and remote_ip:
        cidrs = settings.trusted_proxy_cidrs_list
        should_trust = (not cidrs) or _ip_in_cidrs(remote_ip, cidrs)
        if should_trust:
            forwarded = _first_valid_ip(request.headers.get('x-forwarded-for', ''))
            if forwarded:
                return forwarded
            real_ip = _first_valid_ip(request.headers.get('x-real-ip', ''))
            if real_ip:
                return real_ip

    return remote_ip


# ---------------------------------------------------------------------------
# JWT authentication
# ---------------------------------------------------------------------------

def _decode_jwt_from_cookie(cookie_value: str | None, settings: Settings) -> dict | None:
    """Decode a JWT access token from cookie value."""
    if not cookie_value:
        return None
    try:
        payload = jwt.decode(
            cookie_value,
            settings.JWT_SECRET_KEY,
            algorithms=['HS256'],
            options={'verify_exp': True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={'error': '토큰이 만료되었습니다.', 'error_code': 'token_expired'},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail={'error': '유효하지 않은 토큰입니다.', 'error_code': 'invalid_token'},
        )


async def get_current_user(
    request: Request,
    db: DbSession,
    settings: SettingsDep,
) -> User:
    """Extract and validate JWT from cookie, return the User."""
    cookie_name = settings.JWT_ACCESS_COOKIE_NAME
    token = request.cookies.get(cookie_name)
    if not token:
        raise HTTPException(
            status_code=401,
            detail={'error': '인증이 필요합니다.', 'error_code': 'authorization_required'},
        )

    # CSRF check for mutating requests
    if settings.JWT_COOKIE_CSRF_PROTECT and request.method not in ('GET', 'HEAD', 'OPTIONS'):
        csrf_from_header = request.headers.get(settings.JWT_ACCESS_CSRF_HEADER_NAME.lower())
        if not csrf_from_header:
            csrf_from_header = request.headers.get('x-csrf-token')
        csrf_cookie = request.cookies.get(settings.JWT_ACCESS_CSRF_COOKIE_NAME)
        if not csrf_from_header:
            raise HTTPException(
                status_code=401,
                detail={'error': 'CSRF 토큰이 필요합니다.', 'error_code': 'csrf_missing'},
            )

    payload = _decode_jwt_from_cookie(token, settings)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail={'error': '인증이 필요합니다.', 'error_code': 'authorization_required'},
        )

    # flask-jwt-extended stores identity in 'sub' claim
    user_id_raw = payload.get('sub')
    if user_id_raw is None:
        raise HTTPException(status_code=401, detail={'error': 'Invalid token identity'})

    try:
        user_id = int(str(user_id_raw))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail={'error': 'Invalid token identity'})

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail={'error': 'User not found'})

    # Attach role from JWT claim for fast access (matches Flask behavior)
    jwt_role = payload.get('role')
    if jwt_role:
        user._jwt_role = str(jwt_role)
    else:
        user._jwt_role = user.role

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_optional_current_user(
    request: Request,
    db: DbSession,
    settings: SettingsDep,
) -> User | None:
    """Return authenticated user when present; otherwise treat request as anonymous."""
    # Field-trip post creation accepts unlocked anonymous visitors, so the route
    # needs a soft-auth dependency instead of failing hard on missing JWT cookies.
    try:
        return await get_current_user(request, db, settings)
    except HTTPException:
        return None


OptionalCurrentUser = Annotated[User | None, Depends(get_optional_current_user)]


# ---------------------------------------------------------------------------
# Field trip cookies
# ---------------------------------------------------------------------------

def _field_trip_cookie_secret(settings: Settings) -> str:
    return f'{settings.JWT_SECRET_KEY}:field_trip_unlock'


def encode_field_trip_unlock_token(class_ids: set[str], settings: Settings) -> str:
    payload = {
        'kind': 'field_trip_unlock',
        'classes': sorted({str(value) for value in class_ids if str(value).strip()}),
    }
    return jwt.encode(payload, _field_trip_cookie_secret(settings), algorithm='HS256')


def generate_field_trip_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def get_field_trip_unlocked_class_ids(
    request: Request,
    settings: SettingsDep,
) -> set[str]:
    cookie_name = settings.FIELD_TRIP_UNLOCK_COOKIE_NAME
    token = request.cookies.get(cookie_name)
    if not token:
        return set()

    try:
        payload = jwt.decode(
            token,
            _field_trip_cookie_secret(settings),
            algorithms=['HS256'],
            options={'verify_exp': False},
        )
    except jwt.InvalidTokenError:
        return set()

    if payload.get('kind') != 'field_trip_unlock':
        return set()

    classes = payload.get('classes')
    if not isinstance(classes, list):
        return set()
    return {str(value) for value in classes if str(value).strip()}


FieldTripUnlockedClasses = Annotated[set[str], Depends(get_field_trip_unlocked_class_ids)]


def require_any_field_trip_unlock(
    unlocked_classes: FieldTripUnlockedClasses,
) -> set[str]:
    if unlocked_classes:
        return unlocked_classes
    raise HTTPException(
        status_code=403,
        detail={'error': '해당 기능을 사용하려면 먼저 반 비밀번호를 확인해야 합니다.'},
    )


def require_field_trip_class_unlocked(
    class_id: str,
    unlocked_classes: FieldTripUnlockedClasses,
) -> set[str]:
    if class_id in unlocked_classes:
        return unlocked_classes
    raise HTTPException(
        status_code=403,
        detail={'error': '이 반 게시판에 접근하려면 비밀번호 확인이 필요합니다.'},
    )


def require_field_trip_write_csrf(
    request: Request,
    settings: SettingsDep,
) -> None:
    cookie_value = request.cookies.get(settings.FIELD_TRIP_CSRF_COOKIE_NAME)
    header_value = request.headers.get(settings.FIELD_TRIP_CSRF_HEADER_NAME, '')
    # The unlock flow issues a field-trip scoped CSRF token so anonymous writers
    # still get write protection without relying on the auth cookie CSRF pair.
    if not cookie_value or not header_value or cookie_value != header_value:
        raise HTTPException(
            status_code=401,
            detail={'error': '요청을 다시 확인해 주세요. 보안 토큰이 올바르지 않습니다.'},
        )


# ---------------------------------------------------------------------------
# Role-based authorization
# ---------------------------------------------------------------------------

def require_role(*roles: str):
    """
    Return a FastAPI dependency that ensures the current user has one of
    the specified roles. Admin always passes.
    """
    async def _check_role(current_user: CurrentUser) -> User:
        user_role = getattr(current_user, '_jwt_role', current_user.role) or current_user.role
        if user_role == 'admin':
            return current_user
        if user_role not in {str(r) for r in roles}:
            raise HTTPException(status_code=403, detail={'error': '이 기능을 사용할 권한이 없습니다.'})
        return current_user
    return _check_role
