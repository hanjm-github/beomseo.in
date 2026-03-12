import { Navigate, Route, Routes } from 'react-router-dom';
import AcademicCalendarPage from './AcademicCalendarPage';
import SchoolInfoHub from './SchoolInfoHub';
import SchoolInfoPlaceholderPage from './SchoolInfoPlaceholderPage';
import TimetableDownloadPage from './TimetableDownloadPage';

const placeholderPages = {
  teachers: {
    eyebrow: '학교 생활 정보',
    title: '선생님 찾기 준비 중',
    description: '교무실 위치와 담당 과목 정보를 보기 쉽게 정리해 곧 공개할 예정입니다.',
  },
  calculator: {
    eyebrow: '학교 생활 정보',
    title: '내신 계산기 준비 중',
    description: '반영 비율과 계산 규칙을 정리한 안정적인 버전으로 제공할 예정입니다.',
  },
  meal: {
    eyebrow: '학교 생활 정보',
    title: '오늘의 급식 준비 중',
    description: '급식 정보와 알레르기 표시를 함께 검증한 화면으로 제공할 예정입니다.',
  },
};

export default function SchoolInfoRouter() {
  return (
    <Routes>
      <Route index element={<SchoolInfoHub />} />
      <Route path="timetable" element={<TimetableDownloadPage />} />
      <Route
        path="teachers"
        element={<SchoolInfoPlaceholderPage {...placeholderPages.teachers} />}
      />
      <Route
        path="calculator"
        element={<SchoolInfoPlaceholderPage {...placeholderPages.calculator} />}
      />
      <Route path="meal" element={<SchoolInfoPlaceholderPage {...placeholderPages.meal} />} />
      <Route path="calendar" element={<AcademicCalendarPage />} />
      <Route path="*" element={<Navigate to="/school-info" replace />} />
    </Routes>
  );
}
