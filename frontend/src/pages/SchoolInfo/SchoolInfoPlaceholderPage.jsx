import { Hammer } from 'lucide-react';
import '../page-shell.css';

export default function SchoolInfoPlaceholderPage({ eyebrow, title, description }) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{description}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-icon">
          <Hammer size={18} />
        </div>
        <div className="card-body">
          <h3>준비 중인 기능입니다</h3>
          <p className="muted">
            실제 사용 흐름과 학교 데이터 정합성을 먼저 점검한 뒤 순차적으로 공개할 예정입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
