/**
 * @file src/api/mocks/sportsLeague.mock.js
 * @description Implements local-first mock transport for sports league live text updates.
 */

import {
  SPORTS_LEAGUE_CATEGORY_ID,
  SPORTS_LEAGUE_STORAGE_VERSION,
} from '../../features/sportsLeague/data';
import {
  buildDefaultEventMessage,
  cloneSportsLeagueSnapshot,
  createTeamsMap,
  getDefaultStatusForEventType,
  getSportsLeagueSeed,
} from '../../features/sportsLeague/utils';

const BROADCAST_CHANNEL_NAME = 'sports-league-live';
const STORAGE_KEY_PREFIX = 'beomseo:sports-league:';
// Player rosters are persisted separately because they do not participate in SSE snapshot replay.
const PLAYER_STORAGE_KEY_PREFIX = 'beomseo:sports-league:players:';
const subscribers = new Map();
const memoryStore = new Map();
const playerMemoryStore = new Map();

let broadcastChannel;
let syncInitialized = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getStorageKey(categoryId) {
  return `${STORAGE_KEY_PREFIX}${categoryId}`;
}

function getPlayersStorageKey(categoryId) {
  return `${PLAYER_STORAGE_KEY_PREFIX}${categoryId}`;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or privacy mode failures and keep in-memory state working.
  }
}

function canUseWindow() {
  return typeof window !== 'undefined';
}

function loadSnapshot(categoryId) {
  if (memoryStore.has(categoryId)) {
    return cloneSportsLeagueSnapshot(memoryStore.get(categoryId));
  }

  const seed = getSportsLeagueSeed(categoryId);
  if (!seed) {
    throw new Error('지원하지 않는 스포츠리그 카테고리입니다.');
  }

  if (canUseWindow()) {
    const raw = readStorage(getStorageKey(categoryId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Storage version mismatches intentionally discard stale local mock data after seed changes.
        if (parsed?.storageVersion === SPORTS_LEAGUE_STORAGE_VERSION) {
          memoryStore.set(categoryId, parsed);
          return cloneSportsLeagueSnapshot(parsed);
        }
      } catch {
        // Fall back to fresh seed below.
      }
    }
  }

  memoryStore.set(categoryId, seed);
  if (canUseWindow()) {
    writeStorage(getStorageKey(categoryId), JSON.stringify(seed));
  }
  return cloneSportsLeagueSnapshot(seed);
}

function clonePlayers(players) {
  return JSON.parse(JSON.stringify(players || []));
}

function loadPlayers(categoryId) {
  if (playerMemoryStore.has(categoryId)) {
    return clonePlayers(playerMemoryStore.get(categoryId));
  }

  if (canUseWindow()) {
    const raw = readStorage(getPlayersStorageKey(categoryId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          playerMemoryStore.set(categoryId, parsed);
          return clonePlayers(parsed);
        }
      } catch {
        // Fall through to empty roster.
      }
    }
  }

  playerMemoryStore.set(categoryId, []);
  if (canUseWindow()) {
    writeStorage(getPlayersStorageKey(categoryId), JSON.stringify([]));
  }
  return [];
}

function sortPlayersForResponse(categoryId, players) {
  const teams = loadSnapshot(categoryId).teams || [];
  const teamsMap = Object.fromEntries(teams.map((team) => [team.id, team]));
  // Mirror the backend ordering so mock and real transports produce the same lineup grouping.
  return clonePlayers(players).sort((left, right) => {
    const leftTeam = teamsMap[left.teamId];
    const rightTeam = teamsMap[right.teamId];
    const leftGroup = leftTeam?.group || 'Z';
    const rightGroup = rightTeam?.group || 'Z';
    if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup);
    const orderDiff = (leftTeam?.displayOrder ?? 0) - (rightTeam?.displayOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(left.name || '').localeCompare(String(right.name || ''), 'ko');
  });
}

function persistSnapshot(categoryId, snapshot) {
  memoryStore.set(categoryId, cloneSportsLeagueSnapshot(snapshot));
  if (canUseWindow()) {
    writeStorage(getStorageKey(categoryId), JSON.stringify(snapshot));
  }
}

function persistPlayers(categoryId, players) {
  playerMemoryStore.set(categoryId, clonePlayers(players));
  if (canUseWindow()) {
    writeStorage(getPlayersStorageKey(categoryId), JSON.stringify(players));
  }
}

