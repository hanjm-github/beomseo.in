import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import NotFoundPage from '../NotFoundPage';
import { SPORTS_LEAGUE_CATEGORY_ID } from '../../features/sportsLeague/data';

const AcademicCalendarPage = lazy(() => import('./AcademicCalendarPage'));
const MealPage = lazy(() => import('./MealPage'));
const SchoolInfoHub = lazy(() => import('./SchoolInfoHub'));
const SportsLeagueCategoryPage = lazy(() => import('./SportsLeagueCategoryPage'));
const TimetableDownloadPage = lazy(() => import('./TimetableDownloadPage'));

const lazyRoute = (Component, props = {}) => (
  <Suspense fallback={<div className="route-fallback">페이지를 불러오는 중...</div>}>
    <Component {...props} />
  </Suspense>
);

export default function SchoolInfoRouter() {
  return (
    <Routes>
      <Route index element={lazyRoute(SchoolInfoHub)} />
      <Route path="timetable" element={lazyRoute(TimetableDownloadPage)} />
      <Route path="meal" element={lazyRoute(MealPage)} />
      <Route path="calendar" element={lazyRoute(AcademicCalendarPage)} />
      <Route
        path="sports-league"
        element={<Navigate to={`/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`} replace />}
      />
      <Route
        path="sports-league/:categoryId"
        element={lazyRoute(SportsLeagueCategoryPage)}
      />
      <Route
        path="*"
        element={
          <NotFoundPage
            eyebrow="학교 생활 정보"
            title="존재하지 않는 학교 생활 정보 주소입니다."
            description="시간표, 급식, 학사 캘린더처럼 제공 중인 메뉴에서 다시 찾아보세요."
            primaryAction={{ label: '학교 생활 정보 홈', to: '/school-info' }}
            secondaryActions={[
              { label: '시간표 다운로드', to: '/school-info/timetable' },
              { label: '학사 캘린더', to: '/school-info/calendar' },
              { label: '스포츠리그', to: `/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}` },
            ]}
          />
        }
      />
    </Routes>
  );
}
