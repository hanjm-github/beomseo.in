import { Routes, Route, Navigate } from 'react-router-dom';
import CommunityPage from './CommunityPage';
import FreeBoardListView from './FreeBoard/FreeBoardListView';
import FreeBoardDetailView from './FreeBoard/FreeBoardDetailView';
import FreeBoardComposeView from './FreeBoard/FreeBoardComposeView';

export default function CommunityRouter() {
  return (
    <Routes>
      <Route index element={<CommunityPage />} />
      <Route path="free" element={<FreeBoardListView />} />
      <Route path="free/new" element={<FreeBoardComposeView mode="create" />} />
      <Route path="free/:id" element={<FreeBoardDetailView />} />
      <Route path="free/:id/edit" element={<FreeBoardComposeView mode="edit" />} />
      <Route path="*" element={<Navigate to="/community" replace />} />
    </Routes>
  );
}
