import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactFormBuilder } from 'react-form-builder2';
import 'react-form-builder2/dist/app.css';
import { surveyExchangeApi } from '../../api/surveyExchange';
import styles from './surveyExchange.module.css';
import '../page-shell.css';

export default function SurveyExchangeComposeView() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!schema?.length) {
      setError('문항을 최소 1개 이상 추가해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await surveyExchangeApi.create({ title, description, formSchema: schema });
      navigate(`/community/survey/${created.id}`);
    } catch (err) {
      setError(err.response?.data?.error || '설문 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">설문 품앗이</p>
          <h1>설문 등록</h1>
        </div>
      </div>

      <form className={styles.formWrap} onSubmit={handleSubmit}>
        <input className={styles.input} placeholder="설문 제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className={styles.textarea} placeholder="설문 설명" value={description} onChange={(e) => setDescription(e.target.value)} />

        <ReactFormBuilder
          data={schema}
          onPost={(data) => setSchema(data?.task_data || [])}
        />

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/community/survey')}>취소</button>
          <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? '등록 중...' : '등록'}</button>
        </div>
      </form>
    </div>
  );
}
