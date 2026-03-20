"""
PWA meal reminder subscriptions keyed by installed device.
"""
from __future__ import annotations

from datetime import datetime

from .user import db


MEAL_NOTIFICATION_ID_TYPE = db.BigInteger().with_variant(db.Integer, 'sqlite')


class SchoolMealNotificationSubscription(db.Model):
    __tablename__ = 'school_meal_notification_subscriptions'

    id = db.Column(MEAL_NOTIFICATION_ID_TYPE, primary_key=True, autoincrement=True)
    installation_id = db.Column(db.String(64), nullable=False, unique=True, index=True)
    fcm_token = db.Column(db.String(512), nullable=True, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    timezone = db.Column(db.String(64), nullable=False, default='Asia/Seoul')
    notification_minute_of_day = db.Column(db.Integer, nullable=False, default=450)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)
    last_sent_meal_date = db.Column(db.Date, nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        db.Index(
            'ix_school_meal_notification_enabled_minute',
            'is_enabled',
            'notification_minute_of_day',
        ),
        db.CheckConstraint(
            'notification_minute_of_day >= 0 AND notification_minute_of_day <= 1439',
            name='ck_school_meal_notification_minute_range',
        ),
        db.CheckConstraint(
            'notification_minute_of_day % 5 = 0',
            name='ck_school_meal_notification_minute_step',
        ),
    )
