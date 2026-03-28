/**
 * @file src/pages/NoticesPage/index.jsx
 * @description Notices domain router that delegates to sibling notice experiences.
 * Responsibilities:
 * - Route school/council notices to the existing notice center page.
 * - Route budget disclosure URLs to the dedicated budget board.
 * Key dependencies:
 * - react-router-dom
 * - ./NoticeCenterPage
 * - ./BudgetBoardPage
 * Side effects:
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns top-level `/notices/*` branching.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import NoticeCenterPage from './NoticeCenterPage';
import BudgetBoardPage from './BudgetBoardPage';

/**
 * NoticesPage module entry point.
 */
export default function NoticesPage() {
  return (
    <Routes>
      <Route index element={<Navigate to="school" replace />} />
      <Route path="budget/*" element={<BudgetBoardPage />} />
      <Route path="*" element={<NoticeCenterPage />} />
    </Routes>
  );
}
