"""
Token issuance, rotation, and revocation helpers.
"""
from datetime import datetime, timezone
from typing import Optional

from flask import request
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from sqlalchemy.exc import SQLAlchemyError

from models import db, AuthToken, AuthTokenType


def _utc_from_unix(unix_ts):
    try:
        return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _safe_user_agent():
    try:
        return (request.headers.get('User-Agent') or '')[:255]
    except Exception:
        return ''


def _safe_client_ip():
    try:
        return (request.remote_addr or '')[:64]
    except Exception:
        return ''


def _persist_token(raw_token: str, token_type: AuthTokenType, user_id: int, parent_jti: Optional[str] = None):
    payload = decode_token(raw_token)
    jti = payload.get('jti')
    exp = payload.get('exp')
    if not jti or not exp:
        raise ValueError('token payload missing jti/exp')

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


def issue_token_pair(user_id: int, rotate_from_refresh_jti: Optional[str] = None):
    """
    Issue access/refresh token pair and persist token state atomically.
    If rotate_from_refresh_jti is provided, revoke that refresh token.
    """
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))

    refresh_rec = _persist_token(
        refresh_token,
        AuthTokenType.REFRESH,
        user_id,
        parent_jti=rotate_from_refresh_jti,
    )
    _persist_token(access_token, AuthTokenType.ACCESS, user_id, parent_jti=refresh_rec.jti)

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


def revoke_token_jti(jti: Optional[str], reason: str = 'revoked', replaced_by_jti: Optional[str] = None):
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
