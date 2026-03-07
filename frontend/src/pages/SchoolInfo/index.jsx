import { Navigate, Route, Routes } from 'react-router-dom';
import SchoolInfoHub from './SchoolInfoHub';
import SchoolInfoPlaceholderPage from './SchoolInfoPlaceholderPage';
import TimetableDownloadPage from './TimetableDownloadPage';

const placeholderPages = {
  teachers: {
    eyebrow: '생활 정보',
    title: '교무실 찾기 준비 중',
    description: '교무실 위치와 선생님 배치를 더 정확하게 정리한 뒤 공개할 예정입니다.',
  },
  calculator: {
    eyebrow: '생활 정보',
    title: '점공 계산기 준비 중',
    description: '실사용 데이터와 계산 규칙을 정리해 안정적인 버전으로 제공할 예정입니다.',
  },
  meal: {
    eyebrow: '생활 정보',
    title: '오늘의 급식 준비 중',
    description: '급식 데이터 연동과 알레르기 표시를 함께 검증한 뒤 열 예정입니다.',
  },
  calendar: {
    eyebrow: '생활 정보',
    title: '학사 캘린더 준비 중',
    description: '학사 일정과 시험 일정을 한눈에 보기 좋게 정리한 화면을 준비하고 있습니다.',
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
      <Route
        path="calendar"
        element={<SchoolInfoPlaceholderPage {...placeholderPages.calendar} />}
      />
      <Route path="*" element={<Navigate to="/school-info" replace />} />
    </Routes>
  );
}
