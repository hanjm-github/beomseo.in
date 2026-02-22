"""
Petition models (학생 청원) with approval, vote, answer, bookmark support.
"""
from datetime import datetime
from enum import Enum
from sqlalchemy import UniqueConstraint

from .user import db, UserRole


class PetitionStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'


class Petition(db.Model):
    __tablename__ = 'petitions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.String(500), nullable=False)
    body = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # 기타/회장단/3학년부/2학년부/정보기술부/방송부/학예부/체육부/진로부/홍보부/기후환경부/학생지원부/생활안전부/융합인재부
    threshold = db.Column(db.Integer, nullable=False, default=50)
    votes_count = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.Enum(PetitionStatus), nullable=False, default=PetitionStatus.PENDING, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('petitions', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    answer = db.relationship('PetitionAnswer', uselist=False, backref='petition', cascade='all, delete-orphan')
    votes = db.relationship('PetitionVote', backref='petition', cascade='all, delete-orphan')

    def status_derived(self, has_answer=None):
        if has_answer is None:
            has_answer = self.answer is not None
        if has_answer:
            return 'answered'
        if (self.votes_count or 0) >= (self.threshold or 50):
            return 'waiting-answer'
        return 'needs-support'

    def to_dict(self, include_body=True, is_voted_by_me=False):
        return {
            'id': self.id,
            'title': self.title,
            'summary': self.summary,
            'body': self.body if include_body else None,
            'category': self.category,
            'votes': self.votes_count,
            'threshold': self.threshold,
            'status': self.status.value if self.status else None,
            'statusDerived': self.status_derived(),
            'author': {
                'id': self.author_id,
                'nickname': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'approvedBy': {
                'id': self.approved_by_id,
                'nickname': self.approved_by.nickname if self.approved_by else None,
                'role': self.approved_by.role.value if self.approved_by else None,
            } if self.approved_by_id else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'isVotedByMe': is_voted_by_me,
            'answer': self.answer.to_dict() if self.answer else None,
        }

    def to_list_dict(self, is_voted_by_me=False):
        has_answer = self.answer is not None
        return {
            'id': self.id,
            'title': self.title,
            'summary': self.summary,
            'category': self.category,
            'votes': self.votes_count,
            'threshold': self.threshold,
            'status': self.status.value if self.status else None,
            'statusDerived': self.status_derived(has_answer=has_answer),
            'author': {
                'id': self.author_id,
                'nickname': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'approvedAt': self.approved_at.isoformat() if self.approved_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'isVotedByMe': is_voted_by_me,
            'hasAnswer': has_answer,
        }


class PetitionVote(db.Model):
    __tablename__ = 'petition_votes'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    petition_id = db.Column(db.Integer, db.ForeignKey('petitions.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('petition_id', 'user_id', name='uq_petition_vote_unique'),
    )


class PetitionAnswer(db.Model):
    __tablename__ = 'petition_answers'
    petition_id = db.Column(db.Integer, db.ForeignKey('petitions.id'), primary_key=True)
    responder_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    responder = db.relationship('User', foreign_keys=[responder_id])
    role = db.Column(db.String(50), nullable=False, default=UserRole.STUDENT_COUNCIL.value)
    content = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'responder': self.responder.nickname if self.responder else None,
            'role': self.role,
            'content': self.content,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
