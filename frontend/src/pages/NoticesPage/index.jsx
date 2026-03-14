/**
 * @file src/pages/NoticesPage/index.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ./ListView
 * Side effects:
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useMemo } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ListView from './ListView';
import DetailView from './DetailView';
import ComposeView from './ComposeView';
import NotFoundPage from '../NotFoundPage';
import { AllowedParamBoundary, NumericParamBoundary } from '../RouteBoundaries';
import '../page-shell.css';
import { useAuth } from '../../context/AuthContext';

const VALID_NOTICE_CATEGORIES = ['school', 'council'];
const tabs = [
  { key: 'school', label: '학교 공지', path: '/notices/school' },
  { key: 'council', label: '학생회 공지', path: '/notices/council' },
];

function NoticeCategoryBoundary() {
  return (
    <AllowedParamBoundary
      param="category"
      allowedValues={VALID_NOTICE_CATEGORIES}
      eyebrow="공지센터"
      title="존재하지 않는 공지 주소입니다."
      description="학교 공지와 학생회 공지 경로만 지원합니다. 아래 메뉴에서 다시 이동해 주세요."
      primaryAction={{ label: '학교 공지', to: '/notices/school' }}
      secondaryActions={[{ label: '학생회 공지', to: '/notices/council' }]}
    />
  );
}

/**
 * NoticesPage module entry point.
 */
export default function NoticesPage() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const canCreate = ['admin', 'student_council'].includes(user?.role);

  const active = useMemo(() => {
    const hit = tabs.find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`));
    return hit ? hit.key : null;
  }, [pathname]);

  const activePath = tabs.find((tab) => tab.key === active)?.path || null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">공지센터</p>
          <h1>학교 & 학생회 공지</h1>
          <p className="lede">상단 고정, 중요/시험 필터, 빠른 열람까지 한 곳에서.</p>
        </div>
        <div className="header-actions">
          {canCreate && activePath ? (
            <Link className="btn btn-primary" to={`${activePath}/new`}>
              <Plus size={16} />
              공지 작성
            </Link>
          ) : null}
        </div>
      </div>

      <div className="tab-row">
        {tabs.map((tab) => (
          <Link key={tab.key} to={tab.path} className={`chip ${active === tab.key ? 'chip-active' : ''}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="school" replace />} />
        <Route element={<NoticeCategoryBoundary />}>
          <Route path=":category" element={<ListView />} />
          <Route path=":category/new" element={<ComposeView mode="create" />} />
          <Route
            element={
              <NumericParamBoundary
                eyebrow="공지센터"
                title="존재하지 않는 공지 주소입니다."
                description="공지 상세 주소 형식을 다시 확인해 주세요. 공지 번호는 숫자 경로만 지원합니다."
                primaryAction={{ label: '학교 공지', to: '/notices/school' }}
                secondaryActions={[{ label: '학생회 공지', to: '/notices/council' }]}
              />
            }
          >
            <Route path=":category/:id" element={<DetailView />} />
            <Route path=":category/:id/edit" element={<ComposeView mode="edit" />} />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <NotFoundPage
              eyebrow="공지센터"
              title="존재하지 않는 공지 주소입니다."
              description="학교 공지와 학생회 공지 메뉴에서 다시 찾아보세요."
              primaryAction={{ label: '학교 공지', to: '/notices/school' }}
              secondaryActions={[{ label: '학생회 공지', to: '/notices/council' }]}
            />
          }
        />
      </Routes>
    </div>
  );
}
