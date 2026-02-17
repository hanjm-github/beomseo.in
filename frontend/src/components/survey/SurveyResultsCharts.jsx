import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./survey.module.css";

const donutPalette = ["#4f46e5", "#06b6d4", "#0ea5e9", "#14b8a6", "#6366f1", "#22c55e", "#0f172a"];
const gradient = "linear-gradient(90deg, #6366f1, #22d3ee)";

const formatTooltip = (value, name, props) => {
  const pct = props?.payload?.pct ?? 0;
  const safeValue = value ?? 0;
  return [`${safeValue}회 · ${pct}%`, name];
};

const percentLabelFormatter = (value) => `${value}%`;
const renderDonutLabel = (props) => {
  const { cx, cy, midAngle, outerRadius, payload } = props || {};
  if (cx == null || cy == null || midAngle == null || outerRadius == null) return null;

  const label = payload?.label ?? "";
  const pct = payload?.pct ?? 0;
  if (!label) return null;

  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
  const textAnchor = x > cx ? "start" : "end";
  const safeLabel = label.length > 18 ? `${label.slice(0, 18)}...` : label;

  return (
    <text
      x={x}
      y={y}
      fill="#0f172a"
      fontSize={12}
      textAnchor={textAnchor}
      dominantBaseline="middle"
    >
      {`${safeLabel} ${pct}%`}
    </text>
  );
};

export default function SurveyResultsCharts({ summary }) {
  const [viewModes, setViewModes] = useState({});

  const questions = useMemo(() => summary?.questions || [], [summary?.questions]);
  const choiceQuestions = useMemo(() => questions.filter((q) => q.type === "choice"), [questions]);
  const textQuestions = useMemo(() => questions.filter((q) => q.type === "text"), [questions]);

  const computedData = useMemo(() => {
    const map = {};
    choiceQuestions.forEach((q) => {
      const entries = Object.entries(q.counts || {});
      const total = entries.reduce((acc, [, v]) => acc + Number(v || 0), 0);
      const data = entries.map(([label, raw]) => {
        const value = Number(raw) || 0;
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return { label, value, pct };
      });
      map[q.id] = { total, data };
    });
    return map;
  }, [choiceQuestions]);

  const handleToggle = (qid, mode) => {
    setViewModes((prev) => ({ ...prev, [qid]: mode }));
  };

  if (!summary || !questions.length) {
    return <div className={styles.empty}>표시할 설문 결과가 없습니다.</div>;
  }

  return (
    <div className={styles.chartsGrid}>
      {choiceQuestions.map((q) => {
        const view = viewModes[q.id] || "bar";
        const info = computedData[q.id] || { total: 0, data: [] };
        const hasData = info.total > 0 && info.data.length > 0;

        return (
          <div key={q.id} className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <p className={styles.eyebrow}>객관식</p>
                <h4 className={styles.chartTitle}>{q.text}</h4>
                <div className={styles.chartMeta}>
                  <span className={styles.chartBadge}>응답 {info.total}개</span>
                  {!hasData && <span className={styles.chartBadgeMuted}>응답 없음</span>}
                </div>
              </div>
              <div className={styles.chartToggle} role="group" aria-label="차트 타입 전환">
                <button
                  type="button"
                  aria-label="막대 차트로 보기"
                  className={`${styles.toggleBtn} ${view === "bar" ? styles.toggleActive : ""}`}
                  onClick={() => handleToggle(q.id, "bar")}
                >
                  Bar
                </button>
                <button
                  type="button"
                  aria-label="도넛 차트로 보기"
                  className={`${styles.toggleBtn} ${view === "donut" ? styles.toggleActive : ""}`}
                  onClick={() => handleToggle(q.id, "donut")}
                >
                  Donut
                </button>
              </div>
            </div>

            {hasData ? (
              <div className={styles.chartBody}>
                {view === "bar" ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={info.data} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis type="number" hide domain={[0, "dataMax"]} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={120}
                        tick={{ fontSize: 12, fill: "#334155" }}
                        tickFormatter={(v) => (v?.length > 18 ? `${v.slice(0, 18)}…` : v)}
                      />
                      <Tooltip formatter={formatTooltip} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]} fill={gradient}>
                        <LabelList dataKey="pct" position="insideRight" formatter={percentLabelFormatter} fill="#fff" fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart margin={{ top: 22, right: 24, bottom: 22, left: 24 }}>
                        <Pie
                          data={info.data}
                          dataKey="value"
                          nameKey="label"
                          innerRadius="55%"
                          outerRadius="72%"
                          paddingAngle={2}
                          isAnimationActive={false}
                          label={renderDonutLabel}
                          labelLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                        >
                          {info.data.map((entry, index) => (
                            <Cell key={`cell-${q.id}-${index}`} fill={donutPalette[index % donutPalette.length]} />
                          ))}
                          <Label
                            position="center"
                            content={(props) => {
                              const { viewBox } = props;
                              const total = info.total;
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="#0f172a"
                                  fontSize={14}
                                  fontWeight={600}
                                >
                                  총 {total}개
                                </text>
                              );
                            }}
                          />
                        </Pie>
                        <Tooltip formatter={formatTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className={styles.donutLegend}>
                      {info.data.map((entry, index) => (
                        <li key={`${q.id}-legend-${entry.label}`}>
                          <span
                            className={styles.legendDot}
                            style={{ backgroundColor: donutPalette[index % donutPalette.length] }}
                            aria-hidden="true"
                          />
                          <span className={styles.legendLabel} title={entry.label}>
                            {entry.label}
                          </span>
                          <span className={styles.legendValue}>
                            {entry.pct}% · {entry.value}회
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <div className={styles.chartEmpty}>응답 데이터가 없습니다.</div>
            )}
          </div>
        );
      })}

      {textQuestions.map((q) => (
        <div key={q.id} className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <p className={styles.eyebrow}>주관식</p>
              <h4 className={styles.chartTitle}>{q.text}</h4>
              <div className={styles.chartMeta}>
                <span className={styles.chartBadge}>샘플 {q.samples?.length || 0}개</span>
              </div>
            </div>
          </div>
          {q.samples?.length ? (
            <ul className={styles.textList}>
              {q.samples.map((s, idx) => (
                <li key={idx} title={s}>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.chartEmpty}>응답 데이터가 없습니다.</div>
          )}
        </div>
      ))}
    </div>
  );
}
