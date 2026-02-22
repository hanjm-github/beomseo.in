"""
Countdown event model for main page widget.
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


class CountdownEvent(db.Model):
    """Main-page countdown schedule entity."""
    __tablename__ = 'countdown_events'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    event_name = db.Column(db.String(200), nullable=False)
    event_at = db.Column(db.DateTime, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    def _event_at_kst(self):
        """Normalize stored datetime into KST for frontend consumption."""
        if not self.event_at:
            return None
        if self.event_at.tzinfo is None:
            return self.event_at.replace(tzinfo=KST)
        return self.event_at.astimezone(KST)

    def to_dict(self):
        """Serialize event using camelCase fields expected by frontend."""
        event_at_kst = self._event_at_kst()
        return {
            'id': self.id,
            'eventName': self.event_name,
            'eventAt': event_at_kst.isoformat() if event_at_kst else None,
        }
