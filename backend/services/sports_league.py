"""
Sports league domain logic, snapshot building, and seed bootstrapping.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from functools import cmp_to_key

from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload

from models import (
    db,
    SportsLeagueCategory,
    SportsLeagueEvent,
    SportsLeagueMatch,
    SportsLeagueStandingOverride,
    SportsLeagueTeam,
)
from utils.security import sanitize_plain_text
from .sports_league_realtime import publish_category_update
from .sports_league_seed import (
    SPORTS_EVENT_DEFAULT_STATUS,
    SPORTS_LEAGUE_CATEGORY_ID,
    SPORTS_LEAGUE_STORAGE_VERSION,
    get_sports_league_seed,
)


SUPPORTED_GROUPS = {'A', 'B'}
SUPPORTED_STATUSES = {'upcoming', 'live', 'halftime', 'completed', 'pending'}
TOURNAMENT_PHASES = {'knockout', 'final'}


class SportsLeagueError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_kickoff(value):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is not None:
        return parsed.replace(tzinfo=None)
    return parsed


def _json_dump(value):
    return json.dumps(value, ensure_ascii=False)


def _safe_int(value, *, minimum=0, allow_none=False, field_name='value'):
    if value in (None, ''):
        if allow_none:
            return None
        return minimum
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise SportsLeagueError(f'{field_name} 값이 올바르지 않습니다.', 422) from exc
    if parsed < minimum:
        raise SportsLeagueError(f'{field_name} 값이 올바르지 않습니다.', 422)
    return parsed


def _event_public_id():
    return f'sports-event-{uuid.uuid4().hex}'


def _active_events_query(category_id, match_id=None):
    query = SportsLeagueEvent.query.options(joinedload(SportsLeagueEvent.author)).filter(
        SportsLeagueEvent.category_id == category_id,
        SportsLeagueEvent.deleted_at.is_(None),
    )
    if match_id:
        query = query.filter(SportsLeagueEvent.match_id == match_id)
    return query


def _serialize_overrides(overrides):
    grouped = {group_key: [] for group_key in SUPPORTED_GROUPS}
    for override in overrides:
        grouped.setdefault(override.group_key, []).append(override.to_dict())
    return {
        group_key: (sorted(rows, key=lambda row: row['rank']) or None)
        for group_key, rows in grouped.items()
    }


def _tie_break_head_to_head(left_row, right_row, completed_matches):
    for match in completed_matches:
        is_same_pair = (
            (match.team_a_id == left_row['team'].id and match.team_b_id == right_row['team'].id)
            or (match.team_a_id == right_row['team'].id and match.team_b_id == left_row['team'].id)
        )
        if not is_same_pair:
            continue

        left_score = match.score_team_a if match.team_a_id == left_row['team'].id else match.score_team_b
        right_score = match.score_team_a if match.team_a_id == right_row['team'].id else match.score_team_b
        if left_score != right_score:
            return right_score - left_score
    return 0


def _compute_standings(matches, teams, overrides, group_id):
    override_rows = [item for item in overrides if item.group_key == group_id]
    if override_rows:
        # Manual overrides short-circuit the derived table so official decisions always win.
        rows = sorted(override_rows, key=lambda item: item.rank)
        return [{'teamId': row.team_id, 'rank': row.rank} for row in rows]

    group_teams = [team for team in teams if team.group_key == group_id]
    # Only completed fixtures affect standings; live scorelines stay informational until finalized.
    completed_matches = [
        match
        for match in matches
        if match.group_key == group_id and match.status == 'completed'
    ]

    base_rows = []
    for team in group_teams:
        base_rows.append(
            {
                'team': team,
                'points': 0,
                'goalDifference': 0,
                'goalsFor': 0,
                'goalsAgainst': 0,
                'wins': 0,
                'draws': 0,
                'losses': 0,
            }
        )
    row_map = {row['team'].id: row for row in base_rows}

    for match in completed_matches:
        home = row_map.get(match.team_a_id)
        away = row_map.get(match.team_b_id)
        if not home or not away:
            continue

        home_goals = int(match.score_team_a or 0)
        away_goals = int(match.score_team_b or 0)
        home['goalsFor'] += home_goals
        home['goalsAgainst'] += away_goals
        away['goalsFor'] += away_goals
        away['goalsAgainst'] += home_goals
        home['goalDifference'] = home['goalsFor'] - home['goalsAgainst']
        away['goalDifference'] = away['goalsFor'] - away['goalsAgainst']

        if home_goals > away_goals:
            home['wins'] += 1
            away['losses'] += 1
            home['points'] += 3
        elif home_goals < away_goals:
            away['wins'] += 1
            home['losses'] += 1
            away['points'] += 3
        else:
            home['draws'] += 1
            away['draws'] += 1
            home['points'] += 1
            away['points'] += 1

    def compare(left_row, right_row):
        if right_row['points'] != left_row['points']:
            return right_row['points'] - left_row['points']
        if right_row['goalDifference'] != left_row['goalDifference']:
            return right_row['goalDifference'] - left_row['goalDifference']
        if right_row['goalsFor'] != left_row['goalsFor']:
            return right_row['goalsFor'] - left_row['goalsFor']
        head_to_head = _tie_break_head_to_head(left_row, right_row, completed_matches)
        if head_to_head:
            return head_to_head
        if left_row['team'].name < right_row['team'].name:
            return -1
        if left_row['team'].name > right_row['team'].name:
            return 1
        return 0

    sorted_rows = sorted(base_rows, key=cmp_to_key(compare))
    return [
        {
            'teamId': row['team'].id,
            'rank': index + 1,
        }
        for index, row in enumerate(sorted_rows)
    ]


def _build_default_event_message(event_type, team_name, message, score_snapshot, stage_label):
    trimmed = sanitize_plain_text(message, max_length=240)
    if trimmed:
        return trimmed
    if event_type == 'goal':
        return f'{team_name or "한 팀"} 득점! {score_snapshot["teamA"]}:{score_snapshot["teamB"]}'
    if event_type == 'yellow':
        return f'{team_name or "선수"}에게 옐로카드가 주어졌습니다.'
    if event_type == 'red':
        return f'{team_name or "선수"}에게 레드카드가 선언됐습니다.'
    if event_type == 'halftime':
        return f'{stage_label} 전반 종료'
    if event_type == 'second_half':
        return f'{stage_label} 후반 시작'
    if event_type == 'fulltime':
        return f'{stage_label} 경기 종료'
    return f'{stage_label} 운영 업데이트'


def _load_category_bundle(category_id):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)

    teams = SportsLeagueTeam.query.filter_by(category_id=category_id).order_by(
        SportsLeagueTeam.display_order.asc()
    ).all()
    matches = SportsLeagueMatch.query.filter_by(category_id=category_id).order_by(
        SportsLeagueMatch.display_order.asc()
    ).all()
    events = _active_events_query(category_id).order_by(
        SportsLeagueEvent.created_at.asc(),
        SportsLeagueEvent.id.asc(),
    ).all()
    overrides = SportsLeagueStandingOverride.query.filter_by(category_id=category_id).order_by(
        SportsLeagueStandingOverride.group_key.asc(),
        SportsLeagueStandingOverride.rank.asc(),
    ).all()
    return category, teams, matches, events, overrides


def _enforce_event_retention_limit(category_id):
    max_active_events = int(current_app.config.get('SPORTS_LEAGUE_MAX_ACTIVE_EVENTS', 250) or 250)
    if max_active_events <= 0:
        return

    active_events = _active_events_query(category_id).order_by(
        SportsLeagueEvent.created_at.desc(),
        SportsLeagueEvent.id.desc(),
    ).all()
    if len(active_events) <= max_active_events:
        return

    # Soft-delete stale rows so payloads stay bounded without destroying operator history.
    deleted_at = datetime.utcnow()
    for stale_event in active_events[max_active_events:]:
        stale_event.deleted_at = deleted_at
        stale_event.updated_at = deleted_at


def build_snapshot(category_id):
    category, teams, matches, events, overrides = _load_category_bundle(category_id)

    return {
        'category': category.to_dict(),
        'teams': [team.to_dict() for team in teams],
        'matches': [match.to_dict() for match in matches],
        'rules': category.rules_dict(),
        'liveEvents': [event.to_dict() for event in events],
        'standingsOverrides': _serialize_overrides(overrides),
        'updatedAt': category.updated_at.replace(tzinfo=timezone.utc).isoformat().replace('+00:00', 'Z')
        if category.updated_at
        else None,
        'storageVersion': category.storage_version,
    }


def _touch_category(category):
    category.updated_at = datetime.utcnow()


def _validate_match_participants(allowed_team_ids, team_id, field_name):
    if team_id in (None, ''):
        return None
    if team_id not in set(allowed_team_ids or []):
        raise SportsLeagueError(f'{field_name} 값이 올바르지 않습니다.', 422)
    return team_id


def _normalize_event_payload(category_id, match, payload, *, current_event=None):
    allowed_team_ids = {match.team_a_id, match.team_b_id}
    # PATCH calls reuse the stored event values when a field is intentionally omitted.

    event_type = sanitize_plain_text(
        payload.get('eventType') if 'eventType' in payload else getattr(current_event, 'event_type', 'note'),
        max_length=32,
    ) or 'note'
    if event_type not in SPORTS_EVENT_DEFAULT_STATUS:
        raise SportsLeagueError('eventType 값이 올바르지 않습니다.', 422)

    raw_status = payload.get('status') if 'status' in payload else getattr(current_event, 'status', None)
    status = sanitize_plain_text(raw_status, max_length=20) or SPORTS_EVENT_DEFAULT_STATUS.get(event_type) or match.status
    if status not in SUPPORTED_STATUSES:
        raise SportsLeagueError('status 값이 올바르지 않습니다.', 422)

    minute_source = payload.get('minute') if 'minute' in payload else getattr(current_event, 'minute', None)
    minute = _safe_int(minute_source, minimum=0, allow_none=True, field_name='minute')

    score_input = payload.get('scoreSnapshot') if 'scoreSnapshot' in payload else None
    score_source = score_input if isinstance(score_input, dict) else {
        'teamA': getattr(current_event, 'score_team_a', match.score_team_a),
        'teamB': getattr(current_event, 'score_team_b', match.score_team_b),
    }
    score_snapshot = {
        'teamA': _safe_int(score_source.get('teamA'), minimum=0, field_name='scoreSnapshot.teamA'),
        'teamB': _safe_int(score_source.get('teamB'), minimum=0, field_name='scoreSnapshot.teamB'),
    }

    subject_team_source = payload.get('subjectTeamId') if 'subjectTeamId' in payload else getattr(current_event, 'subject_team_id', None)
    subject_team_id = _validate_match_participants(allowed_team_ids, subject_team_source, 'subjectTeamId')

    winner_team_source = payload.get('winnerTeamId') if 'winnerTeamId' in payload else getattr(current_event, 'winner_team_id', None)
    winner_team_id = _validate_match_participants(allowed_team_ids, winner_team_source, 'winnerTeamId')
    if match.phase in TOURNAMENT_PHASES and status == 'completed' and score_snapshot['teamA'] == score_snapshot['teamB'] and not winner_team_id:
        raise SportsLeagueError('토너먼트 경기 동점 종료 시 winnerTeamId가 필요합니다.', 422)

    team_name = None
    if subject_team_id:
        team = SportsLeagueTeam.query.filter_by(category_id=category_id, id=subject_team_id).first()
        team_name = team.name if team else None

    message_source = payload.get('message') if 'message' in payload else getattr(current_event, 'message', '')
    message = _build_default_event_message(
        event_type,
        team_name,
        message_source,
        score_snapshot,
        match.stage_label,
    )

    return {
        'eventType': event_type,
        'status': status,
        'minute': minute,
        'message': message,
        'scoreSnapshot': score_snapshot,
        'subjectTeamId': subject_team_id,
        'winnerTeamId': winner_team_id,
    }


def _recompute_match_from_events(match):
    # Match rows are projections derived from the newest active event, not an independent source of truth.
    latest_event = _active_events_query(match.category_id, match.id).order_by(
        SportsLeagueEvent.created_at.desc(),
        SportsLeagueEvent.id.desc(),
    ).first()
    if latest_event is None:
        match.status = match.default_status or 'upcoming'
        match.score_team_a = 0
        match.score_team_b = 0
        match.winner_team_id = None
    else:
        match.status = latest_event.status
        match.score_team_a = int(latest_event.score_team_a or 0)
        match.score_team_b = int(latest_event.score_team_b or 0)
        match.winner_team_id = latest_event.winner_team_id
    match.updated_at = datetime.utcnow()


def create_event(category_id, payload, current_user):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)

    match_id = sanitize_plain_text(payload.get('matchId'), max_length=120)
    if not match_id:
        raise SportsLeagueError('matchId는 필수입니다.', 422)
    match = SportsLeagueMatch.query.filter_by(category_id=category_id, id=match_id).first()
    if not match:
        raise SportsLeagueError('선택한 경기를 찾을 수 없습니다.', 404)

    normalized = _normalize_event_payload(category_id, match, payload)
    event = SportsLeagueEvent(
        id=_event_public_id(),
        category_id=category_id,
        match_id=match.id,
        event_type=normalized['eventType'],
        minute=normalized['minute'],
        message=normalized['message'],
        subject_team_id=normalized['subjectTeamId'],
        status=normalized['status'],
        score_team_a=normalized['scoreSnapshot']['teamA'],
        score_team_b=normalized['scoreSnapshot']['teamB'],
        winner_team_id=normalized['winnerTeamId'],
        author_id=current_user.id,
        author_role=current_user.role.value,
    )
    db.session.add(event)
    db.session.flush()
    _enforce_event_retention_limit(category_id)
    _recompute_match_from_events(match)
    _touch_category(category)

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('문자중계를 저장하지 못했습니다.', 500) from exc

    publish_category_update(category_id)
    return event.to_dict(), build_snapshot(category_id)


def update_event(category_id, event_id, payload):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)

    event = SportsLeagueEvent.query.options(joinedload(SportsLeagueEvent.author)).filter(
        SportsLeagueEvent.category_id == category_id,
        SportsLeagueEvent.id == event_id,
        SportsLeagueEvent.deleted_at.is_(None),
    ).first()
    if not event:
        raise SportsLeagueError('문자중계 기록을 찾을 수 없습니다.', 404)

    match = SportsLeagueMatch.query.filter_by(category_id=category_id, id=event.match_id).first()
    if not match:
        raise SportsLeagueError('선택한 경기를 찾을 수 없습니다.', 404)

    normalized = _normalize_event_payload(category_id, match, payload, current_event=event)
    event.event_type = normalized['eventType']
    event.minute = normalized['minute']
    event.message = normalized['message']
    event.subject_team_id = normalized['subjectTeamId']
    event.status = normalized['status']
    event.score_team_a = normalized['scoreSnapshot']['teamA']
    event.score_team_b = normalized['scoreSnapshot']['teamB']
    event.winner_team_id = normalized['winnerTeamId']
    event.updated_at = datetime.utcnow()

    db.session.flush()
    _recompute_match_from_events(match)
    _touch_category(category)

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('문자중계 기록을 수정하지 못했습니다.', 500) from exc

    publish_category_update(category_id)
    return event.to_dict(), build_snapshot(category_id)


def delete_event(category_id, event_id):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)

    event = SportsLeagueEvent.query.filter(
        SportsLeagueEvent.category_id == category_id,
        SportsLeagueEvent.id == event_id,
        SportsLeagueEvent.deleted_at.is_(None),
    ).first()
    if not event:
        raise SportsLeagueError('문자중계 기록을 찾을 수 없습니다.', 404)

    match = SportsLeagueMatch.query.filter_by(category_id=category_id, id=event.match_id).first()
    if not match:
        raise SportsLeagueError('선택한 경기를 찾을 수 없습니다.', 404)

    event.deleted_at = datetime.utcnow()
    event.updated_at = datetime.utcnow()
    db.session.flush()
    _recompute_match_from_events(match)
    _touch_category(category)

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('문자중계 기록을 삭제하지 못했습니다.', 500) from exc

    publish_category_update(category_id)
    return build_snapshot(category_id)


def save_standings_overrides(category_id, group_id, rows):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)
    if group_id not in SUPPORTED_GROUPS:
        raise SportsLeagueError('지원하지 않는 조입니다.', 404)
    if not isinstance(rows, list) or not rows:
        raise SportsLeagueError('rows는 비어 있지 않은 배열이어야 합니다.', 422)

    teams = SportsLeagueTeam.query.filter_by(category_id=category_id, group_key=group_id).all()
    team_ids = {team.id for team in teams}
    if not team_ids:
        raise SportsLeagueError('조 편성 정보를 찾을 수 없습니다.', 404)

    # Replace the entire official table in one shot so the ranking stays internally consistent.
    SportsLeagueStandingOverride.query.filter_by(category_id=category_id, group_key=group_id).delete()

    seen_team_ids = set()
    seen_ranks = set()
    for row in rows:
        team_id = sanitize_plain_text(row.get('teamId'), max_length=120)
        if team_id not in team_ids or team_id in seen_team_ids:
            raise SportsLeagueError('teamId 값이 올바르지 않습니다.', 422)
        rank = _safe_int(row.get('rank'), minimum=1, field_name='rank')
        if rank in seen_ranks:
            raise SportsLeagueError('rank 값이 중복되었습니다.', 422)

        seen_team_ids.add(team_id)
        seen_ranks.add(rank)
        override = SportsLeagueStandingOverride(
            category_id=category_id,
            group_key=group_id,
            team_id=team_id,
            rank=rank,
            points=_safe_int(row.get('points', 0), minimum=0, field_name='points'),
            goal_difference=int(row.get('goalDifference', 0) or 0),
            goals_for=_safe_int(row.get('goalsFor', 0), minimum=0, field_name='goalsFor'),
            goals_against=_safe_int(row.get('goalsAgainst', 0), minimum=0, field_name='goalsAgainst'),
            wins=_safe_int(row.get('wins', 0), minimum=0, field_name='wins'),
            draws=_safe_int(row.get('draws', 0), minimum=0, field_name='draws'),
            losses=_safe_int(row.get('losses', 0), minimum=0, field_name='losses'),
            note=sanitize_plain_text(row.get('note', ''), max_length=255) or None,
        )
        db.session.add(override)

    _touch_category(category)
    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('공식 순위를 저장하지 못했습니다.', 500) from exc

    publish_category_update(category_id)
    return build_snapshot(category_id)


def clear_standings_overrides(category_id, group_id):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)
    if group_id not in SUPPORTED_GROUPS:
        raise SportsLeagueError('지원하지 않는 조입니다.', 404)

    SportsLeagueStandingOverride.query.filter_by(category_id=category_id, group_key=group_id).delete()
    _touch_category(category)
    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('공식 순위를 삭제하지 못했습니다.', 500) from exc

    publish_category_update(category_id)
    return build_snapshot(category_id)


def update_match_participants(category_id, match_id, team_a_id, team_b_id):
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)

    match = SportsLeagueMatch.query.filter_by(category_id=category_id, id=match_id).first()
    if not match:
        raise SportsLeagueError('선택한 경기를 찾을 수 없습니다.', 404)
    if match.phase not in TOURNAMENT_PHASES:
        raise SportsLeagueError('토너먼트 경기만 직접 설정할 수 있습니다.', 422)

    team_a_id = sanitize_plain_text(team_a_id, max_length=120)
    team_b_id = sanitize_plain_text(team_b_id, max_length=120)
    if not team_a_id or not team_b_id or team_a_id == team_b_id:
        raise SportsLeagueError('팀 설정 값이 올바르지 않습니다.', 422)

    valid_team_ids = {
        team.id
        for team in SportsLeagueTeam.query.filter_by(category_id=category_id).all()
    }
    if team_a_id not in valid_team_ids or team_b_id not in valid_team_ids:
        raise SportsLeagueError('팀 설정 값이 올바르지 않습니다.', 422)

    match.team_a_id = team_a_id
    match.team_b_id = team_b_id
    if match.winner_team_id not in {team_a_id, team_b_id}:
        match.winner_team_id = None
    match.updated_at = datetime.utcnow()
    _touch_category(category)

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('토너먼트 대진을 저장하지 못했습니다.', 500) from exc

    publish_category_update(category_id)
    return build_snapshot(category_id)


def bootstrap_sports_league_category(category_id=SPORTS_LEAGUE_CATEGORY_ID):
    seed = get_sports_league_seed(category_id)
    if not seed:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)

    # Seed upserts refresh fixtures and metadata while preserving accumulated live events.
    category_payload = seed['category']
    category = SportsLeagueCategory.query.filter_by(id=category_id).first()
    if category is None:
        category = SportsLeagueCategory(id=category_id)
        db.session.add(category)

    category.title = category_payload['title']
    category.subtitle = category_payload['subtitle']
    category.season_label = category_payload['seasonLabel']
    category.grade_label = category_payload['gradeLabel']
    category.sport_label = category_payload['sportLabel']
    category.status_note = category_payload['statusNote']
    category.schedule_window_label = category_payload['scheduleWindowLabel']
    category.match_time_label = category_payload['matchTimeLabel']
    category.broadcast_label = category_payload['broadcastLabel']
    category.location_label = category_payload['locationLabel']
    category.rules_format_json = _json_dump(seed['rules']['format'])
    category.rules_points_json = _json_dump(seed['rules']['points'])
    category.rules_ranking_json = _json_dump(seed['rules']['ranking'])
    category.rules_notes_json = _json_dump(seed['rules']['notes'])
    category.storage_version = SPORTS_LEAGUE_STORAGE_VERSION
    category.updated_at = datetime.utcnow()

    existing_teams = {
        team.id: team
        for team in SportsLeagueTeam.query.filter_by(category_id=category_id).all()
    }
    for index, team_payload in enumerate(seed['teams']):
        team = existing_teams.get(team_payload['id'])
        if team is None:
            team = SportsLeagueTeam(id=team_payload['id'], category_id=category_id)
            db.session.add(team)
        team.name = team_payload['name']
        team.short_name = team_payload['shortName']
        team.group_key = team_payload['group']
        team.tone = team_payload['tone']
        team.display_order = index

    existing_matches = {
        match.id: match
        for match in SportsLeagueMatch.query.filter_by(category_id=category_id).all()
    }
    for index, match_payload in enumerate(seed['matches']):
        match = existing_matches.get(match_payload['id'])
        if match is None:
            match = SportsLeagueMatch(id=match_payload['id'], category_id=category_id)
            db.session.add(match)
            match.status = match_payload['status']
            match.score_team_a = int(match_payload['score']['teamA'])
            match.score_team_b = int(match_payload['score']['teamB'])
            match.winner_team_id = None
        match.phase = match_payload['phase']
        match.stage_label = match_payload['stageLabel']
        match.group_key = match_payload['group']
        match.week_label = match_payload['weekLabel']
        match.kickoff_at = _parse_kickoff(match_payload['kickoffAt'])
        match.team_a_id = match_payload['teamAId']
        match.team_b_id = match_payload['teamBId']
        match.default_status = match_payload['status']
        match.display_order = index
        match.updated_at = datetime.utcnow()

    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise SportsLeagueError('스포츠리그 시드 반영에 실패했습니다.', 500) from exc

    return build_snapshot(category_id)


def bootstrap_all_sports_leagues():
    return [bootstrap_sports_league_category(SPORTS_LEAGUE_CATEGORY_ID)]
