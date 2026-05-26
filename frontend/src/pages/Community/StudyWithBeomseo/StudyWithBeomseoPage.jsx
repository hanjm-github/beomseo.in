/**
 * @file src/pages/Community/StudyWithBeomseo/StudyWithBeomseoPage.jsx
 * @description Study With Beomseo class leaderboard page.
 */
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Clock3,
  Loader2,
  Medal,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';

import SEO from '../../../components/SEO';
import {
  getStudyWithBeomseoErrorMessage,
  studyWithBeomseoApi,
  STUDY_WITH_BEOMSEO_CLASS_OPTIONS,
} from '../../../api/studyWithBeomseo';
import { useAuth } from '../../../context/AuthContext';
import '../../page-shell.css';
import styles from './StudyWithBeomseoPage.module.css';

const SCORE_FORMATTER = new Intl.NumberFormat('ko-KR');
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatScore(value) {
  return `${SCORE_FORMATTER.format(Number(value || 0))}점`;
}

function formatDateTime(value) {
  if (!value) return '공개 기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return DATE_TIME_FORMATTER.format(date);
}

function formatPublishedThrough(value) {
  if (!value) return '아직 공개된 점수 없음';
  return `${formatDateTime(value)}까지 반영`;
}

function formatRemainingTime(targetValue, now) {
  if (!targetValue) return '예약 시간 미정';
  const target = new Date(targetValue);
  if (Number.isNaN(target.getTime())) return '예약 시간 확인 필요';

  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return '공개 대기 중';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}일 ${hours}시간 후`;
  if (hours > 0) return `${hours}시간 ${minutes}분 후`;
  if (minutes > 0) return `${minutes}분 ${seconds}초 후`;
  return `${seconds}초 후`;
}

function resolveServerNow(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toKstIsoFromDateTimeLocal(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  // datetime-local has no timezone; Study With Beomseo schedules are authored
  // as school-local KST times and sent with an explicit +09:00 offset.
  return `${withSeconds}+09:00`;
}

function sortLeaderboardRows(items) {
  return [...items].sort((left, right) => {
    const rankDelta = Number(left.rank || 0) - Number(right.rank || 0);
    if (rankDelta !== 0) return rankDelta;
    const scoreDelta = Number(right.totalScore || 0) - Number(left.totalScore || 0);
    if (scoreDelta !== 0) return scoreDelta;
    return String(left.classId).localeCompare(String(right.classId), 'ko-KR', { numeric: true });
  });
}

function getRankClassName(rank) {
  if (rank === 1) return styles.rankGold;
  if (rank === 2) return styles.rankSilver;
  if (rank === 3) return styles.rankBronze;
  return '';
}

function LoadingBoard() {
  return (
    <section className={styles.statePanel} aria-live="polite">
      <Loader2 size={22} className={styles.spinner} aria-label="불러오는 중" />
      <div>
        <h2>순위판을 불러오는 중입니다.</h2>
        <p>공개 시간이 지난 점수만 정리하고 있습니다.</p>
      </div>
    </section>
  );
}

function StatePanel({ icon, title, description, actionLabel, onAction, tone = 'neutral' }) {
  return (
    <section className={`${styles.statePanel} ${tone === 'error' ? styles.statePanelError : ''}`}>
      {createElement(icon, { size: 24, 'aria-hidden': true })}
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className={styles.secondaryButton} onClick={onAction}>
          <RefreshCw size={16} />
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function TopRankCard({ row }) {
  return (
    <article className={`${styles.topRankCard} ${getRankClassName(row.rank)}`}>
      <div className={styles.topRankHeader}>
        <span className={styles.medalIcon} aria-hidden="true">
          <Medal size={20} />
        </span>
        <span className={styles.topRankNumber}>Rank {row.rank}</span>
      </div>
      <strong className={styles.topRankClass}>{row.label}</strong>
      <span className={styles.topRankScore}>{formatScore(row.totalScore)}</span>
      <span className={styles.topRankTime}>{formatDateTime(row.lastPublishedAt)}</span>
    </article>
  );
}

export default function StudyWithBeomseoPage() {
  const { user } = useAuth();
  const [scoreboard, setScoreboard] = useState({
    serverNow: null,
    updatedThrough: null,
    canManage: false,
    items: [],
    pendingUpdates: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [form, setForm] = useState({
    classId: STUDY_WITH_BEOMSEO_CLASS_OPTIONS[0]?.classId || '',
    totalScore: '',
    effectiveAt: '',
  });

  const canManage = Boolean(scoreboard.canManage || studyWithBeomseoApi.canManage(user));

  const loadScoreboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const nextScoreboard = await studyWithBeomseoApi.getScoreboard();
      setScoreboard(nextScoreboard);
      setNow(resolveServerNow(nextScoreboard.serverNow));
    } catch (error) {
      setLoadError(
        getStudyWithBeomseoErrorMessage(
          error,
          '스터디 윗 범서 순위판 API가 아직 연결되지 않았습니다.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // The initial load is kept local to this effect so late responses cannot
    // update state after route transitions.
    const load = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const nextScoreboard = await studyWithBeomseoApi.getScoreboard();
        if (!cancelled) {
          setScoreboard(nextScoreboard);
          setNow(resolveServerNow(nextScoreboard.serverNow));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            getStudyWithBeomseoErrorMessage(
              error,
              '스터디 윗 범서 순위판 API가 아직 연결되지 않았습니다.'
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canManage || scoreboard.pendingUpdates.length === 0) {
      return undefined;
    }

    // Manager-only countdown labels tick locally between scoreboard refreshes.
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [canManage, scoreboard.pendingUpdates.length]);

  const rankedRows = useMemo(() => sortLeaderboardRows(scoreboard.items), [scoreboard.items]);
  const topRows = useMemo(() => rankedRows.slice(0, 3), [rankedRows]);
  const pendingUpdates = useMemo(
    () =>
      [...scoreboard.pendingUpdates].sort((left, right) =>
        String(left.effectiveAt || '').localeCompare(String(right.effectiveAt || ''))
      ),
    [scoreboard.pendingUpdates]
  );
  const leader = topRows[0] || null;

  const handleChangeForm = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setActionError('');
    setActionSuccess('');

    const totalScore = Number(form.totalScore);
    const effectiveAt = toKstIsoFromDateTimeLocal(form.effectiveAt);

    if (!form.classId || !Number.isFinite(totalScore) || totalScore < 0 || !effectiveAt) {
      setActionError('반, 최종 총점, 공개 예정 시간을 모두 입력해 주세요.');
      return;
    }

    setSaving(true);

    try {
      await studyWithBeomseoApi.scheduleScoreUpdate({
        classId: form.classId,
        totalScore,
        effectiveAt,
      });
      setActionSuccess('점수 공개 예약을 저장했습니다.');
      setForm((current) => ({
        ...current,
        totalScore: '',
        effectiveAt: '',
      }));
      await loadScoreboard();
    } catch (error) {
      setActionError(
        getStudyWithBeomseoErrorMessage(error, '점수 공개 예약을 저장하지 못했습니다.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`page-shell ${styles.page}`}>
      <SEO
        title="스터디 윗 범서 순위판"
        description="스터디 윗 범서 반별 순위와 예약 공개된 최종 점수를 확인하세요."
        path="/community/study-with-beomseo"
      />

      <section className={styles.heroBand}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>소통하는 범서고</p>
          <h1>스터디 윗 범서</h1>
          <p className={styles.description}>
            하루 동안 모인 점수는 바로 반영되지 않으며,<br />
            다음날 낮 12시에 범서인 순위 게시판에 업데이트됩니다!<br />
            예시) 5월 26일에 획득한 점수 → 5월 27일 낮 12시에 순위표 반영
          </p>
        </div>

        <div className={styles.heroStats} aria-label="순위판 요약">
          <div className={styles.statBlock}>
            <Trophy size={18} aria-hidden="true" />
            <span>현재 1위</span>
            <strong>{leader ? leader.label : '-'}</strong>
          </div>
          <div className={styles.statBlock}>
            <Sparkles size={18} aria-hidden="true" />
            <span>마지막 업데이트</span>
            <strong>{formatPublishedThrough(scoreboard.updatedThrough)}</strong>
          </div>
          <div className={styles.statBlock}>
            <Clock3 size={18} aria-hidden="true" />
            <span>참여 범위</span>
            <strong>1-1부터 3-10까지</strong>
          </div>
        </div>
      </section>

      {loading ? <LoadingBoard /> : null}

      {!loading && loadError ? (
        <StatePanel
          icon={AlertCircle}
          title="순위판 API 연결이 필요합니다."
          description={loadError}
          actionLabel="다시 불러오기"
          onAction={loadScoreboard}
          tone="error"
        />
      ) : null}

      {!loading && !loadError && rankedRows.length === 0 ? (
        <StatePanel
          icon={Trophy}
          title="아직 공개된 점수 데이터가 없습니다."
          description="예약된 점수의 공개 시간이 지나면 이곳에 반별 순위가 표시됩니다."
        />
      ) : null}

      {!loading && !loadError && rankedRows.length > 0 ? (
        <>
          <section className={styles.podiumSection} aria-labelledby="study-top-ranks">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Top Class</p>
                <h2 id="study-top-ranks">상위 3개 반</h2>
              </div>
            </div>
            <div className={styles.topRankGrid}>
              {topRows.map((row) => (
                <TopRankCard key={row.classId} row={row} />
              ))}
            </div>
          </section>

          <section className={styles.boardSection} aria-labelledby="study-rank-board">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Rank Board</p>
                <h2 id="study-rank-board">전체 순위</h2>
              </div>
              <span className={styles.updateChip}>
                <CalendarClock size={15} />
                {formatPublishedThrough(scoreboard.updatedThrough)}
              </span>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.rankTable}>
                <thead>
                  <tr>
                    <th scope="col">순위</th>
                    <th scope="col">반</th>
                    <th scope="col">총점</th>
                    <th scope="col">마지막 업데이트</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedRows.map((row) => (
                    <tr key={row.classId} className={row.rank <= 3 ? styles.topRow : ''}>
                      <td data-label="순위">
                        <span className={`${styles.rankBadge} ${getRankClassName(row.rank)}`}>
                          {row.rank}
                        </span>
                      </td>
                      <th scope="row" data-label="반">
                        {row.label}
                      </th>
                      <td data-label="총점" className={styles.scoreCell}>
                        {formatScore(row.totalScore)}
                      </td>
                      <td data-label="마지막 업데이트">{formatDateTime(row.lastPublishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {canManage && !loadError ? (
        <section className={styles.managerSection} aria-labelledby="study-manager-panel">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Manager</p>
              <h2 id="study-manager-panel">점수 공개 예약</h2>
            </div>
            <span className={styles.managerBadge}>
              <ShieldCheck size={15} />
              학생회 이상
            </span>
          </div>

          <form className={styles.managerForm} onSubmit={handleSubmit}>
            <label className={styles.formField}>
              <span>반</span>
              <select value={form.classId} onChange={handleChangeForm('classId')} disabled={saving}>
                {STUDY_WITH_BEOMSEO_CLASS_OPTIONS.map((option) => (
                  <option key={option.classId} value={option.classId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.formField}>
              <span>최종 총점</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.totalScore}
                onChange={handleChangeForm('totalScore')}
                disabled={saving}
                placeholder="예: 1650"
              />
            </label>

            <label className={styles.formField}>
              <span>공개 예정 시간</span>
              <input
                type="datetime-local"
                value={form.effectiveAt}
                onChange={handleChangeForm('effectiveAt')}
                disabled={saving}
              />
            </label>

            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? <Loader2 size={16} className={styles.spinner} /> : <Save size={16} />}
              예약 저장
            </button>
          </form>

          <div className={styles.formStatus} aria-live="polite">
            {actionError ? <p className={styles.errorText}>{actionError}</p> : null}
            {actionSuccess ? <p className={styles.successText}>{actionSuccess}</p> : null}
          </div>

          <div className={styles.pendingPanel}>
            <div className={styles.pendingHeader}>
              <h3>대기 중인 점수</h3>
              <span>{pendingUpdates.length}건</span>
            </div>

            {pendingUpdates.length > 0 ? (
              <div className={styles.pendingList}>
                {pendingUpdates.map((update) => (
                  <article key={update.id} className={styles.pendingItem}>
                    <div>
                      <strong>{update.label}</strong>
                      <span>{formatScore(update.totalScore)}</span>
                    </div>
                    <div>
                      <span>{formatDateTime(update.effectiveAt)}</span>
                      <em>{formatRemainingTime(update.effectiveAt, now)}</em>
                    </div>
                    {update.createdBy?.nickname ? (
                      <span className={styles.creatorText}>{update.createdBy.nickname}</span>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.pendingEmpty}>예약 대기 중인 점수가 없습니다.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
