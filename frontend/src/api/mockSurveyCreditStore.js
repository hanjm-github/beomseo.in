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

export function getMockSurveyCredits() {
  const normalized = normalizeCredits(mockSurveyCredits);
  const available = normalized.base + normalized.earned - normalized.used;
  return {
    ...normalized,
    available: Math.max(0, available),
  };
}

export function setMockSurveyCredits(next) {
  mockSurveyCredits = normalizeCredits(next || DEFAULT_CREDITS);
  return getMockSurveyCredits();
}

export function patchMockSurveyCredits(patch = {}) {
  mockSurveyCredits = normalizeCredits({
    ...mockSurveyCredits,
    ...patch,
  });
  return getMockSurveyCredits();
}

export function earnMockSurveyCredits(amount = 0) {
  const value = Math.max(0, toSafeNumber(amount));
  return patchMockSurveyCredits({
    earned: toSafeNumber(mockSurveyCredits.earned) + value,
  });
}

export function consumeMockSurveyCredits(amount = 0) {
  const value = Math.max(0, toSafeNumber(amount));
  return patchMockSurveyCredits({
    used: toSafeNumber(mockSurveyCredits.used) + value,
  });
}

export function resetMockSurveyCredits() {
  return setMockSurveyCredits(DEFAULT_CREDITS);
}

