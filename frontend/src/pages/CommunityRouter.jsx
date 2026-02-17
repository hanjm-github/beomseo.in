import { Routes, Route, Navigate } from 'react-router-dom';
import CommunityPage from './CommunityPage';
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
import SurveyExchangeComposeView from './SurveyExchange/SurveyExchangeComposeView';
import SurveyExchangeDetailView from './SurveyExchange/SurveyExchangeDetailView';

export default function CommunityRouter() {
  return (
    <Routes>
      <Route index element={<CommunityPage />} />
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
      <Route path="survey/new" element={<SurveyExchangeComposeView />} />
      <Route path="survey/:id" element={<SurveyExchangeDetailView />} />
      <Route path="*" element={<Navigate to="/community" replace />} />
    </Routes>
  );
}
