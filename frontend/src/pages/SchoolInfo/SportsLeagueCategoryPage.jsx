import { startTransition, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  CalendarDays,
  CircleAlert,
  Flag,
  Radio,
  RefreshCw,
  Settings2,
  Timer,
  Trophy,
} from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';

import { sportsLeagueApi } from '../../api/sportsLeague';
import { useAuth } from '../../context/AuthContext';
import {
  SPORTS_EVENT_TEMPLATES,
  SPORTS_LEAGUE_CATEGORY_ID,
} from '../../features/sportsLeague/data';
import useSportsLeagueLive from '../../features/sportsLeague/useSportsLeagueLive';
import {
  computeStandings,
  createTeamsMap,
  describeMatch,
  formatSportsDate,
  formatSportsDateTime,
  formatSportsTime,
  getCurrentMatch,
  getEventTone,
  getFocusedMatchId,
  getMatchEvents,
  getMatchStatusLabel,
  getNextMatch,
  getResolvedMatchStatus,
  groupMatchesByWeek,
} from '../../features/sportsLeague/utils';
import NotFoundPage from '../NotFoundPage';
import '../page-shell.css';
import styles from './SportsLeagueCategoryPage.module.css';

const STATUS_OPTIONS = [
  { value: 'auto', label: '자동' },
  { value: 'upcoming', label: '예정' },
  { value: 'live', label: '진행 중' },
  { value: 'halftime', label: '하프타임' },
  { value: 'completed', label: '경기 종료' },
];

const EVENT_TYPE_LABELS = Object.fromEntries(
  SPORTS_EVENT_TEMPLATES.map((template) => [template.id, template.label])
);
const EVENT_CARD_CLASS_NAMES = {
  neutral: 'eventCardneutral',
  goal: 'eventCardgoal',
  warning: 'eventCardwarning',
  danger: 'eventCarddanger',
  accent: 'eventCardaccent',
  info: 'eventCardinfo',
  success: 'eventCardsuccess',
};

function TeamBadge({ team, compact = false }) {
  if (!team) return null;

  return (
    <span className={`${styles.teamBadge} ${styles[`teamBadge${team.tone}`]}`}>
      {compact ? team.shortName : team.name}
    </span>
  );
}

function MatchStatusPill({ status }) {
  return (
    <span className={`${styles.statusPill} ${styles[`statusPill${status}`]}`}>
      {getMatchStatusLabel(status)}
    </span>
  );
}

function EventMarker({ eventType }) {
  return (
    <span className={`${styles.eventMarker} ${styles[`eventMarker${getEventTone(eventType)}`]}`}>
      {EVENT_TYPE_LABELS[eventType] || '일반'}
    </span>
  );
}

function getEventCardClass(eventType) {
  return styles[`eventCard${getEventTone(eventType)}`] || '';
}

function EventActions({ canManage, onEdit, onDelete }) {
  if (!canManage) return null;

  return (
    <div className={styles.eventActions}>
      <button type="button" className={styles.eventActionButton} onClick={onEdit}>
        수정
      </button>
      <button
        type="button"
        className={`${styles.eventActionButton} ${styles.eventActionButtonDanger}`}
        onClick={onDelete}
      >
        삭제
      </button>
    </div>
  );
}

function MatchCard({
  match,
  teamsMap,
  now,
  selected,
  onSelect,
  emphasis = 'default',
}) {
  const teamA = teamsMap[match.teamAId];
  const teamB = teamsMap[match.teamBId];
  const resolvedStatus = getResolvedMatchStatus(match, now);
  const showScore =
    resolvedStatus === 'live' || resolvedStatus === 'halftime' || match.status === 'completed';

  return (
    <button
      type="button"
      className={`${styles.matchCard} ${selected ? styles.matchCardSelected : ''} ${
        emphasis === 'strong' ? styles.matchCardStrong : ''
      }`}
      onClick={() => onSelect(match.id)}
    >
      <div className={styles.matchCardTop}>
        <span className={styles.matchStage}>{match.stageLabel}</span>
        <MatchStatusPill status={resolvedStatus} />
      </div>
      <div className={styles.matchCardMeta}>
        <span>{formatSportsDate(match.kickoffAt)}</span>
        <span>{formatSportsTime(match.kickoffAt)} 킥오프</span>
      </div>
      <div className={styles.scoreRow}>
        <div className={styles.scoreTeam}>
          <TeamBadge team={teamA} compact />
        </div>
        <div className={styles.scoreValue}>
          {showScore ? (
            <>
              <span>{match.score?.teamA ?? 0}</span>
              <span className={styles.scoreDivider}>:</span>
              <span>{match.score?.teamB ?? 0}</span>
            </>
          ) : (
            <span className={styles.scoreVs}>VS</span>
          )}
        </div>
        <div className={styles.scoreTeam}>
          <TeamBadge team={teamB} compact />
        </div>
      </div>
    </button>
  );
}

