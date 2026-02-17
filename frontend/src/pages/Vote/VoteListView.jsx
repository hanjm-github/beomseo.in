import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Plus, Vote as VoteIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { voteApi } from '../../api/vote';
import VoteCard from '../../components/vote/VoteCard';
import styles from '../../components/vote/vote.module.css';
import '../page-shell.css';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'recent', label: '최신순' },
  { value: 'participation', label: '참여 많은순' },
  { value: 'deadline', label: '마감 임박순' },
];

export default function VoteListView() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState(params.get('sort') || 'recent');
  const [search, setSearch] = useState(params.get('q') || '');
  const [includeClosed, setIncludeClosed] = useState(params.get('closed') === '1');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [data, setData] = useState({ items: [], total: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);

  const canWrite = voteApi.canWrite(user);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || PAGE_SIZE))),
    [data.total, data.pageSize]
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (sort !== 'recent') next.set('sort', sort);
    if (search) next.set('q', search);
    if (includeClosed) next.set('closed', '1');
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
  }, [includeClosed, page, search, setParams, sort]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      voteApi
        .list({
          sort,
          q: search,
          includeClosed,
          page,
          pageSize: PAGE_SIZE,
        })
        .then((res) => {
          if (cancelled) return;
          setData(res);
        })
        .catch(() => {
          if (!cancelled) {
            setData({ items: [], total: 0, pageSize: PAGE_SIZE });
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [includeClosed, page, search, sort]);

  const handleSortChange = (nextSort) => {
    setLoading(true);
    setSort(nextSort);
    setPage(1);
  };

  const handleSearchChange = (nextSearch) => {
    setLoading(true);
    setSearch(nextSearch);
    setPage(1);
  };

  const handleToggleIncludeClosed = () => {
    setLoading(true);
    setIncludeClosed((prev) => !prev);
    setPage(1);
  };

  const handlePrevPage = () => {
    setLoading(true);
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setLoading(true);
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>실시간 투표 게시판</h1>
          <p className="lede">
            현재 진행 중인 투표를 바로 확인하고, 결과를 실시간으로 볼 수 있어요.
          </p>
        </div>
        {canWrite ? (
          <Link className="btn btn-primary" to="/community/vote/new">
            <Plus size={16} />
            투표 만들기
          </Link>
        ) : null}
      </div>

      <div className={styles.filters}>
        <div className={styles.filtersLeft}>
          <select
            className={styles.select}
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
            aria-label="정렬 기준"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`${styles.chip} ${includeClosed ? styles.chipActive : ''}`}
            onClick={handleToggleIncludeClosed}
            aria-pressed={includeClosed}
          >
            마감 포함
          </button>
        </div>
        <div className={styles.filtersRight}>
          <input
            className={styles.search}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="질문/선택지 검색"
            aria-label="투표 검색"
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.grid} aria-live="polite">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className={styles.skeleton} key={index} />
          ))}
        </div>
      ) : data.items?.length ? (
        <div className={styles.grid}>
          {data.items.map((post) => (
            <VoteCard key={post.id} post={post} to={`/community/vote/${post.id}`} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <VoteIcon size={18} />
          <p>조건에 맞는 투표가 없습니다.</p>
          {canWrite ? (
            <Link className="btn btn-secondary" to="/community/vote/new">
              첫 투표 만들기
            </Link>
          ) : null}
        </div>
      )}

      <div className="list-toolbar" style={{ justifyContent: 'center' }}>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={handlePrevPage}
          disabled={page <= 1}
        >
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={handleNextPage}
          disabled={page >= totalPages}
        >
          다음
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
          <Loader2 size={16} className="spin" />
          불러오는 중…
        </div>
      ) : null}
    </div>
  );
}
