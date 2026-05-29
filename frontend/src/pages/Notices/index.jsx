/**
 * @file src/pages/Notices/index.jsx
 * @description Notices domain router that delegates to sibling notice experiences.
 * Responsibilities:
 * - Route school/council notices to the existing notice center page.
 * - Route budget disclosure URLs to the dedicated budget board.
 * Key dependencies:
 * - react-router-dom
 * - ./NoticeCenter/NoticeCenterPage
 * - ./BudgetBoard/BudgetBoardPage
 * Side effects:
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns top-level `/notices/*` branching.
 */
import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NumericParamBoundary } from '../RouteBoundaries';
import { LOST_FOUND_NOTICE_BASE_PATH } from './LostFound/paths';

const NoticeCenterPage = lazy(() => import('./NoticeCenter/NoticeCenterPage'));
const BudgetBoardPage = lazy(() => import('./BudgetBoard/BudgetBoardPage'));
const LostFoundListView = lazy(() => import('./LostFound/LostFoundListView'));
const LostFoundDetailView = lazy(() => import('./LostFound/LostFoundDetailView'));
const LostFoundComposeView = lazy(() => import('./LostFound/LostFoundComposeView'));
const SchoolInfoPage = lazy(() => import('./SchoolInfo/CSHSInfoPage'));

const lazyRoute = (Component, props = {}) => (
  <Suspense fallback={<div className="route-fallback">페이지를 불러오는 중...</div>}>
    <Component {...props} />
  </Suspense>
);

/**
 * NoticesPage module entry point.
 */
export default function NoticesPage() {
  return (
    <Routes>
      <Route index element={<Navigate to="school" replace />} />
      <Route path="budget/*" element={lazyRoute(BudgetBoardPage)} />
      <Route path="lost-found" element={lazyRoute(LostFoundListView)} />
      <Route path="lost-found/new" element={lazyRoute(LostFoundComposeView)} />
      <Route path='school-info/cshs-info' element={lazyRoute(SchoolInfoPage)} />
      <Route
        element={
          <NumericParamBoundary
            eyebrow="공지사항"
            title="존재하지 않는 분실물 주소입니다."
            description="분실물 상세 주소 형식을 다시 확인해 주세요."
            primaryAction={{ label: '분실물 센터', to: LOST_FOUND_NOTICE_BASE_PATH }}
            secondaryActions={[
              { label: '학교 공지', to: '/notices/school' },
              { label: '학생회 공지', to: '/notices/council' },
            ]}
          />
        }
      >
        <Route path="lost-found/:id" element={lazyRoute(LostFoundDetailView)} />
      </Route>
      <Route path="*" element={lazyRoute(NoticeCenterPage)} />
    </Routes>
  );
}
