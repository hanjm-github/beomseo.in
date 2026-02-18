import { createElement, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Users, Shuffle, Vote, PlugZap, ShieldCheck, Package, Store } from 'lucide-react';
import './page-shell.css';

const boards = [
  {
    key: 'free',
    path: 'free',
    label: '자유 게시판',
    description: '잡담, 정보, QnA 글을 자유롭게 공유하세요.',
    icon: MessageCircle,
  },
  {
    key: 'club-recruit',
    path: 'club-recruit',
    label: '동아리 모집',
    description: '동아리 포스터와 분야를 한눈에 확인할 수 있어요.',
    icon: Users,
  },
  {
    key: 'subjects',
    path: 'subjects',
    label: '선택과목 변경',
    description: '주는 과목 / 받는 과목 정보를 빠르게 탐색하세요.',
    icon: Shuffle,
  },
  {
    key: 'petition',
    path: 'petition',
    label: '학생 청원',
    description: '추천 수 기반으로 학생회 답변을 받는 청원 보드입니다.',
    icon: ShieldCheck,
  },
  {
    key: 'survey',
    path: 'survey',
    label: '설문 품앗이',
    description: '설문 응답을 주고받고 응답권을 교환해요.',
    icon: PlugZap,
  },
  {
    key: 'vote',
    path: 'vote',
    label: '실시간 투표',
    description: '학급·학생회 투표를 실시간으로 확인할 수 있어요.',
    icon: Vote,
  },
  {
    key: 'lost-found',
    path: 'lost-found',
    label: '분실물 센터',
    description: '사진, 발견 장소를 확인해 주인을 찾습니다.',
    icon: Package,
  },
  {
    key: 'gomsol-market',
    path: 'gomsol-market',
    label: '곰솔마켓',
    description: '교내 중고거래 글을 확인해요.',
    icon: Store,
  },
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
          <p className="lede">자유 게시판, 투표, 설문까지 하나의 허브에서.</p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-primary" to="/community/free/new">
            글쓰기
          </Link>
        </div>
      </div>

      <div className="grid-cards">
        {boards.map(({ key, path, label, description, icon }) => (
          <Link
            to={`/community/${path}`}
            key={key}
            className={`card card-link ${active === key ? 'card-active' : ''}`}
          >
            <div className="card-icon">
              {createElement(icon, { size: 18 })}
            </div>
            <div className="card-body">
              <h3>{label}</h3>
              <p className="muted">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
