"""
Notice and Attachment models for school / student council announcements.
"""
from datetime import datetime
from enum import Enum
import re
from sqlalchemy import func
from sqlalchemy.schema import UniqueConstraint

from .user import db, User, UserRole


class NoticeCategory(str, Enum):
    SCHOOL = 'school'
    COUNCIL = 'council'


class Attachment(db.Model):
    __tablename__ = 'attachments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    notice_id = db.Column(db.Integer, db.ForeignKey('notices.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    mime = db.Column(db.String(128), nullable=True)
    size = db.Column(db.Integer, nullable=True)
    kind = db.Column(db.String(20), nullable=True)  # file | image
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'mime': self.mime,
            'size': self.size,
            'kind': self.kind,
        }


class ReactionType(str, Enum):
    LIKE = 'like'
    DISLIKE = 'dislike'


class NoticeReaction(db.Model):
    __tablename__ = 'notice_reactions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    notice_id = db.Column(db.Integer, db.ForeignKey('notices.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    type = db.Column(db.Enum(ReactionType), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('notice_id', 'user_id', name='uq_notice_user_reaction'),
    )


class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    notice_id = db.Column(db.Integer, db.ForeignKey('notices.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    user = db.relationship('User', backref=db.backref('comments', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'noticeId': self.notice_id,
            'body': self.body,
            'author': {
                'id': self.user_id,
                'name': self.user.nickname if self.user else None,
                'role': self.user.role.value if self.user else None,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class Notice(db.Model):
    __tablename__ = 'notices'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category = db.Column(db.Enum(NoticeCategory), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    summary = db.Column(db.String(255), nullable=True)
    pinned = db.Column(db.Boolean, default=False, nullable=False)
    important = db.Column(db.Boolean, default=False, nullable=False)
    exam_related = db.Column(db.Boolean, default=False, nullable=False)
    tags = db.Column(db.Text, nullable=True)  # comma-separated
    views = db.Column(db.Integer, default=0, nullable=False)
    like_count = db.Column(db.Integer, default=0, nullable=False)
    dislike_count = db.Column(db.Integer, default=0, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', backref=db.backref('notices', lazy='dynamic'))

    reactions = db.relationship(
        'NoticeReaction',
        backref='notice',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )
    comments = db.relationship(
        'Comment',
        backref='notice',
        cascade='all, delete-orphan',
        lazy='dynamic',
        order_by='Comment.created_at.asc()'
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    attachments = db.relationship(
        'Attachment',
        backref='notice',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='Attachment.id.asc()'
    )

    @staticmethod
    def summarize(body: str) -> str:
        if not body:
            return ''
        text = body.replace('<', ' <').split()
        plain = ' '.join(text)
        if len(plain) > 240:
            return plain[:240] + '…'
        return plain

    def tags_list(self):
        return [t.strip() for t in (self.tags or '').split(',') if t.strip()]

    def to_dict(self, my_reaction=None):
        role_alias = 'council' if self.author_role == UserRole.STUDENT_COUNCIL.value else self.author_role
        return {
            'id': self.id,
            'category': self.category.value if self.category else None,
            'title': self.title,
            'summary': self.summary,
            'pinned': self.pinned,
            'important': self.important,
            'examRelated': self.exam_related,
            'tags': self.tags_list(),
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
                'role_alias': role_alias
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': self.views,
            'attachments': [a.to_dict() for a in self.attachments],
            'body': self.body,
            'deletedAt': self.deleted_at.isoformat() if self.deleted_at else None,
            'likes': self.like_count,
            'dislikes': self.dislike_count,
            'myReaction': my_reaction,
        }

    def to_list_dict(self, my_reaction=None):
        role_alias = 'council' if self.author_role == UserRole.STUDENT_COUNCIL.value else self.author_role
        attachments_count = len(self.attachments) if self.attachments is not None else 0
        return {
            'id': self.id,
            'category': self.category.value if self.category else None,
            'title': self.title,
            'summary': self.summary,
            'pinned': self.pinned,
            'important': self.important,
            'examRelated': self.exam_related,
            'tags': self.tags_list(),
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
                'role_alias': role_alias,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'views': self.views,
            'attachmentsCount': attachments_count,
            'likes': self.like_count,
            'dislikes': self.dislike_count,
            'myReaction': my_reaction,
        }


# Helpful scopes
def apply_notice_filters(query, category=None, query_text=None, pinned=None, important=None, exam=None, tags=None):
    query = query.filter(Notice.deleted_at.is_(None))
    if category in {NoticeCategory.SCHOOL.value, NoticeCategory.SCHOOL}:
        query = query.filter(Notice.category == NoticeCategory.SCHOOL)
    elif category in {NoticeCategory.COUNCIL.value, NoticeCategory.COUNCIL}:
        query = query.filter(Notice.category == NoticeCategory.COUNCIL)

    if pinned is not None:
        query = query.filter(Notice.pinned.is_(bool(pinned)))
    if important is not None:
        query = query.filter(Notice.important.is_(bool(important)))
    if exam is not None:
        query = query.filter(Notice.exam_related.is_(bool(exam)))

    if query_text:
        pattern = f"%{query_text}%"
        query = query.filter(
            db.or_(
                Notice.title.ilike(pattern),
                Notice.body.ilike(pattern),
                Notice.summary.ilike(pattern),
                Notice.tags.ilike(pattern),
            )
        )
    if tags:
        if isinstance(tags, str):
            tags = [t.strip() for t in re.split(r'[,\n;，]+', tags) if t.strip()]
        if tags:
            for tag in tags:
                query = query.filter(Notice.tags.ilike(f"%{tag}%"))
    return query


def apply_notice_sort(query, sort_key: str):
    if sort_key == 'views':
        return query.order_by(Notice.views.desc(), Notice.created_at.desc())
    if sort_key == 'important':
        return query.order_by(Notice.important.desc(), Notice.pinned.desc(), Notice.created_at.desc())
    return query.order_by(Notice.created_at.desc())
