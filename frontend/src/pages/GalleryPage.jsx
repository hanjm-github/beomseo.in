import { Camera, Palette, ShieldCheck } from 'lucide-react';
import './page-shell.css';

const gallerySections = [
  { icon: Palette, title: '공모전', desc: '진행/완료 상태 배지와 카드 뷰' },
  { icon: Camera, title: '행사 사진', desc: '권한 필터가 적용된 보호 갤러리' },
  { icon: ShieldCheck, title: '교육청 IP 보호', desc: '민감 사진은 흐림/안내 라벨' },
];

export default function GalleryPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">갤러리</p>
          <h1>beomseo.in 사진 아카이브</h1>
          <p className="lede">공모전과 행사 순간을 카드/메이슨리로 감상하세요.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary">사진 업로드</button>
        </div>
      </div>

      <div className="grid-cards">
        {gallerySections.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card">
            <div className="card-icon">
              <Icon size={18} />
            </div>
            <div className="card-body">
              <h3>{title}</h3>
              <p className="muted">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
