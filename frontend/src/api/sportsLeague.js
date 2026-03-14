/**
 * @file src/api/sportsLeague.js
 * @description Exposes the sports league data boundary used by the live text frontend.
 */

import api from './auth';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { SPORTS_LEAGUE_MANAGER_ROLES } from '../features/sportsLeague/data';
import { sportsLeagueMockApi } from './mocks/sportsLeague.mock';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BROADCAST_CHANNEL_NAME = 'sports-league-live';
const STORAGE_KEY_PREFIX = 'beomseo:sports-league:';
const STREAM_RECONNECT_MS = 3000;
const POLL_INTERVAL_MS = 5000;

const fallbackCategoryIds = new Set();
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
  // Each category shares one transport state so multiple listeners do not duplicate EventSource work.
  const current =
    subscriptionState.get(categoryId) || {
      listeners: new Set(),
      eventSource: null,
      reconnectTimer: null,
      pollTimer: null,
      isStreamHealthy: false,
      mockUnsubscribe: null,
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
  const response = await api.get(`/api/sports-league/categories/${categoryId}`);
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
  if (state.mockUnsubscribe) {
    state.mockUnsubscribe();
    state.mockUnsubscribe = null;
  }
}

function startPolling(categoryId) {
  if (!canUseWindow()) return;
  const state = getCategoryState(categoryId);
  if (state.pollTimer || shouldUseFallbackForCategory(categoryId)) return;

  // Polling only runs while SSE is unhealthy and stops as soon as the stream recovers.
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
  if (state.reconnectTimer || shouldUseFallbackForCategory(categoryId)) return;

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
  if (shouldUseFallbackForCategory(categoryId)) return;

  const state = getCategoryState(categoryId);
  if (!state.listeners.size || state.eventSource) return;

  try {
    const streamUrl = `${API_BASE_URL}/api/sports-league/categories/${categoryId}/stream`;
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
      // Skip rebroadcast/storage writes to avoid infinite cross-tab echo loops.
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

function shouldUseFallbackForCategory(categoryId) {
  return ENABLE_API_MOCKS && fallbackCategoryIds.has(categoryId);
}

async function withBackendFallback(categoryId, backendCall, mockCall) {
  if (shouldUseFallbackForCategory(categoryId)) {
    return mockCall();
  }

  try {
    return await backendCall();
  } catch (error) {
    if (!shouldUseMockFallback(error)) throw error;
    // Once transport-level failure happens in dev, keep the category on mock transport for stability.
    fallbackCategoryIds.add(categoryId);
    stopStream(categoryId);
    return mockCall();
  }
}

export const sportsLeagueApi = {
  managerRoles: SPORTS_LEAGUE_MANAGER_ROLES,

  async getCategory(categoryId) {
    initializeSync();
    const cached = hydrateSnapshot(categoryId);
    if (cached && !shouldUseFallbackForCategory(categoryId)) {
      // Render cached data first, then refresh in the background for stale-while-revalidate UX.
      fetchCategorySnapshot(categoryId)
        .then((snapshot) => pushSnapshot(categoryId, snapshot))
        .catch(() => {});
      return cached;
    }

    const snapshot = await withBackendFallback(
      categoryId,
      () => fetchCategorySnapshot(categoryId),
      () => sportsLeagueMockApi.getCategory(categoryId)
    );
    pushSnapshot(categoryId, snapshot);
    return snapshot;
  },

  async createEvent(categoryId, payload) {
    const result = await withBackendFallback(
      categoryId,
      async () => {
        const response = await api.post(`/api/sports-league/categories/${categoryId}/events`, payload);
        return response.data;
      },
      () => sportsLeagueMockApi.createEvent(categoryId, payload)
    );
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  async updateEvent(categoryId, eventId, payload) {
    const result = await withBackendFallback(
      categoryId,
      async () => {
        const response = await api.patch(
          `/api/sports-league/categories/${categoryId}/events/${eventId}`,
          payload
        );
        return response.data;
      },
      () => sportsLeagueMockApi.updateEvent(categoryId, eventId, payload)
    );
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  async deleteEvent(categoryId, eventId) {
    const result = await withBackendFallback(
      categoryId,
      async () => {
        const response = await api.delete(
          `/api/sports-league/categories/${categoryId}/events/${eventId}`
        );
        return response.data;
      },
      () => sportsLeagueMockApi.deleteEvent(categoryId, eventId)
    );
    if (result?.snapshot) {
      pushSnapshot(categoryId, result.snapshot);
    }
    return result;
  },

  async updateMatchParticipants(categoryId, matchId, payload) {
    const result = await withBackendFallback(
      categoryId,
      async () => {
        const response = await api.patch(
          `/api/sports-league/categories/${categoryId}/matches/${matchId}/participants`,
          payload
        );
        return response.data;
      },
      () => sportsLeagueMockApi.updateMatchParticipants(categoryId, matchId, payload)
    );
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

    if (shouldUseFallbackForCategory(categoryId)) {
      if (!state.mockUnsubscribe) {
        state.mockUnsubscribe = sportsLeagueMockApi.subscribe(categoryId, (snapshot) => {
          pushSnapshot(categoryId, snapshot, { skipBroadcast: true });
        });
      }
      return () => {
        state.listeners.delete(listener);
        if (!state.listeners.size) {
          stopStream(categoryId);
          subscriptionState.delete(categoryId);
        }
      };
    }

    // A single shared EventSource keeps the browser connection count predictable per category.
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
