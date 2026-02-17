import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Loader2, Plus, Sparkles } from 'lucide-react';
import SurveyCard from '../../components/survey/SurveyCard';
import SurveyCreditBadge from '../../components/survey/SurveyCreditBadge';
import styles from '../../components/survey/survey.module.css';
import { surveyApi } from '../../api/survey';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';

const SORT_OPTIONS = [
  { key: 'recent', label: '최신순' },
  { key: 'quota-asc', label: '응답 많이 남은 순' },
  { key: 'responses-desc', label: '응답 많이 받은 순' },
];

const PAGE_SIZE = 12;

export default function SurveyExchangeListView() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sort, setSort] = useState(params.get('sort') || 'recent');
  const [search, setSearch] = useState(params.get('q') || '');
  const [onlyMine, setOnlyMine] = useState(params.get('mine') === '1');
  const [hideAnswered, setHideAnswered] = useState(params.get('hide') === '1');
  const [page, setPage] = useState(Number(params.get('page')) || 1);

  const [data, setData] = useState({ items: [], total: 0 });
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)), [data.total]);

  // sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (sort && sort !== 'recent') next.set('sort', sort);
    if (search) next.set('q', search);
    if (onlyMine) next.set('mine', '1');
    if (hideAnswered) next.set('hide', '1');
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
  }, [sort, search, onlyMine, hideAnswered, page, setParams]);

  // fetch list
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    surveyApi
      .list({
        sort,
        q: search,
        onlyMine,
        hideAnswered,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch(() => {
        if (!cancelled) setData({ items: [], total: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sort, search, onlyMine, hideAnswered, page]);

  // credits
  useEffect(() => {
    surveyApi.credits().then(setCredits).catch(() => setCredits(null));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [sort, search, onlyMine, hideAnswered]);

  const handleOpen = (survey) => {
    navigate(`/community/survey/${survey.id}`);
  };

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>설문조사 품앗이</h1>
          <p className="lede">설문을 올리고 서로 응답을 주고받아요. 내 설문은 승인 후 응답권 30개로 시작합니다.</p>
        </div>
        <Link className="btn btn-primary" to="/community/survey/new">
          <Plus size={16} />
          설문 올리기
        </Link>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <h2>내 잔여 응답권</h2>
          <p>응답을 하면 내 설문에 받을 수 있는 응답이 5개씩 늘어납니다.</p>
          <SurveyCreditBadge credits={credits} />
        </div>
        <div className={styles.badgeRow} style={{ justifyContent: 'flex-end', alignItems: 'flex-start' }}>
          <span className={`${styles.chip} ${styles.chipActive}`}><Sparkles size={14} />승인 시 응답권 +30</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className={`${styles.chip} ${styles.chipToggle}`}>
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={() => setOnlyMine((v) => !v)}
              style={{ accentColor: '#6366f1' }}
            />
            내 설문만
          </label>
          <label className={`${styles.chip} ${styles.chipToggle}`}>
            <input
              type="checkbox"
              checked={hideAnswered}
              onChange={() => setHideAnswered((v) => !v)}
              style={{ accentColor: '#6366f1' }}
            />
            내가 응답한 설문 숨기기
          </label>
        </div>
        <input
          className={styles.search}
          placeholder="검색 (제목, 태그)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className={styles.grid} aria-live="polite">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className={styles.skeleton} />
          ))}
        </div>
      ) : data.items?.length ? (
        <div className={styles.grid}>
          {data.items.map((survey) => (
            <SurveyCard key={survey.id} survey={survey} onOpen={handleOpen} isAdmin={user?.role === 'admin'} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Filter size={18} />
          <p>아직 등록된 설문이 없어요. 첫 설문을 올려보세요.</p>
          <Link className="btn btn-primary" to="/community/survey/new">
            설문 올리기
          </Link>
        </div>
      )}

      <div className="list-toolbar" style={{ justifyContent: 'center', marginTop: '16px' }}>
        <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          className="btn btn-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          다음
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: '#6b7280' }}>
          <Loader2 size={16} className="spin" /> 불러오는 중…
        </div>
      ) : null}
    </div>
  );
}
