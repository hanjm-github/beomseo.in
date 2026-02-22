"""
Subject change (선택과목 변경) models with approval, likes, comments.
"""
from datetime import datetime
from enum import Enum

from .user import db, UserRole, User


class MatchStatus(str, Enum):
    OPEN = 'open'
    NEGOTIATING = 'negotiating'
    MATCHED = 'matched'


class ApprovalStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'


class ContactType(str, Enum):
    KAKAO = 'kakao'
    EMAIL = 'email'
    URL = 'url'
    STUDENT_ID = 'student_id'
    EXTRA = 'extra'


class SubjectChange(db.Model):
    """Subject-change listing with approval and match-state workflow."""
    __tablename__ = 'subject_changes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    grade = db.Column(db.Integer, nullable=False, index=True)
    class_name = db.Column(db.String(20), nullable=True)
    offering_subject = db.Column(db.String(120), nullable=False)
    requesting_subject = db.Column(db.String(120), nullable=False)
    note = db.Column(db.Text, nullable=True)
    contact_links = db.Column(db.JSON, nullable=True)
    status = db.Column(db.Enum(MatchStatus), nullable=False, default=MatchStatus.OPEN, index=True)
    approval_status = db.Column(db.Enum(ApprovalStatus), nullable=False, default=ApprovalStatus.PENDING, index=True)
    views = db.Column(db.Integer, default=0, nullable=False)
    like_count = db.Column(db.Integer, default=0, nullable=False)
    comment_count = db.Column(db.Integer, default=0, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('subject_changes', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self, include_note=True):
        """Serialize board item for detail/list responses."""
        return {
            'id': self.id,
            'grade': self.grade,
            'className': self.class_name,
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'authorNickname': self.author.nickname if self.author else None,
            'offeringSubject': self.offering_subject,
            'requestingSubject': self.requesting_subject,
            'status': self.status.value if self.status else None,
            'approvalStatus': self.approval_status.value if self.approval_status else None,
            'note': self.note if include_note else None,
            'contactLinks': self.contact_links or [],
            'commentCount': self.comment_count,
            'views': self.views,
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'approvedBy': {
                'id': self.approved_by_id,
                'name': self.approved_by.nickname if self.approved_by else None,
                'role': self.approved_by.role.value if self.approved_by else None,
            } if self.approved_by_id else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_list_dict(self):
        return self.to_dict(include_note=True)


class SubjectChangeLike(db.Model):
    __tablename__ = 'subject_change_likes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    subject_change_id = db.Column(db.Integer, db.ForeignKey('subject_changes.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Enforces one like per user per subject-change item.
    __table_args__ = (
        db.UniqueConstraint('subject_change_id', 'user_id', name='uq_subject_change_like'),
    )


class SubjectChangeComment(db.Model):
    __tablename__ = 'subject_change_comments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    subject_change_id = db.Column(db.Integer, db.ForeignKey('subject_changes.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    user = db.relationship('User', backref=db.backref('subject_change_comments', lazy='dynamic'))

    def to_dict(self):
        """Serialize subject-change comment payload."""
        return {
            'id': self.id,
            'postId': self.subject_change_id,
            'body': self.body,
            'author': {
                'id': self.user_id,
                'name': self.user.nickname if self.user else None,
                'role': self.user.role.value if self.user else None,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
