import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { gomsolMarketApi } from '../../api/gomsolMarket';
import { useAuth } from '../../context/AuthContext';
import GomsolMarketFilterBar from '../../components/gomsolmarket/GomsolMarketFilterBar';
import GomsolMarketList from '../../components/gomsolmarket/GomsolMarketList';
import styles from '../../components/gomsolmarket/gomsolmarket.module.css';
import '../page-shell.css';

const PAGE_SIZE = 12;

function toSafePage(value) {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export default function GomsolMarketListView() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();

  const isAdmin = gomsolMarketApi.canManageApproval(user);
  const canWrite = gomsolMarketApi.canWrite(user);

  const status = params.get('status') || 'all';
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'recent';
  const search = params.get('q') || '';
  const approval = isAdmin ? params.get('approval') || 'all' : 'approved';
  const page = toSafePage(params.get('page'));
  const submittedPending = params.get('submitted') === 'pending';

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

  const clearSubmissionNotice = () => {
    const next = new URLSearchParams(params);
    next.delete('submitted');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchList = async () => {
      setLoading(true);
      try {
        const res = await gomsolMarketApi.list({
          status: status === 'all' ? undefined : status,
          category: category === 'all' ? undefined : category,
          approval: isAdmin ? (approval === 'all' ? undefined : approval) : 'approved',
          sort,
          q: search,
          page,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;

        const rawItems = res.items || [];
        const filteredItems = isAdmin
          ? rawItems
          : rawItems.filter((item) => item.approvalStatus === 'approved');
        const hasClientFilter = filteredItems.length !== rawItems.length;

        setData({
          ...res,
          items: filteredItems,
          total: hasClientFilter ? filteredItems.length : res.total,
        });
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
  }, [approval, category, isAdmin, page, search, sort, status]);

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>곰솔마켓</h1>
          <p className="lede">교내 중고거래 장터에서 필요한 물건을 쉽고 안전하게 거래해요.</p>
        </div>
        {canWrite ? (
          <Link className="btn btn-primary" to="/community/gomsol-market/new">
            <Plus size={16} />
            상품 등록
          </Link>
        ) : null}
      </div>

      {submittedPending ? (
        <div className={styles.noticeBox}>
          등록한 게시글은 관리자 승인 후 일반 사용자에게 노출됩니다.
          <button type="button" className="btn btn-secondary u-ml-3" onClick={clearSubmissionNotice}>
            닫기
          </button>
        </div>
      ) : null}

      <GomsolMarketFilterBar
        status={status}
        category={category}
        approval={approval}
        sort={sort}
        search={search}
        isAdmin={isAdmin}
        onStatusChange={(value) => updateParams({ status: value }, true)}
        onCategoryChange={(value) => updateParams({ category: value }, true)}
        onApprovalChange={(value) => updateParams({ approval: value }, true)}
        onSortChange={(value) => updateParams({ sort: value }, true)}
        onSearchChange={(value) => updateParams({ q: value }, true)}
        onReset={() => {
          const next = new URLSearchParams();
          if (params.get('submitted') === 'pending') next.set('submitted', 'pending');
          setParams(next, { replace: true });
        }}
      />

      <GomsolMarketList
        items={data.items}
        basePath="/community/gomsol-market"
        isLoading={loading}
        isAdmin={isAdmin}
      />

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