export default function SportsLeagueCategoryPage() {
  const { categoryId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    snapshot,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    updateMatchParticipants,
  } = useSportsLeagueLive(categoryId);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState('');
  const [knockoutDraft, setKnockoutDraft] = useState({
    matchId: '',
    teamAId: '',
    teamBId: '',
  });
  const [knockoutError, setKnockoutError] = useState('');
  const [isUpdatingKnockout, setIsUpdatingKnockout] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState({
    matchId: '',
    eventType: 'note',
    status: 'auto',
    minute: '',
    message: '',
    subjectTeamId: '',
    teamAScore: '0',
    teamBScore: '0',
    winnerTeamId: '',
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const canManage = sportsLeagueApi.managerRoles.includes(user?.role);
  const canConfigureKnockout = user?.role === 'admin';
  const teamsMap = useMemo(() => createTeamsMap(snapshot?.teams || []), [snapshot?.teams]);
  const matchesById = useMemo(
    () => Object.fromEntries((snapshot?.matches || []).map((match) => [match.id, match])),
    [snapshot?.matches]
  );

  const currentMatch = useMemo(
    () => getCurrentMatch(snapshot?.matches || [], now),
    [snapshot?.matches, now]
  );
  const nextMatch = useMemo(
    () => getNextMatch(snapshot?.matches || [], now),
    [snapshot?.matches, now]
  );
  const selectedMatchId = useMemo(
    () => getFocusedMatchId(snapshot, searchParams.get('match'), now),
    [snapshot, searchParams, now]
  );
  const selectedMatch = selectedMatchId ? matchesById[selectedMatchId] : null;
  const heroMatch = currentMatch || nextMatch || selectedMatch;
  const heroStatus = heroMatch ? getResolvedMatchStatus(heroMatch, now) : 'upcoming';
  const heroEvents = useMemo(
    () => (heroMatch ? getMatchEvents(snapshot, heroMatch.id, 'desc').slice(0, 3) : []),
    [heroMatch, snapshot]
  );
  const heroShowsScore =
    heroStatus === 'live' ||
    heroStatus === 'halftime' ||
    heroMatch?.status === 'completed' ||
    heroEvents.length > 0;
  const feedMatch = selectedMatch || currentMatch || nextMatch;
  const feedEvents = useMemo(
    () => (feedMatch ? getMatchEvents(snapshot, feedMatch.id, 'desc') : []),
    [feedMatch, snapshot]
  );
  const groupedSchedule = useMemo(
    () => groupMatchesByWeek(snapshot?.matches || []),
    [snapshot?.matches]
  );
  const knockoutMatches = useMemo(
    () =>
      (snapshot?.matches || []).filter(
        (match) => match.phase === 'knockout' || match.phase === 'final'
      ),
    [snapshot?.matches]
  );
  const standingsA = useMemo(() => computeStandings(snapshot, 'A'), [snapshot]);
  const standingsB = useMemo(() => computeStandings(snapshot, 'B'), [snapshot]);
  const selectedTemplate = SPORTS_EVENT_TEMPLATES.find(
    (template) => template.id === draft.eventType
  );
  const selectedDraftMatch = draft.matchId ? matchesById[draft.matchId] : null;
  const selectedDraftTeams = selectedDraftMatch
    ? [teamsMap[selectedDraftMatch.teamAId], teamsMap[selectedDraftMatch.teamBId]].filter(Boolean)
    : [];
  const selectedKnockoutMatch = knockoutDraft.matchId ? matchesById[knockoutDraft.matchId] : null;
  const isEditing = Boolean(editingEventId);
  const resolvedDraftStatus =
    draft.status === 'auto'
      ? selectedTemplate?.defaultStatus || selectedDraftMatch?.status || 'upcoming'
      : draft.status;
  const needsWinnerSelection = Boolean(
    selectedDraftMatch &&
      (selectedDraftMatch.phase === 'knockout' || selectedDraftMatch.phase === 'final') &&
      resolvedDraftStatus === 'completed' &&
      Number(draft.teamAScore) === Number(draft.teamBScore)
  );

  const buildDraftForMatch = (match, overrides = {}) => ({
    matchId: match?.id || '',
    eventType: overrides.eventType || 'note',
    status: overrides.status || 'auto',
    minute: overrides.minute ?? '',
    message: overrides.message || '',
    subjectTeamId:
      overrides.subjectTeamId && [match?.teamAId, match?.teamBId].includes(overrides.subjectTeamId)
        ? overrides.subjectTeamId
        : match?.teamAId || '',
    teamAScore: String(overrides.teamAScore ?? match?.score?.teamA ?? 0),
    teamBScore: String(overrides.teamBScore ?? match?.score?.teamB ?? 0),
    winnerTeamId:
      overrides.winnerTeamId && [match?.teamAId, match?.teamBId].includes(overrides.winnerTeamId)
        ? overrides.winnerTeamId
        : '',
  });

  const resetEditor = (match) => {
    setEditingEventId('');
    setDraft(buildDraftForMatch(match));
  };

  useEffect(() => {
    if (!snapshot || !selectedMatchId) return;
    if (searchParams.get('match') === selectedMatchId) return;

    // Keep deep links stable by normalizing every render to a concrete match query parameter.
    const next = new URLSearchParams(searchParams);
    next.set('match', selectedMatchId);
    startTransition(() => {
      setSearchParams(next, { replace: true });
    });
  }, [searchParams, selectedMatchId, setSearchParams, snapshot]);

  useEffect(() => {
    if (!selectedMatch || draft.matchId) return;
    setDraft(buildDraftForMatch(selectedMatch));
  }, [draft.matchId, selectedMatch]);

  useEffect(() => {
    if (!knockoutMatches.length) return;
    const activeMatch =
      knockoutMatches.find((match) => match.id === knockoutDraft.matchId) || knockoutMatches[0];
    if (!activeMatch) return;

    setKnockoutDraft((current) => {
      if (
        current.matchId === activeMatch.id &&
        current.teamAId === activeMatch.teamAId &&
        current.teamBId === activeMatch.teamBId
      ) {
        return current;
      }
      return {
        matchId: activeMatch.id,
        teamAId: activeMatch.teamAId,
        teamBId: activeMatch.teamBId,
      };
    });
  }, [knockoutMatches, knockoutDraft.matchId]);

  const scrollToFeed = () => {
    if (typeof document === 'undefined') return;
    const feedSection = document.getElementById('sports-feed');
    if (!feedSection) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateMatchQuery = (matchId) => {
    const next = new URLSearchParams(searchParams);
    next.set('match', matchId);
    startTransition(() => {
      setSearchParams(next, { replace: false });
    });
    scrollToFeed();
  };

  const syncDraftScore = (match) => {
    if (!match) return;
    // Pull the latest projected match score back into the editor before the next operator update.
    setDraft((current) => ({
      ...current,
      teamAScore: String(match.score?.teamA ?? 0),
      teamBScore: String(match.score?.teamB ?? 0),
      winnerTeamId:
        current.winnerTeamId && [match.teamAId, match.teamBId].includes(current.winnerTeamId)
          ? current.winnerTeamId
          : '',
      subjectTeamId:
        current.subjectTeamId && [match.teamAId, match.teamBId].includes(current.subjectTeamId)
          ? current.subjectTeamId
          : match.teamAId,
    }));
  };

  const handleDraftMatchChange = (matchId) => {
    const match = matchesById[matchId];
    if (!match) return;
    updateMatchQuery(matchId);
    setEditingEventId('');
    setDraft(buildDraftForMatch(match));
  };

  const handleTemplateChange = (eventType) => {
    setDraft((current) => ({
      ...current,
      eventType,
      status: 'auto',
      message: '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManage || !draft.matchId || isSubmitting) return;
    if (needsWinnerSelection && !draft.winnerTeamId) {
      setSubmitError('토너먼트 경기 동점 종료 시 승리 팀을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        matchId: draft.matchId,
        eventType: draft.eventType,
        status: resolvedDraftStatus,
        minute: draft.minute,
        message: draft.message,
        subjectTeamId: draft.subjectTeamId || null,
        scoreSnapshot: {
          teamA: draft.teamAScore,
          teamB: draft.teamBScore,
        },
        winnerTeamId: needsWinnerSelection ? draft.winnerTeamId || null : null,
      };

      const result = isEditing
        ? await updateEvent(editingEventId, payload)
        : await createEvent(payload);
      const updatedMatch = result.snapshot.matches.find((match) => match.id === draft.matchId);

      resetEditor(updatedMatch || selectedDraftMatch);
    } catch (issue) {
      setSubmitError(issue?.message || '문자중계 입력에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEvent = (eventItem) => {
    const match = matchesById[eventItem.matchId];
    if (!match) return;
    updateMatchQuery(match.id);
    setEditingEventId(eventItem.id);
    setSubmitError('');
    setDraft(
      buildDraftForMatch(match, {
        eventType: eventItem.eventType,
        status: eventItem.status || 'auto',
        minute: eventItem.minute ?? '',
        message: eventItem.message || '',
        subjectTeamId: eventItem.subjectTeamId || '',
        teamAScore: eventItem.scoreSnapshot?.teamA ?? 0,
        teamBScore: eventItem.scoreSnapshot?.teamB ?? 0,
        winnerTeamId: eventItem.winnerTeamId || '',
      })
    );
  };

  const handleDeleteEvent = async (eventItem) => {
    if (!canManage) return;
    const confirmed = window.confirm('이 문자중계 기록을 삭제할까요?');
    if (!confirmed) return;

    try {
      const result = await deleteEvent(eventItem.id);
      const fallbackMatch = result.snapshot.matches.find((match) => match.id === eventItem.matchId);
      if (editingEventId === eventItem.id) {
        resetEditor(fallbackMatch || selectedDraftMatch);
      }
    } catch (issue) {
      setSubmitError(issue?.message || '문자중계 삭제에 실패했습니다.');
    }
  };

  const handleKnockoutMatchChange = (matchId) => {
    const match = knockoutMatches.find((item) => item.id === matchId);
    if (!match) return;
    setKnockoutError('');
    setKnockoutDraft({
      matchId: match.id,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
    });
    updateMatchQuery(match.id);
  };

  const handleKnockoutParticipantSubmit = async (event) => {
    event.preventDefault();
    if (!canConfigureKnockout || !selectedKnockoutMatch || isUpdatingKnockout) return;
    if (
      !knockoutDraft.teamAId ||
      !knockoutDraft.teamBId ||
      knockoutDraft.teamAId === knockoutDraft.teamBId
    ) {
      setKnockoutError('서로 다른 두 팀을 선택해주세요.');
      return;
    }

    setIsUpdatingKnockout(true);
    setKnockoutError('');
    try {
      const result = await updateMatchParticipants(selectedKnockoutMatch.id, {
        teamAId: knockoutDraft.teamAId,
        teamBId: knockoutDraft.teamBId,
      });
      const updatedMatch = result.snapshot.matches.find(
        (match) => match.id === selectedKnockoutMatch.id
      );
      if (updatedMatch) {
        setKnockoutDraft({
          matchId: updatedMatch.id,
          teamAId: updatedMatch.teamAId,
          teamBId: updatedMatch.teamBId,
        });
      }
    } catch (issue) {
      setKnockoutError(issue?.message || '토너먼트 대진 저장에 실패했습니다.');
    } finally {
      setIsUpdatingKnockout(false);
    }
  };

  if (categoryId !== SPORTS_LEAGUE_CATEGORY_ID) {
    return (
      <NotFoundPage
        eyebrow="학교 생활 정보"
        title="지원하지 않는 스포츠리그 카테고리입니다."
        description="현재는 2026 1학기 3학년 남자 축구 문자중계만 제공하고 있습니다."
        primaryAction={{ label: '학교 생활 정보 홈', to: '/school-info' }}
        secondaryActions={[
          {
            label: '문자중계 홈',
            to: `/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`,
          },
        ]}
      />
    );
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>{snapshot?.category?.title || '스포츠리그 문자중계'}</h1>
          <p className="lede">
            {snapshot?.category?.subtitle || '현재 경기와 지난 기록을 모바일에서 빠르게 확인하세요.'}
          </p>
        </div>
      </div>

      {loading ? (
        <section className={styles.loadingCard}>문자중계 페이지를 준비하고 있습니다…</section>
      ) : error ? (
        <section className={styles.errorCard}>{error}</section>
      ) : (
        <>
          <section className={styles.hero}>
            <div className={styles.heroContent}>
              <div className={styles.heroText}>
                <div className={styles.heroEyebrowRow}>
                  <span className={styles.heroEyebrow}>
                    {heroStatus === 'live' || heroStatus === 'halftime'
                      ? '현재 진행 중 경기'
                      : '다음 경기'}
                  </span>
                  <div className={styles.heroBadges}>
                    <span className={styles.heroBroadcast}>
                      <Radio size={14} />
                      실시간 동기화
                    </span>
                    <MatchStatusPill status={heroStatus} />
                  </div>
                </div>

                {heroMatch ? (
                  <>
                    <h2 className={styles.heroTitle}>{heroMatch.stageLabel}</h2>
                    <p className={styles.heroMeta}>
                      <CalendarDays size={16} />
                      {formatSportsDate(heroMatch.kickoffAt)} · {formatSportsTime(heroMatch.kickoffAt)} 킥오프
                    </p>

                    <div className={styles.heroScoreboard}>
                      <div className={styles.heroTeamBlock}>
                        <TeamBadge team={teamsMap[heroMatch.teamAId]} />
                      </div>
                      <div className={styles.heroScore}>
                        {heroShowsScore ? (
                          <>
                            <span>{heroMatch.score?.teamA ?? 0}</span>
                            <span className={styles.heroScoreDivider}>:</span>
                            <span>{heroMatch.score?.teamB ?? 0}</span>
                          </>
                        ) : (
                          <span className={styles.scoreVs}>VS</span>
                        )}
                      </div>
                      <div className={styles.heroTeamBlock}>
                        <TeamBadge team={teamsMap[heroMatch.teamBId]} />
                      </div>
                    </div>

                    <p className={styles.heroUpdated}>
                      업데이트:{' '}
                      {heroEvents[0]?.createdAt
                        ? formatSportsDateTime(heroEvents[0].createdAt)
                        : snapshot?.updatedAt
                          ? formatSportsDateTime(snapshot.updatedAt)
                          : '아직 중계가 시작되지 않았습니다.'}
                    </p>
                  </>
                ) : (
                  <div className={styles.heroEmpty}>표시할 경기가 아직 등록되지 않았습니다.</div>
                )}
              </div>
            </div>
            <div className={styles.heroDecoration} aria-hidden="true">
              <span className={styles.heroStripeTop} />
              <span className={styles.heroStripeBottom} />
            </div>
          </section>

          <section
            className={`${styles.broadcastGrid} ${!canManage ? styles.broadcastGridSingle : ''}`}
          >
            <article className={`${styles.panelCard} ${styles.feedPanel}`} id="sports-feed">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>문자중계</p>
                  <h2 className={styles.sectionTitle}>
                    {feedMatch ? `${feedMatch.stageLabel} 실시간 피드` : '실시간 피드'}
                  </h2>
                </div>
                <p className={styles.sectionHint}>
                  {feedMatch ? describeMatch(feedMatch, teamsMap) : '경기를 선택해 주세요.'}
                </p>
              </div>

              {feedMatch ? (
                <div className={styles.feedMetaRow}>
                  <MatchStatusPill status={getResolvedMatchStatus(feedMatch, now)} />
                  <span>{formatSportsDate(feedMatch.kickoffAt)}</span>
                </div>
              ) : null}

              <div className={styles.liveFeed} aria-live="polite">
                {feedMatch && feedEvents.length ? (
                  feedEvents.map((eventItem) => (
                    <div
                      key={eventItem.id}
                      className={`${styles.liveFeedItem} ${getEventCardClass(eventItem.eventType)}`}
                    >
                      <div className={styles.eventRowTop}>
                        <div className={styles.eventRowMeta}>
                          <EventMarker eventType={eventItem.eventType} />
                          <span>
                            {eventItem.minute != null
                              ? `${eventItem.minute}'`
                              : formatSportsDateTime(eventItem.createdAt)}
                          </span>
                        </div>
                        <span className={styles.eventOperator}>
                          {
                            eventItem.author?.nickname || '운영진'
                          }
                        </span>
                      </div>
                      <EventActions
                        canManage={canManage}
                        onEdit={() => handleEditEvent(eventItem)}
                        onDelete={() => handleDeleteEvent(eventItem)}
                      />
                      <p className={styles.eventMessage}>{eventItem.message}</p>
                      <p className={styles.eventScoreHint}>
                        스코어 {eventItem.scoreSnapshot?.teamA ?? 0}:
                        {eventItem.scoreSnapshot?.teamB ?? 0}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className={styles.feedEmpty}>
                    아직 등록된 문자중계가 없습니다. 경기 시작 후 운영진이 순차적으로 기록합니다.
                  </div>
                )}
              </div>
            </article>

            {canManage ? (
              <article className={`${styles.panelCard} ${styles.editorPanel}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>운영진 입력</p>
                    <h2 className={styles.sectionTitle}>
                      {isEditing ? '문자중계 수정' : '문자중계 입력'}
                    </h2>
                  </div>
                  <p className={styles.sectionHint}>
                    {isEditing
                      ? '기존 기록을 수정하거나 삭제한 뒤 저장할 수 있습니다.'
                      : '학생회 이상 권한만 표시됩니다.'}
                  </p>
                </div>

                <form className={styles.editorForm} onSubmit={handleSubmit}>
                  {isEditing ? (
                    <div className={styles.editorModeBanner}>
                      <span>수정 중인 기록이 있습니다.</span>
                      <button
                        type="button"
                        className={styles.eventActionButton}
                        onClick={() => resetEditor(selectedDraftMatch)}
                      >
                        취소
                      </button>
                    </div>
                  ) : null}

                  <label className={styles.fieldLabel}>
                    <span>경기 선택</span>
                    <select
                      value={draft.matchId}
                      onChange={(event) => handleDraftMatchChange(event.target.value)}
                      className={styles.selectField}
                      required
                    >
                      <option value="" disabled>
                        경기 선택
                      </option>
                      {(snapshot?.matches || []).map((match) => (
                        <option key={match.id} value={match.id}>
                          {formatSportsDate(match.kickoffAt)} · {match.stageLabel} ·{' '}
                          {describeMatch(match, teamsMap)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className={styles.templateRow}>
                    {SPORTS_EVENT_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className={`${styles.templateChip} ${
                          draft.eventType === template.id ? styles.templateChipActive : ''
                        }`}
                        onClick={() => handleTemplateChange(template.id)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.formGrid}>
                    <label className={styles.fieldLabel}>
                      <span>상태</span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, status: event.target.value }))
                        }
                        className={styles.selectField}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.fieldLabel}>
                      <span>분</span>
                      <input
                        className={styles.inputField}
                        inputMode="numeric"
                        value={draft.minute}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, minute: event.target.value }))
                        }
                        placeholder="예: 12"
                      />
                    </label>

                    <label className={styles.fieldLabel}>
                      <span>대상 팀</span>
                      <select
                        value={draft.subjectTeamId}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            subjectTeamId: event.target.value,
                          }))
                        }
                        className={styles.selectField}
                        disabled={!selectedDraftTeams.length}
                      >
                        <option value="">경기 전체</option>
                        {selectedDraftTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className={styles.fieldLabel}>
                    <span>중계 문구</span>
                    <textarea
                      className={styles.textareaField}
                      value={draft.message}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, message: event.target.value }))
                      }
                      placeholder={selectedTemplate?.placeholder}
                      rows={4}
                      maxLength={240}
                    />
                    <small className={styles.helperText}>{selectedTemplate?.helper}</small>
                  </label>

                  {needsWinnerSelection ? (
                    <label className={styles.fieldLabel}>
                      <span>승리 팀</span>
                      <select
                        value={draft.winnerTeamId}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            winnerTeamId: event.target.value,
                          }))
                        }
                        className={styles.selectField}
                        required
                      >
                        <option value="">승리 팀 선택</option>
                        {selectedDraftTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <div className={styles.scoreEditor}>
                    <div className={styles.scoreEditorHeader}>
                      <span>점수 스냅샷</span>
                      <button
                        type="button"
                        className={styles.syncButton}
                        onClick={() => syncDraftScore(selectedDraftMatch)}
                      >
                        <RefreshCw size={14} />
                        현재 점수
                      </button>
                    </div>

                    <div className={styles.scoreEditorGrid}>
                      <label className={styles.scoreField}>
                        <span>{teamsMap[selectedDraftMatch?.teamAId]?.shortName || '팀 A'}</span>
                        <input
                          className={styles.inputField}
                          inputMode="numeric"
                          value={draft.teamAScore}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              teamAScore: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className={styles.scoreField}>
                        <span>{teamsMap[selectedDraftMatch?.teamBId]?.shortName || '팀 B'}</span>
                        <input
                          className={styles.inputField}
                          inputMode="numeric"
                          value={draft.teamBScore}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              teamBScore: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {submitError ? <p className={styles.errorText}>{submitError}</p> : null}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !draft.matchId}
                  >
                    {isSubmitting
                      ? isEditing
                        ? '수정 중…'
                        : '등록 중…'
                      : isEditing
                        ? '수정 저장'
                        : '중계 올리기'}
                  </button>
                </form>

                {canConfigureKnockout ? (
                  <form className={styles.knockoutConfigurator} onSubmit={handleKnockoutParticipantSubmit}>
                    <div className={styles.knockoutConfiguratorHeader}>
                      <div>
                        <p className={styles.sectionEyebrow}>토너먼트 대진 설정</p>
                        <h3 className={styles.knockoutConfiguratorTitle}>
                          <Settings2 size={16} />
                          준결승 / 결승 참가 팀
                        </h3>
                      </div>
                      <p className={styles.sectionHint}>
                        자동 예측 대신 admin이 직접 설정합니다.
                      </p>
                    </div>

                    <label className={styles.fieldLabel}>
                      <span>토너먼트 경기</span>
                      <select
                        value={knockoutDraft.matchId}
                        onChange={(event) => handleKnockoutMatchChange(event.target.value)}
                        className={styles.selectField}
                      >
                        {knockoutMatches.map((match) => (
                          <option key={match.id} value={match.id}>
                            {match.stageLabel}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className={styles.knockoutTeamGrid}>
                      <label className={styles.fieldLabel}>
                        <span>팀 A</span>
                        <select
                          value={knockoutDraft.teamAId}
                          onChange={(event) =>
                            setKnockoutDraft((current) => ({
                              ...current,
                              teamAId: event.target.value,
                            }))
                          }
                          className={styles.selectField}
                        >
                          {(snapshot?.teams || []).map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.fieldLabel}>
                        <span>팀 B</span>
                        <select
                          value={knockoutDraft.teamBId}
                          onChange={(event) =>
                            setKnockoutDraft((current) => ({
                              ...current,
                              teamBId: event.target.value,
                            }))
                          }
                          className={styles.selectField}
                        >
                          {(snapshot?.teams || []).map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {knockoutError ? <p className={styles.errorText}>{knockoutError}</p> : null}

                    <button
                      type="submit"
                      className="btn btn-secondary"
                      disabled={isUpdatingKnockout || !selectedKnockoutMatch}
                    >
                      {isUpdatingKnockout ? '저장 중…' : '대진 저장'}
                    </button>
                  </form>
                ) : null}
              </article>
            ) : null}
          </section>

          <section className={styles.quickRail} aria-label="빠른 이동">
            <a href="#sports-feed" className={styles.railCard}>
              <span className={styles.railLabel}>현재 경기</span>
              <strong>
                {currentMatch ? describeMatch(currentMatch, teamsMap) : '현재 진행 중 경기 없음'}
              </strong>
            </a>
            <a href="#sports-schedule" className={styles.railCard}>
              <span className={styles.railLabel}>다음 경기</span>
              <strong>{nextMatch ? describeMatch(nextMatch, teamsMap) : '예정 경기 없음'}</strong>
            </a>
            <a href="#sports-feed" className={styles.railCard}>
              <span className={styles.railLabel}>중계 로그</span>
              <strong>{snapshot?.liveEvents?.length || 0}개 기록</strong>
            </a>
          </section>

          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <AlarmClock size={18} />
              </div>
              <p className={styles.summaryLabel}>대회 기간</p>
              <h2 className={styles.summaryValue}>{snapshot.category.scheduleWindowLabel}</h2>
              <p className={styles.summaryDescription}>{snapshot.category.matchTimeLabel}</p>
            </article>

            <article className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <Flag size={18} />
              </div>
              <p className={styles.summaryLabel}>다음 경기</p>
              <h2 className={styles.summaryValue}>
                {nextMatch ? formatSportsDate(nextMatch.kickoffAt) : '모든 경기 종료'}
              </h2>
              <p className={styles.summaryDescription}>
                {nextMatch ? describeMatch(nextMatch, teamsMap) : '추가 일정이 없습니다.'}
              </p>
            </article>

            <article className={styles.summaryCard}>
              <div className={styles.summaryIcon}>
                <Timer size={18} />
              </div>
              <p className={styles.summaryLabel}>중계 로그</p>
              <h2 className={styles.summaryValue}>{snapshot?.liveEvents?.length || 0}개</h2>
              <p className={styles.summaryDescription}>
                선택한 경기에서 과거 중계 기록까지 바로 확인할 수 있습니다.
              </p>
            </article>
          </section>

          <section className={`${styles.panelCard} ${styles.standingsSection}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>조별 순위</p>
                <h2 className={styles.sectionTitle}>예선 순위판</h2>
              </div>
              <p className={styles.sectionHint}>승점 → 득실차 → 다득점 → 맞대결 순</p>
            </div>

            <div className={styles.standingsGrid}>
              {[
                { label: 'A조', value: standingsA },
                { label: 'B조', value: standingsB },
              ].map((item) => (
                <div key={item.label} className={styles.groupStandings}>
                  <div className={styles.groupStandingsHeader}>
                    <h3>{item.label}</h3>
                    {item.value.isOfficialOverride ? (
                      <span className={styles.overrideBadge}>official override</span>
                    ) : null}
                  </div>

                  <div className={styles.mobileStandingsList}>
                    {item.value.rows.map((row) => (
                      <article key={row.team.id} className={styles.mobileStandingCard}>
                        <div className={styles.mobileStandingTop}>
                          <div className={styles.standingsTeamCell}>
                            <span className={styles.rankBadge}>{row.rank}</span>
                            <TeamBadge team={row.team} compact />
                          </div>
                          <strong>{row.points}점</strong>
                        </div>
                        <div className={styles.mobileStandingStats}>
                          <span>득실 {row.goalDifference}</span>
                          <span>득점 {row.goalsFor}</span>
                          <span>{row.wins}승</span>
                          <span>{row.draws}무</span>
                          <span>{row.losses}패</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className={styles.desktopStandingsTable}>
                    <div className="u-mobile-scroll">
                      <table className={styles.standingsTable}>
                        <thead>
                          <tr>
                            <th>팀</th>
                            <th>승점</th>
                            <th>득실</th>
                            <th>득점</th>
                            <th>승</th>
                            <th>무</th>
                            <th>패</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.value.rows.map((row) => (
                            <tr key={row.team.id}>
                              <td>
                                <div className={styles.standingsTeamCell}>
                                  <span className={styles.rankBadge}>{row.rank}</span>
                                  <TeamBadge team={row.team} compact />
                                </div>
                              </td>
                              <td>{row.points}</td>
                              <td>{row.goalDifference}</td>
                              <td>{row.goalsFor}</td>
                              <td>{row.wins}</td>
                              <td>{row.draws}</td>
                              <td>{row.losses}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {item.value.warnings.length ? (
                    <div className={styles.warningStack}>
                      {item.value.warnings.map((warning) => (
                        <p key={warning} className={styles.warningText}>
                          <CircleAlert size={14} />
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.panelCard} ${styles.scheduleSection}`} id="sports-schedule">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>전체 일정</p>
                <h2 className={styles.sectionTitle}>주차별 대진표</h2>
              </div>
              <p className={styles.sectionHint}>카드를 누르면 해당 경기로 바로 이동합니다.</p>
            </div>

            <div className={styles.weekStacks}>
              {groupedSchedule.map((week) => (
                <section key={week.weekLabel} className={styles.weekBlock}>
                  <div className={styles.weekHeader}>
                    <h3>{week.weekLabel}</h3>
                    <span>{week.matches.length}경기</span>
                  </div>
                  <div className={styles.scheduleGrid}>
                    {week.matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        teamsMap={teamsMap}
                        now={now}
                        selected={selectedMatchId === match.id}
                        onSelect={updateMatchQuery}
                        emphasis={
                          match.phase === 'knockout' || match.phase === 'final'
                            ? 'strong'
                            : 'default'
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className={`${styles.rulesGrid} ${styles.rulesSection}`}>
            <article className={styles.panelCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>규칙 요약</p>
                  <h2 className={styles.sectionTitle}>경기 방식</h2>
                </div>
              </div>
              <ul className={styles.ruleList}>
                {snapshot.rules.format.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>

            <article className={styles.panelCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>승점 규칙</p>
                  <h2 className={styles.sectionTitle}>순위 산정</h2>
                </div>
              </div>
              <div className={styles.ruleColumns}>
                <div>
                  <h3 className={styles.ruleHeading}>
                    <Trophy size={16} />
                    승점
                  </h3>
                  <ul className={styles.ruleList}>
                    {snapshot.rules.points.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className={styles.ruleHeading}>
                    <CircleAlert size={16} />
                    동률 시
                  </h3>
                  <ol className={styles.ruleList}>
                    {snapshot.rules.ranking.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </article>

            <article className={styles.panelCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>유의사항</p>
                  <h2 className={styles.sectionTitle}>운영 공지</h2>
                </div>
              </div>
              <ul className={styles.ruleList}>
                {snapshot.rules.notes.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
