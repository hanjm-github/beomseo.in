import { MapPin, Utensils, Calendar, ClipboardList, Building2, GraduationCap } from 'lucide-react';
import './page-shell.css';

const items = [
  { icon: Building2, title: '교무실 지도', desc: '교과/학급별 검색, 좌석 확인' },
  { icon: GraduationCap, title: '점공 계산기', desc: '내신 석차 예상 계산' },
  { icon: ClipboardList, title: '수행평가/시험범위', desc: '학년별 아코디언 뷰' },
  { icon: Utensils, title: '오늘의 급식', desc: 'NEIS 연동, 좋아요/싫어요' },
  { icon: Calendar, title: '학사 캘린더', desc: '월간 뷰, 시험/행사 동기화' },
  { icon: MapPin, title: '교육청 IP 보호 구역', desc: '민감 정보는 권한 라벨 표시' },
];

export default function SchoolInfoPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">생활 정보</p>
          <h1>학교 생활 허브</h1>
          <p className="lede">교무실, 급식, 캘린더, 점공까지 한 곳에.</p>
        </div>
      </div>

      <div className="grid-cards">
        {items.map(({ icon: Icon, title, desc }) => (
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
