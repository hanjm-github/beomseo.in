"""
Survey exchange models: Survey, SurveyResponse, SurveyCredit.
"""
from datetime import datetime, date
from enum import Enum

from sqlalchemy import UniqueConstraint

from .user import db


class SurveyStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'


class Survey(db.Model):
    """Survey aggregate with approval gate and response quota accounting."""
    __tablename__ = 'surveys'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    summary = db.Column(db.String(300), nullable=True)
    form_json = db.Column(db.JSON, nullable=False)
    status = db.Column(db.Enum(SurveyStatus), nullable=False, default=SurveyStatus.PENDING, index=True)
    responses_received = db.Column(db.Integer, nullable=False, default=0)
    expires_at = db.Column(db.Date, nullable=True, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    owner_role = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    owner = db.relationship('User', foreign_keys=[owner_id], backref=db.backref('surveys', lazy='dynamic'))

    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])
    approved_at = db.Column(db.DateTime, nullable=True)

    credit_granted = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def status_derived(self, quota_available: int = None):
        """Compute open/closed status based on approval, expiration, and quota."""
        if self.status != SurveyStatus.APPROVED:
            return 'closed'
        if self.expires_at and isinstance(self.expires_at, date):
            # 마감일 당일을 포함하여 종료
            if self.expires_at <= date.today():
                return 'closed'
        if quota_available is not None:
            if quota_available <= (self.responses_received or 0):
                return 'closed'
        return 'open'

    def to_dict(
        self,
        include_form: bool = True,
        include_body: bool = True,
        is_answered: bool = False,
        quota_available: int = None,
    ):
        """Detail serializer for survey endpoints (camelCase frontend contract)."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description if include_body else None,
            'summary': self.summary,
            'formJson': self.form_json if include_form else None,
            'responsesReceived': self.responses_received,
            'responseQuota': quota_available,
            'expiresAt': self.expires_at.isoformat() if self.expires_at else None,
            'approvalStatus': self.status.value if self.status else None,
            'owner': {
                'id': self.owner_id,
                'name': self.owner.nickname if self.owner else None,
                'role': self.owner_role,
            },
            'status': self.status_derived(quota_available),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'isAnsweredByMe': is_answered,
        }

    def to_list_dict(
        self,
        is_answered: bool = False,
        quota_available: int = None,
    ):
        return self.to_dict(
            include_form=False,
            include_body=False,
            is_answered=is_answered,
            quota_available=quota_available,
        )


class SurveyResponse(db.Model):
    __tablename__ = 'survey_responses'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=False, index=True)
    respondent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    answers = db.Column(db.JSON, nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    survey = db.relationship('Survey', backref=db.backref('responses', lazy='dynamic'))
    respondent = db.relationship('User')

    # One respondent can submit only one response per survey.
    __table_args__ = (
        UniqueConstraint('survey_id', 'respondent_id', name='uq_survey_response_unique'),
    )

    def to_raw_dict(self):
        return {
            'id': self.id,
            'submittedAt': self.submitted_at.isoformat() if self.submitted_at else None,
            'answers': self.answers,
        }


class SurveyCredit(db.Model):
    """Per-user credit ledger shared by survey and vote features."""
    __tablename__ = 'survey_credits'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    base = db.Column(db.Integer, nullable=False, default=0)
    earned = db.Column(db.Integer, nullable=False, default=0)
    used = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = db.relationship('User')

    @property
    def available(self):
        """Available credits = base + earned - used."""
        return (self.base or 0) + (self.earned or 0) - (self.used or 0)

    def consume(self, amount: int = 1):
        """Increase used credits by non-negative amount."""
        if amount < 0:
            amount = 0
        self.used = (self.used or 0) + amount

    def earn(self, amount: int = 1):
        """Increase earned credits by non-negative amount."""
        if amount < 0:
            amount = 0
        self.earned = (self.earned or 0) + amount
