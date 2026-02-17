import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFormGenerator } from 'react-form-builder2';
import 'react-form-builder2/dist/app.css';
import { surveyExchangeApi } from '../../api/surveyExchange';
import styles from './surveyExchange.module.css';
import '../page-shell.css';

export default function SurveyExchangeDetailView() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    surveyExchangeApi.get(id)
      .then((res) => { if (!cancelled) setItem(res); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || '설문 조회 실패'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleSubmit = async (answers) => {
    try {
      await surveyExchangeApi.submitResponse(id, answers || []);
      setDone(true);
      const refreshed = await surveyExchangeApi.get(id);
      setItem(refreshed);
    } catch (err) {
      setError(err.response?.data?.error || '응답 제출 실패');
    }
  };

  if (loading) return <div className="page-shell"><p>불러오는 중...</p></div>;
  if (error) return <div className="page-shell"><p className={styles.error}>{error}</p></div>;
  if (!item) return null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">설문 품앗이</p>
          <h1>{item.title}</h1>
          <p className="lede">{item.description}</p>
        </div>
      </div>

      <div className={styles.formWrap}>
        <div className={styles.meta}>
          <span>작성자: {item.author?.nickname}</span>
          <span>누적 응답: {item.responsesCount}</span>
          <span>응답 가능: {item.remainingSlots}/{item.responseLimit}</span>
        </div>

        {done ? <p>응답이 제출되었습니다. 고마워요! 이제 당신의 설문 응답 한도가 증가합니다.</p> : null}

        <ReactFormGenerator
          data={item.formSchema || []}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
