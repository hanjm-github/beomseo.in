import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Users, Shuffle, Vote, Radio, PlugZap, ShieldCheck } from 'lucide-react';
import './page-shell.css';

const boards = [
  { key: 'free', label: '자유 게시판', icon: MessageCircle },
  { key: 'clubs', label: '동아리 모집', icon: Users },
  { key: 'subjects', label: '선택과목 변경', icon: Shuffle },
  { key: 'petition', label: '학생 청원', icon: ShieldCheck },
  { key: 'radio', label: '라디오 신청곡', icon: Radio },
  { key: 'survey', label: '설문 품앗이', icon: PlugZap },
  { key: 'vote', label: '실시간 투표', icon: Vote },
  { key: 'lost-found', label: '분실물 센터', icon: ShieldCheck },
];

export default function CommunityPage() {
  const { pathname } = useLocation();
  const active = useMemo(() => boards.find((b) => pathname.includes(b.key))?.key, [pathname]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">소통 허브</p>
          <h1>범서고 커뮤니티</h1>
          <p className="lede">자유 게시판, 투표, 설문, 라디오 신청까지 하나의 허브에서.</p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-primary" to="/community/free/new">
            글쓰기
          </Link>
        </div>
      </div>

      <div className="grid-cards">
        {boards.map(({ key, label, icon: Icon }) => (
          <Link
            to={`/community/${key}`}
            key={key}
            className={`card card-link ${active === key ? 'card-active' : ''}`}
          >
            <div className="card-icon">
              <Icon size={18} />
            </div>
            <div className="card-body">
              <h3>{label}</h3>
              <p className="muted">상태, 필터, 정렬은 API 연동 시 활성화됩니다.</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
