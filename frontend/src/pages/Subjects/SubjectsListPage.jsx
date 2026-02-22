import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subjectChangesApi } from '../../api/subjectChanges';
import GradeTabs from '../../components/subjects/GradeTabs';
import SubjectFilterBar from '../../components/subjects/SubjectFilterBar';
import SubjectListGrid from '../../components/subjects/SubjectListGrid';
import SubjectCard from '../../components/subjects/SubjectCard';
import EmptyState from '../../components/clubRecruit/EmptyState';
import ErrorState from '../../components/clubRecruit/ErrorState';
import InfiniteLoader from '../../components/clubRecruit/InfiniteLoader';
import '../page-shell.css';

const PAGE_SIZE = 12;

export default function SubjectsListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canViewDetail = Boolean(user);

  const [grade, setGrade] = useState(1);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [hideClosed, setHideClosed] = useState(true);
  const [subjectTag, setSubjectTag] = useState('all');
  const [approval, setApproval] = useState('all');

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sentinelRef = useRef(null);

  const params = useMemo(
    () => ({
      grade,
      q: search,
      onlyMine,
      hideClosed,
      subjectTag,
      status: isAdmin ? (approval === 'all' ? undefined : approval) : undefined,
      pageSize: PAGE_SIZE,
    }),
    [grade, search, onlyMine, hideClosed, subjectTag, approval, isAdmin]
  );

  const loadPage = useCallback(
    async (pageToLoad = 1, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await subjectChangesApi.list({ ...params, page: pageToLoad });
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

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPage(1, false);
  }, [params, loadPage]);

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

  useEffect(() => {
    if (page === 1) return;
    loadPage(page, true);
  }, [page, loadPage]);

  const handleRetry = () => loadPage(page, page > 1);

  const handleApprovalChange = (nextApproval) => {
    setApproval(nextApproval);
    setPage(1);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>선택과목 변경 게시판</h1>
          <p className="lede">주는 과목과 받고 싶은 과목을 한눈에 확인하세요.</p>
          {!canViewDetail ? (
            <p className="muted" style={{ marginTop: 8 }}>
              상세 열람과 댓글 참여는 로그인 후 이용할 수 있습니다.
            </p>
          ) : null}
          <p className="muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <Info size={14} /> 주는/받는 과목을 꼭 입력해 주세요.
          </p>
        </div>
        <div className="header-actions">
          {user ? (
            <Link className="btn btn-primary" to="/community/subjects/new">
              글쓰기
            </Link>
          ) : (
            <Link className="btn btn-secondary" to="/login" state={{ from: '/community/subjects' }}>
              로그인
            </Link>
          )}
        </div>
      </div>

      <GradeTabs value={grade} onChange={setGrade} />
      <SubjectFilterBar
        search={search}
        onSearchChange={setSearch}
        onlyMine={onlyMine}
        onToggleOnlyMine={setOnlyMine}
        hideClosed={hideClosed}
        onToggleHideClosed={setHideClosed}
        subjectTag={subjectTag}
        onSubjectTagChange={setSubjectTag}
        isAdmin={isAdmin}
        approval={approval}
        onApprovalChange={handleApprovalChange}
      />

      {error ? <ErrorState onRetry={handleRetry} /> : null}

      {!error && (
        <>
          <SubjectListGrid>
            {items.map((item) => (
              <SubjectCard
                key={item.id}
                item={item}
                showMeta={false}
                showApproval={isAdmin || Boolean(user?.id && item.author?.id && String(user.id) === String(item.author.id))}
                canViewDetail={canViewDetail}
              />
            ))}
          </SubjectListGrid>

          {items.length === 0 && !loading ? (
            <EmptyState message="조건에 맞는 글이 없습니다. 과목 키워드를 검색해 보세요." />
          ) : null}

          <div ref={sentinelRef} />
          {loading ? <InfiniteLoader /> : null}
          {!hasMore && items.length > 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '12px' }}>
              모든 글을 확인했어요.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
