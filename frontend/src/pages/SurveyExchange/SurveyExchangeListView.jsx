import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { surveyExchangeApi } from '../../api/surveyExchange';
import { useAuth } from '../../context/AuthContext';
import styles from './surveyExchange.module.css';
import '../page-shell.css';

export default function SurveyExchangeListView() {
  const { user } = useAuth();
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [] });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    surveyExchangeApi.list({ mine: mine ? 1 : undefined }).then((res) => {
      if (!cancelled) setData(res);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mine]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">설문 품앗이</p>
          <h1>설문 교환 게시판</h1>
          <p className="lede">등록 시 기본 응답 10개, 다른 설문에 응답할수록 내 설문 한도가 늘어납니다.</p>
        </div>
      </div>

      <div className={styles.shell}>
        <div className={styles.toolbar}>
          <label>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} disabled={!user} /> 내 설문만 보기
          </label>
          <Link className="btn btn-primary" to="/community/survey/new">설문 등록</Link>
        </div>

        {loading ? <p>불러오는 중...</p> : (
          <div className={styles.cards}>
            {(data.items || []).map((item) => (
              <Link key={item.id} to={`/community/survey/${item.id}`} className={styles.card}>
                <span className={styles.badge}>{item.remainingSlots}/{item.responseLimit} 응답 가능</span>
                <h3>{item.title}</h3>
                <p>{item.description || '설명 없음'}</p>
                <div className={styles.meta}>
                  <span>작성자: {item.author?.nickname || '익명'}</span>
                  <span>응답 {item.responsesCount}개</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
