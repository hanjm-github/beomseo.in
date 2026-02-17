"""
Realtime vote board models.
"""
from datetime import datetime
from sqlalchemy import UniqueConstraint

from .user import db


class Vote(db.Model):
    __tablename__ = 'votes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)
    closes_at = db.Column(db.DateTime, nullable=True, index=True)
    total_votes = db.Column(db.Integer, nullable=False, default=0)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('votes', lazy='dynamic'))

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    options = db.relationship(
        'VoteOption',
        backref='vote',
        cascade='all, delete-orphan',
        order_by='VoteOption.display_order',
        lazy='selectin',
    )
    responses = db.relationship(
        'VoteResponse',
        backref='vote',
        cascade='all, delete-orphan',
        lazy='dynamic',
    )

    def status(self, now=None):
        now = now or datetime.utcnow()
        if self.deleted_at:
            return 'closed'
        if self.closes_at and self.closes_at <= now:
            return 'closed'
        return 'open'

    def to_dict(self, my_vote_option_id=None, now=None):
        total = max(0, int(self.total_votes or 0))
        serialized_options = [opt.to_dict(total_votes=total) for opt in self.options]

        return {
            'id': self.id,
            'title': self.title,
            'description': self.description or '',
            'status': self.status(now=now),
            'closesAt': self.closes_at.isoformat() if self.closes_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'author': {
                'id': self.author_id,
                'name': self.author.nickname if self.author else None,
                'role': self.author_role,
            },
            'totalVotes': total,
            'options': serialized_options,
            'myVoteOptionId': my_vote_option_id,
        }


class VoteOption(db.Model):
    __tablename__ = 'vote_options'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vote_id = db.Column(db.Integer, db.ForeignKey('votes.id'), nullable=False, index=True)
    option_key = db.Column(db.String(120), nullable=False)
    text = db.Column(db.String(80), nullable=False)
    votes_count = db.Column(db.Integer, nullable=False, default=0)
    display_order = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint('vote_id', 'option_key', name='uq_vote_option_key_per_vote'),
    )

    def to_dict(self, total_votes=0):
        votes = max(0, int(self.votes_count or 0))
        divisor = max(0, int(total_votes or 0))
        pct = round((votes / divisor) * 100) if divisor > 0 else 0
        return {
            'id': self.option_key,
            'text': self.text,
            'votes': votes,
            'pct': int(pct),
        }


class VoteResponse(db.Model):
    __tablename__ = 'vote_responses'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vote_id = db.Column(db.Integer, db.ForeignKey('votes.id'), nullable=False, index=True)
    option_id = db.Column(db.Integer, db.ForeignKey('vote_options.id'), nullable=False, index=True)
    respondent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    credits_earned = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    option = db.relationship('VoteOption')
    respondent = db.relationship('User')

    __table_args__ = (
        UniqueConstraint('vote_id', 'respondent_id', name='uq_vote_response_unique'),
    )
