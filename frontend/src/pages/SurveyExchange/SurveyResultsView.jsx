import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Table } from 'lucide-react';
import { surveyApi } from '../../api/survey';
import SurveyResultsCharts from '../../components/survey/SurveyResultsCharts';
import styles from '../../components/survey/survey.module.css';
import '../page-shell.css';

export default function SurveyResultsView() {
  const { id } = useParams();
  const [survey, setSurvey] = useState(null);
  const [summary, setSummary] = useState(null);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('summary');

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [detailRes, summaryRes, rawRes] = await Promise.all([
          surveyApi.detail(id),
          surveyApi.summary(id),
          surveyApi.rawResponses(id),
        ]);
        if (cancelled) return;
        setSurvey(detailRes);
        setSummary(summaryRes);
        setRaw(rawRes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flattenedRows = useMemo(() => {
    if (!raw?.rows) return [];
    return raw.rows.map((row) => ({
      id: row.id,
      submittedAt: row.submittedAt,
      ...row.answers,
    }));
  }, [raw]);

  const exportSheet = (type) => {
    if (!flattenedRows.length) return;
    const headers = Object.keys(flattenedRows[0]);
    const escapeCsv = (v) => {
      let s = v == null ? '' : String(v);
      if (typeof v === 'object') {
        try {
          s = JSON.stringify(v);
        } catch {
          s = String(v);
        }
      }
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [headers.map(escapeCsv).join(',')];
    flattenedRows.forEach((row) => {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    });

    // Excel에서 한글/UTF-8 깨짐 방지를 위해 BOM 추가
    const csvWithBom = '\uFEFF' + lines.join('\n');

    // 'XLSX' 버튼도 실제로는 Excel 호환 CSV를 .xls 확장자로 저장해 깨짐/열기 오류를 방지
    const isXlsx = type === 'xlsx';
    const blob = new Blob([csvWithBom], {
      type: isXlsx
        ? 'application/vnd.ms-excel;charset=utf-8;'
        : 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-${id}.${isXlsx ? 'xls' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatResponseValue = (value) => {
    if (value == null || value === '') return '-';
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ');
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      const active = entries
        .filter(([, v]) => Boolean(v))
        .map(([k, v]) => (typeof v === 'boolean' ? k : `${k}: ${v}`));
      if (active.length) return active.join(', ');
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  if (loading) {
    return (
      <div className="page-shell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader2 className="spin" size={18} /> 불러오는 중…
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="page-shell">
        <p>결과를 불러오지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">설문 결과</p>
          <h1>{survey.title}</h1>
          <p className="lede">{survey.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => exportSheet('csv')}>
            CSV 다운로드
          </button>
          <button className="btn btn-primary" onClick={() => exportSheet('xlsx')}>
            XLSX 다운로드
          </button>
        </div>
      </div>

      <div className={styles.resultTabs}>
        <button
          className={`${styles.chip} ${tab === 'summary' ? styles.chipActive : ''}`}
          onClick={() => setTab('summary')}
        >
          그래프 보기
        </button>
        <button
          className={`${styles.chip} ${tab === 'raw' ? styles.chipActive : ''}`}
          onClick={() => setTab('raw')}
        >
          개별 응답
        </button>
      </div>

      {tab === 'summary' ? (
        <SurveyResultsCharts summary={summary} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>제출 시각</th>
                {summary?.questions?.map((q) => (
                  <th key={q.id}>{q.text}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flattenedRows.length ? (
                flattenedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{new Date(row.submittedAt).toLocaleString()}</td>
                    {summary?.questions?.map((q) => (
                      <td key={q.id}>{formatResponseValue(row[q.id])}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2 + (summary?.questions?.length || 0)} style={{ textAlign: 'center', padding: 12 }}>
                    <Table size={16} /> 아직 응답이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
