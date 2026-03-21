import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CircleAlert,
  Radio,
  RefreshCw,
  Settings2,
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
import usePlayersStore from '../../features/sportsLeague/usePlayersStore';
import TeamLineupPanel from '../../features/sportsLeague/TeamLineupPanel';
import PlayerRankingPanel from '../../features/sportsLeague/PlayerRankingPanel';
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
  isInProgressMatchStatus,
  isScoreVisibleMatchStatus,
  groupMatchesByWeek,
  sortMatchesByKickoff,
} from '../../features/sportsLeague/utils';
import NotFoundPage from '../NotFoundPage';
import '../page-shell.css';
import styles from './SportsLeagueCategoryPage.module.css';

const STATUS_OPTIONS = [
  { value: 'upcoming', label: '예정' },
  { value: 'kickoff', label: '경기 시작' },
  { value: 'live', label: '진행 중' },
  { value: 'halftime', label: '하프타임' },
  { value: 'completed', label: '경기 종료' },
];

const SPORTS_TAB_OPTIONS = [
  { key: 'live', label: '실시간 중계' },
  { key: 'standings', label: '예선 순위판' },
  { key: 'schedule', label: '주차별 대진표' },
  { key: 'rules', label: '경기 규칙' },
  { key: 'lineup', label: '팀별 라인업' },
  { key: 'playerRanking', label: '개인별 순위' },
];

const SPORTS_TAB_KEYS = new Set(SPORTS_TAB_OPTIONS.map((tab) => tab.key));

const EVENT_TYPE_LABELS = Object.fromEntries(
  SPORTS_EVENT_TEMPLATES.map((template) => [template.id, template.label])
);

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

