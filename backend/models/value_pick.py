"""
Value Pick board models with approval workflow.
"""
from datetime import datetime
from enum import Enum
from html import unescape
import re
from sqlalchemy.schema import UniqueConstraint

from .user import db


_HTML_TAG_RE = re.compile(r'<[^>]+>')
_WHITESPACE_RE = re.compile(r'\s+')


class ValuePickStatus(str, Enum):
    """Moderation lifecycle for Value Pick posts."""
    PENDING = 'pending'
    APPROVED = 'approved'


class ValuePickReactionType(str, Enum):
    """Supported reaction types for the board."""
    LIKE = 'like'
    DISLIKE = 'dislike'


class ValuePickReaction(db.Model):
    """One reaction per user per post, enforced by a unique constraint."""
    __tablename__ = 'value_pick_reactions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(
        db.Integer,
        db.ForeignKey('value_pick_posts.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    type = db.Column(db.Enum(ValuePickReactionType), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_value_pick_post_user_reaction'),
    )


class ValuePickComment(db.Model):
    """Comment entity for Value Pick detail pages."""
    __tablename__ = 'value_pick_comments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(
        db.Integer,
        db.ForeignKey('value_pick_posts.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    body = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    user = db.relationship('User', backref=db.backref('value_pick_comments', lazy='dynamic'))

    def to_dict(self):
        """Serialize one comment using the camelCase contract expected by the SPA."""
        return {
            'id': self.id,
            'postId': self.post_id,
            'body': self.body,
            'author': {
                'id': self.user_id,
                'name': self.user.nickname if self.user else None,
                'role': self.user.role.value if self.user else None,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class ValuePickPost(db.Model):
    """Value Pick post with moderation, reactions, and comments."""

    __tablename__ = 'value_pick_posts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    competency = db.Column(db.String(50), nullable=False, index=True)
    pledge = db.Column(db.String(180), nullable=False)
    body = db.Column(db.Text, nullable=False, default='')
    status = db.Column(db.Enum(ValuePickStatus), nullable=False, default=ValuePickStatus.PENDING, index=True)
    views = db.Column(db.Integer, default=0, nullable=False)
    like_count = db.Column(db.Integer, default=0, nullable=False)
    dislike_count = db.Column(db.Integer, default=0, nullable=False)
    comments_count = db.Column(db.Integer, default=0, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('value_pick_posts', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    reactions = db.relationship(
        ValuePickReaction,
        backref='post',
        cascade='all, delete-orphan',
        lazy='dynamic',
    )
    comments = db.relationship(
        ValuePickComment,
        backref='post',
        cascade='all, delete-orphan',
        lazy='dynamic',
        order_by='ValuePickComment.created_at.asc()',
    )

    @staticmethod
    def summarize_body(body: str, max_length: int = 180) -> str:
        """Create the plain-text preview used by list cards from rich HTML body content."""
        if not body:
            return ''
        no_tags = _HTML_TAG_RE.sub(' ', body)
        plain = unescape(no_tags).replace('\xa0', ' ')
        plain = _WHITESPACE_RE.sub(' ', plain).strip()
        if len(plain) > max_length:
            return plain[:max_length].rstrip() + '...'
        return plain

    def to_dict(self, my_reaction=None):
        # The board does not currently persist attachment rows, but the frontend
        # expects the same shape as other post serializers.
        return {
            'id': self.id,
            'competency': self.competency,
            'pledge': self.pledge,
            'body': self.body or '',
            'status': self.status.value if self.status else None,
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'approvedBy': {
                'id': self.approved_by_id,
                'name': self.approved_by.nickname if self.approved_by else None,
                'role': self.approved_by.role.value if self.approved_by else None,
            } if self.approved_by_id else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': self.views,
            'likes': self.like_count,
            'dislikes': self.dislike_count,
            'commentsCount': self.comments_count,
            'myReaction': my_reaction,
            'attachments': [],
        }

    def to_list_dict(self, my_reaction=None):
        """Serialize the lightweight list-card representation of a post."""
        return {
            'id': self.id,
            'competency': self.competency,
            'pledge': self.pledge,
            'bodyPreview': self.summarize_body(self.body),
            'status': self.status.value if self.status else None,
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': self.views,
            'likes': self.like_count,
            'dislikes': self.dislike_count,
            'commentsCount': self.comments_count,
            'myReaction': my_reaction,
        }
