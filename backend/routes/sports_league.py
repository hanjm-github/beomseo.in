"""
Sports league live text routes.
"""
from __future__ import annotations

import json

from flask import Blueprint, Response, jsonify, request, stream_with_context, current_app
from flask_jwt_extended import jwt_required

from models import UserRole, db
from services.sports_league import (
    SportsLeagueError,
    bootstrap_sports_league_category,
    build_snapshot,
    clear_standings_overrides,
    create_event,
    delete_event,
    save_standings_overrides,
    update_match_participants,
    update_event,
)
from services.sports_league_realtime import (
    subscribe_category_updates,
)
from utils.cache import cache_json_response, invalidate_cache_namespaces
from utils.rate_limit import limiter
from utils.security import get_current_user, require_role


sports_league_bp = Blueprint('sports_league', __name__, url_prefix='/api/sports-league')


def _sse_message(*, event=None, data=None, retry=None, comment=None):
    parts = []
    if comment:
        parts.append(f': {comment}')
    if retry is not None:
        parts.append(f'retry: {int(retry)}')
    if event:
        parts.append(f'event: {event}')
    if data is not None:
        payload = json.dumps(data, ensure_ascii=False)
        for line in payload.splitlines() or ['']:
            parts.append(f'data: {line}')
    return '\n'.join(parts) + '\n\n'


def _build_fresh_snapshot(category_id):
    # Long-lived SSE requests must not keep serving stale ORM identity-map state.
    db.session.remove()
    return build_snapshot(category_id)


@sports_league_bp.errorhandler(SportsLeagueError)
def handle_sports_league_error(error):
    return jsonify({'error': error.message}), error.status_code


@sports_league_bp.route('/categories/<string:category_id>', methods=['GET'])
@limiter.limit(lambda: current_app.config.get('RATELIMIT_SPORTS_LEAGUE_READ', '60 per minute'))
@cache_json_response('sports_league', ttl=10)
def get_category(category_id):
    return jsonify(build_snapshot(category_id))


@sports_league_bp.route('/categories/<string:category_id>/stream', methods=['GET'])
def stream_category(category_id):
    heartbeat_seconds = int(current_app.config.get('SPORTS_LEAGUE_SSE_HEARTBEAT_SECONDS', 15) or 15)
    retry_ms = int(current_app.config.get('SPORTS_LEAGUE_SSE_RETRY_MS', 3000) or 3000)
    poll_seconds = max(1, min(heartbeat_seconds, 3))
    snapshot = _build_fresh_snapshot(category_id)
    last_updated_at = snapshot.get('updatedAt')

    def generate():
        nonlocal last_updated_at
        idle_seconds = 0
        yield _sse_message(retry=retry_ms)
        yield _sse_message(event='snapshot', data=snapshot)
        with subscribe_category_updates(category_id) as subscription:
            while True:
                if subscription.wait(poll_seconds):
                    latest_snapshot = _build_fresh_snapshot(category_id)
                    last_updated_at = latest_snapshot.get('updatedAt')
                    idle_seconds = 0
                    yield _sse_message(event='snapshot', data=latest_snapshot)
                else:
                    # Polling closes the gap for writes that change the snapshot without a pub/sub signal.
                    latest_snapshot = _build_fresh_snapshot(category_id)
                    latest_updated_at = latest_snapshot.get('updatedAt')
                    if latest_updated_at != last_updated_at:
                        last_updated_at = latest_updated_at
                        idle_seconds = 0
                        yield _sse_message(event='snapshot', data=latest_snapshot)
                        continue

                    idle_seconds += poll_seconds
                    if idle_seconds >= heartbeat_seconds:
                        idle_seconds = 0
                        yield _sse_message(comment='heartbeat')

    response = Response(stream_with_context(generate()), mimetype='text/event-stream')
    # Disable intermediary buffering so live text updates reach browsers immediately.
    response.headers['Cache-Control'] = 'no-cache, no-transform'
    response.headers['Connection'] = 'keep-alive'
    response.headers['X-Accel-Buffering'] = 'no'
    return response


@sports_league_bp.route('/categories/<string:category_id>/events', methods=['POST'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def create_category_event(category_id):
    current_user = get_current_user()
    event, snapshot = create_event(category_id, request.get_json() or {}, current_user)
    invalidate_cache_namespaces('sports_league')
    return jsonify({'event': event, 'snapshot': snapshot}), 201


@sports_league_bp.route('/categories/<string:category_id>/events/<string:event_id>', methods=['PATCH'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def update_category_event(category_id, event_id):
    event, snapshot = update_event(category_id, event_id, request.get_json() or {})
    invalidate_cache_namespaces('sports_league')
    return jsonify({'event': event, 'snapshot': snapshot})


@sports_league_bp.route('/categories/<string:category_id>/events/<string:event_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def delete_category_event(category_id, event_id):
    snapshot = delete_event(category_id, event_id)
    invalidate_cache_namespaces('sports_league')
    return jsonify({'message': '문자중계 기록을 삭제했습니다.', 'snapshot': snapshot})


@sports_league_bp.route('/categories/<string:category_id>/standings-overrides/<string:group_id>', methods=['PUT'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def update_standings_override(category_id, group_id):
    payload = request.get_json() or {}
    snapshot = save_standings_overrides(category_id, group_id, payload.get('rows') or [])
    invalidate_cache_namespaces('sports_league')
    return jsonify({'snapshot': snapshot})


@sports_league_bp.route('/categories/<string:category_id>/standings-overrides/<string:group_id>', methods=['DELETE'])
@jwt_required()
@require_role(UserRole.STUDENT_COUNCIL, UserRole.ADMIN)
def delete_standings_override(category_id, group_id):
    snapshot = clear_standings_overrides(category_id, group_id)
    invalidate_cache_namespaces('sports_league')
    return jsonify({'snapshot': snapshot})


@sports_league_bp.route('/categories/<string:category_id>/matches/<string:match_id>/participants', methods=['PATCH'])
@jwt_required()
@require_role(UserRole.ADMIN)
def patch_match_participants(category_id, match_id):
    payload = request.get_json() or {}
    snapshot = update_match_participants(
        category_id,
        match_id,
        payload.get('teamAId'),
        payload.get('teamBId'),
    )
    invalidate_cache_namespaces('sports_league')
    return jsonify({'snapshot': snapshot})


@sports_league_bp.route('/bootstrap/<string:category_id>', methods=['POST'])
@jwt_required()
@require_role(UserRole.ADMIN)
def bootstrap_category(category_id):
    snapshot = bootstrap_sports_league_category(category_id)
    invalidate_cache_namespaces('sports_league')
    return jsonify({'snapshot': snapshot}), 201
