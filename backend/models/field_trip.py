"""
Field-trip event domain models.
"""
from __future__ import annotations

from datetime import datetime, timezone

from .user import db


def _to_utc_iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace('+00:00', 'Z')


class FieldTripClass(db.Model):
    __tablename__ = 'field_trip_classes'

    class_id = db.Column(db.String(2), primary_key=True)
    label = db.Column(db.String(20), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    board_description = db.Column(db.String(240), nullable=True)
    total_score = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    posts = db.relationship(
        'FieldTripPost',
        backref='field_trip_class',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='FieldTripPost.created_at.desc()',
    )

    def to_summary_dict(self, *, post_count=0, is_unlocked=False, board_description=None):
        return {
            'classId': self.class_id,
            'label': self.label,
            'postCount': int(post_count or 0),
            'isUnlocked': bool(is_unlocked),
            'boardDescription': board_description
            if board_description is not None
            else self.board_description,
        }

    def to_score_dict(self):
        return {
            'classId': self.class_id,
            'label': self.label,
            'totalScore': int(self.total_score or 0),
        }


class FieldTripPost(db.Model):
    __tablename__ = 'field_trip_posts'

    id = db.Column(db.String(80), primary_key=True)
    class_id = db.Column(
        db.String(2),
        db.ForeignKey('field_trip_classes.class_id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    author_user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    # Keep the Flask model aligned with the FastAPI serializer contract so both
    # runtimes describe anonymous field-trip authors the same way.
    author_role = db.Column(db.String(50), nullable=False, default='anonymous')
    nickname = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(80), nullable=False)
    body = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        db.Index('ix_field_trip_posts_class_created_at', 'class_id', 'created_at'),
    )

    attachments = db.relationship(
        'FieldTripPostAttachment',
        backref='post',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='FieldTripPostAttachment.display_order.asc()',
    )

    def to_dict(self, attachment_url_builder):
        author_role = self.author_role or ('anonymous' if self.author_user_id is None else 'student')
        return {
            'id': self.id,
            'classId': self.class_id,
            # Frontend normalization treats 0 as the anonymous sentinel even
            # though the database stores anonymous authors with a null FK.
            'authorUserId': 0 if author_role == 'anonymous' else self.author_user_id,
            'authorRole': author_role,
            'nickname': self.nickname,
            'title': self.title,
            'body': self.body,
            'attachments': [
                attachment.to_dict(attachment_url_builder(attachment.stored_filename))
                for attachment in self.attachments
            ],
            'createdAt': _to_utc_iso(self.created_at),
            'updatedAt': _to_utc_iso(self.updated_at),
        }


class FieldTripPostAttachment(db.Model):
    __tablename__ = 'field_trip_post_attachments'

    id = db.Column(db.String(120), primary_key=True)
    post_id = db.Column(
        db.String(80),
        db.ForeignKey('field_trip_posts.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    stored_filename = db.Column(db.String(120), nullable=False, unique=True)
    original_name = db.Column(db.String(255), nullable=False)
    mime = db.Column(db.String(120), nullable=False)
    kind = db.Column(db.String(16), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False, default=0)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self, url):
        return {
            'id': self.id,
            'name': self.original_name,
            'size': int(self.size_bytes or 0),
            'url': url,
            'mime': self.mime,
            'kind': self.kind,
        }
