import { CalendarDays, Calculator, Download, Hammer, Soup, Waypoints } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../page-shell.css';

const schoolInfoCards = [
  {
    key: 'timetable',
    to: '/school-info/timetable',
    title: '시간표 다운로드',
    description: '반별 시간표를 바로 확인하고, 2·3학년 선택과목을 반영한 개인 시간표 PNG를 저장할 수 있어요.',
    icon: Download,
    active: true,
  },
  {
    key: 'teachers',
    to: '/school-info/teachers',
    title: '교무실 찾기',
    description: '교무실 위치와 선생님 배치 지도를 준비 중입니다.',
    icon: Waypoints,
  },
  {
    key: 'calculator',
    to: '/school-info/calculator',
    title: '점공 계산기',
    description: '점공 계산 규칙과 입력 UX를 다듬고 있습니다.',
    icon: Calculator,
  },
  {
    key: 'meal',
    to: '/school-info/meal',
    title: '오늘의 급식',
    description: '급식 정보와 알레르기 표시를 안정화하고 있습니다.',
    icon: Soup,
  },
  {
    key: 'calendar',
    to: '/school-info/calendar',
    title: '학사 캘린더',
    description: '학사 일정과 시험 일정을 캘린더로 보여줄 예정입니다.',
    icon: CalendarDays,
  },
];

export default function SchoolInfoHub() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">생활 정보</p>
          <h1>학교 생활 허브</h1>
          <p className="lede">
            학교 생활에 자주 필요한 기능을 한곳에 모읍니다. 이번 업데이트에서는 시간표 다운로드를 먼저 공개합니다.
          </p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-primary" to="/school-info/timetable">
            시간표 다운로드 열기
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
            기존 디자인 톤은 유지하면서, 실사용 빈도가 높은 생활 정보 도구부터 하나씩 안정화해 공개합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
