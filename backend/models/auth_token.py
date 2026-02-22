"""
JWT token state model for rotation and revocation.
"""
from datetime import datetime
from enum import Enum

from .user import db


class AuthTokenType(str, Enum):
    ACCESS = 'access'
    REFRESH = 'refresh'


class AuthToken(db.Model):
    """
    Persisted JWT session state.

    This table enables revocation/rotation controls that are not possible with
    stateless JWT validation alone.
    """
    __tablename__ = 'auth_tokens'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_type = db.Column(db.Enum(AuthTokenType), nullable=False, index=True)
    issued_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)

    revoked_at = db.Column(db.DateTime, nullable=True, index=True)
    revoked_reason = db.Column(db.String(64), nullable=True)
    replaced_by_jti = db.Column(db.String(64), nullable=True, index=True)
    parent_jti = db.Column(db.String(64), nullable=True, index=True)

    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user = db.relationship('User')

    @property
    def is_revoked(self):
        """Convenience flag used by token state checks."""
        return self.revoked_at is not None
