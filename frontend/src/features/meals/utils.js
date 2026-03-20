const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function getReferenceDate(baseDate = new Date()) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
}

export function addDays(date, amount) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  nextDate.setDate(nextDate.getDate() + amount);
  return getReferenceDate(nextDate);
}

export function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

export function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return getReferenceDate(date);
}

export function parseMonthKey(value) {
  if (!/^\d{4}-\d{2}$/.test(value || '')) {
    return null;
  }

  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1) {
    return null;
  }

  return date;
}

export function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getDateRange(centerDate, before, after) {
  const dates = [];

  for (let offset = before; offset <= after; offset += 1) {
    dates.push(addDays(centerDate, offset));
  }

  return dates;
}

export function formatHeroDate(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export function formatMonthLabel(monthKey) {
  const date = parseMonthKey(monthKey);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatRailDate(date) {
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
}

export function formatWeekday(date) {
  return DAY_NAMES[date.getDay()];
}

export function getRelativeLabel(date, referenceDate) {
  const diff = Math.round(
    (getReferenceDate(date).getTime() - getReferenceDate(referenceDate).getTime()) / 86400000,
  );

  if (diff === 0) {
    return '오늘';
  }

  if (diff === -1) {
    return '어제';
  }

  if (diff === 1) {
    return '내일';
  }

  if (diff < 0) {
    return `${Math.abs(diff)}일 전`;
  }

  return `${diff}일 뒤`;
}

export function getMealStatus(entry, referenceDate) {
  if (entry.isNoMeal) {
    return 'empty';
  }

  const entryDate = parseDateKey(entry.date);

  if (!entryDate) {
    return 'empty';
  }

  if (isSameDate(entryDate, referenceDate)) {
    return 'today';
  }

  if (entryDate.getTime() < referenceDate.getTime()) {
    return 'past';
  }

  return 'upcoming';
}

export function getMealStatusLabel(entry, referenceDate) {
  const status = getMealStatus(entry, referenceDate);

  if (status === 'today') {
    return '오늘 급식';
  }

  if (status === 'past') {
    return '지난 급식';
  }

  if (status === 'upcoming') {
    return '예정 급식';
  }

  return '급식 없음';
}

export function buildMealMonthMatrix(monthKey, entriesByDate, referenceDate) {
  const monthDate = parseMonthKey(monthKey);

  if (!monthDate) {
    return [];
  }

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const weeks = [];

  let cursor = gridStart;

  while (cursor.getTime() <= gridEnd.getTime()) {
    const week = [];

    for (let index = 0; index < 7; index += 1) {
      const dateKey = formatDateKey(cursor);

      week.push({
        key: dateKey,
        date: cursor,
        dateKey,
        entry: entriesByDate[dateKey] || null,
        isCurrentMonth: cursor.getMonth() === monthDate.getMonth(),
        isToday: isSameDate(cursor, referenceDate),
      });

      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
  }

  return weeks;
}

export function buildMealWeekdayMatrix(monthKey, entriesByDate, referenceDate) {
  const monthDate = parseMonthKey(monthKey);

  if (!monthDate) {
    return [];
  }

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const startOffset = monthStart.getDay() === 0 ? -6 : 1 - monthStart.getDay();
  const endOffset = monthEnd.getDay() === 0 ? -2 : 5 - monthEnd.getDay();
  const gridStart = addDays(monthStart, startOffset);
  const gridEnd = addDays(monthEnd, endOffset);
  const weeks = [];

  let cursor = gridStart;

  while (cursor.getTime() <= gridEnd.getTime()) {
    const week = [];

    for (let index = 0; index < 5; index += 1) {
      const dateKey = formatDateKey(cursor);

      week.push({
        key: dateKey,
        date: cursor,
        dateKey,
        entry: entriesByDate[dateKey] || null,
        isCurrentMonth: cursor.getMonth() === monthDate.getMonth(),
        isToday: isSameDate(cursor, referenceDate),
      });

      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
    cursor = addDays(cursor, 2);
  }

  return weeks;
}

export function getMonthOptions(referenceDate) {
  return [-1, 0, 1].map((offset) => {
    const monthDate = addMonths(startOfMonth(referenceDate), offset);
    const key = formatMonthKey(monthDate);
    const relativeLabel = offset === -1 ? '지난달' : offset === 0 ? '이번 달' : '다음 달';

    return {
      key,
      monthDate,
      label: formatMonthLabel(key),
      relativeLabel,
    };
  });
}

export function getMonthEntries(monthKey, entriesByDate) {
  return Object.values(entriesByDate).filter((entry) => entry.date.startsWith(monthKey));
}

export function getMonthSummary(monthKey, entriesByDate) {
  const monthEntries = getMonthEntries(monthKey, entriesByDate);
  const servingDays = monthEntries.filter((entry) => !entry.isNoMeal).length;
  const emptyDays = monthEntries.filter((entry) => entry.isNoMeal).length;

  return {
    totalDays: monthEntries.length,
    servingDays,
    emptyDays,
  };
}

export function getNormalizedMealRouteState(searchParams, referenceDate, monthOptions, entriesByDate) {
  const monthKeys = monthOptions.map((option) => option.key);
  const referenceDateKey = formatDateKey(referenceDate);
  const referenceMonthKey = formatMonthKey(referenceDate);
  const todayRailKeys = new Set(getDateRange(referenceDate, -7, 7).map(formatDateKey));
  const requestedTab = searchParams.get('tab');
  const requestedDateKey = searchParams.get('date') || '';
  const requestedMonthKey = searchParams.get('month') || '';

  const tab = requestedTab === 'month' || requestedTab === 'today' ? requestedTab : 'today';
  let monthKey = monthKeys.includes(requestedMonthKey) ? requestedMonthKey : referenceMonthKey;
  let dateKey = referenceDateKey;

  if (tab === 'today') {
    dateKey =
      requestedDateKey && todayRailKeys.has(requestedDateKey) && entriesByDate[requestedDateKey]
        ? requestedDateKey
        : referenceDateKey;

    const derivedMonthKey = formatMonthKey(parseDateKey(dateKey) || referenceDate);
    monthKey = monthKeys.includes(derivedMonthKey) ? derivedMonthKey : referenceMonthKey;
  } else {
    if (
      requestedDateKey &&
      entriesByDate[requestedDateKey] &&
      formatMonthKey(parseDateKey(requestedDateKey) || referenceDate) === monthKey
    ) {
      dateKey = requestedDateKey;
    } else if (monthKey === referenceMonthKey) {
      dateKey = referenceDateKey;
    } else {
      dateKey = getMonthEntries(monthKey, entriesByDate)[0]?.date || referenceDateKey;
    }
  }

  const normalizedParams = new URLSearchParams();
  normalizedParams.set('tab', tab);
  normalizedParams.set('date', dateKey);
  normalizedParams.set('month', monthKey);

  return {
    tab,
    dateKey,
    monthKey,
    todayRailKeys,
    normalizedParams,
    shouldNormalize: normalizedParams.toString() !== searchParams.toString(),
  };
}
