/**
 * @file src/pages/CommunityRouter.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * Side effects:
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import { NumericParamBoundary } from './RouteBoundaries';

const FreeBoardListView = lazy(() => import('./FreeBoard/FreeBoardListView'));
const FreeBoardDetailView = lazy(() => import('./FreeBoard/FreeBoardDetailView'));
const FreeBoardComposeView = lazy(() => import('./FreeBoard/FreeBoardComposeView'));

const ClubRecruitListPage = lazy(() => import('./ClubRecruit/ClubRecruitListPage'));
const ClubRecruitDetailPage = lazy(() => import('./ClubRecruit/ClubRecruitDetailPage'));
const ClubRecruitComposePage = lazy(() => import('./ClubRecruit/ClubRecruitComposePage'));

const SubjectsListPage = lazy(() => import('./Subjects/SubjectsListPage'));
const SubjectDetailPage = lazy(() => import('./Subjects/SubjectDetailPage'));
const SubjectComposePage = lazy(() => import('./Subjects/SubjectComposePage'));

const PetitionListView = lazy(() => import('./Petition/PetitionListView'));
const PetitionDetailView = lazy(() => import('./Petition/PetitionDetailView'));
const PetitionComposeView = lazy(() => import('./Petition/PetitionComposeView'));

const SurveyExchangeListView = lazy(() => import('./SurveyExchange/SurveyExchangeListView'));
const SurveyExchangeDetailView = lazy(() => import('./SurveyExchange/SurveyExchangeDetailView'));
const SurveyExchangeComposePage = lazy(() => import('./SurveyExchange/SurveyExchangeComposePage'));
const SurveyResultsView = lazy(() => import('./SurveyExchange/SurveyResultsView'));

const VoteListView = lazy(() => import('./Vote/VoteListView'));
const VoteDetailView = lazy(() => import('./Vote/VoteDetailView'));
const VoteComposeView = lazy(() => import('./Vote/VoteComposeView'));

const LostFoundListView = lazy(() => import('./LostFound/LostFoundListView'));
const LostFoundDetailView = lazy(() => import('./LostFound/LostFoundDetailView'));
const LostFoundComposeView = lazy(() => import('./LostFound/LostFoundComposeView'));

const GomsolMarketListView = lazy(() => import('./GomsolMarket/GomsolMarketListView'));
const GomsolMarketDetailView = lazy(() => import('./GomsolMarket/GomsolMarketDetailView'));
const GomsolMarketComposeView = lazy(() => import('./GomsolMarket/GomsolMarketComposeView'));

const lazyRoute = (Component, props = {}) => (
  <Suspense fallback={<div className="route-fallback">Loading...</div>}>
    <Component {...props} />
  </Suspense>
);

/**
 * CommunityRouter module entry point.
 */
export default function CommunityRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/community/free" replace />} />
      <Route path="free" element={lazyRoute(FreeBoardListView)} />
      <Route path="free/new" element={lazyRoute(FreeBoardComposeView, { mode: 'create' })} />

      <Route path="club-recruit" element={lazyRoute(ClubRecruitListPage)} />
      <Route path="club-recruit/new" element={lazyRoute(ClubRecruitComposePage)} />

      <Route path="subjects" element={lazyRoute(SubjectsListPage)} />
      <Route path="subjects/new" element={lazyRoute(SubjectComposePage)} />

      <Route path="petition" element={lazyRoute(PetitionListView)} />
      <Route path="petition/new" element={lazyRoute(PetitionComposeView)} />

      <Route path="survey" element={lazyRoute(SurveyExchangeListView)} />
      <Route path="survey/new" element={lazyRoute(SurveyExchangeComposePage)} />

      <Route path="vote" element={lazyRoute(VoteListView)} />
      <Route path="vote/new" element={lazyRoute(VoteComposeView)} />

      <Route path="lost-found" element={lazyRoute(LostFoundListView)} />
      <Route path="lost-found/new" element={lazyRoute(LostFoundComposeView)} />

      <Route path="gomsol-market" element={lazyRoute(GomsolMarketListView)} />
      <Route path="gomsol-market/new" element={lazyRoute(GomsolMarketComposeView)} />

      <Route
        element={
          <NumericParamBoundary
            eyebrow="커뮤니티"
            title="존재하지 않는 커뮤니티 주소입니다."
            description="게시판 주소 형식을 다시 확인하거나 다른 커뮤니티 메뉴로 이동해 주세요."
            primaryAction={{ label: '자유게시판', to: '/community/free' }}
            secondaryActions={[{ label: '동아리 모집', to: '/community/club-recruit' }]}
          />
        }
      >
        <Route path="free/:id" element={lazyRoute(FreeBoardDetailView)} />
        <Route path="free/:id/edit" element={lazyRoute(FreeBoardComposeView, { mode: 'edit' })} />
        <Route path="club-recruit/:id" element={lazyRoute(ClubRecruitDetailPage)} />
        <Route path="subjects/:id" element={lazyRoute(SubjectDetailPage)} />
        <Route path="petition/:id" element={lazyRoute(PetitionDetailView)} />
        <Route path="survey/:id" element={lazyRoute(SurveyExchangeDetailView)} />
        <Route path="survey/:id/edit" element={lazyRoute(SurveyExchangeComposePage)} />
        <Route path="survey/:id/results" element={lazyRoute(SurveyResultsView)} />
        <Route path="vote/:id" element={lazyRoute(VoteDetailView)} />
        <Route path="lost-found/:id" element={lazyRoute(LostFoundDetailView)} />
        <Route path="gomsol-market/:id" element={lazyRoute(GomsolMarketDetailView)} />
      </Route>

      <Route
        path="*"
        element={
          <NotFoundPage
            eyebrow="커뮤니티"
            title="존재하지 않는 커뮤니티 주소입니다."
            description="입력한 게시판 경로를 찾을 수 없습니다. 아래 메뉴에서 원하는 커뮤니티로 다시 이동해 주세요."
            primaryAction={{ label: '자유게시판', to: '/community/free' }}
            secondaryActions={[
              { label: '동아리 모집', to: '/community/club-recruit' },
              { label: '설문 품앗이', to: '/community/survey' },
            ]}
          />
        }
      />
    </Routes>
  );
}
