"""
Club recruit (동아리 모집) models with approval workflow.
"""
from datetime import datetime, date
from enum import Enum

from .user import db, UserRole


class GradeGroup(str, Enum):
    LOWER = 'lower'  # 1·2학년
    UPPER = 'upper'  # 3학년


class RecruitStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'


class ClubRecruit(db.Model):
    """Club recruitment post with approval workflow metadata."""
    __tablename__ = 'club_recruits'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    club_name = db.Column(db.String(120), nullable=False)
    field = db.Column(db.String(120), nullable=False)
    grade_group = db.Column(db.Enum(GradeGroup), nullable=False, index=True)
    apply_start = db.Column(db.Date, nullable=False)
    apply_end = db.Column(db.Date, nullable=True)
    apply_link = db.Column(db.String(500), nullable=True)
    extra_note = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=True)
    poster_url = db.Column(db.String(500), nullable=True)
    status = db.Column(db.Enum(RecruitStatus), nullable=False, default=RecruitStatus.PENDING, index=True)
    views = db.Column(db.Integer, default=0, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('club_recruits', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self, include_body=True):
        """
        Serialize recruit post in frontend contract shape (camelCase keys).

        `include_body=False` is used by list APIs to reduce payload size.
        """
        return {
            'id': self.id,
            'clubName': self.club_name,
            'field': self.field,
            'gradeGroup': self.grade_group.value if self.grade_group else None,
            'applyPeriod': {
                'start': self.apply_start.isoformat() if self.apply_start else None,
                'end': self.apply_end.isoformat() if self.apply_end else None,
            },
            'applyLink': self.apply_link,
            'extraNote': self.extra_note,
            'body': self.body if include_body else None,
            'posterUrl': self.poster_url,
            'status': self.status.value if self.status else None,
            'views': self.views,
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
        }

    def to_list_dict(self):
        return self.to_dict(include_body=False)

    @staticmethod
    def normalize_date(value):
        """Parse relaxed date inputs (`YYYY-MM-DD` or datetime-like strings)."""
        if not value:
            return None
        if isinstance(value, date):
            return value
        try:
            return date.fromisoformat(value)
        except Exception:
            try:
                # Accept datetime-like strings "YYYY-MM-DDTHH:MM:SSZ"
                return date.fromisoformat(str(value)[:10])
            except Exception:
                return None
