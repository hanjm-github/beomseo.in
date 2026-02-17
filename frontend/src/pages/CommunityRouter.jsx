import { Routes, Route, Navigate } from 'react-router-dom';
import FreeBoardListView from './FreeBoard/FreeBoardListView';
import FreeBoardDetailView from './FreeBoard/FreeBoardDetailView';
import FreeBoardComposeView from './FreeBoard/FreeBoardComposeView';
import ClubRecruitListPage from './ClubRecruit/ClubRecruitListPage';
import ClubRecruitDetailPage from './ClubRecruit/ClubRecruitDetailPage';
import ClubRecruitComposePage from './ClubRecruit/ClubRecruitComposePage';
import SubjectsListPage from './Subjects/SubjectsListPage';
import SubjectDetailPage from './Subjects/SubjectDetailPage';
import SubjectComposePage from './Subjects/SubjectComposePage';
import PetitionListView from './Petition/PetitionListView';
import PetitionDetailView from './Petition/PetitionDetailView';
import PetitionComposeView from './Petition/PetitionComposeView';
import SurveyExchangeListView from './SurveyExchange/SurveyExchangeListView';
import SurveyExchangeDetailView from './SurveyExchange/SurveyExchangeDetailView';
import SurveyExchangeComposePage from './SurveyExchange/SurveyExchangeComposePage';
import SurveyResultsView from './SurveyExchange/SurveyResultsView';
import VoteListView from './Vote/VoteListView';
import VoteDetailView from './Vote/VoteDetailView';
import VoteComposeView from './Vote/VoteComposeView';
import LostFoundListView from './LostFound/LostFoundListView';
import LostFoundDetailView from './LostFound/LostFoundDetailView';
import LostFoundComposeView from './LostFound/LostFoundComposeView';
import GomsolMarketListView from './GomsolMarket/GomsolMarketListView';
import GomsolMarketDetailView from './GomsolMarket/GomsolMarketDetailView';
import GomsolMarketComposeView from './GomsolMarket/GomsolMarketComposeView';

export default function CommunityRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/community/free/" replace />} />
      <Route path="free" element={<FreeBoardListView />} />
      <Route path="free/new" element={<FreeBoardComposeView mode="create" />} />
      <Route path="free/:id" element={<FreeBoardDetailView />} />
      <Route path="free/:id/edit" element={<FreeBoardComposeView mode="edit" />} />
      <Route path="club-recruit" element={<ClubRecruitListPage />} />
      <Route path="club-recruit/new" element={<ClubRecruitComposePage />} />
      <Route path="club-recruit/:id" element={<ClubRecruitDetailPage />} />
      <Route path="subjects" element={<SubjectsListPage />} />
      <Route path="subjects/new" element={<SubjectComposePage />} />
      <Route path="subjects/:id" element={<SubjectDetailPage />} />
      <Route path="petition" element={<PetitionListView />} />
      <Route path="petition/new" element={<PetitionComposeView />} />
      <Route path="petition/:id" element={<PetitionDetailView />} />
      <Route path="survey" element={<SurveyExchangeListView />} />
      <Route path="survey/new" element={<SurveyExchangeComposePage />} />
      <Route path="survey/:id" element={<SurveyExchangeDetailView />} />
      <Route path="survey/:id/edit" element={<SurveyExchangeComposePage />} />
      <Route path="survey/:id/results" element={<SurveyResultsView />} />
      <Route path="vote" element={<VoteListView />} />
      <Route path="vote/new" element={<VoteComposeView />} />
      <Route path="vote/:id" element={<VoteDetailView />} />
      <Route path="lost-found" element={<LostFoundListView />} />
      <Route path="lost-found/new" element={<LostFoundComposeView />} />
      <Route path="lost-found/:id" element={<LostFoundDetailView />} />
      <Route path="gomsol-market" element={<GomsolMarketListView />} />
      <Route path="gomsol-market/new" element={<GomsolMarketComposeView />} />
      <Route path="gomsol-market/:id" element={<GomsolMarketDetailView />} />
      <Route path="*" element={<Navigate to="/community/free/" replace />} />
    </Routes>
  );
}
