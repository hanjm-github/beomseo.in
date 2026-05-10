import {
  CalendarDays,
  Download,
  FileText,
  Hammer,
  QrCode,
  Radio,
  Soup,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import SEO from '../../../components/SEO';

import { SPORTS_LEAGUE_CATEGORY_ID } from '../../../features/sportsLeague/data';
import '../../page-shell.css';

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
    key: 'meal',
    to: '/school-info/meal',
    title: '오늘의 급식',
    description: '오늘 전후의 점심 메뉴와 이달 급식 달력을 함께 볼 수 있어요.',
    icon: Soup,
    active: true,
  },
  {
    key: 'evaluation-plans',
    to: '/school-info/evaluation-plans',
    title: '평가계획서 다운로드',
    description: '2026학년도 1학기 학년별 평가계획서 HWP 원본 파일을 바로 내려받을 수 있습니다.',
    icon: FileText,
    active: true,
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
  {
    key: 'qr-generator',
    to: '/school-info/qr-generator',
    title: 'QR 코드 생성기',
    description:
      '텍스트·URL을 입력하고 색상, 스타일, 로고를 설정한 뒤 PNG/JPG/WebP로 바로 다운로드할 수 있습니다.',
    icon: QrCode,
    active: true,
  },
];

export default function SchoolInfoHub() {
  return (
    <div className="page-shell">
      <SEO path="/school-info" />
      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>학교 생활 허브</h1>
          <p className="lede">
            학교 생활에 자주 필요한 기능을 한 곳에 모았습니다. 시간표 다운로드, 평가계획서,
            급식, 학사 캘린더, 스포츠리그를 한 번에 확인할 수 있습니다.
          </p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-primary" to="/school-info/timetable">
            시간표 다운로드 열기
          </Link>
          <Link className="btn btn-secondary" to="/school-info/evaluation-plans">
            평가계획서 받기
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
