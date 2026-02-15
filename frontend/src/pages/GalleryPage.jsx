import { Hammer } from 'lucide-react';
import './page-shell.css';

const pendingFeatures = ['공모전 갤러리', '행사 사진', '보호 뷰(민감 사진 흐림 처리)'];

export default function GalleryPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">갤러리</p>
          <h1>갤러리 준비 중</h1>
          <p className="lede">행사 사진과 공모전 아카이브를 안정화하고 있습니다. 조금만 기다려 주세요!</p>
        </div>
      </div>

      <div className="card">
        <div className="card-icon">
          <Hammer size={18} />
        </div>
        <div className="card-body">
          <h3>작업 현황</h3>
          <p className="muted">
            업로드, 권한별 보기, 민감 사진 보호 기능을 마무리하는 중입니다. 업데이트 시 홈/공지에서 안내드릴게요.
          </p>
          <ul className="muted">
            {pendingFeatures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
