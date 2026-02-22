/**
 * @file src/pages/SchoolInfoPage.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - lucide-react
 * - ./page-shell.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { Hammer } from 'lucide-react';
import './page-shell.css';

const pendingFeatures = ['교무실 지도', '점공 계산기', '오늘의 급식', '학사 캘린더'];

/**
 * SchoolInfoPage module entry point.
 */
export default function SchoolInfoPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">생활 정보</p>
          <h1>학교 생활 허브 준비 중</h1>
          <p className="lede">더 나은 경험을 위해 이 섹션을 작업하고 있습니다. 곧 업데이트로 찾아뵐게요.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-icon">
          <Hammer size={18} />
        </div>
        <div className="card-body">
          <h3>작업 현황</h3>
          <p className="muted">
            급식, 학사 일정, 점공 계산기 등 주요 기능을 안정화 중입니다. 완료되면 홈과 공지에서 바로 알려드릴게요.
          </p>
          <ul className="muted">
            {pendingFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


