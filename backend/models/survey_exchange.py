"""
Survey exchange models for peer-to-peer questionnaire barter.
"""
from datetime import datetime
from sqlalchemy import UniqueConstraint

from .user import db


class SurveyExchange(db.Model):
    __tablename__ = 'survey_exchanges'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(1000), nullable=True)
    form_schema = db.Column(db.JSON, nullable=False)

    base_quota = db.Column(db.Integer, nullable=False, default=10)
    bonus_quota = db.Column(db.Integer, nullable=False, default=0)
    responses_count = db.Column(db.Integer, nullable=False, default=0)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('survey_exchanges', lazy='dynamic'))

    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    responses = db.relationship('SurveyResponse', backref='survey', cascade='all, delete-orphan')

    @property
    def response_limit(self):
        return max(0, (self.base_quota or 0) + (self.bonus_quota or 0))

    @property
    def remaining_slots(self):
        return max(0, self.response_limit - (self.responses_count or 0))

    def to_dict(self, current_user_id=None, has_responded=False):
        mine = bool(current_user_id and self.author_id == current_user_id)
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'formSchema': self.form_schema,
            'baseQuota': self.base_quota,
            'bonusQuota': self.bonus_quota,
            'responseLimit': self.response_limit,
            'responsesCount': self.responses_count,
            'remainingSlots': self.remaining_slots,
            'mine': mine,
            'hasResponded': has_responded,
            'author': {
                'id': self.author_id,
                'nickname': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class SurveyResponse(db.Model):
    __tablename__ = 'survey_responses'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    survey_id = db.Column(db.Integer, db.ForeignKey('survey_exchanges.id'), nullable=False, index=True)
    responder_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    answers = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('survey_id', 'responder_id', name='uq_survey_response_once'),
    )
