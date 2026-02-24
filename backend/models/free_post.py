"""
Free (community) board models with approval workflow.
"""
from datetime import datetime
from enum import Enum
from html import unescape
import re
from sqlalchemy.schema import UniqueConstraint

from .user import db


_HTML_TAG_RE = re.compile(r'<[^>]+>')
_WHITESPACE_RE = re.compile(r'\s+')


class FreeCategory(str, Enum):
    CHAT = 'chat'
    INFO = 'info'
    QNA = 'qna'


class FreeStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'


class FreeReactionType(str, Enum):
    LIKE = 'like'
    DISLIKE = 'dislike'


class FreeReaction(db.Model):
    __tablename__ = 'free_reactions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey('free_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    type = db.Column(db.Enum(FreeReactionType), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_free_post_user_reaction'),
    )


class FreeBookmark(db.Model):
    __tablename__ = 'free_bookmarks'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey('free_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_free_post_user_bookmark'),
    )


class FreeComment(db.Model):
    __tablename__ = 'free_comments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey('free_posts.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    user = db.relationship('User', backref=db.backref('free_comments', lazy='dynamic'))

    def to_dict(self):
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


class FreePost(db.Model):
    """Free-board post with moderation, reactions, comments, and bookmarks."""
    __tablename__ = 'free_posts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category = db.Column(db.Enum(FreeCategory), nullable=False, index=True)
    status = db.Column(db.Enum(FreeStatus), nullable=False, default=FreeStatus.PENDING, index=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    summary = db.Column(db.String(255), nullable=True)
    views = db.Column(db.Integer, default=0, nullable=False)
    like_count = db.Column(db.Integer, default=0, nullable=False)
    dislike_count = db.Column(db.Integer, default=0, nullable=False)
    comments_count = db.Column(db.Integer, default=0, nullable=False)
    bookmarked_count = db.Column(db.Integer, default=0, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('free_posts', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    reactions = db.relationship(
        FreeReaction,
        backref='post',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )
    comments = db.relationship(
        FreeComment,
        backref='post',
        cascade='all, delete-orphan',
        lazy='dynamic',
        order_by='FreeComment.created_at.asc()'
    )
    bookmarks = db.relationship(
        FreeBookmark,
        backref='post',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )

    @staticmethod
    def summarize(body: str) -> str:
        """Build plain-text summary from rich-text body for list cards."""
        if not body:
            return ''
        no_tags = _HTML_TAG_RE.sub(' ', body)
        plain = unescape(no_tags).replace('\xa0', ' ')
        plain = _WHITESPACE_RE.sub(' ', plain).strip()
        if len(plain) > 240:
            return plain[:240] + '…'
        return plain

    def to_dict(self, my_reaction=None, bookmarked=False):
        """Detail serializer for free-board endpoints."""
        return {
            'id': self.id,
            'title': self.title,
            'body': self.body,
            'summary': self.summary,
            'category': self.category.value if self.category else None,
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
            'attachments': [],
            'myReaction': my_reaction,
            'bookmarked': bookmarked,
        }

    def to_list_dict(self, my_reaction=None, bookmarked=False):
        """Compact serializer used by free-board list APIs."""
        summary_source = self.summary or self.body or ''
        safe_summary = FreePost.summarize(summary_source)
        return {
            'id': self.id,
            'title': self.title,
            'summary': safe_summary,
            'category': self.category.value if self.category else None,
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
            'attachmentsCount': 0,
            'myReaction': my_reaction,
            'bookmarked': bookmarked,
        }


def apply_free_filters(query, category=None, status=None, query_text=None, mine=None, bookmarked=None, user_id=None):
    """Reusable filter helper for free-board query composition."""
    query = query.filter(FreePost.deleted_at.is_(None))
    if category in {FreeCategory.CHAT.value, FreeCategory.CHAT}:
        query = query.filter(FreePost.category == FreeCategory.CHAT)
    elif category in {FreeCategory.INFO.value, FreeCategory.INFO}:
        query = query.filter(FreePost.category == FreeCategory.INFO)
    elif category in {FreeCategory.QNA.value, FreeCategory.QNA}:
        query = query.filter(FreePost.category == FreeCategory.QNA)

    if status in {FreeStatus.PENDING.value, FreeStatus.PENDING}:
        query = query.filter(FreePost.status == FreeStatus.PENDING)
    elif status in {FreeStatus.APPROVED.value, FreeStatus.APPROVED}:
        query = query.filter(FreePost.status == FreeStatus.APPROVED)

    if query_text:
        pattern = f"%{query_text}%"
        query = query.filter(
            db.or_(
                FreePost.title.ilike(pattern),
                FreePost.body.ilike(pattern),
                FreePost.summary.ilike(pattern)
            )
        )
    if mine and user_id:
        query = query.filter(FreePost.author_id == user_id)
    if bookmarked and user_id:
        query = query.join(FreeBookmark).filter(FreeBookmark.user_id == user_id)
    return query


def apply_free_sort(query, sort_key: str):
    """Reusable sort helper for free-board listing order."""
    if sort_key == 'comments':
        return query.order_by(FreePost.comments_count.desc(), FreePost.created_at.desc())
    if sort_key == 'likes':
        return query.order_by(FreePost.like_count.desc(), FreePost.created_at.desc())
    return query.order_by(FreePost.created_at.desc())
