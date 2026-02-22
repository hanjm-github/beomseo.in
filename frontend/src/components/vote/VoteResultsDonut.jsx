/**
 * @file src/components/vote/VoteResultsDonut.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - recharts
 * - ./vote.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './vote.module.css';

const COLORS = ['#2E7D5C', '#C2185B', '#246750', '#E91E8C', '#42A07A', '#8B2252', '#91C7AB', '#6B1A3C'];

const tooltipFormatter = (value, name, props) => {
  const pct = props?.payload?.pct ?? 0;
  return [`${value}표 (${pct}%)`, name];
};

/**
 * VoteResultsDonut module entry point.
 */
export default function VoteResultsDonut({ options = [], totalVotes = 0 }) {
  const safeData = options.map((option, index) => ({
    name: option.text,
    value: option.votes,
    pct: option.pct,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="78%"
              paddingAngle={2}
              isAnimationActive={false}
              label={({ name, pct }) => `${name} ${pct}%`}
              labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            >
              {safeData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={tooltipFormatter} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className={styles.optionList} style={{ marginTop: 6 }}>
        {safeData.map((entry) => (
          <li key={entry.name} className={styles.optionItem}>
            <div className="u-flex-center-gap-2">
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '999px',
                  background: entry.color,
                  flexShrink: 0,
                }}
              />
              <strong style={{ fontSize: 'var(--text-sm)' }}>{entry.name}</strong>
            </div>
            <div className={styles.optionStats}>
              <span>{entry.value}표</span>
              <span>{entry.pct}%</span>
            </div>
          </li>
        ))}
      </ul>

      <p style={{ margin: '8px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        총 참여 인원 {totalVotes}명
      </p>
    </div>
  );
}




