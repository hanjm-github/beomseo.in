import { ACADEMIC_CATEGORY_META, ACADEMIC_EVENTS, ACADEMIC_YEAR_META } from './data';

const CATEGORY_PRIORITY = ['exam', 'ceremony', 'trip', 'holiday', 'break', 'studentLife', 'college'];

export function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatDateRangeKo(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (startDate === endDate) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getDate()}일`;
    }

    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }

  return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`;
}

export function getMonthKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return null;
  }

  const [year, month] = monthKey.split('-').map(Number);

  if (month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1, 12);
}

export function getVisibleMonths() {
  const start = parseLocalDate(ACADEMIC_YEAR_META.startDate);
  const end = parseLocalDate(ACADEMIC_YEAR_META.endDate);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  const months = [];

  while (cursor <= end) {
    months.push({
      key: getMonthKey(cursor),
      label: `${cursor.getMonth() + 1}월`,
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      semester: cursor.getMonth() + 1 >= 8 || cursor.getMonth() + 1 <= 2 ? 'fall' : 'spring',
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export function getSemesterMeta(semester) {
  return ACADEMIC_YEAR_META.semesters.find((item) => item.id === semester) || null;
}

export function compareAcademicEvents(left, right) {
  if (left.startDate !== right.startDate) {
    return left.startDate.localeCompare(right.startDate);
  }

  const leftPriority = CATEGORY_PRIORITY.indexOf(left.category);
  const rightPriority = CATEGORY_PRIORITY.indexOf(right.category);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.title.localeCompare(right.title, 'ko');
}

export function getMonthEvents(monthKey, events = ACADEMIC_EVENTS) {
  return events
    .filter((event) => {
      const start = parseLocalDate(event.startDate);
      const end = parseLocalDate(event.endDate);
      const monthDate = parseMonthKey(monthKey);

      if (!monthDate) {
        return false;
      }

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12);

      return start <= monthEnd && end >= monthStart;
    })
    .sort(compareAcademicEvents);
}

export function getEventDateKeys(event) {
  const start = parseLocalDate(event.startDate);
  const end = parseLocalDate(event.endDate);
  const cursor = new Date(start);
  const keys = [];

  while (cursor <= end) {
    keys.push(getDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function getDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getEventsByDay(events) {
  return events.reduce((map, event) => {
    getEventDateKeys(event).forEach((dateKey) => {
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(event);
      map[dateKey].sort(compareAcademicEvents);
    });

    return map;
  }, {});
}

export function buildMonthMatrix(monthKey, events = ACADEMIC_EVENTS) {
  const monthDate = parseMonthKey(monthKey);

  if (!monthDate) {
    return [];
  }

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const eventsByDay = getEventsByDay(getMonthEvents(monthKey, events));
  const weeks = [];
  let cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const week = [];

    for (let index = 0; index < 7; index += 1) {
      const cellDate = new Date(cursor);
      const cellKey = getDateKey(cellDate);
      week.push({
        key: cellKey,
        date: cellDate,
        day: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === monthDate.getMonth(),
        isToday: cellKey === getDateKey(new Date()),
        events: eventsByDay[cellKey] || [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);
  }

  return weeks;
}

export function getSemesterLabel(semester) {
  return getSemesterMeta(semester)?.label || semester;
}

export function getCategoryLabel(category) {
  return ACADEMIC_CATEGORY_META[category]?.label || category;
}

export function getAudienceLabel(audience) {
  const audienceMap = {
    all: '전학년',
    guardian: '학부모',
    'student-council': '학생회',
    '1': '1학년',
    '2': '2학년',
    '3': '3학년',
  };

  return audience.map((item) => audienceMap[item] || item).join(' · ');
}

export function getNextAcademicEvent(referenceDate = new Date(), events = ACADEMIC_EVENTS) {
  const anchor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12);

  return events
    .filter((event) => parseLocalDate(event.endDate) >= anchor)
    .sort(compareAcademicEvents)[0] || null;
}

export function getDefaultMonthKey(searchParams) {
  const monthParam = searchParams.get('month');
  const validMonths = new Set(getVisibleMonths().map((month) => month.key));

  if (monthParam && validMonths.has(monthParam)) {
    return monthParam;
  }

  const today = new Date();
  const todayKey = getMonthKey(today);
  if (validMonths.has(todayKey)) {
    return todayKey;
  }

  const nextEvent = getNextAcademicEvent(today);
  if (nextEvent) {
    return nextEvent.startDate.slice(0, 7);
  }

  return getVisibleMonths()[0]?.key || null;
}

export function getDefaultSemester(searchParams, monthKey) {
  const semesterParam = searchParams.get('semester');

  if (semesterParam === 'spring' || semesterParam === 'fall') {
    return semesterParam;
  }

  const month = getVisibleMonths().find((item) => item.key === monthKey);
  return month?.semester || 'spring';
}
