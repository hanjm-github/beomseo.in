/**
 * @file src/pages/Community/Bospi/BospiPage.jsx
 * @description BOSPI graph and prediction page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, BarChart3, Loader2, PencilLine, Save, Trophy } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SEO from '../../../components/SEO';
import { bospiApi } from '../../../api/bospi';
import { useAuth } from '../../../context/AuthContext';
import styles from './BospiPage.module.css';
import '../../page-shell.css';

const DIRECTION_LABELS = {
  increase: '증가',
  decrease: '감소',
};

const RESULT_LABELS = {
  pending: '대기',
  correct: '적중',
  incorrect: '미적중',
  tie: '동률',
};

const OUTCOME_LABELS = {
  increase: '증가',
  decrease: '감소',
  tie: '동률',
};

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

function formatRatioLabel(value) {
  if (value == null || value === '') return '-';
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return '-';
  return `${ratio.toFixed(4)}%`;
}

function formatCountPair(row) {
  if (row?.baselineStudentCount == null || row?.uniformedStudentCount == null) {
    return '-';
  }
  return `${row.uniformedStudentCount}/${row.baselineStudentCount}`;
}

function formatPredictionLabel(prediction) {
  if (!prediction?.direction) return '-';
  return DIRECTION_LABELS[prediction.direction] || '-';
}

function formatOutcomeLabel(outcome) {
  if (!outcome) return '-';
  return OUTCOME_LABELS[outcome] || '-';
}

function formatPredictionResult(prediction) {
  if (!prediction) return '-';
  return RESULT_LABELS[prediction.status] || '-';
}

function predictionResultClass(status) {
  if (status === 'correct') return styles.resultCorrect;
  if (status === 'incorrect') return styles.resultIncorrect;
  if (status === 'tie') return styles.resultTie;
  if (status === 'pending') return styles.resultPending;
  return '';
}

function rankBadgeClass(rank) {
  if (rank === 1) return styles.rankGold;
  if (rank === 2) return styles.rankSilver;
  if (rank === 3) return styles.rankBronze;
  return '';
}

function resolveDefaultRecordDate(data) {
  return data?.today || '';
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point || point.ratio == null) return null;

  return (
    <div className={styles.tooltip}>
      <strong>{point.label}</strong>
      <span>{point.ratio}%</span>
    </div>
  );
}

export default function BospiPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submittingPrediction, setSubmittingPrediction] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [recordDate, setRecordDate] = useState('');
  const [baselineStudentCount, setBaselineStudentCount] = useState('');
  const [uniformedStudentCount, setUniformedStudentCount] = useState('');
  const [managerSaving, setManagerSaving] = useState(false);
  const [managerError, setManagerError] = useState('');

  const [pendingDirection, setPendingDirection] = useState(null);
  const [predictionError, setPredictionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bospiApi
      .getState()
      .then((nextData) => {
        if (cancelled) return;
        setData(nextData);
        setLoadError(false);
        setRecordDate(resolveDefaultRecordDate(nextData));
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(
    () => [...(data?.records || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [data?.records],
  );

  const recordsByDate = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      if (record.date) map.set(record.date, record);
    });
    return map;
  }, [records]);

  const myPredictionsByDate = useMemo(() => {
    const map = new Map();
    (data?.myPredictions || []).forEach((prediction) => {
      if (prediction.targetDate) map.set(prediction.targetDate, prediction);
    });
    return map;
  }, [data?.myPredictions]);

  const comparisonsByDate = useMemo(() => {
    const map = new Map();
    (data?.comparisons || []).forEach((comparison) => {
      if (comparison.date) map.set(comparison.date, comparison);
    });
    return map;
  }, [data?.comparisons]);

  useEffect(() => {
    if (!recordDate) {
      setBaselineStudentCount('');
      setUniformedStudentCount('');
      return;
    }

    const existingRecord = recordsByDate.get(recordDate);
    setBaselineStudentCount(
      existingRecord?.baselineStudentCount != null
        ? String(existingRecord.baselineStudentCount)
        : '',
    );
    setUniformedStudentCount(
      existingRecord?.uniformedStudentCount != null
        ? String(existingRecord.uniformedStudentCount)
        : '',
    );
  }, [recordDate, recordsByDate]);

  const calculatedRecordRatio = useMemo(() => {
    const baseline = Number(baselineStudentCount);
    const uniformed = Number(uniformedStudentCount);
    if (
      !Number.isInteger(baseline) ||
      baseline <= 0 ||
      !Number.isInteger(uniformed) ||
      uniformed < 0 ||
      uniformed > baseline
    ) {
      return null;
    }
    return (uniformed / baseline) * 100;
  }, [baselineStudentCount, uniformedStudentCount]);

  const chartData = useMemo(
    () =>
      records.map((record) => ({
        date: record.date,
        label: formatDateLabel(record.date),
        ratio: record.ratio ?? null,
      })),
    [records],
  );

  const indexBoardRows = useMemo(
    () =>
      records.map((record) => {
        const comparison = comparisonsByDate.get(record.date);
        const prediction = myPredictionsByDate.get(record.date);
        return {
          date: record.date,
          label: formatDateLabel(record.date),
          ratio: record.ratio ?? null,
          baselineStudentCount: record.baselineStudentCount ?? null,
          uniformedStudentCount: record.uniformedStudentCount ?? null,
          outcome: comparison?.outcome || null,
          prediction,
        };
      }),
    [comparisonsByDate, myPredictionsByDate, records],
  );
  const rankingRows = data?.rankings || [];

  const canManage = Boolean(data?.canManage || bospiApi.canManage(user));
  const savedDirection = data?.myPrediction?.direction || null;
  const selectedDirection = pendingDirection || savedDirection;
  const predictionBaseDisabled =
    loadError || loading || submittingPrediction || !data?.predictionOpen;
  const predictionDisabled = predictionBaseDisabled;

  /* The headline mirrors the latest official record, not a pending prediction. */
  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const currentRatio = latestRecord?.ratio ?? null;
  const currentDate = latestRecord ? formatDateLabel(latestRecord.date) : null;

  /* The trend compares the latest two official records using percentage points. */
  const previousRecord = records.length > 1 ? records[records.length - 2] : null;
  const ratioChange = currentRatio != null && previousRecord?.ratio != null
    ? currentRatio - previousRecord.ratio
    : null;



  const handlePrediction = async (direction) => {
    if (predictionBaseDisabled) return;
    if (!user) {
      navigate('/login', { state: { from: '/community/bospi' } });
      return;
    }

    setPendingDirection(direction);
    setPredictionError('');
    setSubmittingPrediction(true);
    try {
      const nextData = await bospiApi.predict(direction);
      setData(nextData);
      setLoadError(false);
      setPendingDirection(null);
    } catch (err) {
      setPendingDirection(null);
      setPredictionError(err?.response?.data?.error || '예측을 저장하지 못했습니다.');
    } finally {
      setSubmittingPrediction(false);
    }
  };

  const handleRecordSubmit = async (event) => {
    event.preventDefault();
    if (!recordDate || baselineStudentCount === '' || uniformedStudentCount === '') return;

    setManagerSaving(true);
    setManagerError('');
    try {
      const nextData = await bospiApi.saveRecord({
        date: recordDate,
        baselineStudentCount: Number(baselineStudentCount),
        uniformedStudentCount: Number(uniformedStudentCount),
      });
      setData(nextData);
      setLoadError(false);
      if (!recordDate) setRecordDate(resolveDefaultRecordDate(nextData));
    } catch (err) {
      setManagerError(err?.response?.data?.error || 'BOSPI 값을 저장하지 못했습니다.');
    } finally {
      setManagerSaving(false);
    }
  };

  const unavailableClass = loadError ? styles.unavailable : '';
  const score = data?.myScore ?? 0;
  const predictionPrompt = data?.predictionOpen ? '다음 BOSPI는?' : '첫 기록을 기다리는 중';
  const selectedPredictionLabel = selectedDirection
    ? DIRECTION_LABELS[selectedDirection]
    : '-';

  return (
    <div className="page-shell">
      <SEO
        title="BOSPI"
        description="BOSPI 교복 착용 비율 그래프와 예측 페이지입니다."
        path="/community/bospi"
      />

      <div className="page-header">
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>BOSPI</h1>
          <p className="lede">
            매일 각 반 별로 교복 착용자 비율을 측정하여 BOSPI 지수로 공시합니다. 다음 지수의 등락을 예측하고, 순위권에 들어가 상금을 받아 보세요!
          </p>
        </div>
      </div>

      <div className={`${styles.dashboard} ${unavailableClass}`}>
        {/* 1. Current BOSPI headline */}
        <section className={styles.heroSection} aria-label="현재 BOSPI">
          <div className={styles.heroContent}>
            <div className={styles.acronymRow}>
              <span className={styles.acronymLetter}>B</span>
              <span className={styles.acronymWord}>e</span>
              <span className={styles.acronymLetter}>O</span>
              <span className={styles.acronymWord}>mseo high</span>
              <span className={styles.acronymLetter}>S</span>
              <span className={styles.acronymWord}>chool uniform</span>
              <span className={styles.acronymLetter}>P</span>
              <span className={styles.acronymWord}>oint</span>
              <span className={styles.acronymLetter}>I</span>
              <span className={styles.acronymWord}>ndex</span>
            </div>
            <span className={styles.heroLabel}>현재 BOSPI</span>
            <div className={styles.heroValue}>
              {loading ? (
                <Loader2 size={32} className="spin" aria-label="불러오는 중" />
              ) : currentRatio != null ? (
                <>
                  <strong className={styles.heroRatio}>
                    {currentRatio.toFixed(4)}
                    <span className={styles.heroUnit}>%</span>
                  </strong>
                  {ratioChange != null && (
                    <span
                      className={`${styles.heroChange} ${ratioChange > 0
                        ? styles.heroChangeUp
                        : ratioChange < 0
                          ? styles.heroChangeDown
                          : ''
                        }`}
                    >
                      {ratioChange > 0 ? <ArrowUp size={16} /> : ratioChange < 0 ? <ArrowDown size={16} /> : null}
                      {ratioChange > 0 ? '+' : ''}{ratioChange.toFixed(4)}%p
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.heroEmpty}>데이터 없음</span>
              )}
            </div>
            {currentDate && !loading && (
              <span className={styles.heroDate}>{currentDate} 기준</span>
            )}
          </div>
        </section>

        {/* 2. Score and next prediction controls */}
        <section className={styles.actionRow} aria-label="점수 및 예측">
          <div className={styles.scoreBox}>
            <span>내 총 점수</span>
            <strong>{score}</strong>
          </div>

          <div className={styles.predictionBox}>
            <div className={styles.predictionHeader}>
              <p className={styles.question}>{predictionPrompt}</p>
              <span>{data?.settings?.rewardPoints || 10}점</span>
            </div>
            <div className={styles.predictionButtons}>
              <button
                type="button"
                className={`${styles.predictionButton} ${styles.increaseButton} ${selectedDirection === 'increase' ? styles.predictionSelected : ''
                  }`}
                onClick={() => handlePrediction('increase')}
                disabled={predictionDisabled}
                aria-pressed={selectedDirection === 'increase'}
              >
                <ArrowUp size={20} />
                {DIRECTION_LABELS.increase}
              </button>
              <button
                type="button"
                className={`${styles.predictionButton} ${styles.decreaseButton} ${selectedDirection === 'decrease' ? styles.predictionSelected : ''
                  }`}
                onClick={() => handlePrediction('decrease')}
                disabled={predictionDisabled}
                aria-pressed={selectedDirection === 'decrease'}
              >
                <ArrowDown size={20} />
                {DIRECTION_LABELS.decrease}
              </button>
            </div>

            <p className={styles.predictionNote}>선택: {selectedPredictionLabel}</p>
            {predictionError ? <p className={styles.predictionError}>{predictionError}</p> : null}
          </div>
        </section>

        {/* 3. Official BOSPI line chart */}
        <section className={styles.chartPanel} aria-label="BOSPI 꺾은선 그래프">
          <div className={styles.chartTopbar}>
            <div className={styles.chartActions}>
              {loading ? <Loader2 size={18} className="spin" aria-label="불러오는 중" /> : null}
              {canManage && !loadError ? (
                <button
                  type="button"
                  className={styles.managerToggle}
                  onClick={() => setManagerOpen((value) => !value)}
                  aria-expanded={managerOpen}
                >
                  <PencilLine size={16} />
                  당일 학생 수 입력하기
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                />
                <YAxis
                  width={42}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '4 4' }} />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  stroke="var(--color-chart-1)"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-surface)' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {managerOpen && canManage ? (
            <div className={styles.managerPanel}>
              <form className={styles.managerForm} onSubmit={handleRecordSubmit}>
                <label className={styles.field}>
                  <span>날짜</span>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(event) => setRecordDate(event.target.value)}
                    disabled={managerSaving}
                  />
                </label>
                <label className={styles.field}>
                  <span>전체 학생 수</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={baselineStudentCount}
                    onChange={(event) => setBaselineStudentCount(event.target.value)}
                    disabled={managerSaving}
                  />
                </label>
                <label className={styles.field}>
                  <span>교복 착용 학생 수</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={uniformedStudentCount}
                    onChange={(event) => setUniformedStudentCount(event.target.value)}
                    disabled={managerSaving}
                  />
                </label>
                <div className={styles.calculatedRatio} aria-live="polite">
                  <span>자동 계산 비율</span>
                  <strong>{formatRatioLabel(calculatedRecordRatio)}</strong>
                </div>
                <button type="submit" className={styles.saveButton} disabled={managerSaving}>
                  <Save size={16} />
                  저장
                </button>
              </form>
            </div>
          ) : null}
        </section>

        {/* 4. Ranking board */}
        <div className={styles.rankingBoard} aria-label="BOSPI 랭킹 보드">
          <div className={styles.indexBoardHeader}>
            <h2>
              <span className={styles.boardIcon}><Trophy size={16} /></span>
              랭킹 보드
            </h2>
          </div>
          <p className={styles.boardDescription}>BOSPI 예측 적중률로 순위를 겨뤄보세요.</p>
          <div className={styles.tableScroller}>
            <table className={`${styles.indexTable} ${styles.rankingTable}`}>
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">사용자</th>
                  <th scope="col">총점</th>
                  <th scope="col">적중</th>
                  <th scope="col">미적중</th>
                  <th scope="col">다음 예측</th>
                </tr>
              </thead>
              <tbody>
                {rankingRows.length ? (
                  rankingRows.map((row) => (
                    <tr
                      key={row.userId || row.nickname}
                      className={row.isCurrentUser ? styles.currentRankingRow : ''}
                      aria-current={row.isCurrentUser ? 'true' : undefined}
                    >
                      <td data-label="순위">
                        <span className={`${styles.rankBadge} ${rankBadgeClass(row.rank)}`}>
                          {row.rank}
                        </span>
                      </td>
                      <th scope="row" className={styles.rankingName} data-label="사용자">
                        {row.nickname}
                      </th>
                      <td className={styles.numericCell} data-label="총점">{row.totalScore}</td>
                      <td className={styles.numericCell} data-label="적중">{row.correctCount}</td>
                      <td className={styles.numericCell} data-label="미적중">{row.incorrectCount}</td>
                      <td data-label="다음 예측">
                        <span
                          className={`${styles.trendBadge} ${row.nextPrediction?.direction === 'increase'
                            ? styles.trendIncrease
                            : row.nextPrediction?.direction === 'decrease'
                              ? styles.trendDecrease
                              : ''
                            }`}
                        >
                          {formatPredictionLabel(row.nextPrediction)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={styles.emptyCell} colSpan={6}>
                      아직 BOSPI 참여자가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Index board */}
        <div className={styles.indexBoard} aria-label="BOSPI 지수보드">
          <div className={styles.indexBoardHeader}>
            <h2>
              <span className={styles.boardIcon}><BarChart3 size={16} /></span>
              지수보드
            </h2>
          </div>
          <p className={styles.boardDescription}>날짜별 교복 착용 비율과 예측 결과를 한눈에 확인하세요.</p>
          <div className={styles.tableScroller}>
            <table className={styles.indexTable}>
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">착용·전체</th>
                  <th scope="col">비율</th>
                  <th scope="col">등락</th>
                  <th scope="col">내 예측</th>
                  <th scope="col">결과</th>
                </tr>
              </thead>
              <tbody>
                {indexBoardRows.length ? (
                  indexBoardRows.map((row) => (
                    <tr key={row.date}>
                      <td data-label="날짜">{row.label || row.date}</td>
                      <td data-label="착용·전체">{formatCountPair(row)}</td>
                      <td data-label="비율">{formatRatioLabel(row.ratio)}</td>
                      <td data-label="등락">
                        <span
                          className={`${styles.trendBadge} ${row.outcome === 'increase'
                            ? styles.trendIncrease
                            : row.outcome === 'decrease'
                              ? styles.trendDecrease
                              : ''
                            }`}
                        >
                          {formatOutcomeLabel(row.outcome)}
                        </span>
                      </td>
                      <td data-label="내 예측">{formatPredictionLabel(row.prediction)}</td>
                      <td data-label="결과">
                        <span
                          className={`${styles.resultBadge} ${predictionResultClass(
                            row.prediction?.status,
                          )}`}
                        >
                          {formatPredictionResult(row.prediction)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={styles.emptyCell} colSpan={6}>
                      아직 입력된 BOSPI 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {managerError && canManage ? <p className={styles.managerError}>{managerError}</p> : null}
        </div>
      </div>
    </div>
  );
}
