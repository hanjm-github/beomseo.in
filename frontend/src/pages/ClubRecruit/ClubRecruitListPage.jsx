import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { clubRecruitApi } from '../../api/clubRecruit';
import GradeTabs from '../../components/clubRecruit/GradeTabs';
import RecruitFilterBar from '../../components/clubRecruit/RecruitFilterBar';
import RecruitGrid from '../../components/clubRecruit/RecruitGrid';
import RecruitCard from '../../components/clubRecruit/RecruitCard';
import InfiniteLoader from '../../components/clubRecruit/InfiniteLoader';
import EmptyState from '../../components/clubRecruit/EmptyState';
import ErrorState from '../../components/clubRecruit/ErrorState';
import '../page-shell.css';

const PAGE_SIZE = 12;

export default function ClubRecruitListPage() {
  const { user } = useAuth();
  const [gradeGroup, setGradeGroup] = useState('lower');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sentinelRef = useRef(null);

  const params = useMemo(
    () => ({
      gradeGroup,
      sort,
      q: search,
      pageSize: PAGE_SIZE,
    }),
    [gradeGroup, sort, search]
  );

  const loadPage = useCallback(
    async (pageToLoad = 1, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await clubRecruitApi.list({ ...params, page: pageToLoad });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        const size = res.pageSize || PAGE_SIZE;
        const nextHasMore = res.total > pageToLoad * size && res.items.length === size;
        setHasMore(nextHasMore);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [params]
  );

  // Reset when filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPage(1, false);
  }, [params, loadPage]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current) return undefined;
    const node = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '240px 0px 240px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  // Load subsequent pages
  useEffect(() => {
    if (page === 1) return;
    loadPage(page, true);
  }, [page, loadPage]);

  const handleRetry = () => {
    loadPage(page, page > 1);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>동아리 모집 게시판</h1>
          <p className="lede">포스터 한눈에, 필터와 검색으로 바로 지원.</p>
        </div>
        <div className="header-actions">
          {user ? (
            <a className="btn btn-primary" href="/community/club-recruit/new">
              글쓰기
            </a>
          ) : null}
        </div>
      </div>

      <GradeTabs value={gradeGroup} onChange={setGradeGroup} />

      <RecruitFilterBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />

      {error ? <ErrorState onRetry={handleRetry} /> : null}

      {!error && (
        <>
          <RecruitGrid>
            {items.map((item) => (
              <RecruitCard
                key={item.id}
                item={item}
                showStatus={user?.role === 'admin'}
              />
            ))}
          </RecruitGrid>

          {items.length === 0 && !loading ? (
            <EmptyState message="조건에 맞는 동아리 모집이 없어요." />
          ) : null}

          <div ref={sentinelRef} />
          {loading ? <InfiniteLoader /> : null}
          {!hasMore && items.length > 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '12px' }}>
              모든 모집 공고를 확인했어요.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
