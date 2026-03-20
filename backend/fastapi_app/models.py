"""
Standalone SQLAlchemy ORM models for the sports league tables.

Maps to the exact same tables as the Flask app models. Uses pure
SQLAlchemy declarative_base instead of Flask-SQLAlchemy db.Model.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


KST = timezone(timedelta(hours=9))


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# User model (read-only reference for event author lookup)
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    nickname = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default='student')
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


MEAL_ID_TYPE = BigInteger().with_variant(Integer, 'sqlite')


# ---------------------------------------------------------------------------
# Sports League models
# ---------------------------------------------------------------------------

class SportsLeagueCategory(Base):
    __tablename__ = 'sports_league_categories'

    id = Column(String(120), primary_key=True)
    title = Column(String(120), nullable=False)
    subtitle = Column(String(160), nullable=False)
    season_label = Column(String(60), nullable=False)
    grade_label = Column(String(60), nullable=False)
    sport_label = Column(String(60), nullable=False)
    status_note = Column(String(255), nullable=False)
    schedule_window_label = Column(String(120), nullable=False)
    match_time_label = Column(String(160), nullable=False)
    broadcast_label = Column(String(160), nullable=False)
    location_label = Column(String(120), nullable=False)
    rules_format_json = Column(Text, nullable=False, default='[]')
    rules_points_json = Column(Text, nullable=False, default='[]')
    rules_ranking_json = Column(Text, nullable=False, default='[]')
    rules_notes_json = Column(Text, nullable=False, default='[]')
    storage_version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    teams = relationship(
        'SportsLeagueTeam',
        back_populates='category',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='SportsLeagueTeam.display_order.asc()',
    )
    matches = relationship(
        'SportsLeagueMatch',
        back_populates='category',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='SportsLeagueMatch.display_order.asc()',
    )
    # Player rosters are loaded separately from the live-event snapshot so lineup/ranking tabs can evolve independently.
    players = relationship(
        'SportsLeaguePlayer',
        back_populates='category',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='SportsLeaguePlayer.created_at.asc()',
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


class SportsLeagueTeam(Base):
    __tablename__ = 'sports_league_teams'

    id = Column(String(120), primary_key=True)
    category_id = Column(
        String(120),
        ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    short_name = Column(String(120), nullable=False)
    group_key = Column(String(8), nullable=False, index=True)
    tone = Column(String(32), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)

    category = relationship('SportsLeagueCategory', back_populates='teams')
    # Team-level roster access keeps lineup screens from having to stitch players back onto teams manually.
    players = relationship(
        'SportsLeaguePlayer',
        back_populates='team',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='SportsLeaguePlayer.created_at.asc()',
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'shortName': self.short_name,
            'group': self.group_key,
            'tone': self.tone,
            'displayOrder': int(self.display_order or 0),
        }


class SportsLeagueMatch(Base):
    __tablename__ = 'sports_league_matches'

    id = Column(String(120), primary_key=True)
    category_id = Column(
        String(120),
        ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    phase = Column(String(20), nullable=False)
    stage_label = Column(String(120), nullable=False)
    group_key = Column(String(8), nullable=False, index=True)
    week_label = Column(String(32), nullable=False)
    kickoff_at = Column(DateTime, nullable=False, index=True)
    team_a_id = Column(String(120), nullable=False)
    team_b_id = Column(String(120), nullable=False)
    default_status = Column(String(20), nullable=False, default='upcoming')
    status = Column(String(20), nullable=False, default='upcoming')
    score_team_a = Column(Integer, nullable=False, default=0)
    score_team_b = Column(Integer, nullable=False, default=0)
    winner_team_id = Column(String(120), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    category = relationship('SportsLeagueCategory', back_populates='matches')

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

class SportsLeaguePlayer(Base):
    # Player rows back the lineup and ranking tabs and remain independent from event-feed writes.
    __tablename__ = 'sports_league_players'

    id = Column(String(80), primary_key=True)
    category_id = Column(
        String(120),
        ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    team_id = Column(
        String(120),
        ForeignKey('sports_league_teams.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    name = Column(String(20), nullable=False)
    goals = Column(Integer, nullable=False, default=0, index=True)
    assists = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        # Category-first indexes match the dominant access pattern: "all players for one category".
        Index('ix_sports_league_players_category_team', 'category_id', 'team_id'),
        Index('ix_sports_league_players_category_goals', 'category_id', 'goals'),
        Index('ix_sports_league_players_category_assists', 'category_id', 'assists'),
    )

    category = relationship('SportsLeagueCategory', back_populates='players')
    team = relationship('SportsLeagueTeam', back_populates='players')

    def to_dict(self):
        return {
            'id': self.id,
            'categoryId': self.category_id,
            'teamId': self.team_id,
            'name': self.name,
            'goals': int(self.goals or 0),
            'assists': int(self.assists or 0),
            'createdAt': _to_utc_iso(self.created_at),
            'updatedAt': _to_utc_iso(self.updated_at),
        }


class SportsLeagueEvent(Base):
    __tablename__ = 'sports_league_events'

    id = Column(String(80), primary_key=True)
    category_id = Column(
        String(120),
        ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    match_id = Column(
        String(120),
        ForeignKey('sports_league_matches.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    event_type = Column(String(32), nullable=False)
    minute = Column(Integer, nullable=True)
    message = Column(String(240), nullable=False)
    subject_team_id = Column(String(120), nullable=True)
    status = Column(String(20), nullable=False)
    score_team_a = Column(Integer, nullable=False, default=0)
    score_team_b = Column(Integer, nullable=False, default=0)
    winner_team_id = Column(String(120), nullable=True)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    author_role = Column(String(50), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True, index=True)

    author = relationship('User')

    def to_dict(self):
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


class SportsLeagueStandingOverride(Base):
    __tablename__ = 'sports_league_standing_overrides'

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(
        String(120),
        ForeignKey('sports_league_categories.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    group_key = Column(String(8), nullable=False, index=True)
    team_id = Column(String(120), nullable=False)
    rank = Column(Integer, nullable=False)
    points = Column(Integer, nullable=False, default=0)
    goal_difference = Column(Integer, nullable=False, default=0)
    goals_for = Column(Integer, nullable=False, default=0)
    goals_against = Column(Integer, nullable=False, default=0)
    wins = Column(Integer, nullable=False, default=0)
    draws = Column(Integer, nullable=False, default=0)
    losses = Column(Integer, nullable=False, default=0)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

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


class FieldTripClass(Base):
    __tablename__ = 'field_trip_classes'

    class_id = Column(String(2), primary_key=True)
    label = Column(String(20), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    board_description = Column(String(240), nullable=True)
    total_score = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    posts = relationship(
        'FieldTripPost',
        back_populates='field_trip_class',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='FieldTripPost.created_at.desc()',
    )

    def to_summary_dict(self, *, post_count=0, is_unlocked=False, board_description=None):
        return {
            'classId': self.class_id,
            'label': self.label,
            'postCount': int(post_count or 0),
            'isUnlocked': bool(is_unlocked),
            'boardDescription': board_description
            if board_description is not None
            else self.board_description,
        }

    def to_score_dict(self):
        return {
            'classId': self.class_id,
            'label': self.label,
            'totalScore': int(self.total_score or 0),
        }


class FieldTripPost(Base):
    __tablename__ = 'field_trip_posts'

    id = Column(String(80), primary_key=True)
    class_id = Column(
        String(2),
        ForeignKey('field_trip_classes.class_id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    author_user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    # Anonymous posts keep author_user_id nullable, so the role column becomes
    # the stable source of truth for badges and edit permissions.
    author_role = Column(String(50), nullable=False, default='anonymous')
    nickname = Column(String(20), nullable=False)
    title = Column(String(80), nullable=False)
    body = Column(Text, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('ix_field_trip_posts_class_created_at', 'class_id', 'created_at'),
    )

    field_trip_class = relationship('FieldTripClass', back_populates='posts')
    attachments = relationship(
        'FieldTripPostAttachment',
        back_populates='post',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='FieldTripPostAttachment.display_order.asc()',
    )

    def to_dict(self, attachment_url_builder):
        author_role = self.author_role or ('anonymous' if self.author_user_id is None else 'student')
        return {
            'id': self.id,
            'classId': self.class_id,
            # Frontend code uses 0 as the normalized anonymous sentinel so list
            # and detail views do not have to branch on null vs. missing values.
            'authorUserId': 0 if author_role == 'anonymous' else self.author_user_id,
            'authorRole': author_role,
            'nickname': self.nickname,
            'title': self.title,
            'body': self.body,
            'attachments': [
                attachment.to_dict(attachment_url_builder(attachment.stored_filename))
                for attachment in self.attachments
            ],
            'createdAt': _to_utc_iso(self.created_at),
            'updatedAt': _to_utc_iso(self.updated_at),
        }


class FieldTripPostAttachment(Base):
    __tablename__ = 'field_trip_post_attachments'

    id = Column(String(120), primary_key=True)
    post_id = Column(
        String(80),
        ForeignKey('field_trip_posts.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    stored_filename = Column(String(120), nullable=False, unique=True)
    original_name = Column(String(255), nullable=False)
    mime = Column(String(120), nullable=False)
    kind = Column(String(16), nullable=False)
    size_bytes = Column(Integer, nullable=False, default=0)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    post = relationship('FieldTripPost', back_populates='attachments')

    def to_dict(self, url):
        return {
            'id': self.id,
            'name': self.original_name,
            'size': int(self.size_bytes or 0),
            'url': url,
            'mime': self.mime,
            'kind': self.kind,
        }


class SchoolMeal(Base):
    __tablename__ = 'school_meals'

    id = Column(MEAL_ID_TYPE, primary_key=True, autoincrement=True)
    meal_date = Column(Date, nullable=False, index=True)
    meal_type_code = Column(String(4), nullable=False, default='2')
    meal_type_name = Column(String(32), nullable=False, default='중식')
    office_code = Column(String(16), nullable=False)
    office_name = Column(String(64), nullable=False)
    school_code = Column(String(16), nullable=False)
    school_name = Column(String(128), nullable=False)
    dish_html = Column(Text, nullable=False)
    menu_items_json = Column(Text, nullable=False, default='[]')
    preview_text = Column(String(255), nullable=False)
    note_text = Column(String(255), nullable=False)
    calorie_text = Column(String(64), nullable=True)
    calories_kcal = Column(Numeric(6, 1), nullable=True)
    origin_items_json = Column(Text, nullable=False, default='[]')
    nutrition_items_json = Column(Text, nullable=False, default='[]')
    meal_service_figure_raw = Column(Numeric(8, 1), nullable=True)
    source_from_ymd = Column(String(8), nullable=True)
    source_to_ymd = Column(String(8), nullable=True)
    source_load_ymd = Column(String(8), nullable=True)
    synced_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('meal_date', 'meal_type_code', name='uq_school_meals_date_type'),
        Index('ix_school_meals_type_date', 'meal_type_code', 'meal_date'),
    )

    def menu_items(self):
        return _load_json_list(self.menu_items_json)

    def origin_items(self):
        return _load_json_list(self.origin_items_json)

    def nutrition_items(self):
        return _load_json_list(self.nutrition_items_json)


class SchoolMealRating(Base):
    __tablename__ = 'school_meal_ratings'

    id = Column(MEAL_ID_TYPE, primary_key=True, autoincrement=True)
    meal_date = Column(Date, nullable=False, index=True)
    category = Column(String(32), nullable=False)
    score = Column(Integer, nullable=False)
    voter_key = Column(String(64), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            'meal_date',
            'category',
            'voter_key',
            name='uq_school_meal_ratings_date_category_voter',
        ),
        Index('ix_school_meal_ratings_date_category', 'meal_date', 'category'),
        CheckConstraint('score >= 1 AND score <= 5', name='ck_school_meal_ratings_score_range'),
    )


class SchoolMealNotificationSubscription(Base):
    __tablename__ = 'school_meal_notification_subscriptions'

    id = Column(MEAL_ID_TYPE, primary_key=True, autoincrement=True)
    installation_id = Column(String(64), nullable=False, unique=True, index=True)
    fcm_token = Column(String(512), nullable=True, unique=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    timezone = Column(String(64), nullable=False, default='Asia/Seoul')
    notification_minute_of_day = Column(Integer, nullable=False, default=450)
    is_enabled = Column(Integer, nullable=False, default=1)
    last_sent_meal_date = Column(Date, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index(
            'ix_school_meal_notification_enabled_minute',
            'is_enabled',
            'notification_minute_of_day',
        ),
        CheckConstraint(
            'notification_minute_of_day >= 0 AND notification_minute_of_day <= 1439',
            name='ck_school_meal_notification_minute_range',
        ),
        CheckConstraint(
            'notification_minute_of_day % 5 = 0',
            name='ck_school_meal_notification_minute_step',
        ),
        CheckConstraint(
            'is_enabled IN (0, 1)',
            name='ck_school_meal_notification_is_enabled_bool',
        ),
    )
