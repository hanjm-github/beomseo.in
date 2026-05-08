"""
BOSPI graph, prediction, and scoring models.
"""
from datetime import datetime, timedelta, timezone
from enum import Enum
from sqlalchemy.schema import UniqueConstraint

from .user import db


KST = timezone(timedelta(hours=9))
# Keep the reward centralized so the API payload, evaluation, and UI label
# cannot drift when the point policy changes.
BOSPI_REWARD_POINTS = 100


class BospiPredictionDirection(str, Enum):
    """Supported prediction choices."""
    INCREASE = 'increase'
    DECREASE = 'decrease'


def today_kst():
    """Return the current date in Korea Standard Time."""
    return datetime.now(KST).date()


def date_to_iso(value):
    """Serialize date objects as YYYY-MM-DD."""
    return value.isoformat() if value else None


class BospiRecord(db.Model):
    """One official BOSPI ratio for a recorded school date."""
    __tablename__ = 'bospi_records'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    operation_date = db.Column(db.Date, nullable=False, unique=True, index=True)
    uniform_rate = db.Column(db.Float, nullable=False)
    baseline_student_count = db.Column(db.Integer, nullable=True)
    uniformed_student_count = db.Column(db.Integer, nullable=True)
    entered_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    entered_by_role = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    entered_by = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'date': date_to_iso(self.operation_date),
            'ratio': round(float(self.uniform_rate or 0), 4),
            'baselineStudentCount': self.baseline_student_count,
            'uniformedStudentCount': self.uniformed_student_count,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'enteredBy': {
                'id': self.entered_by_id,
                'name': self.entered_by.nickname if self.entered_by else None,
                'role': self.entered_by_role,
            },
        }


class BospiPendingPrediction(db.Model):
    """A user's current prediction for the next official BOSPI record."""
    __tablename__ = 'bospi_pending_predictions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    direction = db.Column(db.Enum(BospiPredictionDirection), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = db.relationship('User')

    __table_args__ = (
        UniqueConstraint('user_id', name='uq_bospi_pending_prediction_user'),
    )

    def to_dict(self):
        direction = self.direction.value if hasattr(self.direction, 'value') else str(self.direction)
        return {
            'id': self.id,
            'targetDate': None,
            'direction': direction,
            'pointsAwarded': 0,
            'isCorrect': None,
            'status': 'pending',
            'evaluatedAt': None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class BospiUserScore(db.Model):
    """A denormalized BOSPI score projection for one user."""
    __tablename__ = 'bospi_user_scores'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    total_score = db.Column(db.Integer, nullable=False, default=0)
    correct_count = db.Column(db.Integer, nullable=False, default=0)
    incorrect_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = db.relationship('User')

    __table_args__ = (
        UniqueConstraint('user_id', name='uq_bospi_user_score_user'),
        # Ranking reads sort by these fields on every state response, so keep
        # the projection indexed in the same priority order used by the route.
        db.Index(
            'ix_bospi_user_scores_ranking',
            'total_score',
            'correct_count',
            'incorrect_count',
            'user_id',
        ),
    )

    def to_score_dict(self):
        return {
            'userId': self.user_id,
            'nickname': self.user.nickname if self.user else None,
            'totalScore': int(self.total_score or 0),
            'correctCount': int(self.correct_count or 0),
            'incorrectCount': int(self.incorrect_count or 0),
        }


class BospiPrediction(db.Model):
    """A user's materialized and evaluated prediction for one BOSPI date."""
    __tablename__ = 'bospi_predictions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    target_date = db.Column(db.Date, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    direction = db.Column(db.Enum(BospiPredictionDirection), nullable=False)
    points_awarded = db.Column(db.Integer, nullable=False, default=0)
    is_correct = db.Column(db.Boolean, nullable=True)
    evaluated_at = db.Column(db.DateTime, nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = db.relationship('User')

    __table_args__ = (
        UniqueConstraint('target_date', 'user_id', name='uq_bospi_prediction_target_user'),
    )

    def status(self):
        """Return a compact status label for UI rendering."""
        if self.evaluated_at is None:
            return 'pending'
        if self.is_correct is True:
            return 'correct'
        if self.is_correct is False:
            return 'incorrect'
        return 'tie'

    def to_dict(self):
        direction = self.direction.value if hasattr(self.direction, 'value') else str(self.direction)
        return {
            'id': self.id,
            'targetDate': date_to_iso(self.target_date),
            'direction': direction,
            'pointsAwarded': int(self.points_awarded or 0),
            'isCorrect': self.is_correct,
            'status': self.status(),
            'evaluatedAt': self.evaluated_at.isoformat() if self.evaluated_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }
