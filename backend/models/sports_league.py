"""
Sports league live text domain models.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.schema import UniqueConstraint

from .user import db


KST = timezone(timedelta(hours=9))


def _to_utc_iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace('+00:00', 'Z')


def _to_kst_iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=KST)
    else:
        value = value.astimezone(KST)
    return value.isoformat()


def _load_json_list(raw_value):
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


class SportsLeagueCategory(db.Model):
    __tablename__ = 'sports_league_categories'

    id = db.Column(db.String(120), primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    subtitle = db.Column(db.String(160), nullable=False)
    season_label = db.Column(db.String(60), nullable=False)
    grade_label = db.Column(db.String(60), nullable=False)
    sport_label = db.Column(db.String(60), nullable=False)
    status_note = db.Column(db.String(255), nullable=False)
    schedule_window_label = db.Column(db.String(120), nullable=False)
    match_time_label = db.Column(db.String(160), nullable=False)
    broadcast_label = db.Column(db.String(160), nullable=False)
    location_label = db.Column(db.String(120), nullable=False)
    rules_format_json = db.Column(db.Text, nullable=False, default='[]')
    rules_points_json = db.Column(db.Text, nullable=False, default='[]')
    rules_ranking_json = db.Column(db.Text, nullable=False, default='[]')
    rules_notes_json = db.Column(db.Text, nullable=False, default='[]')
    storage_version = db.Column(db.String(32), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    teams = db.relationship(
        'SportsLeagueTeam',
        backref='category',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='SportsLeagueTeam.display_order.asc()',
    )
    matches = db.relationship(
        'SportsLeagueMatch',
        backref='category',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='SportsLeagueMatch.display_order.asc()',
    )

    def rules_dict(self):
        return {
            'format': _load_json_list(self.rules_format_json),
            'points': _load_json_list(self.rules_points_json),
            'ranking': _load_json_list(self.rules_ranking_json),
            'notes': _load_json_list(self.rules_notes_json),
        }

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'subtitle': self.subtitle,
            'seasonLabel': self.season_label,
            'gradeLabel': self.grade_label,
            'sportLabel': self.sport_label,
            'statusNote': self.status_note,
            'scheduleWindowLabel': self.schedule_window_label,
            'matchTimeLabel': self.match_time_label,
            'broadcastLabel': self.broadcast_label,
            'locationLabel': self.location_label,
        }


class SportsLeagueTeam(db.Model):
    __tablename__ = 'sports_league_teams'

    id = db.Column(db.String(120), primary_key=True)
    category_id = db.Column(
        db.String(120),
        db.ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(120), nullable=False)
    short_name = db.Column(db.String(120), nullable=False)
    group_key = db.Column(db.String(8), nullable=False, index=True)
    tone = db.Column(db.String(32), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'shortName': self.short_name,
            'group': self.group_key,
            'tone': self.tone,
        }


class SportsLeagueMatch(db.Model):
    __tablename__ = 'sports_league_matches'

    id = db.Column(db.String(120), primary_key=True)
    category_id = db.Column(
        db.String(120),
        db.ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    phase = db.Column(db.String(20), nullable=False)
    stage_label = db.Column(db.String(120), nullable=False)
    group_key = db.Column(db.String(8), nullable=False, index=True)
    week_label = db.Column(db.String(32), nullable=False)
    kickoff_at = db.Column(db.DateTime, nullable=False, index=True)
    team_a_id = db.Column(db.String(120), nullable=False)
    team_b_id = db.Column(db.String(120), nullable=False)
    default_status = db.Column(db.String(20), nullable=False, default='upcoming')
    status = db.Column(db.String(20), nullable=False, default='upcoming')
    score_team_a = db.Column(db.Integer, nullable=False, default=0)
    score_team_b = db.Column(db.Integer, nullable=False, default=0)
    winner_team_id = db.Column(db.String(120), nullable=True)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    events = db.relationship(
        'SportsLeagueEvent',
        backref='match',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )

    def to_dict(self, *, team_a_id=None, team_b_id=None):
        return {
            'id': self.id,
            'phase': self.phase,
            'stageLabel': self.stage_label,
            'group': self.group_key,
            'weekLabel': self.week_label,
            'kickoffAt': _to_kst_iso(self.kickoff_at),
            'teamAId': team_a_id or self.team_a_id,
            'teamBId': team_b_id or self.team_b_id,
            'status': self.status,
            'score': {
                'teamA': int(self.score_team_a or 0),
                'teamB': int(self.score_team_b or 0),
            },
            'winnerTeamId': self.winner_team_id,
        }


class SportsLeagueEvent(db.Model):
    __tablename__ = 'sports_league_events'

    id = db.Column(db.String(80), primary_key=True)
    category_id = db.Column(
        db.String(120),
        db.ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    match_id = db.Column(
        db.String(120),
        db.ForeignKey('sports_league_matches.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    event_type = db.Column(db.String(32), nullable=False)
    minute = db.Column(db.Integer, nullable=True)
    message = db.Column(db.String(240), nullable=False)
    subject_team_id = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(20), nullable=False)
    score_team_a = db.Column(db.Integer, nullable=False, default=0)
    score_team_b = db.Column(db.Integer, nullable=False, default=0)
    winner_team_id = db.Column(db.String(120), nullable=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    author_role = db.Column(db.String(50), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    deleted_at = db.Column(db.DateTime, nullable=True, index=True)

    author = db.relationship('User')

    def to_dict(self):
        # Public feeds only expose the operator nickname to avoid leaking role or audit metadata.
        return {
            'id': self.id,
            'matchId': self.match_id,
            'eventType': self.event_type,
            'minute': self.minute,
            'message': self.message,
            'scoreSnapshot': {
                'teamA': int(self.score_team_a or 0),
                'teamB': int(self.score_team_b or 0),
            },
            'createdAt': _to_utc_iso(self.created_at),
            'updatedAt': _to_utc_iso(self.updated_at),
            'author': {
                'nickname': self.author.nickname if self.author else None,
            },
            'subjectTeamId': self.subject_team_id,
            'status': self.status,
            'winnerTeamId': self.winner_team_id,
        }


class SportsLeagueStandingOverride(db.Model):
    __tablename__ = 'sports_league_standing_overrides'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category_id = db.Column(
        db.String(120),
        db.ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    group_key = db.Column(db.String(8), nullable=False, index=True)
    team_id = db.Column(db.String(120), nullable=False)
    rank = db.Column(db.Integer, nullable=False)
    points = db.Column(db.Integer, nullable=False, default=0)
    goal_difference = db.Column(db.Integer, nullable=False, default=0)
    goals_for = db.Column(db.Integer, nullable=False, default=0)
    goals_against = db.Column(db.Integer, nullable=False, default=0)
    wins = db.Column(db.Integer, nullable=False, default=0)
    draws = db.Column(db.Integer, nullable=False, default=0)
    losses = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Official manual standings must stay unique both by team and by final rank.
    __table_args__ = (
        UniqueConstraint('category_id', 'group_key', 'team_id', name='uq_sports_league_override_team'),
        UniqueConstraint('category_id', 'group_key', 'rank', name='uq_sports_league_override_rank'),
    )

    def to_dict(self):
        return {
            'teamId': self.team_id,
            'rank': int(self.rank or 0),
            'points': int(self.points or 0),
            'goalDifference': int(self.goal_difference or 0),
            'goalsFor': int(self.goals_for or 0),
            'goalsAgainst': int(self.goals_against or 0),
            'wins': int(self.wins or 0),
            'draws': int(self.draws or 0),
            'losses': int(self.losses or 0),
            'note': self.note or '',
        }
