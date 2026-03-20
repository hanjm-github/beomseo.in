"""
Persistent 1~5 score ratings for school meals.
"""
from __future__ import annotations

from datetime import datetime

from .user import db


MEAL_RATING_ID_TYPE = db.BigInteger().with_variant(db.Integer, 'sqlite')


class SchoolMealRating(db.Model):
    __tablename__ = 'school_meal_ratings'

    id = db.Column(MEAL_RATING_ID_TYPE, primary_key=True, autoincrement=True)
    meal_date = db.Column(db.Date, nullable=False, index=True)
    category = db.Column(db.String(32), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    voter_key = db.Column(db.String(64), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        db.UniqueConstraint(
            'meal_date',
            'category',
            'voter_key',
            name='uq_school_meal_ratings_date_category_voter',
        ),
        db.Index('ix_school_meal_ratings_date_category', 'meal_date', 'category'),
        db.CheckConstraint('score >= 1 AND score <= 5', name='ck_school_meal_ratings_score_range'),
    )
