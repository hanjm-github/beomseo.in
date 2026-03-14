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
const subscribers = new Map();
const memoryStore = new Map();

let broadcastChannel;
let syncInitialized = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getStorageKey(categoryId) {
  return `${STORAGE_KEY_PREFIX}${categoryId}`;
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

function persistSnapshot(categoryId, snapshot) {
  memoryStore.set(categoryId, cloneSportsLeagueSnapshot(snapshot));
  if (canUseWindow()) {
    writeStorage(getStorageKey(categoryId), JSON.stringify(snapshot));
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
