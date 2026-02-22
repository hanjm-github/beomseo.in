/**
 * @file src/api/mockSurveyCreditStore.js
 * @description Encapsulates backend API contracts, normalization, and fallback behavior.
 * Responsibilities:
 * - Expose a stable API-facing interface for feature code while shielding transport details.
 * Key dependencies:
 * - Module-local logic without direct import dependencies.
 * Side effects:
 * - Performs HTTP requests to backend endpoints via shared API clients.
 * Role in app flow:
 * - Acts as the data boundary between UI code and backend HTTP endpoints.
 */
const DEFAULT_CREDITS = Object.freeze({
  base: 0,
  earned: 10,
  used: 2,
});

let mockSurveyCredits = {
  ...DEFAULT_CREDITS,
};

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function normalizeCredits(next) {
  return {
    base: Math.max(0, toSafeNumber(next.base)),
    earned: Math.max(0, toSafeNumber(next.earned)),
    used: Math.max(0, toSafeNumber(next.used)),
  };
}

/**
 * getMockSurveyCredits module entry point.
 */
export function getMockSurveyCredits() {
  const normalized = normalizeCredits(mockSurveyCredits);
  const available = normalized.base + normalized.earned - normalized.used;
  return {
    ...normalized,
    available: Math.max(0, available),
  };
}

/**
 * setMockSurveyCredits module entry point.
 */
export function setMockSurveyCredits(next) {
  mockSurveyCredits = normalizeCredits(next || DEFAULT_CREDITS);
  return getMockSurveyCredits();
}

/**
 * patchMockSurveyCredits module entry point.
 */
export function patchMockSurveyCredits(patch = {}) {
  mockSurveyCredits = normalizeCredits({
    ...mockSurveyCredits,
    ...patch,
  });
  return getMockSurveyCredits();
}

/**
 * earnMockSurveyCredits module entry point.
 */
export function earnMockSurveyCredits(amount = 0) {
  const value = Math.max(0, toSafeNumber(amount));
  return patchMockSurveyCredits({
    earned: toSafeNumber(mockSurveyCredits.earned) + value,
  });
}

/**
 * consumeMockSurveyCredits module entry point.
 */
export function consumeMockSurveyCredits(amount = 0) {
  const value = Math.max(0, toSafeNumber(amount));
  return patchMockSurveyCredits({
    used: toSafeNumber(mockSurveyCredits.used) + value,
  });
}

/**
 * resetMockSurveyCredits module entry point.
 */
export function resetMockSurveyCredits() {
  return setMockSurveyCredits(DEFAULT_CREDITS);
}



