/**
 * Lightweight chart replacement without external deps (since offline install blocked).
 * Shows bar-style divs for 선택형, list for 주관식.
 */
export default function SurveyResultsCharts({ summary }) {
  if (!summary) return null;

  const choiceQuestions = (summary.questions || []).filter((q) => q.type === 'choice');
  const textQuestions = (summary.questions || []).filter((q) => q.type === 'text');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      {choiceQuestions.map((q) => {
        const entries = Object.entries(q.counts || {});
        const max = Math.max(...entries.map(([, v]) => Number(v) || 0), 1);
        return (
          <div key={q.id} style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 8px' }}>{q.text}</h4>
            <div style={{ display: 'grid', gap: 6 }}>
              {entries.map(([label, value]) => {
                const pct = Math.round(((Number(value) || 0) / max) * 100);
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475467' }}>
                      <span>{label}</span>
                      <span>{value}명</span>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: '#e5e7eb',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #6366f1, #22d3ee)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {textQuestions.map((q) => (
        <div key={q.id} style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 8px' }}>{q.text}</h4>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', display: 'grid', gap: 6 }}>
            {(q.samples || []).map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
