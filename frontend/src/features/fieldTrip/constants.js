export const FIELD_TRIP_TABS = [
  { key: 'mission', label: '미션 수행' },
  { key: 'scoreboard', label: '점수판' },
];

export const FIELD_TRIP_CLASS_IDS = Array.from({ length: 10 }, (_, index) =>
  String(index + 1)
);

export const FIELD_TRIP_UNLOCK_STORAGE_KEY = 'beomseo.fieldTripUnlockedClasses';

export const FIELD_TRIP_MANAGER_ROLES = ['admin', 'student_council'];

export const FIELD_TRIP_MAX_SCORE = 10000;
// Score writes are intentionally step-based so UI controls and API validation
// stay aligned on the same +/- increment.
export const FIELD_TRIP_SCORE_STEP = 5;

export const FIELD_TRIP_PASSWORDS = Object.fromEntries(
  FIELD_TRIP_CLASS_IDS.map((classId) => [classId, `trip-${classId.padStart(2, '0')}`])
);

export const FIELD_TRIP_SCORE_ROWS = FIELD_TRIP_CLASS_IDS.map((classId) => ({
  classId,
  label: `${classId}반`,
  totalScore: 0,
}));