function emitSnapshot(categoryId) {
  const listeners = subscribers.get(categoryId);
  if (!listeners?.size) return;
  const snapshot = loadSnapshot(categoryId);
  listeners.forEach((listener) => listener(snapshot));
}

function initializeSync() {
  if (!canUseWindow() || syncInitialized) return;
  syncInitialized = true;

  if ('BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.addEventListener('message', (event) => {
      const nextCategoryId = event?.data?.categoryId;
      if (nextCategoryId) {
        emitSnapshot(nextCategoryId);
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(STORAGE_KEY_PREFIX)) return;
    const categoryId = event.key.replace(STORAGE_KEY_PREFIX, '');
    if (!categoryId) return;

    if (event.newValue) {
      try {
        memoryStore.set(categoryId, JSON.parse(event.newValue));
      } catch {
        memoryStore.delete(categoryId);
      }
    }

    emitSnapshot(categoryId);
  });
}

function broadcast(categoryId) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ categoryId });
  }
}

function sanitizeScoreSnapshot(scoreSnapshot, fallbackScore) {
  if (!scoreSnapshot) return fallbackScore;
  return {
    teamA: Math.max(0, Number.parseInt(scoreSnapshot.teamA, 10) || 0),
    teamB: Math.max(0, Number.parseInt(scoreSnapshot.teamB, 10) || 0),
  };
}

