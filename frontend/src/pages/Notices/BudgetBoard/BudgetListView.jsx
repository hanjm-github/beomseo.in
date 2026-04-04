/**
 * @file src/pages/NoticesPage/BudgetListView.jsx
 * @description Month-scoped list page for budget disclosure notices.
 * Responsibilities:
 * - Fetch budget disclosure notices filtered by cycle year and month.
 * - Reuse the shared notice list experience without attribute/tag controls.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - ../../../components/notices/NoticeCenter/NoticeToolbar
 * - ../../../components/notices/NoticeCenter/NoticeList
 * Side effects:
 * - Influences client-side routing and navigation state.
 * - Schedules deferred work using timer-based execution.
 * Role in app flow:
 * - Owns budget board monthly list rendering.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import NoticeToolbar from '../../../components/notices/NoticeCenter/NoticeToolbar';
import NoticeList from '../../../components/notices/NoticeCenter/NoticeList';
import styles from '../../../components/notices/NoticeCenter/notices.module.css';
import { noticesApi } from '../../../api/notices';
import { useAuth } from '../../../context/AuthContext';
import { buildBudgetListPath, formatBudgetPeriodLabel } from './budgetUtils';

const PAGE_SIZE = 10;
const BUDGET_SORT_OPTIONS = [
  { value: 'recent', label: '최신순' },
  { value: 'views', label: '조회순' },
];

/**
 * BudgetListView module entry point.
 */
export default function BudgetListView() {
  const { budgetYear, budgetMonth } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const canCreate = ['admin', 'student_council'].includes(user?.role);
  const budgetScope = `${budgetYear}-${budgetMonth}`;

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [pageState, setPageState] = useState({ scope: budgetScope, value: 1 });
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const page = pageState.scope === budgetScope ? pageState.value : 1;

  const setPage = (nextPage) => {
    setPageState((current) => {
      const currentValue = current.scope === budgetScope ? current.value : 1;
      const resolvedValue =
        typeof nextPage === 'function' ? nextPage(currentValue) : nextPage;
      return { scope: budgetScope, value: resolvedValue };
    });
  };

  useEffect(() => {
    let cancelled = false;
    // Debounce toolbar-driven refetches so month tab changes stay responsive
    // without firing a request on every keystroke.
    const timer = setTimeout(() => {
      setLoading(true);
      noticesApi
        .list({
          category: 'budget',
          budgetYear,
          budgetMonth,
          query: search,
          sort,
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
  }, [budgetMonth, budgetYear, search, sort, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)),
    [data.total]
  );
  const basePath = buildBudgetListPath(budgetYear, budgetMonth);
  const monthLabel = formatBudgetPeriodLabel(budgetYear, budgetMonth);

  return (
    <div className="card surface">
      <div className={styles.listHeader}>
        <div className={styles.listHeaderLeft}>
          <p className="eyebrow">월별 내역</p>
          <h2>{monthLabel}</h2>
        </div>
        {canCreate ? (
          <Link to={`${basePath}/new`} state={{ from: location }} className={styles.btnPrimary}>
            글 작성
          </Link>
        ) : null}
      </div>

      <NoticeToolbar
        search={search}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch);
          setPage(1);
        }}
        sort={sort}
        onSortChange={(nextSort) => {
          setSort(nextSort);
          setPage(1);
        }}
        showAttributeFilters={false}
        searchPlaceholder="검색 (제목, 본문)"
        sortOptions={BUDGET_SORT_OPTIONS}
      />

      <NoticeList
        items={data.items}
        basePath={basePath}
        isLoading={loading}
        emptyStateProps={{
          createPath: `${basePath}/new`,
          title: '선택한 월에는 등록된 예산 공개 글이 없습니다.',
          description: '첫 예산 공개 글을 등록해보세요.',
        }}
        cardProps={{
          hideBadges: true,
          hideTags: true,
        }}
      />

      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={page <= 1}
          onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
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
          onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
        >
          다음
        </button>
      </div>
    </div>
  );
}
