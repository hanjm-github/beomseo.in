import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Pin, Filter, ListFilter, Printer } from 'lucide-react';
import './page-shell.css';

const tabs = [
  { key: 'school', label: '학교 공지', path: '/notices/school' },
  { key: 'council', label: '학생회 공지', path: '/notices/council' },
];

export default function NoticesPage() {
  const { pathname } = useLocation();

  const active = useMemo(() => {
    const hit = tabs.find((t) => pathname.startsWith(t.path));
    return hit ? hit.key : 'school';
  }, [pathname]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">공지센터</p>
          <h1>학교 & 학생회 공지</h1>
          <p className="lede">상단 고정, 중요/시험 필터, 프린트 뷰까지 한 곳에서.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary">
            <Printer size={16} />
            프린트 보기
          </button>
          <button className="btn btn-primary">공지 작성</button>
        </div>
      </div>

      <div className="tab-row">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={tab.path}
            className={`chip ${active === tab.key ? 'chip-active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="card surface">
        <div className="list-toolbar">
          <div className="chip-set">
            <button className="chip ghost">
              <Pin size={14} />
              상단 고정
            </button>
            <button className="chip ghost">
              <Filter size={14} />
              중요
            </button>
            <button className="chip ghost">시험</button>
          </div>
          <div className="chip-set">
            <button className="chip ghost">
              <ListFilter size={14} />
              정렬
            </button>
          </div>
        </div>
        <div className="placeholder">공지 리스트는 API 연동 시 교체됩니다.</div>
      </div>
    </div>
  );
}
