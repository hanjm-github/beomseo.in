import { startTransition, useEffect, useMemo } from 'react';
import { CalendarDays, FileText, GraduationCap, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import {
  ACADEMIC_CATEGORY_META,
  ACADEMIC_EVENTS,
  ACADEMIC_YEAR_META,
} from '../../features/academicCalendar/data';
import {
  buildMonthMatrix,
  compareAcademicEvents,
  formatDateRangeKo,
  getAudienceLabel,
  getDefaultMonthKey,
  getMonthEvents,
  getNextAcademicEvent,
  getSemesterLabel,
  getVisibleMonths,
} from '../../features/academicCalendar/utils';
import '../page-shell.css';
import styles from './AcademicCalendarPage.module.css';

const WEEKDAY_COLUMNS = [
  { day: 1, label: '월' },
  { day: 2, label: '화' },
  { day: 3, label: '수' },
  { day: 4, label: '목' },
  { day: 5, label: '금' },
];
const WEEKDAY_LABEL_BY_DAY = Object.fromEntries(
  WEEKDAY_COLUMNS.map(({ day, label }) => [day, label]),
);
const SEMESTER_OPTIONS = [
  ...ACADEMIC_YEAR_META.semesters,
  { id: 'all', label: '1,2학기 전체' },
];

function isWeekdayCell(cell) {
  const day = cell.date.getDay();
  return day >= 1 && day <= 5;
}

function isSemester(value) {
  return value === 'spring' || value === 'fall' || value === 'all';
}

function getSemesterOptionLabel(value) {
  if (value === 'all') {
    return '1,2학기 전체';
  }

  return getSemesterLabel(value);
}

function getSemesterSummaryDescription(value) {
  if (value === 'all') {
    const totalSchoolDays = ACADEMIC_YEAR_META.semesters.reduce(
      (sum, semester) => sum + semester.schoolDays,
      0,
    );
    const combinedBreaks = ACADEMIC_YEAR_META.semesters
      .map((semester) => semester.breakSummary)
      .join(' · ');

    return `${totalSchoolDays}일 수업 · ${combinedBreaks}`;
  }

  const semesterMeta = ACADEMIC_YEAR_META.semesters.find((semester) => semester.id === value);
  return `${semesterMeta?.schoolDays || 0}일 수업 · ${semesterMeta?.breakSummary || ''}`;
}

export default function AcademicCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleMonths = useMemo(() => getVisibleMonths(), []);
  const monthMap = useMemo(
    () => Object.fromEntries(visibleMonths.map((month) => [month.key, month])),
    [visibleMonths],
  );
  const requestedEvent = useMemo(
    () => ACADEMIC_EVENTS.find((event) => event.id === searchParams.get('event')) || null,
    [searchParams],
  );

  const activeMonthKey = useMemo(() => {
    const requestedMonth = searchParams.get('month');

    if (requestedMonth && monthMap[requestedMonth]) {
      return requestedMonth;
    }

    if (requestedEvent) {
      return requestedEvent.startDate.slice(0, 7);
    }

    const requestedSemester = searchParams.get('semester');
    if (requestedSemester === 'spring' || requestedSemester === 'fall') {
      return visibleMonths.find((month) => month.semester === requestedSemester)?.key || null;
    }

    return getDefaultMonthKey(searchParams);
  }, [monthMap, requestedEvent, searchParams, visibleMonths]);

  const activeMonth = activeMonthKey ? monthMap[activeMonthKey] : null;
  const activeSemester = useMemo(() => {
    const requestedSemester = searchParams.get('semester');

    if (isSemester(requestedSemester)) {
      return requestedSemester;
    }

    return activeMonth?.semester || 'spring';
  }, [activeMonth, searchParams]);
  const isAllView = activeSemester === 'all';

  const monthOptions = useMemo(
    () =>
      isAllView
        ? visibleMonths
        : visibleMonths.filter((month) => month.semester === activeSemester),
    [activeSemester, isAllView, visibleMonths],
  );
  const visibleMonthKeys = useMemo(
    () =>
      isAllView
        ? visibleMonths.map((month) => month.key)
        : activeMonthKey
          ? [activeMonthKey]
          : [],
    [activeMonthKey, isAllView, visibleMonths],
  );

  const calendarSections = useMemo(
    () =>
      visibleMonthKeys.map((monthKey) => ({
        month: monthMap[monthKey],
        matrix: buildMonthMatrix(monthKey, ACADEMIC_EVENTS),
      })),
    [monthMap, visibleMonthKeys],
  );

  const listedEvents = useMemo(() => {
    if (isAllView) {
      return [...ACADEMIC_EVENTS].sort(compareAcademicEvents);
    }

    return activeMonthKey ? getMonthEvents(activeMonthKey, ACADEMIC_EVENTS) : [];
  }, [activeMonthKey, isAllView]);

  const nextAcademicEvent = useMemo(() => getNextAcademicEvent(new Date(), ACADEMIC_EVENTS), []);
  const selectedEventId = listedEvents.some((event) => event.id === searchParams.get('event'))
    ? searchParams.get('event')
    : null;

  useEffect(() => {
    if (!activeMonthKey) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (nextParams.get('month') !== activeMonthKey) {
      nextParams.set('month', activeMonthKey);
      changed = true;
    }

    if (nextParams.get('semester') !== activeSemester) {
      nextParams.set('semester', activeSemester);
      changed = true;
    }

    const eventId = nextParams.get('event');
    if (eventId && !ACADEMIC_EVENTS.some((event) => event.id === eventId)) {
      nextParams.delete('event');
      changed = true;
    }

    if (changed) {
      startTransition(() => {
        setSearchParams(nextParams, { replace: true });
      });
    }
  }, [activeMonthKey, activeSemester, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    document.getElementById(`academic-event-${selectedEventId}`)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [selectedEventId]);

  const summaryCards = [
    {
      icon: CalendarDays,
      label: '학년도',
      value: ACADEMIC_YEAR_META.label,
      description: '2026.3.2~2027.02.28.',
    },
    {
      icon: GraduationCap,
      label: '선택 학기',
      value: getSemesterOptionLabel(activeSemester),
      description: getSemesterSummaryDescription(activeSemester),
    },
    {
      icon: Sparkles,
      label: '다음 일정',
      value: nextAcademicEvent?.title || '예정 없음',
      description: nextAcademicEvent
        ? formatDateRangeKo(nextAcademicEvent.startDate, nextAcademicEvent.endDate)
        : '등록된 남은 일정이 없습니다.',
    },
  ];

  const handleSemesterChange = (semester) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('semester', semester);
    nextParams.delete('event');

    if (semester === 'all') {
      nextParams.set('month', activeMonthKey || getDefaultMonthKey(searchParams) || visibleMonths[0].key);
    } else {
      const fallbackMonth = visibleMonths.find((month) => month.semester === semester);
      if (!fallbackMonth) {
        return;
      }
      nextParams.set('month', fallbackMonth.key);
    }

    startTransition(() => {
      setSearchParams(nextParams);
    });
  };

  const handleMonthChange = (monthKey) => {
    const month = monthMap[monthKey];
    if (!month) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('month', month.key);
    nextParams.set('semester', isAllView ? 'all' : month.semester);
    nextParams.delete('event');

    startTransition(() => {
      setSearchParams(nextParams);
    });

    if (isAllView) {
      window.setTimeout(() => {
        document.getElementById(`month-section-${month.key}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
  };

  const handleEventFocus = (eventId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('event', eventId);

    startTransition(() => {
      setSearchParams(nextParams);
    });
  };

  const renderCalendarGrid = (matrix) => {
    const weekdayMatrix = matrix.map((week) => week.filter(isWeekdayCell));
    const mobileAgendaCells = weekdayMatrix
      .flat()
      .filter((cell) => cell.isCurrentMonth && (cell.events.length > 0 || cell.isToday));

    return (
      <>
        <div className={styles.weekdayRow}>
          {WEEKDAY_COLUMNS.map(({ label }) => (
            <div key={label} className={styles.weekdayCell}>
              {label}
            </div>
          ))}
        </div>

        <div className={styles.calendarGrid}>
          {weekdayMatrix.flat().map((cell) => (
            <div
              key={cell.key}
              className={`${styles.dayCell} ${
                cell.isCurrentMonth ? '' : styles.dayCellMuted
              } ${cell.isToday ? styles.dayCellToday : ''}`}
            >
              <div className={styles.dayHeader}>
                <span className={styles.dayNumber}>{cell.day}</span>
              </div>
              <div className={styles.dayEvents}>
                {cell.events.slice(0, 2).map((event) => {
                  const tone = ACADEMIC_CATEGORY_META[event.category]?.tone || event.category;
                  return (
                    <button
                      key={`${cell.key}-${event.id}`}
                      type="button"
                      className={`${styles.eventPill} ${styles[`tone-${tone}`]}`}
                      onClick={() => handleEventFocus(event.id)}
                      title={event.title}
                    >
                      {event.title}
                    </button>
                  );
                })}
                {cell.events.length > 2 ? (
                  <span className={styles.moreEvents}>+{cell.events.length - 2}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mobileCalendarList}>
          {mobileAgendaCells.length ? (
            mobileAgendaCells.map((cell) => (
              <article
                key={`mobile-${cell.key}`}
                className={`${styles.mobileDayCard} ${
                  cell.isToday ? styles.mobileDayCardToday : ''
                }`}
              >
                <div className={styles.mobileDayHeader}>
                  <div>
                    <p className={styles.mobileDayWeekday}>
                      {WEEKDAY_LABEL_BY_DAY[cell.date.getDay()]}
                    </p>
                    <h3 className={styles.mobileDayDate}>{cell.day}일</h3>
                  </div>
                  {cell.isToday ? <span className={styles.mobileTodayBadge}>오늘</span> : null}
                </div>

                {cell.events.length ? (
                  <div className={styles.mobileDayEvents}>
                    {cell.events.map((event) => {
                      const tone = ACADEMIC_CATEGORY_META[event.category]?.tone || event.category;
                      return (
                        <button
                          key={`mobile-${cell.key}-${event.id}`}
                          type="button"
                          className={`${styles.eventPill} ${styles.mobileEventPill} ${
                            styles[`tone-${tone}`]
                          }`}
                          onClick={() => handleEventFocus(event.id)}
                          title={event.title}
                        >
                          {event.title}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.mobileDayEmpty}>등록된 일정이 없습니다.</p>
                )}
              </article>
            ))
          ) : (
            <div className={styles.mobileAgendaEmpty}>이번 달에 표시할 평일 일정이 없습니다.</div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>2026학년도 학사 캘린더</h1>
          <p className="lede">올해 학사일정을 한 눈에 확인해보세요!</p>
        </div>

      </div>

      <section className={styles.summaryGrid}>
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <Icon size={18} />
              </div>
              <p className={styles.summaryLabel}>{item.label}</p>
              <h2 className={styles.summaryValue}>{item.value}</h2>
              <p className={styles.summaryDescription}>{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className={styles.controlPanel}>
        <div className={styles.controlGroup}>
          <p className={styles.controlLabel}>학기 선택</p>
          <div className="tab-row">
            {SEMESTER_OPTIONS.map((semester) => (
              <button
                key={semester.id}
                type="button"
                className={`${styles.toggleButton} ${
                  activeSemester === semester.id ? styles.toggleButtonActive : ''
                }`}
                onClick={() => handleSemesterChange(semester.id)}
              >
                {semester.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <p className={styles.controlLabel}>{isAllView ? '월 바로가기' : '월 선택'}</p>
          <div className="chip-set">
            {monthOptions.map((month) => (
              <button
                key={month.key}
                type="button"
                className={`${styles.monthChip} ${
                  activeMonthKey === month.key ? styles.monthChipActive : ''
                }`}
                onClick={() => handleMonthChange(month.key)}
              >
                {month.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.calendarCard}>
          {isAllView ? (
            <>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>연간 보기</p>
                  <h2 className={styles.sectionTitle}>2026학년도 전체 일정</h2>
                </div>
                <p className={styles.sectionHint}>월 칩을 누르면 해당 달 위치로 이동합니다.</p>
              </div>

              <div className={styles.yearCalendarStack}>
                {calendarSections.map(({ month, matrix }) => (
                  <section
                    key={month.key}
                    id={`month-section-${month.key}`}
                    className={styles.monthSection}
                  >
                    <div className={styles.monthSectionHeader}>
                      <div>
                        <p className={styles.sectionEyebrow}>{month.year}년</p>
                        <h3 className={styles.monthSectionTitle}>{month.label}</h3>
                      </div>
                      <p className={styles.sectionHint}>{getSemesterLabel(month.semester)}</p>
                    </div>
                    {renderCalendarGrid(matrix)}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>{activeMonth?.year}년</p>
                  <h2 className={styles.sectionTitle}>{activeMonth?.label || '월 선택 필요'}</h2>
                </div>
                <p className={styles.sectionHint}>날짜 선택 시 일정 목록에서 해당날짜 목록이 표시됩니다.</p>
              </div>
              {calendarSections[0] ? renderCalendarGrid(calendarSections[0].matrix) : null}
            </>
          )}
        </article>

        <article className={styles.listCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{isAllView ? '연간 일정' : '월별 일정'}</p>
              <h2 className={styles.sectionTitle}>
                {isAllView ? '2026학년도 일정 목록' : `${activeMonth?.label || ''} 일정 목록`}
              </h2>
            </div>
            <p className={styles.sectionHint}>{listedEvents.length}개 일정</p>
          </div>

          {listedEvents.length === 0 ? (
            <div className={styles.emptyState}>선택한 범위에 등록된 일정이 없습니다.</div>
          ) : (
            <div className={styles.eventList}>
              {listedEvents.map((event) => {
                const tone = ACADEMIC_CATEGORY_META[event.category]?.tone || event.category;
                return (
                  <button
                    key={event.id}
                    id={`academic-event-${event.id}`}
                    type="button"
                    className={`${styles.eventCard} ${
                      selectedEventId === event.id ? styles.eventCardActive : ''
                    }`}
                    onClick={() => handleEventFocus(event.id)}
                  >
                    <div className={styles.eventCardTop}>
                      <div>
                        <h3 className={styles.eventTitle}>{event.title}</h3>
                        <p className={styles.eventDate}>
                          {formatDateRangeKo(event.startDate, event.endDate)}
                        </p>
                      </div>
                      <span className={`${styles.categoryBadge} ${styles[`tone-${tone}`]}`}>
                        {ACADEMIC_CATEGORY_META[event.category]?.label || event.category}
                      </span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaChip}>{getSemesterLabel(event.semester)}</span>
                      <span className={styles.metaChip}>{getAudienceLabel(event.audience)}</span>
                    </div>
                    {event.note ? <p className={styles.eventNote}>{event.note}</p> : null}
                  </button>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className={styles.sourceCard}>
        <div className={styles.sourceHeader}>
          <FileText size={18} />
          <h2 className={styles.sourceTitle}>출처 및 안내</h2>
        </div>
        <ul className={styles.noteList}>
          {ACADEMIC_YEAR_META.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className={styles.sourceMeta}>출처: 1. 2026학년도 학사일정.pdf (페이지 1~2 정리본)</p>
      </section>
    </div>
  );
}




