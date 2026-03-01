"""
Token issuance, rotation, and revocation helpers.
"""
from datetime import datetime, timezone
from typing import Optional

from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from sqlalchemy.exc import SQLAlchemyError

from models import db, AuthToken, AuthTokenType, UserRole
from utils.request_metadata import get_request_ip_for_storage, get_request_ua_for_storage


def _utc_from_unix(unix_ts):
    """Convert UNIX timestamp claims to naive UTC datetimes for DB storage."""
    try:
        return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _safe_user_agent():
    try:
        return get_request_ua_for_storage()
    except Exception:
        return None


def _safe_client_ip():
    try:
        return get_request_ip_for_storage()
    except Exception:
        return None


def _persist_token(raw_token: str, token_type: AuthTokenType, user_id: int, parent_jti: Optional[str] = None):
    """
    Persist token metadata from JWT payload.

    Token rows provide server-side session state, enabling revocation and
    rotation checks that are not possible with stateless JWT validation alone.
    """
    payload = decode_token(raw_token)
    jti = payload.get('jti')
    exp = payload.get('exp')
    if not jti or not exp:
        raise ValueError('token payload missing jti/exp')

    # Idempotency guard for retries during login/refresh flows.
    existing = AuthToken.query.filter_by(jti=jti).first()
    if existing:
        return existing

    token = AuthToken(
        jti=jti,
        user_id=user_id,
        token_type=token_type,
        issued_at=datetime.utcnow(),
        expires_at=_utc_from_unix(exp),
        parent_jti=parent_jti,
        ip_address=_safe_client_ip(),
        user_agent=_safe_user_agent(),
    )
    db.session.add(token)
    return token


def _normalize_role_value(user_role):
    """Normalize optional role values before embedding into JWT claims."""
    if isinstance(user_role, UserRole):
        return user_role.value
    if user_role in (None, ''):
        return None
    return str(user_role)


def _claims_for_role(user_role: Optional[str]):
    role_value = _normalize_role_value(user_role)
    return {'role': role_value} if role_value else None


def _issue_and_persist_pair(
    user_id: int,
    claims: Optional[dict] = None,
    parent_refresh_jti: Optional[str] = None,
):
    """
    Create access/refresh pair and persist both token rows in current transaction.
    """
    access_token = create_access_token(identity=str(user_id), additional_claims=claims)
    refresh_token = create_refresh_token(identity=str(user_id), additional_claims=claims)

    # Persist refresh first so access token can point to refresh parent_jti.
    refresh_rec = _persist_token(
        refresh_token,
        AuthTokenType.REFRESH,
        user_id,
        parent_jti=parent_refresh_jti,
    )
    _persist_token(access_token, AuthTokenType.ACCESS, user_id, parent_jti=refresh_rec.jti)
    return access_token, refresh_token, refresh_rec


def issue_token_pair(
    user_id: int,
    rotate_from_refresh_jti: Optional[str] = None,
    user_role: Optional[str] = None,
):
    """
    Issue access/refresh token pair and persist token state atomically.
    If rotate_from_refresh_jti is provided, revoke that refresh token.
    """
    # Embedding role keeps authorization checks cheap on most requests.
    claims = _claims_for_role(user_role)
    access_token, refresh_token, refresh_rec = _issue_and_persist_pair(
        user_id=user_id,
        claims=claims,
        parent_refresh_jti=rotate_from_refresh_jti,
    )

    if rotate_from_refresh_jti:
        old_refresh = AuthToken.query.filter_by(jti=rotate_from_refresh_jti).first()
        if old_refresh and not old_refresh.revoked_at:
            old_refresh.revoked_at = datetime.utcnow()
            old_refresh.revoked_reason = 'rotated'
            old_refresh.replaced_by_jti = refresh_rec.jti

    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        raise

    return access_token, refresh_token


def rotate_refresh_token_pair(
    user_id: int,
    refresh_jti: str,
    user_role: Optional[str] = None,
):
    """
    Rotate one refresh token exactly once.

    Returns tuple(access_token, refresh_token, error_key).
    """
    if not refresh_jti:
        return None, None, 'invalid_refresh_token'

    claims = _claims_for_role(user_role)
    now = datetime.utcnow()

    # Lock the presented refresh token row to prevent replay race.
    old_refresh = (
        AuthToken.query
        .filter_by(
            jti=refresh_jti,
            user_id=user_id,
            token_type=AuthTokenType.REFRESH,
        )
        .with_for_update()
        .first()
    )
    if not old_refresh:
        return None, None, 'invalid_refresh_token'
    if old_refresh.revoked_at is not None:
        return None, None, 'refresh_token_replayed'
    if old_refresh.expires_at and old_refresh.expires_at <= now:
        old_refresh.revoked_at = now
        old_refresh.revoked_reason = 'expired'
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
        return None, None, 'refresh_token_expired'

    old_refresh.revoked_at = now
    old_refresh.revoked_reason = 'rotated'

    try:
        access_token, refresh_token, new_refresh = _issue_and_persist_pair(
            user_id=user_id,
            claims=claims,
            parent_refresh_jti=refresh_jti,
        )
        old_refresh.replaced_by_jti = new_refresh.jti
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return None, None, 'rotation_failed'

    return access_token, refresh_token, None


def revoke_token_jti(jti: Optional[str], reason: str = 'revoked', replaced_by_jti: Optional[str] = None):
    """Mark one token as revoked; no-op when token is unknown/already revoked."""
    if not jti:
        return False

    token = AuthToken.query.filter_by(jti=jti).first()
    if not token or token.revoked_at:
        return False

    token.revoked_at = datetime.utcnow()
    token.revoked_reason = reason[:64] if reason else 'revoked'
    token.replaced_by_jti = replaced_by_jti
    return True


def revoke_raw_refresh_token(raw_token: str, expected_user_id: int):
    """
    Revoke refresh token string if it belongs to expected user.
    Returns tuple(success, error_key).
    """
    try:
        payload = decode_token(raw_token, allow_expired=True)
    except Exception:
        return False, 'invalid_token'

    # Only refresh tokens are accepted for explicit logout revocation.
    if payload.get('type') != 'refresh':
        return False, 'invalid_token_type'

    subject = payload.get('sub')
    if str(subject) != str(expected_user_id):
        return False, 'token_user_mismatch'

    revoked = revoke_token_jti(payload.get('jti'), reason='logout')
    return revoked, None


def is_token_blocked(jwt_payload):
    """
    DB-backed token state is authoritative.
    Unknown or revoked JTI is treated as blocked.
    """
    jti = (jwt_payload or {}).get('jti')
    if not jti:
        return True

    record = AuthToken.query.filter_by(jti=jti).first()
    if not record:
        return True
    if record.revoked_at is not None:
        return True
    return False
