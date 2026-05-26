"""
Study With Beomseo scheduled score update model.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .user import db


def resolve_kst_timezone():
    """Resolve Korea timezone with fixed-offset fallback for minimal environments."""
    try:
        return ZoneInfo('Asia/Seoul')
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=9))


KST = resolve_kst_timezone()


def attach_kst(value):
    """Return an aware KST datetime for API serialization."""
    if value is None:
        return None
    # The database stores event times as naive KST wall-clock values, so API
    # serialization reattaches the explicit timezone offset for clients.
    if value.tzinfo is None:
        return value.replace(tzinfo=KST)
    return value.astimezone(KST)


def to_kst_iso(value):
    """Serialize datetime values with an explicit +09:00 offset."""
    value_kst = attach_kst(value)
    return value_kst.isoformat() if value_kst else None


class StudyWithBeomseoScoreUpdate(db.Model):
    """Append-only total score snapshot scheduled for public leaderboard release."""
    __tablename__ = 'study_with_beomseo_score_updates'

    # class_id is denormalized with grade/class_number to keep reads simple
    # while still allowing database-level range checks on each numeric part.
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    class_id = db.Column(db.String(5), nullable=False)
    grade = db.Column(db.Integer, nullable=False)
    class_number = db.Column(db.Integer, nullable=False)
    total_score = db.Column(db.Integer, nullable=False)
    effective_at = db.Column(db.DateTime, nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    created_by_role = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    created_by = db.relationship('User')

    __table_args__ = (
        db.CheckConstraint('grade BETWEEN 1 AND 3', name='ck_swbsu_grade_range'),
        db.CheckConstraint('class_number BETWEEN 1 AND 10', name='ck_swbsu_class_number_range'),
        db.CheckConstraint('total_score BETWEEN 0 AND 1000000', name='ck_swbsu_total_score_range'),
        # Read paths need the newest effective row per class and the future
        # schedule ordered by release time; these indexes support both shapes.
        db.Index(
            'ix_swbsu_class_effective_id',
            'class_id',
            'effective_at',
            'id',
        ),
        db.Index(
            'ix_swbsu_effective_class_id',
            'effective_at',
            'class_id',
            'id',
        ),
    )

    def to_update_dict(self):
        """Serialize a score update using the frontend contract."""
        creator = None
        if self.created_by:
            creator = {
                'id': self.created_by.id,
                'nickname': self.created_by.nickname,
                'role': self.created_by_role,
            }

        return {
            'id': self.id,
            'classId': self.class_id,
            'grade': self.grade,
            'classNumber': self.class_number,
            'label': self.class_id,
            'totalScore': int(self.total_score or 0),
            'effectiveAt': to_kst_iso(self.effective_at),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'createdBy': creator,
        }
