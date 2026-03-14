import {
  CalendarDays,
  Calculator,
  Download,
  Hammer,
  Radio,
  Soup,
  Waypoints,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { SPORTS_LEAGUE_CATEGORY_ID } from '../../features/sportsLeague/data';
import '../page-shell.css';

const schoolInfoCards = [
  {
    key: 'timetable',
    to: '/school-info/timetable',
    title: '시간표 다운로드',
    description:
      '반별 시간표를 바로 확인하고, 2·3학년 선택과목을 반영한 개인 시간표 PNG를 저장할 수 있어요.',
    icon: Download,
    active: true,
  },
  {
    key: 'teachers',
    to: '/school-info/teachers',
    title: '선생님 찾기',
    description: '교무실 위치와 담당 과목 지도를 준비 중입니다.',
    icon: Waypoints,
  },
  {
    key: 'calculator',
    to: '/school-info/calculator',
    title: '내신 계산기',
    description: '내신 계산 규칙과 입력 경험을 다듬고 있습니다.',
    icon: Calculator,
  },
  {
    key: 'meal',
    to: '/school-info/meal',
    title: '오늘의 급식',
    description: '급식 정보와 알레르기 표시를 안정적으로 연결하고 있습니다.',
    icon: Soup,
  },
  {
    key: 'calendar',
    to: '/school-info/calendar',
    title: '학사 캘린더',
    description: '학사 일정, 시험, 방학, 진학 일정을 월간 캘린더와 리스트로 확인할 수 있습니다.',
    icon: CalendarDays,
    active: true,
  },
  {
    key: 'sports-league',
    to: `/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`,
    title: '스포츠리그',
    description: '실시간 중계, 예선 순위판, 주차별 대진표, 경기 규칙을 탭으로 나눠 빠르게 확인할 수 있습니다.',
    icon: Radio,
    active: true,
  },
];

export default function SchoolInfoHub() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>학교 생활 허브</h1>
          <p className="lede">
            학교 생활에 자주 필요한 기능을 한 곳에 모았습니다. 시간표 다운로드와 학사 캘린더를
            먼저 공개하고, 스포츠리그 문자중계도 함께 제공합니다.
          </p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-primary" to="/school-info/timetable">
            시간표 다운로드 열기
          </Link>
          <Link
            className="btn btn-secondary"
            to={`/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`}
          >
            스포츠리그 보기
          </Link>
        </div>
      </div>

      <div className="grid-cards">
        {schoolInfoCards.map((card) => {
          const CardIcon = card.icon;

          return (
            <Link
              key={card.key}
              to={card.to}
              className={`card card-link ${card.active ? 'card-active' : ''}`}
            >
              <div className="card-icon">
                <CardIcon size={18} />
              </div>
              <div className="card-body">
                <h3>{card.title}</h3>
                <p className="muted">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="card">
        <div className="card-icon">
          <Hammer size={18} />
        </div>
        <div className="card-body">
          <h3>업데이트 방향</h3>
          <p className="muted">
            기존 사용자 흐름을 유지하면서도, 자주 찾는 학교 생활 정보부터 순차적으로 완성도 있게
            확장하고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
