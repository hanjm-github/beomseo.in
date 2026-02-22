import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

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

export default function CommunityRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/community/free/" replace />} />
      <Route path="free" element={lazyRoute(FreeBoardListView)} />
      <Route path="free/new" element={lazyRoute(FreeBoardComposeView, { mode: 'create' })} />
      <Route path="free/:id" element={lazyRoute(FreeBoardDetailView)} />
      <Route path="free/:id/edit" element={lazyRoute(FreeBoardComposeView, { mode: 'edit' })} />

      <Route path="club-recruit" element={lazyRoute(ClubRecruitListPage)} />
      <Route path="club-recruit/new" element={lazyRoute(ClubRecruitComposePage)} />
      <Route path="club-recruit/:id" element={lazyRoute(ClubRecruitDetailPage)} />

      <Route path="subjects" element={lazyRoute(SubjectsListPage)} />
      <Route path="subjects/new" element={lazyRoute(SubjectComposePage)} />
      <Route path="subjects/:id" element={lazyRoute(SubjectDetailPage)} />

      <Route path="petition" element={lazyRoute(PetitionListView)} />
      <Route path="petition/new" element={lazyRoute(PetitionComposeView)} />
      <Route path="petition/:id" element={lazyRoute(PetitionDetailView)} />

      <Route path="survey" element={lazyRoute(SurveyExchangeListView)} />
      <Route path="survey/new" element={lazyRoute(SurveyExchangeComposePage)} />
      <Route path="survey/:id" element={lazyRoute(SurveyExchangeDetailView)} />
      <Route path="survey/:id/edit" element={lazyRoute(SurveyExchangeComposePage)} />
      <Route path="survey/:id/results" element={lazyRoute(SurveyResultsView)} />

      <Route path="vote" element={lazyRoute(VoteListView)} />
      <Route path="vote/new" element={lazyRoute(VoteComposeView)} />
      <Route path="vote/:id" element={lazyRoute(VoteDetailView)} />

      <Route path="lost-found" element={lazyRoute(LostFoundListView)} />
      <Route path="lost-found/new" element={lazyRoute(LostFoundComposeView)} />
      <Route path="lost-found/:id" element={lazyRoute(LostFoundDetailView)} />

      <Route path="gomsol-market" element={lazyRoute(GomsolMarketListView)} />
      <Route path="gomsol-market/new" element={lazyRoute(GomsolMarketComposeView)} />
      <Route path="gomsol-market/:id" element={lazyRoute(GomsolMarketDetailView)} />
      <Route path="*" element={<Navigate to="/community/free/" replace />} />
    </Routes>
  );
}
