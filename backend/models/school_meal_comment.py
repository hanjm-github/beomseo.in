"""Flask-SQLAlchemy model for private school meal opinions."""
from datetime import datetime

from .user import db


MEAL_COMMENT_ID_TYPE = db.BigInteger().with_variant(db.Integer, 'sqlite')


class SchoolMealComment(db.Model):
    __tablename__ = 'school_meal_comments'

    id = db.Column(MEAL_COMMENT_ID_TYPE, primary_key=True, autoincrement=True)
    meal_date = db.Column(db.Date, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)
    # Unused legacy moderation columns are retained for schema compatibility only.
    # Private meal opinions no longer use approval status for visibility or workflow.
    approval_status = db.Column(db.String(16), nullable=False, default='pending', index=True)
    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)

    user = db.relationship(
        'User',
        foreign_keys=[user_id],
        backref=db.backref('school_meal_comments', lazy='dynamic'),
    )
    approved_by = db.relationship('User', foreign_keys=[approved_by_id])

    __table_args__ = (
        db.CheckConstraint(
            "approval_status IN ('pending', 'approved')",
            name='ck_school_meal_comments_approval_status',
        ),
        # Legacy indexes are retained with the unchanged schema; current reads key on date/deleted rows.
        db.Index(
            'ix_school_meal_comments_date_status_created',
            'meal_date',
            'approval_status',
            'deleted_at',
            'created_at',
        ),
        db.Index(
            'ix_school_meal_comments_date_user_status',
            'meal_date',
            'user_id',
            'approval_status',
        ),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'mealDate': self.meal_date.isoformat() if self.meal_date else None,
            'body': self.body,
            'userId': self.user_id,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
