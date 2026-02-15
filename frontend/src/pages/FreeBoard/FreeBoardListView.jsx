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
  const [params, setParams] = useSearchParams();

  const initialCategory = params.get('category') || 'all';

  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState(params.get('sort') || 'recent');
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
    if (mine) next.set('mine', '1');
    if (bookmarked) next.set('bookmarked', '1');
    if (page > 1) next.set('page', String(page));
    navigate({ search: next.toString() }, { replace: true });
  }, [category, search, sort, mine, bookmarked, page, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      const categoryParam = category === 'all' ? undefined : category;
      const statusParam = user?.role === 'admin' ? 'all' : undefined;
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
          setData(res);
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
  }, [category, search, sort, mine, bookmarked, page]);

  useEffect(() => {
    setPage(1);
  }, [category, search, sort, mine, bookmarked]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)), [data.total]);
  const basePath = '/community/free';
  const canWrite = !!user; // allow any logged-in user to write; backend enforces further
  const isAdmin = user?.role === 'admin';

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
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <FreeBoardToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        mine={mine}
        bookmarked={bookmarked}
        onToggleMine={() => setMine((v) => !v)}
        onToggleBookmarked={() => setBookmarked((v) => !v)}
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
