import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import NoticeToolbar from '../../components/notices/NoticeToolbar';
import NoticeList from '../../components/notices/NoticeList';
import styles from '../../components/notices/notices.module.css';
import { noticesApi } from '../../api/notices';
import { useAuth } from '../../context/AuthContext';

const VALID_CATEGORIES = ['school', 'council'];
const PAGE_SIZE = 10;

export default function ListView() {
  const { category = 'school' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canCreate = ['admin', 'council', 'student_council'].includes(user?.role);

  const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState(false);
  const [important, setImportant] = useState(false);
  const [exam, setExam] = useState(false);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!VALID_CATEGORIES.includes(category)) {
      navigate('/notices/school', { replace: true });
    }
  }, [category, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      const params = {
        category,
        query: search,
        sort,
        page,
        pageSize: PAGE_SIZE,
      };
      if (pinned) params.pinned = true;
      if (important) params.important = true;
      if (exam) params.exam = true;

      noticesApi
        .list(params)
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
  }, [category, search, pinned, important, exam, sort, page]);

  useEffect(() => {
    setPage(1);
  }, [search, pinned, important, exam, sort, category]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)), [data.total]);

  const basePath = `/notices/${category}`;

  return (
    <div className="card surface">
      <div className={styles.listHeader}>
        <div className={styles.listHeaderLeft}>
          <p className="eyebrow">게시판</p>
          <h2>{category === 'school' ? '학교 공지' : '학생회 공지'}</h2>
        </div>
        {canCreate && (
          <Link to={`${basePath}/new`} state={{ from: location }} className={styles.btnPrimary}>
            공지 작성
          </Link>
        )}
      </div>

      <NoticeToolbar
        search={search}
        onSearchChange={setSearch}
        pinned={pinned}
        important={important}
        exam={exam}
        sort={sort}
        onTogglePinned={() => setPinned((v) => !v)}
        onToggleImportant={() => setImportant((v) => !v)}
        onToggleExam={() => setExam((v) => !v)}
        onSortChange={setSort}
      />

      <NoticeList items={data.items} basePath={basePath} isLoading={loading} />

      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </button>
        <span className={styles.meta}>
          {page} / {totalPages}
        </span>
        <button
          type="button"
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
