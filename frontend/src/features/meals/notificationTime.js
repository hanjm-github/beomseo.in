export const DEFAULT_MEAL_NOTIFICATION_TIME = '07:30';
export const DEFAULT_MEAL_NOTIFICATION_TIMEZONE = 'Asia/Seoul';
export const MEAL_NOTIFICATION_TIME_STEP_MINUTES = 5;
export const MEAL_NOTIFICATION_TIME_STEP_SECONDS = MEAL_NOTIFICATION_TIME_STEP_MINUTES * 60;

const MINUTES_PER_DAY = 24 * 60;
const MAX_NOTIFICATION_MINUTE = MINUTES_PER_DAY - MEAL_NOTIFICATION_TIME_STEP_MINUTES;
const DEFAULT_NOTIFICATION_MINUTE_OF_DAY = 7 * 60 + 30;

export const MEAL_NOTIFICATION_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);
export const MEAL_NOTIFICATION_MINUTE_OPTIONS = Array.from(
  { length: 60 / MEAL_NOTIFICATION_TIME_STEP_MINUTES },
  (_, index) => index * MEAL_NOTIFICATION_TIME_STEP_MINUTES,
);

function clampNotificationMinute(totalMinutes) {
  return Math.max(0, Math.min(MAX_NOTIFICATION_MINUTE, totalMinutes));
}

export function parseMealNotificationTime(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const parts = value.split(':');
  if (parts.length !== 2 || parts.some((part) => !/^\d{1,2}$/.test(part))) {
    return null;
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return (hour * 60) + minute;
}

export function formatMealNotificationTime(totalMinutes) {
  const normalizedMinutes = clampNotificationMinute(Number(totalMinutes) || 0);
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeMealNotificationTime(
  value,
  fallback = DEFAULT_MEAL_NOTIFICATION_TIME,
) {
  const parsedMinutes = parseMealNotificationTime(value);
  if (parsedMinutes === null) {
    return fallback;
  }

  const alignedMinutes = clampNotificationMinute(
    parsedMinutes - (parsedMinutes % MEAL_NOTIFICATION_TIME_STEP_MINUTES),
  );

  return formatMealNotificationTime(alignedMinutes);
}

export function composeMealNotificationTime(hour, minute) {
  const normalizedHour = Math.max(0, Math.min(23, Number(hour) || 0));
  const normalizedMinute = Math.max(
    0,
    Math.min(55, Number(minute) || 0),
  );

  return normalizeMealNotificationTime(
    `${String(normalizedHour).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`,
    DEFAULT_MEAL_NOTIFICATION_TIME,
  );
}

export function shiftMealNotificationTime(value, deltaMinutes) {
  const currentMinutes = parseMealNotificationTime(
    normalizeMealNotificationTime(value, DEFAULT_MEAL_NOTIFICATION_TIME),
  );
  const safeCurrentMinutes = currentMinutes ?? DEFAULT_NOTIFICATION_MINUTE_OF_DAY;
  return formatMealNotificationTime(clampNotificationMinute(safeCurrentMinutes + deltaMinutes));
}

export function getMealNotificationTimeContext(value) {
  const minuteOfDay = parseMealNotificationTime(
    normalizeMealNotificationTime(value, DEFAULT_MEAL_NOTIFICATION_TIME),
  );
  const safeMinuteOfDay = minuteOfDay ?? DEFAULT_NOTIFICATION_MINUTE_OF_DAY;

  if (safeMinuteOfDay < 7 * 60) {
    return {
      label: '이른 확인',
      description: '아침 준비 전에 오늘 점심을 먼저 확인할 수 있어요.',
    };
  }

  if (safeMinuteOfDay < 8 * 60) {
    return {
      label: '등교 준비',
      description: '집을 나서기 전에 메뉴를 빠르게 훑어보기 좋은 시간이에요.',
    };
  }

  if (safeMinuteOfDay < 9 * 60) {
    return {
      label: '등교 직후',
      description: '학교 도착 무렵 다시 확인하고 싶을 때 잘 맞아요.',
    };
  }

  return {
    label: '오전 리마인드',
    description: '조금 늦게 받더라도 오전 중에 다시 떠올리고 싶을 때 좋아요.',
  };
}
