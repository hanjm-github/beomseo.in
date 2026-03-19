import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FIELD_TRIP_MAX_SCORE,
  FIELD_TRIP_SCORE_STEP,
} from '../../features/fieldTrip/constants';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';
import { getScoreboardSummary, sortScoreRowsByClassId } from '../../features/fieldTrip/utils';

const tooltipContentStyle = {
  backgroundColor: 'var(--color-card-bg)',
  border: '1px solid var(--color-card-border)',
  borderRadius: 14,
  color: 'var(--color-text-primary)',
};

export default function FieldTripScoreboard({
  rows,
  loading,
  canManage = false,
  pendingClassId = '',
  actionError = '',
  onAdjustScore,
}) {
  const orderedRows = useMemo(() => sortScoreRowsByClassId(rows), [rows]);
  const summary = useMemo(() => getScoreboardSummary(orderedRows), [orderedRows]);
  const chartMaxScore = useMemo(() => {
    const highestScore = orderedRows.reduce(
      (maxScore, row) => Math.max(maxScore, Number(row.totalScore || 0)),
      0
    );

    // Match the chart scale to the public +/-5 manager controls so visual ticks
    // line up with the only valid score mutations.
    return Math.max(
      FIELD_TRIP_SCORE_STEP,
      Math.ceil(highestScore / FIELD_TRIP_SCORE_STEP) * FIELD_TRIP_SCORE_STEP
    );
  }, [orderedRows]);
  const chartTicks = useMemo(() => {
    const tickCount = Math.floor(chartMaxScore / FIELD_TRIP_SCORE_STEP) + 1;
    return Array.from({ length: tickCount }, (_, index) => index * FIELD_TRIP_SCORE_STEP);
  }, [chartMaxScore]);

  if (loading && !rows.length) {
    return <section className={styles.inlineState}>점수판을 불러오는 중입니다.</section>;
  }

  if (!orderedRows.length) {
    return <section className={styles.emptyCard}>아직 공개된 점수 데이터가 없습니다.</section>;
  }

  return (
    <div className={styles.scoreboardStack}>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>점수판</p>
            <h2 className={styles.sectionTitle}>10개 반 총점 현황</h2>
            <p className={styles.sectionDescription}>
              전체 반의 점수를 한눈에 확인할 수 있습니다.
            </p>
          </div>
          {canManage ? (
            <span className={styles.sectionPill}>학생회 이상 권한으로 점수를 바로 조정할 수 있습니다.</span>
          ) : null}
        </div>

        <div className={styles.scoreTableWrap}>
          <table className={styles.scoreTable}>
            <thead>
              <tr>
                <th scope="col">반</th>
                <th scope="col">총점</th>
                {canManage ? <th scope="col">조정</th> : null}
              </tr>
            </thead>
            <tbody>
              {orderedRows.map((row) => {
                const isLeader = row.classId === summary.leader?.classId;
                const isPending = pendingClassId === row.classId;

                return (
                  <tr key={row.classId} className={isLeader ? styles.scoreTableLeader : ''}>
                    <th scope="row">
                      <span className={styles.scoreRowLabel}>
                        {row.label}
                        {isLeader ? <span className={styles.scoreLeaderBadge}>선두</span> : null}
                      </span>
                    </th>
                    <td>{row.totalScore}점</td>
                    {canManage ? (
                      <td>
                        <div className={styles.scoreControls}>
                          <button
                            type="button"
                            className={styles.scoreAdjustButton}
                            onClick={() => onAdjustScore?.(row.classId, -FIELD_TRIP_SCORE_STEP)}
                            disabled={isPending || row.totalScore < FIELD_TRIP_SCORE_STEP}
                            aria-label={`${row.label} 점수 5점 감소`}
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.scoreAdjustButton}
                            onClick={() => onAdjustScore?.(row.classId, FIELD_TRIP_SCORE_STEP)}
                            disabled={isPending || row.totalScore >= FIELD_TRIP_MAX_SCORE}
                            aria-label={`${row.label} 점수 5점 증가`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {actionError ? <p className={styles.formError}>{actionError}</p> : null}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>막대그래프</p>
            <h2 className={styles.sectionTitle}>반별 총점 시각화</h2>
          </div>
        </div>

        <div className={styles.chartShell}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={orderedRows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                stroke="var(--color-card-border)"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, chartMaxScore]}
                ticks={chartTicks}
                allowDecimals={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [`${value}점`, '총점']}
                contentStyle={tooltipContentStyle}
                labelStyle={{ color: 'var(--color-text-secondary)' }}
                itemStyle={{ color: 'var(--color-text-primary)' }}
              />
              <Bar dataKey="totalScore" radius={[12, 12, 4, 4]}>
                {orderedRows.map((row) => (
                  <Cell
                    key={row.classId}
                    fill={
                      row.classId === summary.leader?.classId
                        ? 'var(--field-trip-chart-strong)'
                        : 'var(--field-trip-chart-base)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
