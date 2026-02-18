import { useMemo } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ListView from './ListView';
import DetailView from './DetailView';
import ComposeView from './ComposeView';
import '../page-shell.css';
import { useAuth } from '../../context/AuthContext';

const tabs = [
  { key: 'school', label: '학교 공지', path: '/notices/school' },
  { key: 'council', label: '학생회 공지', path: '/notices/council' },
];

export default function NoticesPage() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const canCreate = ['admin', 'council', 'student_council'].includes(user?.role);

  const active = useMemo(() => {
    const hit = tabs.find((t) => pathname.startsWith(t.path));
    return hit ? hit.key : 'school';
  }, [pathname]);

  const activePath = tabs.find((t) => t.key === active)?.path || '/notices/school';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">공지센터</p>
          <h1>학교 & 학생회 공지</h1>
          <p className="lede">상단 고정, 중요/시험 필터, 빠른 열람까지 한 곳에서.</p>
        </div>
        <div className="header-actions">
          {canCreate && (
            <Link className="btn btn-primary" to={`${activePath}/new`}>
              <Plus size={16} />
              공지 작성
            </Link>
          )}
        </div>
      </div>

      <div className="tab-row">
        {tabs.map((tab) => (
          <Link key={tab.key} to={tab.path} className={`chip ${active === tab.key ? 'chip-active' : ''}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="school" replace />} />
        <Route path=":category" element={<ListView />} />
        <Route path=":category/new" element={<ComposeView mode="create" />} />
        <Route path=":category/:id" element={<DetailView />} />
        <Route path=":category/:id/edit" element={<ComposeView mode="edit" />} />
        <Route path="*" element={<Navigate to="school" replace />} />
      </Routes>
    </div>
  );
}