function createMockPlayerId() {
  return `sports-player-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getPlayersUpdatedAt(players) {
  if (!players.length) return null;
  const timestamps = players
    .map((player) => player.updatedAt || player.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(left) - new Date(right));
  return timestamps[timestamps.length - 1] || null;
}

function buildPlayersResponse(categoryId) {
  // Mutations always return a fresh sorted roster so the UI can replace local state without extra reads.
  const players = sortPlayersForResponse(categoryId, loadPlayers(categoryId));
  return {
    players,
    updatedAt: getPlayersUpdatedAt(players),
  };
}

function createEventAuthor(author) {
  return {
    nickname: author?.nickname ?? author?.name ?? '학생회',
  };
}

function getLatestEventForMatch(events, matchId) {
  return [...events]
    .filter((event) => event.matchId === matchId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];
}

function buildMatchStateFromLatestEvent(match, latestEvent) {
  // Mock match projections follow the backend rule: latest event is the authoritative match state.
  return latestEvent
    ? {
        ...match,
        score: latestEvent.scoreSnapshot,
        status: latestEvent.status,
        winnerTeamId: latestEvent.winnerTeamId || null,
      }
    : {
        ...match,
        score: { teamA: 0, teamB: 0 },
        status: 'upcoming',
        winnerTeamId: null,
      };
}

export const sportsLeagueMockApi = {
  async getCategory(categoryId) {
    await delay(70);
    return loadSnapshot(categoryId);
  },

  async getPlayers(categoryId) {
    await delay(30);
    return buildPlayersResponse(categoryId);
  },

  async createPlayer(categoryId, teamId, payload) {
    await delay(20);

    const snapshot = loadSnapshot(categoryId);
    const team = (snapshot.teams || []).find((item) => item.id === teamId);
    if (!team) {
      throw new Error('선택한 팀을 찾을 수 없습니다.');
    }
    if (!['A', 'B'].includes(team.group)) {
      throw new Error('라인업에는 실제 반 팀만 등록할 수 있습니다.');
    }

    const name = String(payload?.name || '').trim().slice(0, 20);
    if (!name) {
      throw new Error('선수 이름은 1자 이상 20자 이하로 입력해주세요.');
    }

    const players = loadPlayers(categoryId);
    const timestamp = new Date().toISOString();
    const player = {
      id: createMockPlayerId(),
      categoryId,
      teamId,
      name,
      goals: 0,
      assists: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    players.push(player);
    persistPlayers(categoryId, players);
    const response = buildPlayersResponse(categoryId);

    return {
      player,
      players: response.players,
      updatedAt: response.updatedAt,
    };
  },

  async deletePlayer(categoryId, playerId) {
    await delay(20);

    const players = loadPlayers(categoryId);
    const nextPlayers = players.filter((player) => player.id !== playerId);
    if (nextPlayers.length === players.length) {
      throw new Error('선수를 찾을 수 없습니다.');
    }
    persistPlayers(categoryId, nextPlayers);
    const response = buildPlayersResponse(categoryId);

    return {
      message: '선수를 라인업에서 삭제했습니다.',
      players: response.players,
      updatedAt: response.updatedAt,
    };
  },

  async adjustPlayerStat(categoryId, playerId, payload) {
    await delay(20);

    const players = loadPlayers(categoryId);
    const playerIndex = players.findIndex((player) => player.id === playerId);
    if (playerIndex < 0) {
      throw new Error('선수를 찾을 수 없습니다.');
    }

    const stat = payload?.stat;
    const delta = payload?.delta;
    if (!['goals', 'assists'].includes(stat) || ![-1, 1].includes(delta)) {
      throw new Error('선수 기록 요청 값이 올바르지 않습니다.');
    }

    const currentPlayer = players[playerIndex];
    const nextValue = Math.max(0, Number(currentPlayer[stat] || 0) + Number(delta));
    const updatedPlayer = {
      ...currentPlayer,
      [stat]: nextValue,
      updatedAt: new Date().toISOString(),
    };
    players[playerIndex] = updatedPlayer;
    persistPlayers(categoryId, players);
    const response = buildPlayersResponse(categoryId);

    return {
      player: { ...updatedPlayer },
      players: response.players,
      updatedAt: response.updatedAt,
    };
  },

  async createEvent(categoryId, payload) {
    await delay(30);

    const snapshot = loadSnapshot(categoryId);
    const matchIndex = snapshot.matches.findIndex((match) => match.id === payload?.matchId);
    if (matchIndex < 0) {
      throw new Error('선택한 경기를 찾을 수 없습니다.');
    }

    const match = snapshot.matches[matchIndex];
    const teamsMap = createTeamsMap(snapshot.teams);
    const eventType = payload?.eventType || 'note';
    const scoreSnapshot = sanitizeScoreSnapshot(payload?.scoreSnapshot, match.score);
    const status = payload?.status || getDefaultStatusForEventType(eventType) || match.status;
    const author = createEventAuthor(payload?.author);
    const createdAt = new Date().toISOString();
    const teamName = payload?.subjectTeamId ? teamsMap[payload.subjectTeamId]?.name : null;

    const event = {
      id: `sports-event-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      matchId: match.id,
      eventType,
      minute:
        payload?.minute === '' || payload?.minute == null
          ? null
          : Math.max(0, Number.parseInt(payload.minute, 10) || 0),
      message: buildDefaultEventMessage({
        eventType,
        teamName,
        message: payload?.message,
        scoreSnapshot,
        stageLabel: match.stageLabel,
      }),
      scoreSnapshot,
      createdAt,
      author: { nickname: author.nickname },
      subjectTeamId: payload?.subjectTeamId || null,
      status,
      winnerTeamId: payload?.winnerTeamId || null,
    };

    snapshot.liveEvents = [...snapshot.liveEvents, event];
    snapshot.matches[matchIndex] = {
      ...match,
      score: scoreSnapshot,
      status,
      winnerTeamId: payload?.winnerTeamId || null,
    };
    snapshot.updatedAt = createdAt;

    persistSnapshot(categoryId, snapshot);
    emitSnapshot(categoryId);
    broadcast(categoryId);

    return {
      event,
      snapshot: cloneSportsLeagueSnapshot(snapshot),
    };
  },

  async updateEvent(categoryId, eventId, payload) {
    await delay(30);

    const snapshot = loadSnapshot(categoryId);
    const eventIndex = snapshot.liveEvents.findIndex((event) => event.id === eventId);
    if (eventIndex < 0) {
      throw new Error('수정할 문자중계 기록을 찾을 수 없습니다.');
    }

    const existingEvent = snapshot.liveEvents[eventIndex];
    const matchIndex = snapshot.matches.findIndex((match) => match.id === existingEvent.matchId);
    if (matchIndex < 0) {
      throw new Error('선택한 경기를 찾을 수 없습니다.');
    }

    const match = snapshot.matches[matchIndex];
    const teamsMap = createTeamsMap(snapshot.teams);
    const eventType = payload?.eventType || existingEvent.eventType || 'note';
    const scoreSnapshot = sanitizeScoreSnapshot(payload?.scoreSnapshot, existingEvent.scoreSnapshot);
    const status = payload?.status || getDefaultStatusForEventType(eventType) || existingEvent.status;
    const teamName = payload?.subjectTeamId ? teamsMap[payload.subjectTeamId]?.name : null;

    const updatedEvent = {
      ...existingEvent,
      eventType,
      minute:
        payload?.minute === '' || payload?.minute == null
          ? null
          : Math.max(0, Number.parseInt(payload.minute, 10) || 0),
      message: buildDefaultEventMessage({
        eventType,
        teamName,
        message: payload?.message,
        scoreSnapshot,
        stageLabel: match.stageLabel,
      }),
      scoreSnapshot,
      subjectTeamId: payload?.subjectTeamId || null,
      status,
      winnerTeamId: payload?.winnerTeamId || null,
    };

    snapshot.liveEvents[eventIndex] = updatedEvent;
    snapshot.matches[matchIndex] = buildMatchStateFromLatestEvent(
      match,
      getLatestEventForMatch(snapshot.liveEvents, existingEvent.matchId)
    );
    snapshot.updatedAt = new Date().toISOString();

    persistSnapshot(categoryId, snapshot);
    emitSnapshot(categoryId);
    broadcast(categoryId);

    return {
      event: updatedEvent,
      snapshot: cloneSportsLeagueSnapshot(snapshot),
    };
  },

  async deleteEvent(categoryId, eventId) {
    await delay(20);

    const snapshot = loadSnapshot(categoryId);
    const eventIndex = snapshot.liveEvents.findIndex((event) => event.id === eventId);
    if (eventIndex < 0) {
      throw new Error('삭제할 문자중계 기록을 찾을 수 없습니다.');
    }

    const [deletedEvent] = snapshot.liveEvents.splice(eventIndex, 1);
    const remaining = snapshot.liveEvents.filter((event) => event.matchId === deletedEvent.matchId);
    const matchIndex = snapshot.matches.findIndex((match) => match.id === deletedEvent.matchId);

    if (matchIndex >= 0) {
      const match = snapshot.matches[matchIndex];
      snapshot.matches[matchIndex] = buildMatchStateFromLatestEvent(
        match,
        getLatestEventForMatch(remaining, deletedEvent.matchId)
      );
    }

    snapshot.updatedAt = new Date().toISOString();
    persistSnapshot(categoryId, snapshot);
    emitSnapshot(categoryId);
    broadcast(categoryId);

    return {
      message: '문자중계 기록을 삭제했습니다.',
      snapshot: cloneSportsLeagueSnapshot(snapshot),
    };
  },

  async updateMatchParticipants(categoryId, matchId, payload) {
    await delay(20);

    const snapshot = loadSnapshot(categoryId);
    const matchIndex = snapshot.matches.findIndex((match) => match.id === matchId);
    if (matchIndex < 0) {
      throw new Error('선택한 경기를 찾을 수 없습니다.');
    }

    const nextTeamAId = payload?.teamAId;
    const nextTeamBId = payload?.teamBId;
    if (!nextTeamAId || !nextTeamBId || nextTeamAId === nextTeamBId) {
      throw new Error('팀 설정 값이 올바르지 않습니다.');
    }

    snapshot.matches[matchIndex] = {
      ...snapshot.matches[matchIndex],
      teamAId: nextTeamAId,
      teamBId: nextTeamBId,
      winnerTeamId:
        [nextTeamAId, nextTeamBId].includes(snapshot.matches[matchIndex].winnerTeamId)
          ? snapshot.matches[matchIndex].winnerTeamId
          : null,
    };
    snapshot.updatedAt = new Date().toISOString();

    persistSnapshot(categoryId, snapshot);
    emitSnapshot(categoryId);
    broadcast(categoryId);

    return {
      snapshot: cloneSportsLeagueSnapshot(snapshot),
    };
  },

  subscribe(categoryId, listener) {
    initializeSync();
    const current = subscribers.get(categoryId) || new Set();
    current.add(listener);
    subscribers.set(categoryId, current);

    return () => {
      const active = subscribers.get(categoryId);
      if (!active) return;
      active.delete(listener);
      if (!active.size) {
        subscribers.delete(categoryId);
      }
    };
  },
};

export default sportsLeagueMockApi;
