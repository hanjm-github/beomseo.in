/**
 * @file src/api/sportsLeague.js
 * @description Exposes the sports league data boundary used by the live text frontend.
 */

import { fastapiApi, FASTAPI_BASE_URL } from './fastapiClient';
import { SPORTS_LEAGUE_MANAGER_ROLES } from '../features/sportsLeague/data';

const sportsApi = fastapiApi;
const BROADCAST_CHANNEL_NAME = 'sports-league-live';
const STORAGE_KEY_PREFIX = 'beomseo:sports-league:';
const STREAM_RECONNECT_MS = 3000;
const POLL_INTERVAL_MS = 5000;

const memorySnapshots = new Map();
const subscriptionState = new Map();

let broadcastChannel = null;
let syncInitialized = false;

function canUseWindow() {
  return typeof window !== 'undefined';
}

function getStorageKey(categoryId) {
  return `${STORAGE_KEY_PREFIX}${categoryId}`;
}

function readStorage(key) {
  if (!canUseWindow()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (!canUseWindow()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore quota/privacy mode failures.
  }
}

function getCategoryState(categoryId) {
  const current =
    subscriptionState.get(categoryId) || {
      listeners: new Set(),
      eventSource: null,
      reconnectTimer: null,
      pollTimer: null,
      isStreamHealthy: false,
    };
  subscriptionState.set(categoryId, current);
  return current;
}

function emitSnapshot(categoryId, snapshot) {
  const state = subscriptionState.get(categoryId);
  if (!state?.listeners.size) return;
  state.listeners.forEach((listener) => listener(snapshot));
}

function cacheSnapshot(categoryId, snapshot, options = {}) {
  memorySnapshots.set(categoryId, snapshot);
  if (!options.skipStorage) {
    writeStorage(getStorageKey(categoryId), JSON.stringify(snapshot));
  }
}

function broadcastSnapshot(categoryId, snapshot) {
  if (!broadcastChannel) return;
  try {
    broadcastChannel.postMessage({ categoryId, snapshot });
  } catch {
    // Ignore BroadcastChannel failures.
  }
}

function hydrateSnapshot(categoryId) {
  if (memorySnapshots.has(categoryId)) {
    return memorySnapshots.get(categoryId);
  }

  const raw = readStorage(getStorageKey(categoryId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    memorySnapshots.set(categoryId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function pushSnapshot(categoryId, snapshot, options = {}) {
  cacheSnapshot(categoryId, snapshot, { skipStorage: options.skipStorage });
  if (!options.skipNotify) {
    emitSnapshot(categoryId, snapshot);
  }
  if (!options.skipBroadcast) {
    broadcastSnapshot(categoryId, snapshot);
  }
}

async function fetchCategorySnapshot(categoryId) {
  const response = await sportsApi.get(`/api/sports-league/categories/${categoryId}`);
  return response.data;
}

function clearTimers(state) {
  if (state.reconnectTimer) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function stopStream(categoryId) {
  const state = subscriptionState.get(categoryId);
  if (!state) return;
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  state.isStreamHealthy = false;
  clearTimers(state);
}

function startPolling(categoryId) {
  if (!canUseWindow()) return;
  const state = getCategoryState(categoryId);
  if (state.pollTimer) return;

  state.pollTimer = window.setInterval(async () => {
    try {
      const snapshot = await fetchCategorySnapshot(categoryId);
      pushSnapshot(categoryId, snapshot);
    } catch {
      // Keep polling until a healthy SSE stream is established again.
    }
  }, POLL_INTERVAL_MS);
}

function scheduleReconnect(categoryId) {
  if (!canUseWindow()) return;
  const state = getCategoryState(categoryId);
  if (state.reconnectTimer) return;

  state.reconnectTimer = window.setTimeout(async () => {
    state.reconnectTimer = null;
    try {
      const snapshot = await fetchCategorySnapshot(categoryId);
      pushSnapshot(categoryId, snapshot);
    } catch {
      startPolling(categoryId);
    }
    startStream(categoryId);
  }, STREAM_RECONNECT_MS);
}

function startStream(categoryId) {
  if (!canUseWindow()) return;

  const state = getCategoryState(categoryId);
  if (!state.listeners.size || state.eventSource) return;

  try {
    const streamUrl = `${FASTAPI_BASE_URL}/api/sports-league/categories/${categoryId}/stream`;
    const eventSource = new EventSource(streamUrl, { withCredentials: true });
    state.eventSource = eventSource;

    eventSource.addEventListener('snapshot', (event) => {
      try {
        const snapshot = JSON.parse(event.data);
        state.isStreamHealthy = true;
        if (state.pollTimer) {
          window.clearInterval(state.pollTimer);
          state.pollTimer = null;
        }
        pushSnapshot(categoryId, snapshot);
      } catch {
        // Ignore malformed events and keep stream alive.
      }
    });

    eventSource.onerror = () => {
      if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
      }
      state.isStreamHealthy = false;
      startPolling(categoryId);
      scheduleReconnect(categoryId);
    };
  } catch {
    startPolling(categoryId);
    scheduleReconnect(categoryId);
  }
}

function initializeSync() {
  if (!canUseWindow() || syncInitialized) return;
  syncInitialized = true;

  if ('BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.addEventListener('message', (event) => {
      const nextCategoryId = event?.data?.categoryId;
      const snapshot = event?.data?.snapshot;
      if (!nextCategoryId || !snapshot) return;
      pushSnapshot(nextCategoryId, snapshot, {
        skipBroadcast: true,
        skipStorage: true,
      });
    });
    return;
  }

  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(STORAGE_KEY_PREFIX) || !event.newValue) return;
    const categoryId = event.key.replace(STORAGE_KEY_PREFIX, '');
    if (!categoryId) return;

    try {
      const snapshot = JSON.parse(event.newValue);
      pushSnapshot(categoryId, snapshot, {
        skipStorage: true,
        skipBroadcast: true,
      });
    } catch {
      // Ignore malformed storage payloads.
    }
  });
}

