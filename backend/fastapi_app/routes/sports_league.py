"""
FastAPI router for sports league live text endpoints.

Provides all CRUD endpoints plus the SSE stream endpoint using async
generators for high-concurrency real-time updates.
"""
from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings, get_settings
from ..database import get_db, get_session_factory
from ..deps import CurrentUser, DbSession, SettingsDep, get_client_ip, require_role
from ..schemas import (
    AdjustPlayerStatRequest,
    CreateEventRequest,
    CreatePlayerRequest,
    MatchParticipantsRequest,
    StandingsOverrideRequest,
    UpdateEventRequest,
)
from ..services.sports_league_players import (
    adjust_player_stat,
    create_player,
    delete_player,
    get_players,
)
from ..utils import sse_message
from ..services.sports_league import (
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
from ..services.sports_league_realtime import subscribe_category_updates


router = APIRouter(prefix='/api/sports-league', tags=['sports-league'])


# ---------------------------------------------------------------------------
# Error handler
# ---------------------------------------------------------------------------

def _error_response(error: SportsLeagueError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={'error': error.message},
    )


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------

ManagerUser = Annotated[
    object,
    Depends(require_role('student_council', 'admin')),
]
AdminUser = Annotated[
    object,
    Depends(require_role('admin')),
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get('/categories/{category_id}')
async def get_category(
    category_id: str,
    db: DbSession,
):
    try:
        snapshot = await build_snapshot(db, category_id)
    except SportsLeagueError as e:
        return _error_response(e)
    return snapshot


# Player roster endpoints intentionally stay outside the snapshot payload so the live feed remains lightweight.
@router.get('/categories/{category_id}/players')
async def get_category_players(
    category_id: str,
    db: DbSession,
):
    try:
        return await get_players(db, category_id)
    except SportsLeagueError as e:
        return _error_response(e)


@router.post('/categories/{category_id}/teams/{team_id}/players', status_code=201)
async def create_category_player(
    category_id: str,
    team_id: str,
    body: CreatePlayerRequest,
    db: DbSession,
    current_user: ManagerUser,
):
    try:
        player, players_payload = await create_player(
            db,
            category_id,
            team_id,
            body.model_dump(),
        )
    except SportsLeagueError as e:
        return _error_response(e)
    return JSONResponse(
        status_code=201,
        content={
            'player': player,
            'players': players_payload['players'],
            'updatedAt': players_payload['updatedAt'],
        },
    )


@router.delete('/categories/{category_id}/players/{player_id}')
async def delete_category_player(
    category_id: str,
    player_id: str,
    db: DbSession,
    current_user: ManagerUser,
):
    try:
        players_payload = await delete_player(db, category_id, player_id)
    except SportsLeagueError as e:
        return _error_response(e)
    return {
        'message': '선수를 라인업에서 삭제했습니다.',
        'players': players_payload['players'],
        'updatedAt': players_payload['updatedAt'],
    }


@router.patch('/categories/{category_id}/players/{player_id}/stats')
async def patch_category_player_stats(
    category_id: str,
    player_id: str,
    body: AdjustPlayerStatRequest,
    db: DbSession,
    current_user: ManagerUser,
):
    try:
        player, players_payload = await adjust_player_stat(
            db,
            category_id,
            player_id,
            body.model_dump(),
        )
    except SportsLeagueError as e:
        return _error_response(e)
    return {
        'player': player,
        'players': players_payload['players'],
        'updatedAt': players_payload['updatedAt'],
    }


@router.get('/categories/{category_id}/stream')
async def stream_category(
    category_id: str,
    request: Request,
    settings: SettingsDep,
):
    """
    SSE endpoint for real-time category updates.
    Uses async generators so thousands of connections can be served
    concurrently on a single Uvicorn worker.
    """
    heartbeat_seconds = settings.SPORTS_LEAGUE_SSE_HEARTBEAT_SECONDS
    retry_ms = settings.SPORTS_LEAGUE_SSE_RETRY_MS
    poll_seconds = max(1, min(heartbeat_seconds, 3))

    async def event_generator():
        factory = get_session_factory()

        # Initial snapshot
        async with factory() as session:
            try:
                snapshot = await build_snapshot(session, category_id)
            except SportsLeagueError:
                yield sse_message(event='error', data={'error': 'Category not found'})
                return
            last_updated_at = snapshot.get('updatedAt')

        yield sse_message(retry=retry_ms)
        yield sse_message(event='snapshot', data=snapshot)

        async with subscribe_category_updates(category_id, settings) as subscription:
            idle_seconds = 0
            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    return

                if await subscription.wait(poll_seconds):
                    async with factory() as session:
                        try:
                            latest_snapshot = await build_snapshot(session, category_id)
                        except SportsLeagueError:
                            continue
                    last_updated_at = latest_snapshot.get('updatedAt')
                    idle_seconds = 0
                    yield sse_message(event='snapshot', data=latest_snapshot)
                else:
                    # Polling fallback for writes without pub/sub signal
                    async with factory() as session:
                        try:
                            latest_snapshot = await build_snapshot(session, category_id)
                        except SportsLeagueError:
                            idle_seconds += poll_seconds
                            if idle_seconds >= heartbeat_seconds:
                                idle_seconds = 0
                                yield sse_message(comment='heartbeat')
                            continue

                    latest_updated_at = latest_snapshot.get('updatedAt')
                    if latest_updated_at != last_updated_at:
                        last_updated_at = latest_updated_at
                        idle_seconds = 0
                        yield sse_message(event='snapshot', data=latest_snapshot)
                        continue

                    idle_seconds += poll_seconds
                    if idle_seconds >= heartbeat_seconds:
                        idle_seconds = 0
                        yield sse_message(comment='heartbeat')

    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )


@router.post('/categories/{category_id}/events', status_code=201)
async def create_category_event(
    category_id: str,
    body: CreateEventRequest,
    db: DbSession,
    settings: SettingsDep,
    current_user: ManagerUser,
):
    try:
        event_dict, snapshot = await create_event(
            db, settings, category_id, body.model_dump(), current_user,
        )
    except SportsLeagueError as e:
        return _error_response(e)
    return JSONResponse(
        status_code=201,
        content={'event': event_dict, 'snapshot': snapshot},
    )


@router.patch('/categories/{category_id}/events/{event_id}')
async def update_category_event(
    category_id: str,
    event_id: str,
    body: UpdateEventRequest,
    db: DbSession,
    settings: SettingsDep,
    current_user: ManagerUser,
):
    try:
        event_dict, snapshot = await update_event(
            db, settings, category_id, event_id,
            body.model_dump(exclude_unset=True),
        )
    except SportsLeagueError as e:
        return _error_response(e)
    return {'event': event_dict, 'snapshot': snapshot}


@router.delete('/categories/{category_id}/events/{event_id}')
async def delete_category_event(
    category_id: str,
    event_id: str,
    db: DbSession,
    settings: SettingsDep,
    current_user: ManagerUser,
):
    try:
        snapshot = await delete_event(db, settings, category_id, event_id)
    except SportsLeagueError as e:
        return _error_response(e)
    return {'message': '문자중계 기록을 삭제했습니다.', 'snapshot': snapshot}


@router.put('/categories/{category_id}/standings-overrides/{group_id}')
async def update_standings_override(
    category_id: str,
    group_id: str,
    body: StandingsOverrideRequest,
    db: DbSession,
    settings: SettingsDep,
    current_user: ManagerUser,
):
    try:
        rows_dicts = [row.model_dump() for row in body.rows]
        snapshot = await save_standings_overrides(
            db, settings, category_id, group_id, rows_dicts,
        )
    except SportsLeagueError as e:
        return _error_response(e)
    return {'snapshot': snapshot}


@router.delete('/categories/{category_id}/standings-overrides/{group_id}')
async def delete_standings_override(
    category_id: str,
    group_id: str,
    db: DbSession,
    settings: SettingsDep,
    current_user: ManagerUser,
):
    try:
        snapshot = await clear_standings_overrides(db, settings, category_id, group_id)
    except SportsLeagueError as e:
        return _error_response(e)
    return {'snapshot': snapshot}


@router.patch('/categories/{category_id}/matches/{match_id}/participants')
async def patch_match_participants(
    category_id: str,
    match_id: str,
    body: MatchParticipantsRequest,
    db: DbSession,
    settings: SettingsDep,
    current_user: AdminUser,
):
    try:
        snapshot = await update_match_participants(
            db, settings, category_id, match_id,
            body.teamAId, body.teamBId,
        )
    except SportsLeagueError as e:
        return _error_response(e)
    return {'snapshot': snapshot}


@router.post('/bootstrap/{category_id}', status_code=201)
async def bootstrap_category(
    category_id: str,
    db: DbSession,
    settings: SettingsDep,
    current_user: AdminUser,
):
    try:
        snapshot = await bootstrap_sports_league_category(db, settings, category_id)
    except SportsLeagueError as e:
        return _error_response(e)
    return JSONResponse(status_code=201, content={'snapshot': snapshot})
