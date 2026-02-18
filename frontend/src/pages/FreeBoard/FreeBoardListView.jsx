import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import FreeBoardToolbar from '../../components/freeboard/FreeBoardToolbar';
import FreePostList from '../../components/freeboard/FreePostList';
import styles from '../../components/freeboard/freeboard.module.css';
import { communityApi } from '../../api/community';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'chat', label: '잡담' },
  { key: 'info', label: '정보' },
  { key: 'qna', label: 'QnA' },
];

const PAGE_SIZE = 20;

export default function FreeBoardListView() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const isAdmin = user?.role === 'admin';

  const initialCategory = params.get('category') || 'all';

  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState(params.get('sort') || 'recent');
  const [approval, setApproval] = useState(isAdmin ? params.get('approval') || 'all' : 'approved');
  const [mine, setMine] = useState(params.get('mine') === '1');
  const [bookmarked, setBookmarked] = useState(params.get('bookmarked') === '1');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  // keep URL in sync
  useEffect(() => {
    const next = new URLSearchParams();
    if (category && category !== 'all') next.set('category', category);
    if (search) next.set('q', search);
    if (sort !== 'recent') next.set('sort', sort);
    if (isAdmin && approval !== 'all') next.set('approval', approval);
    if (mine) next.set('mine', '1');
    if (bookmarked) next.set('bookmarked', '1');
    if (page > 1) next.set('page', String(page));
    navigate({ search: next.toString() }, { replace: true });
  }, [category, search, sort, approval, isAdmin, mine, bookmarked, page, navigate]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const categoryParam = category === 'all' ? undefined : category;
      const statusParam = isAdmin ? (approval === 'all' ? undefined : approval) : 'approved';
      communityApi
        .list({
          category: categoryParam,
          status: statusParam,
          query: search,
          sort,
          mine,
          bookmarked,
          page,
          pageSize: PAGE_SIZE,
        })
        .then((res) => {
          if (cancelled) return;

          const rawItems = res.items || [];
          const filteredItems = isAdmin
            ? approval === 'all'
              ? rawItems
              : rawItems.filter((item) => item.status === approval)
            : rawItems.filter((item) => item.status === 'approved');
          const hasClientFilter = filteredItems.length !== rawItems.length;

          setData({
            ...res,
            items: filteredItems,
            total: hasClientFilter ? filteredItems.length : res.total,
          });
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setData({ items: [], total: 0 });
          setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [category, search, sort, approval, isAdmin, mine, bookmarked, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)), [data.total]);
  const basePath = '/community/free';
  const canWrite = !!user; // allow any logged-in user to write; backend enforces further

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    setPage(1);
  };

  const handleSearchChange = (nextSearch) => {
    setSearch(nextSearch);
    setPage(1);
  };

  const handleSortChange = (nextSort) => {
    setSort(nextSort);
    setPage(1);
  };

  const handleApprovalChange = (nextApproval) => {
    setApproval(nextApproval);
    setPage(1);
  };

  const handleToggleMine = () => {
    setMine((v) => !v);
    setPage(1);
  };

  const handleToggleBookmarked = () => {
    setBookmarked((v) => !v);
    setPage(1);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>자유 게시판</h1>
          <p className="lede">실시간 소통, 카테고리별로 깔끔하게.</p>
        </div>
        <div className="header-actions">
          {canWrite ? (
            <Link className="btn btn-primary" to={`${basePath}/new`} state={{ from: location }}>
              <Plus size={16} />
              글쓰기
            </Link>
          ) : null}
        </div>
      </div>

      <div className={styles.chipRow} role="tablist" aria-label="카테고리 선택">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={category === c.key}
            className={`${styles.chip} ${category === c.key ? styles.chipActive : ''}`}
            onClick={() => handleCategoryChange(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <FreeBoardToolbar
        search={search}
        onSearchChange={handleSearchChange}
        sort={sort}
        onSortChange={handleSortChange}
        isAdmin={isAdmin}
        approval={approval}
        onApprovalChange={handleApprovalChange}
        mine={mine}
        bookmarked={bookmarked}
        onToggleMine={handleToggleMine}
        onToggleBookmarked={handleToggleBookmarked}
      />

      <FreePostList items={data.items} basePath={basePath} isLoading={loading} />

      <div className={styles.pagination}>
        <button className={styles.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          className={styles.btnGhost}
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          다음
        </button>
      </div>
    </div>
  );
}
