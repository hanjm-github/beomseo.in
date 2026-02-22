import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Plus, RotateCcw, Search } from 'lucide-react';
import PetitionCard from '../../components/petition/PetitionCard';
import { petitionApi, THRESHOLD_DEFAULT } from '../../api/petition';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';
import styles from '../../components/petition/petition.module.css';

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'needs-support', label: '추천 필요' },
  { key: 'waiting-answer', label: '답변 대기' },
  { key: 'answered', label: '답변 완료' },
];

const APPROVAL_FILTERS = [
  { key: 'all', label: '승인 전체' },
  { key: 'approved', label: '승인됨' },
  { key: 'pending', label: '미승인' },
];

const CATEGORY_FILTERS = [
  '전체',
  '기타',
  '회장단',
  '3학년부',
  '2학년부',
  '정보기술부',
  '방송부',
  '학예부',
  '체육부',
  '진로부',
  '홍보부',
  '기후환경부',
  '학생지원부',
  '생활안전부',
  '융합인재부',
];

const PAGE_SIZE = 12;

export default function PetitionListView() {
  const { user, isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [status, setStatus] = useState(params.get('status') || 'all');
  const [approval, setApproval] = useState(params.get('approval') || 'all');
  const [category, setCategory] = useState(params.get('category') || '전체');
  const [sort, setSort] = useState(params.get('sort') || 'recent');
  const [search, setSearch] = useState(params.get('q') || '');
  const [page, setPage] = useState(Number(params.get('page')) || 1);

  const [data, setData] = useState({ items: [], total: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (status && status !== 'all') next.set('status', status);
    if (isAdmin && approval !== 'all') next.set('approval', approval);
    if (category && category !== '전체') next.set('category', category);
    if (sort !== 'recent') next.set('sort', sort);
    if (search) next.set('q', search);
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
  }, [status, approval, isAdmin, category, sort, search, page, setParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchList = async () => {
      try {
        const approvalParam = isAdmin
          ? approval === 'pending'
            ? 'unapproved'
            : approval
          : undefined;
        const res = await petitionApi.list({
          approval: approvalParam === 'all' ? undefined : approvalParam,
          statusDerived: status === 'all' ? undefined : status,
          category: category === '전체' ? undefined : category,
          sort,
          q: search,
          page,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;
        setData(res);
      } catch (err) {
        if (cancelled) return;
        setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchList();
    return () => {
      cancelled = true;
    };
  }, [status, approval, isAdmin, category, sort, search, page]);

  // reset page on filters change
  useEffect(() => {
    setPage(1);
  }, [status, approval, category, sort, search]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || PAGE_SIZE))),
    [data.total, data.pageSize]
  );

  const handleVote = async (item) => {
    if (!isAuthenticated) {
      navigate('/login', { replace: false, state: { from: '/community/petition' } });
      return;
    }
    try {
      const action = item.isVotedByMe ? 'cancel' : 'up';
      const res = await petitionApi.vote(item.id, action);
      setData((prev) => ({
        ...prev,
        items: prev.items.map((p) =>
          p.id === item.id
            ? { ...p, votes: res.votes, isVotedByMe: res.isVotedByMe, statusDerived: res.status }
            : p
        ),
      }));
    } catch {
      // silent fail, UI unchanged
    }
  };

  const resetFilters = () => {
    setStatus('all');
    setApproval('all');
    setCategory('전체');
    setSort('recent');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>학생 청원 게시판</h1>
          <p className="lede">추천 {THRESHOLD_DEFAULT}명 달성 시 학생회장단이 직접 답변합니다.</p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-primary" to="/community/petition/new">
            <Plus size={16} />
            청원 작성
          </Link>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.chipRow} role="tablist" aria-label="상태 필터">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.key}
              role="tab"
              aria-selected={status === opt.key}
              className={`${styles.chip} ${status === opt.key ? styles.chipActive : ''}`}
              onClick={() => setStatus(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.chipRow} aria-label="카테고리 필터">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                className={`${styles.chip} ${category === cat ? styles.chipActive : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="정렬 선택"
          >
            <option value="recent">최신순</option>
            <option value="votes">추천순</option>
          </select>

          {isAdmin ? (
            <select
              className={styles.sortSelect}
              value={approval}
              onChange={(e) => setApproval(e.target.value)}
              aria-label="승인 상태 필터"
            >
              {APPROVAL_FILTERS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrapper} style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
            <input
              className={styles.search}
              placeholder="키워드로 청원 찾기"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>
          <button type="button" className={styles.chip} onClick={resetFilters}>
            <RotateCcw size={16} />
            필터 초기화
          </button>
        </div>
      </div>

      {error ? (
        <div className={styles.error}>
          목록을 불러오지 못했습니다. <button onClick={() => setPage((p) => p)} className={styles.chip}>다시 시도</button>
        </div>
      ) : null}

      {loading ? (
        <div className={styles.grid} aria-live="polite">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={styles.skeleton} />
          ))}
        </div>
      ) : (
        <>
          {data.items?.length ? (
            <div className={styles.grid}>
              {data.items.map((item) => (
                <PetitionCard
                  key={item.id}
                  item={item}
                  onVote={handleVote}
                  canVote={!!user}
                  isAdmin={isAdmin}
                  // 상세 이동 후 목록으로 돌아오기 위한 state 전달
                  linkState={{ from: '/community/petition' }}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <Filter size={18} />
              조건에 맞는 청원이 없어요. 필터를 조정해 보세요.
            </div>
          )}

          <div className="list-toolbar" style={{ justifyContent: 'center', marginTop: '16px' }}>
            <button
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
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
        </>
      )}
    </div>
  );
}