function MetaChip({ children }) {
  return <span className={`chip ${styles.metaChip}`}>{children}</span>;
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

function MatchPickerButton({ match, teamsMap, now, selected, signal, onSelect, buttonRef }) {
  const teamA = teamsMap[match.teamAId];
  const teamB = teamsMap[match.teamBId];
  const resolvedStatus = getResolvedMatchStatus(match, now);
  const showScore = isScoreVisibleMatchStatus(resolvedStatus);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${styles.matchPickerButton} ${selected ? styles.matchPickerButtonSelected : ''
        } ${signal ? styles.matchPickerButtonStrong : ''}`}
      onClick={() => onSelect(match.id)}
      aria-pressed={selected}
    >
      <div className={styles.matchPickerTop}>
        <span className={styles.matchPickerStage}>{match.stageLabel}</span>
        <div className={styles.matchPickerBadges}>
          {signal ? (
            <span
              className={`${styles.matchPickerSignal} ${signal === 'current'
                  ? styles.matchPickerSignalCurrent
                  : styles.matchPickerSignalNext
                }`}
            >
              {signal === 'current' ? '현재' : '다음'}
            </span>
          ) : null}
          <MatchStatusPill status={resolvedStatus} />
        </div>
      </div>
      <p className={styles.matchPickerMeta}>
        {formatSportsDate(match.kickoffAt)} · {formatSportsTime(match.kickoffAt)} 킥오프
      </p>
      <div className={styles.matchPickerTeams}>
        <span className={styles.matchPickerTeam}>{teamA?.shortName || match.teamAId}</span>
        <strong className={styles.matchPickerScore}>
          {showScore ? `${match.score?.teamA ?? 0} : ${match.score?.teamB ?? 0}` : 'VS'}
        </strong>
        <span className={styles.matchPickerTeam}>{teamB?.shortName || match.teamBId}</span>
      </div>
    </button>
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
  const showScore = isScoreVisibleMatchStatus(resolvedStatus);

  return (
    <button
      type="button"
      className={`${styles.matchCard} ${selected ? styles.matchCardSelected : ''} ${emphasis === 'strong' ? styles.matchCardStrong : ''
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
  // Player data is managed outside the live snapshot so lineup/ranking tabs can use lighter CRUD responses.
  const {
    players,
    loading: playersLoading,
    error: playersError,
    addPlayer,
    removePlayer,
    incrementStat,
    decrementStat,
  } = usePlayersStore(categoryId);
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
  const matchPickerRailRef = useRef(null);
  const matchPickerButtonRefs = useRef(new Map());
  const [draft, setDraft] = useState({
    matchId: '',
    eventType: 'note',
    status: 'auto',
    message: '',
    subjectTeamId: '',
    teamAScore: '0',
    teamBScore: '0',
    winnerTeamId: '',
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const canManage = sportsLeagueApi.managerRoles.includes(user?.role);
  const canConfigureKnockout = user?.role === 'admin';
  // Keep tab state in the query string so deep links survive refresh and tab switches.
  const activeTab = SPORTS_TAB_KEYS.has(searchParams.get('tab')) ? searchParams.get('tab') : 'live';
  const teamsMap = useMemo(() => createTeamsMap(snapshot?.teams || []), [snapshot?.teams]);
  const orderedMatches = useMemo(
    () => sortMatchesByKickoff(snapshot?.matches || []),
    [snapshot?.matches]
  );
  const matchesById = useMemo(
    () => Object.fromEntries(orderedMatches.map((match) => [match.id, match])),
    [orderedMatches]
  );
  const currentMatch = useMemo(() => getCurrentMatch(orderedMatches, now), [orderedMatches, now]);
  const nextMatch = useMemo(() => getNextMatch(orderedMatches, now), [orderedMatches, now]);
  const selectedMatchId = useMemo(
    () => getFocusedMatchId(snapshot, searchParams.get('match'), now),
    [snapshot, searchParams, now]
  );
  const selectedMatch = selectedMatchId ? matchesById[selectedMatchId] : null;
  const heroMatch = currentMatch || nextMatch || selectedMatch;
  const autoScrollMatchId = currentMatch?.id || nextMatch?.id || selectedMatchId || null;
  const heroStatus = heroMatch ? getResolvedMatchStatus(heroMatch, now) : 'upcoming';
  const latestHeroEvent = useMemo(
    () => (heroMatch ? getMatchEvents(snapshot, heroMatch.id, 'desc')[0] || null : null),
    [heroMatch, snapshot]
  );
  const heroShowsScore =
    isScoreVisibleMatchStatus(heroStatus) || Boolean(latestHeroEvent);
  const feedMatch = selectedMatch || currentMatch || nextMatch;
  const feedStatus = feedMatch ? getResolvedMatchStatus(feedMatch, now) : 'upcoming';
  const feedEvents = useMemo(
    () => (feedMatch ? getMatchEvents(snapshot, feedMatch.id, 'desc') : []),
    [feedMatch, snapshot]
  );
  const feedShowsScore = isScoreVisibleMatchStatus(feedStatus) || feedEvents.length > 0;
  const groupedSchedule = useMemo(() => groupMatchesByWeek(orderedMatches), [orderedMatches]);
  const knockoutMatches = useMemo(
    () =>
      orderedMatches.filter((match) => match.phase === 'knockout' || match.phase === 'final'),
    [orderedMatches]
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
  const statusOptions = useMemo(
    () => [
      { value: 'auto', label: `자동 (${getMatchStatusLabel(resolvedDraftStatus)})` },
      ...STATUS_OPTIONS,
    ],
    [resolvedDraftStatus]
  );
  const needsWinnerSelection = Boolean(
    selectedDraftMatch &&
    (selectedDraftMatch.phase === 'knockout' || selectedDraftMatch.phase === 'final') &&
    resolvedDraftStatus === 'completed' &&
    Number(draft.teamAScore) === Number(draft.teamBScore)
  );

  const headerMetaItems = [
    snapshot?.category?.seasonLabel,
    [snapshot?.category?.gradeLabel, snapshot?.category?.sportLabel].filter(Boolean).join(' · '),
    snapshot?.category?.scheduleWindowLabel,
    snapshot?.category?.matchTimeLabel,
    snapshot?.category?.locationLabel,
  ].filter(Boolean);

  const buildDraftForMatch = (match, overrides = {}) => ({
    matchId: match?.id || '',
    eventType: overrides.eventType || 'note',
    status: overrides.status || 'auto',
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

    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (searchParams.get('match') !== selectedMatchId) {
      next.set('match', selectedMatchId);
      changed = true;
    }

    if (!SPORTS_TAB_KEYS.has(searchParams.get('tab'))) {
      next.set('tab', 'live');
      changed = true;
    }

    if (!changed) return;

    startTransition(() => {
      setSearchParams(next, { replace: true });
    });
  }, [searchParams, selectedMatchId, setSearchParams, snapshot]);

  useEffect(() => {
    if (!selectedMatch || isEditing) return;

    setDraft((current) => {
      if (current.matchId === selectedMatch.id) return current;
      return buildDraftForMatch(selectedMatch);
    });
  }, [isEditing, selectedMatch]);

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
  }, [knockoutDraft.matchId, knockoutMatches]);

  useEffect(() => {
    if (activeTab !== 'live' || !autoScrollMatchId) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const rail = matchPickerRailRef.current;
      const target = matchPickerButtonRefs.current.get(autoScrollMatchId);

      if (!rail || !target) return;

      const targetCenter = target.offsetLeft + target.offsetWidth / 2;
      const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const nextLeft = Math.min(Math.max(0, targetCenter - rail.clientWidth / 2), maxLeft);

      rail.scrollTo({
        left: nextLeft,
        behavior: rail.scrollLeft > 0 ? 'smooth' : 'auto',
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeTab, autoScrollMatchId, orderedMatches.length]);

  const navigateLeague = ({ matchId = selectedMatchId, tabKey = activeTab, replace = false } = {}) => {
    const next = new URLSearchParams(searchParams);

    if (matchId) next.set('match', matchId);
    else next.delete('match');

    next.set('tab', SPORTS_TAB_KEYS.has(tabKey) ? tabKey : 'live');

    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  const handleTabChange = (tabKey) => {
    if (tabKey === activeTab) return;
    navigateLeague({ tabKey });
  };

  const handleViewerMatchSelect = (matchId, tabKey = 'live') => {
    const match = matchesById[matchId];

    if (match) {
      setEditingEventId('');
      setSubmitError('');
      setDraft(buildDraftForMatch(match));
    }

    navigateLeague({ matchId, tabKey });
  };

  const syncDraftScore = (match) => {
    if (!match) return;

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

    navigateLeague({ matchId, tabKey: 'live' });
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

    navigateLeague({ matchId: match.id, tabKey: 'live' });
    setEditingEventId(eventItem.id);
    setSubmitError('');
    setDraft(
      buildDraftForMatch(match, {
        eventType: eventItem.eventType,
        status: eventItem.status || 'auto',
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
    navigateLeague({ matchId: match.id, tabKey: 'live' });
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
          <h1>{snapshot?.category?.title || '2026 1학기 3학년 남자 축구'}</h1>
          <p className="lede">
            {snapshot?.category?.subtitle || '스포츠리그 반대항전 문자중계를 한눈에 확인하세요.'}
          </p>
          {!loading && !error && headerMetaItems.length ? (
            <div className={styles.metaChips}>
              {headerMetaItems.map((item) => (
                <MetaChip key={item}>{item}</MetaChip>
              ))}
            </div>
          ) : null}
          {!loading && !error && snapshot?.category?.statusNote ? (
            <p className={styles.statusNote}>{snapshot.category.statusNote}</p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <section className={styles.loadingCard}>문자중계 페이지를 준비하고 있습니다…</section>
      ) : error ? (
        <section className={styles.errorCard}>{error}</section>
      ) : (
        <>
          <div className={styles.tabBarShell}>
            <div className="tab-row" role="tablist" aria-label="스포츠리그 카테고리">
              {SPORTS_TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.key}
                  id={`sports-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`sports-panel-${tab.key}`}
                  className={`chip ${styles.tabChip} ${activeTab === tab.key ? 'chip-active' : ''}`}
                  onClick={() => handleTabChange(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <section className={styles.hero}>
            <div className={styles.heroContent}>
              <div className={styles.heroText}>
                <div className={styles.heroEyebrowRow}>
                  <span className={styles.heroEyebrow}>
                    {isInProgressMatchStatus(heroStatus)
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
                      {latestHeroEvent?.createdAt
                        ? formatSportsDateTime(latestHeroEvent.createdAt)
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

          {activeTab === 'live' ? (
            <section
              id="sports-panel-live"
              role="tabpanel"
              aria-labelledby="sports-tab-live"
              className={styles.tabPanel}
            >
              <article className={`${styles.panelCard} ${styles.liveContextPanel}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>실시간 중계</p>
                    <h2 className={styles.sectionTitle}>
                      {feedMatch ? `${feedMatch.stageLabel} 중계` : '실시간 중계'}
                    </h2>
                  </div>
                  <p className={styles.sectionHint}>
                    {feedMatch
                      ? `${describeMatch(feedMatch, teamsMap)} · ${feedEvents.length ? `${feedEvents.length}개 업데이트` : '첫 업데이트 대기 중'
                      }`
                      : '경기를 선택하면 문자중계와 운영 패널이 함께 바뀝니다.'}
                  </p>
                </div>

                {feedMatch ? (
                  <div className={styles.liveContextGrid}>
                    <div className={styles.liveContextCopy}>
                      <div className={styles.liveContextTop}>
                        <span className={styles.liveContextStage}>{feedMatch.stageLabel}</span>
                        <MatchStatusPill status={feedStatus} />
                      </div>
                      <p className={styles.liveContextMeta}>
                        <CalendarDays size={16} />
                        {formatSportsDate(feedMatch.kickoffAt)} · {formatSportsTime(feedMatch.kickoffAt)} 킥오프
                      </p>
                      <p className={styles.liveContextDescription}>
                        {describeMatch(feedMatch, teamsMap)}
                      </p>
                    </div>
                    <div className={styles.liveContextScoreboard}>
                      <div className={styles.contextTeamBlock}>
                        <TeamBadge team={teamsMap[feedMatch.teamAId]} />
                      </div>
                      <div className={styles.contextScore}>
                        {feedShowsScore ? (
                          <>
                            <span>{feedMatch.score?.teamA ?? 0}</span>
                            <span className={styles.scoreDivider}>:</span>
                            <span>{feedMatch.score?.teamB ?? 0}</span>
                          </>
                        ) : (
                          <span className={styles.scoreVs}>VS</span>
                        )}
                      </div>
                      <div className={styles.contextTeamBlock}>
                        <TeamBadge team={teamsMap[feedMatch.teamBId]} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.placeholderBlock}>경기를 선택하면 실시간 패널이 준비됩니다.</div>
                )}

                <div className={styles.pickerHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>경기 선택</p>
                    <p className={styles.pickerHint}>
                      현재 경기와 다음 경기를 포함한 전체 일정을 빠르게 전환할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div ref={matchPickerRailRef} className={styles.matchPickerRail}>
                  {orderedMatches.map((match) => (
                    <MatchPickerButton
                      key={match.id}
                      match={match}
                      teamsMap={teamsMap}
                      now={now}
                      selected={selectedMatchId === match.id}
                      signal={
                        match.id === currentMatch?.id
                          ? 'current'
                          : match.id === nextMatch?.id
                            ? 'next'
                            : null
                      }
                      buttonRef={(node) => {
                        if (node) {
                          matchPickerButtonRefs.current.set(match.id, node);
                          return;
                        }

                        matchPickerButtonRefs.current.delete(match.id);
                      }}
                      onSelect={(matchId) => handleViewerMatchSelect(matchId, 'live')}
                    />
                  ))}
                </div>
              </article>

              <div
                className={`${styles.broadcastGrid} ${!canManage ? styles.broadcastGridSingle : ''}`}
              >
                <article className={`${styles.panelCard} ${styles.feedPanel}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.sectionEyebrow}>실시간 피드</p>
                      <h2 className={styles.sectionTitle}>
                        {feedMatch ? `${feedMatch.stageLabel} 중계 로그` : '중계 피드'}
                      </h2>
                    </div>
                    <p className={styles.sectionHint}>
                      {feedMatch ? describeMatch(feedMatch, teamsMap) : '경기를 선택해 주세요.'}
                    </p>
                  </div>

                  {feedMatch ? (
                    <div className={styles.feedMetaRow}>
                      <MatchStatusPill status={feedStatus} />
                      <span>
                        {formatSportsDate(feedMatch.kickoffAt)} · {formatSportsTime(feedMatch.kickoffAt)}
                      </span>
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
                                {eventItem.createdAt
                                  ? new Date(eventItem.createdAt).toLocaleTimeString('ko-KR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false,
                                  })
                                  : '—'}
                              </span>
                            </div>
                            <span className={styles.eventOperator}>
                              {eventItem.author?.nickname || '운영진'}
                            </span>
                          </div>
                          <EventActions
                            canManage={canManage}
                            onEdit={() => handleEditEvent(eventItem)}
                            onDelete={() => handleDeleteEvent(eventItem)}
                          />
                          <p className={styles.eventMessage}>{eventItem.message}</p>
                          <p className={styles.eventScoreHint}>
                            스코어 {eventItem.scoreSnapshot?.teamA ?? 0}:{eventItem.scoreSnapshot?.teamB ?? 0}
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
                          {orderedMatches.map((match) => (
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
                            className={`${styles.templateChip} ${draft.eventType === template.id ? styles.templateChipActive : ''
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
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {draft.status === 'auto' ? (
                            <small className={styles.helperText}>
                              자동 선택 시 현재는 {getMatchStatusLabel(resolvedDraftStatus)} 상태로 등록됩니다.
                            </small>
                          ) : null}
                        </label>

                        <div className={styles.fieldLabel}>
                          <span>입력 시각</span>
                          <span className={`${styles.inputField} ${styles.readOnlyField}`}>
                            {now.toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false,
                            })}
                          </span>
                        </div>

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
                      <form
                        className={styles.knockoutConfigurator}
                        onSubmit={handleKnockoutParticipantSubmit}
                      >
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
              </div>
            </section>
          ) : null}

          {activeTab === 'standings' ? (
            <section
              id="sports-panel-standings"
              role="tabpanel"
              aria-labelledby="sports-tab-standings"
              className={styles.tabPanel}
            >
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
            </section>
          ) : null}

          {activeTab === 'schedule' ? (
            <section
              id="sports-panel-schedule"
              role="tabpanel"
              aria-labelledby="sports-tab-schedule"
              className={styles.tabPanel}
            >
              <section className={`${styles.panelCard} ${styles.scheduleSection}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>전체 일정</p>
                    <h2 className={styles.sectionTitle}>주차별 대진표</h2>
                  </div>
                  <p className={styles.sectionHint}>
                    카드를 누르면 선택 경기와 탭이 실시간 중계로 즉시 전환됩니다.
                  </p>
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
                            onSelect={(matchId) => handleViewerMatchSelect(matchId, 'live')}
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
            </section>
          ) : null}

          {activeTab === 'rules' ? (
            <section
              id="sports-panel-rules"
              role="tabpanel"
              aria-labelledby="sports-tab-rules"
              className={styles.tabPanel}
            >
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
                      <p className={styles.sectionEyebrow}>득점 규칙</p>
                      <h2 className={styles.sectionTitle}>순위 결정</h2>
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
            </section>
          ) : null}

          {activeTab === 'lineup' ? (
            <TeamLineupPanel
              teams={snapshot?.teams || []}
              players={players}
              loading={playersLoading}
              error={playersError}
              matches={orderedMatches}
              now={now}
              canManage={canManage}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
            />
          ) : null}

          {activeTab === 'playerRanking' ? (
            <PlayerRankingPanel
              players={players}
              loading={playersLoading}
              error={playersError}
              teamsMap={teamsMap}
              canManage={canManage}
              onIncrementStat={incrementStat}
              onDecrementStat={decrementStat}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
