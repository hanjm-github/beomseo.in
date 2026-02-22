/**
 * @file src/pages/LostFound/LostFoundListView.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../api/lostFound
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { lostFoundApi } from '../../api/lostFound';
import { useAuth } from '../../context/AuthContext';
import LostFoundFilterBar from '../../components/lostfound/LostFoundFilterBar';
import LostFoundList from '../../components/lostfound/LostFoundList';
import styles from '../../components/lostfound/lostfound.module.css';
import '../page-shell.css';

const PAGE_SIZE = 12;

function toSafePage(value) {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

/**
 * LostFoundListView module entry point.
 */
export default function LostFoundListView() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const canWrite = lostFoundApi.canWrite(user);

  const status = params.get('status') || 'all';
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'recent';
  const search = params.get('q') || '';
  const page = toSafePage(params.get('page'));

  const [data, setData] = useState({ items: [], total: 0, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(false);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || PAGE_SIZE))),
    [data.total, data.pageSize]
  );

  const updateParams = (patch, resetPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (resetPage) {
      next.delete('page');
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchList = async () => {
      setLoading(true);
      try {
        const res = await lostFoundApi.list({
          status: status === 'all' ? undefined : status,
          category: category === 'all' ? undefined : category,
          sort,
          q: search,
          page,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;
        setData(res);
      } catch {
        if (cancelled) return;
        setData({ items: [], total: 0, pageSize: PAGE_SIZE });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchList();
    return () => {
      cancelled = true;
    };
  }, [status, category, sort, search, page]);

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>분실물 센터</h1>
          <p className="lede">습득물 사진과 보관 정보를 빠르게 확인하고 주인을 찾아주세요.</p>
        </div>
        {canWrite ? (
          <Link className="btn btn-primary" to="/community/lost-found/new">
            <Plus size={16} />
            분실물 등록
          </Link>
        ) : null}
      </div>

      <LostFoundFilterBar
        status={status}
        category={category}
        sort={sort}
        search={search}
        onStatusChange={(value) => updateParams({ status: value }, true)}
        onCategoryChange={(value) => updateParams({ category: value }, true)}
        onSortChange={(value) => updateParams({ sort: value }, true)}
        onSearchChange={(value) => updateParams({ q: value }, true)}
        onReset={() => setParams(new URLSearchParams(), { replace: true })}
      />

      <LostFoundList items={data.items} basePath="/community/lost-found" isLoading={loading} />

      <div className="list-toolbar u-justify-center">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page <= 1}
          onClick={() => updateParams({ page: page - 1 })}
        >
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= totalPages}
          onClick={() => updateParams({ page: page + 1 })}
        >
          다음
        </button>
      </div>
    </div>
  );
}