export const sportsLeagueApi = {
  managerRoles: SPORTS_LEAGUE_MANAGER_ROLES,

  async getCategory(categoryId) {
    initializeSync();
    const cached = hydrateSnapshot(categoryId);
    if (cached) {
      fetchCategorySnapshot(categoryId)
        .then((snapshot) => pushSnapshot(categoryId, snapshot))
        .catch(() => {});
      return cached;
    }

    const snapshot = await fetchCategorySnapshot(categoryId);
    pushSnapshot(categoryId, snapshot);
    return snapshot;
  },

  async createEvent(categoryId, payload) {
    const response = await sportsApi.post(`/api/sports-league/categories/${categoryId}/events`, payload);
    const result = response.data;
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  async getPlayers(categoryId) {
    const response = await sportsApi.get(`/api/sports-league/categories/${categoryId}/players`);
    return response.data;
  },

  async createPlayer(categoryId, teamId, payload) {
    const response = await sportsApi.post(
      `/api/sports-league/categories/${categoryId}/teams/${teamId}/players`,
      payload
    );
    return response.data;
  },

  async deletePlayer(categoryId, playerId) {
    const response = await sportsApi.delete(
      `/api/sports-league/categories/${categoryId}/players/${playerId}`
    );
    return response.data;
  },

  async adjustPlayerStat(categoryId, playerId, payload) {
    const response = await sportsApi.patch(
      `/api/sports-league/categories/${categoryId}/players/${playerId}/stats`,
      payload
    );
    return response.data;
  },

  async updateEvent(categoryId, eventId, payload) {
    const response = await sportsApi.patch(
      `/api/sports-league/categories/${categoryId}/events/${eventId}`,
      payload
    );
    const result = response.data;
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  async deleteEvent(categoryId, eventId) {
    const response = await sportsApi.delete(
      `/api/sports-league/categories/${categoryId}/events/${eventId}`
    );
    const result = response.data;
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  async updateMatchParticipants(categoryId, matchId, payload) {
    const response = await sportsApi.patch(
      `/api/sports-league/categories/${categoryId}/matches/${matchId}/participants`,
      payload
    );
    const result = response.data;
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  subscribe(categoryId, listener) {
    initializeSync();
    const state = getCategoryState(categoryId);
    state.listeners.add(listener);

    const cached = hydrateSnapshot(categoryId);
    if (cached) {
      listener(cached);
    }

    startStream(categoryId);

    return () => {
      state.listeners.delete(listener);
      if (state.listeners.size) return;
      stopStream(categoryId);
      subscriptionState.delete(categoryId);
    };
  },
};

export default sportsLeagueApi;
