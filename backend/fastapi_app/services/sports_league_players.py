"""
Async roster/stat management for sports league player data.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import SportsLeagueCategory, SportsLeaguePlayer, SportsLeagueTeam
from ..utils import sanitize_plain_text
from .sports_league import SportsLeagueError


REAL_TEAM_GROUPS = {'A', 'B'}
ALLOWED_PLAYER_STATS = {'goals', 'assists'}


def _player_public_id() -> str:
    return f'sports-player-{uuid.uuid4().hex}'


def _to_utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace('+00:00', 'Z')


def _normalize_player_name(raw_name: str) -> str:
    # Reuse the shared text sanitizer so roster names follow the same plain-text rules as event messages.
    name = sanitize_plain_text(raw_name, max_length=20)
    if not name:
        raise SportsLeagueError('선수 이름은 1자 이상 20자 이하로 입력해주세요.', 422)
    return name


async def _require_category(session: AsyncSession, category_id: str) -> SportsLeagueCategory:
    result = await session.execute(
        select(SportsLeagueCategory).where(SportsLeagueCategory.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise SportsLeagueError('지원하지 않는 스포츠리그 카테고리입니다.', 404)
    return category


async def _require_real_team(
    session: AsyncSession,
    category_id: str,
    team_id: str,
) -> SportsLeagueTeam:
    result = await session.execute(
        select(SportsLeagueTeam).where(
            SportsLeagueTeam.category_id == category_id,
            SportsLeagueTeam.id == team_id,
        )
    )
    team = result.scalar_one_or_none()
    if not team:
        raise SportsLeagueError('선택한 팀을 찾을 수 없습니다.', 404)
    if team.group_key not in REAL_TEAM_GROUPS:
        raise SportsLeagueError('라인업에는 실제 반 팀만 등록할 수 있습니다.', 422)
    return team


async def _require_player(
    session: AsyncSession,
    category_id: str,
    player_id: str,
) -> SportsLeaguePlayer:
    result = await session.execute(
        select(SportsLeaguePlayer)
        .options(selectinload(SportsLeaguePlayer.team))
        .where(
            SportsLeaguePlayer.category_id == category_id,
            SportsLeaguePlayer.id == player_id,
        )
    )
    player = result.scalar_one_or_none()
    if not player:
        raise SportsLeagueError('선수를 찾을 수 없습니다.', 404)
    return player


async def _load_players(session: AsyncSession, category_id: str) -> list[SportsLeaguePlayer]:
    result = await session.execute(
        select(SportsLeaguePlayer)
        .options(selectinload(SportsLeaguePlayer.team))
        .where(SportsLeaguePlayer.category_id == category_id)
    )
    players = list(result.scalars().all())
    # Keep one deterministic order for both lineup tabs and API responses.
    players.sort(
        key=lambda player: (
            player.team.group_key if player.team else 'Z',
            player.team.display_order if player.team else 0,
            player.name,
            player.created_at or datetime.min,
        )
    )
    return players


def _players_updated_at(players: list[SportsLeaguePlayer]) -> str | None:
    timestamps = [
        player.updated_at or player.created_at
        for player in players
        if player.updated_at or player.created_at
    ]
    if not timestamps:
        return None
    return _to_utc_iso(max(timestamps))


def _players_payload(players: list[SportsLeaguePlayer]) -> dict:
    # The frontend store replaces its entire roster slice from this payload after every mutation.
    return {
        'players': [player.to_dict() for player in players],
        'updatedAt': _players_updated_at(players),
    }


async def get_players(session: AsyncSession, category_id: str) -> dict:
    await _require_category(session, category_id)
    players = await _load_players(session, category_id)
    return _players_payload(players)


async def create_player(
    session: AsyncSession,
    category_id: str,
    team_id: str,
    payload: dict,
) -> tuple[dict, dict]:
    await _require_category(session, category_id)
    await _require_real_team(session, category_id, team_id)

    # New players always start with zeroed counters; live event messages do not mutate this table automatically.
    player = SportsLeaguePlayer(
        id=_player_public_id(),
        category_id=category_id,
        team_id=team_id,
        name=_normalize_player_name(payload.get('name', '')),
        goals=0,
        assists=0,
    )
    session.add(player)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SportsLeagueError('선수를 추가하지 못했습니다.', 500) from exc

    fresh_player = await _require_player(session, category_id, player.id)
    players = await _load_players(session, category_id)
    return fresh_player.to_dict(), _players_payload(players)


async def delete_player(
    session: AsyncSession,
    category_id: str,
    player_id: str,
) -> dict:
    await _require_category(session, category_id)
    player = await _require_player(session, category_id, player_id)
    await session.delete(player)

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SportsLeagueError('선수를 삭제하지 못했습니다.', 500) from exc

    players = await _load_players(session, category_id)
    return _players_payload(players)


async def adjust_player_stat(
    session: AsyncSession,
    category_id: str,
    player_id: str,
    payload: dict,
) -> tuple[dict, dict]:
    await _require_category(session, category_id)
    player = await _require_player(session, category_id, player_id)

    stat = str(payload.get('stat') or '').strip()
    delta = payload.get('delta')
    if stat not in ALLOWED_PLAYER_STATS:
        raise SportsLeagueError('stat 값이 올바르지 않습니다.', 422)
    if delta not in (-1, 1):
        raise SportsLeagueError('delta 값이 올바르지 않습니다.', 422)

    current_value = int(getattr(player, stat) or 0)
    # Clamp at zero so repeated decrements never produce negative public rankings.
    setattr(player, stat, max(0, current_value + int(delta)))
    player.updated_at = datetime.utcnow()

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise SportsLeagueError('선수 기록을 수정하지 못했습니다.', 500) from exc

    fresh_player = await _require_player(session, category_id, player.id)
    players = await _load_players(session, category_id)
    return fresh_player.to_dict(), _players_payload(players)
