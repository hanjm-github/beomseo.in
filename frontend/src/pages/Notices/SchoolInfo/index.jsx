/**
 * @file src/pages/Notices/SchoolInfo/index.jsx
 * @description Nested router for notice-area school profile pages.
 */
import { Navigate, Route, Routes } from 'react-router-dom';

import NotFoundPage from '../../NotFoundPage';
import BeomseoInfoPage from './BeomseoInfoPage';
import CSHSInfoPage from './CSHSInfoPage';

export default function SchoolInfoRouter() {
  return (
    <Routes>
      {/* Keep /notices/school-info as a stable entry point while defaulting to Beomseo. */}
      <Route index element={<Navigate to="bshs-info" replace />} />
      <Route path="bshs-info" element={<BeomseoInfoPage />} />
      <Route path="cshs-info" element={<CSHSInfoPage />} />
      <Route
        path="*"
        element={
          <NotFoundPage
            eyebrow="학교 소개"
            title="존재하지 않는 학교 소개 주소입니다."
            description="범서고와 천상고 학교 소개 메뉴에서 다시 이동해 주세요."
            primaryAction={{ label: '범서고 소개', to: '/notices/school-info/bshs-info' }}
            secondaryActions={[{ label: '천상고 소개', to: '/notices/school-info/cshs-info' }]}
          />
        }
      />
    </Routes>
  );
}
