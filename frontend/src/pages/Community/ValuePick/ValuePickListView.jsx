/**
 * @file src/pages/Community/ValuePick/ValuePickListView.jsx
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Droplets, Plus } from 'lucide-react';
import SEO from '../../../components/SEO';
import { useAuth } from '../../../context/AuthContext';
import { valuePickApi } from '../../../api/valuePick';
import ValuePickToolbar from '../../../components/Community/ValuePick/ValuePickToolbar';
import ValuePickPostList from '../../../components/Community/ValuePick/ValuePickPostList';
import '../../page-shell.css';
import styles from '../../../components/Community/ValuePick/valuepick.module.css';

const PAGE_SIZE = 20;

const STAGES = [
  {
    mark: '수',
    title: '맑은 물 채우기',
    description: '내 안의 선한 마음을 발견하고 올해 실천할 인성 가치를 고르는 시작 단계입니다.',
  },
  {
    mark: '적',
    title: '한 방울의 실천',
    description: '부담 없는 작은 행동을 매일 반복해 인성의 방향을 생활 습관으로 옮깁니다.',
  },
  {
    mark: '천',
    title: '변화의 구멍',
    description: '꾸준한 실천이 쌓여 관계의 벽을 허물고 우리 학교의 분위기를 바꿉니다.',
  },
  {
    mark: '석',
    title: '성장의 확인',
    description: '단단해진 인성 역량을 서로 확인하고, 좋은 실천을 학교 전체로 확산합니다.',
  },
];

export default function ValuePickListView() {
  const [params, setParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const isAdmin = user?.role === 'admin';
  const basePath = '/community/value-pick';

  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState(params.get('sort') || 'recent');
  const [approval, setApproval] = useState(isAdmin ? params.get('approval') || 'all' : 'approved');
  const [mine, setMine] = useState(params.get('mine') === '1');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set('q', search);
    if (sort !== 'recent') next.set('sort', sort);
    if (isAdmin && approval !== 'all') next.set('approval', approval);
    if (mine) next.set('mine', '1');
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
  }, [search, sort, approval, isAdmin, mine, page, setParams]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      valuePickApi
        .list({
          query: search,
          sort,
          status: isAdmin ? (approval === 'all' ? undefined : approval) : undefined,
          mine,
          page,
          pageSize: PAGE_SIZE,
        })
        .then((response) => {
          if (cancelled) return;
          setData({
            items: response.items || [],
            total: response.total || 0,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setData({ items: [], total: 0 });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, sort, approval, isAdmin, mine, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)), [data.total]);

  return (
    <div className="page-shell">
      <SEO path="/community/value-pick" />

      <section className={styles.hero}>
        <div className={styles.heroShell}>
          <div className={styles.heroText}>
            <span className={styles.heroBadge}>
              <Droplets size={16} />
              수적천석 프로젝트
            </span>
            <div>
              <p className="eyebrow">소통하는 범서고</p>
              <h1 className={styles.heroTitle}>인성 가치 PICK!</h1>
            </div>
            <p className={styles.heroDescription}>
              범서고 인성 브랜드 <strong>수적천석(水滴穿石)</strong>을 바탕으로, 학생이 1년 동안 실천할
              인성 역량과 나만의 다짐을 기록하는 게시판입니다. 작은 실천이 모여 큰 변화를 만든다는 마음으로,
              서로의 다짐을 보고 응원하며 학교 문화를 함께 바꿔 갑니다.
            </p>
            <div className={styles.heroActionRow}>
              {isAuthenticated ? (
                <Link className="btn btn-primary" to={`${basePath}/new`}>
                  <Plus size={16} />
                  다짐 남기기
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/login" state={{ from: `${basePath}/new` }}>
                  로그인하고 참여하기
                  <ArrowRight size={16} />
                </Link>
              )}
              <p className={styles.heroHint}>
                작성된 다짐은 학생회가 시각화해 학교 로비 TV에 소개할 수 있도록 활용할 예정입니다.
              </p>
            </div>
          </div>

          <aside className={styles.heroAside}>
            <h2 className={styles.asideTitle}>이 게시판에서 하는 일</h2>
            <ul className={styles.heroList}>
              <li>내가 올해 집중해서 실천할 인성 역량을 자유롭게 선택합니다.</li>
              <li>한 줄 다짐으로 실천 의지를 기록하고, 필요하면 상세 기록도 남깁니다.</li>
              <li>다른 학생의 다짐에 추천, 비추천, 댓글로 반응하며 서로 응원합니다.</li>
            </ul>
          </aside>
        </div>

        <div className={styles.stageGrid}>
          {STAGES.map((stage) => (
            <article key={stage.mark} className={styles.stageCard}>
              <span className={styles.stageMark}>{stage.mark}</span>
              <div>
                <h2 className={styles.stageTitle}>{stage.title}</h2>
                <p className={styles.stageDescription}>{stage.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ValuePickToolbar
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
        isAdmin={isAdmin}
        approval={approval}
        onApprovalChange={(nextApproval) => {
          setApproval(nextApproval);
          setPage(1);
        }}
        mine={mine}
        onToggleMine={() => {
          setMine((prev) => !prev);
          setPage(1);
        }}
      />

      <ValuePickPostList items={data.items} basePath={basePath} isLoading={loading} />

      <div className={styles.pagination}>
        <button
          className={styles.btnGhost}
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          className={styles.btnGhost}
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          다음
        </button>
      </div>
    </div>
  );
}
