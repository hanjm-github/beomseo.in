import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ReactFormBuilder } from 'react-form-builder2';
import 'react-form-builder2/dist/app.css';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { surveyApi } from '../../api/survey';
import styles from '../../components/survey/survey.module.css';
import '../page-shell.css';

export default function SurveyExchangeComposePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;

  const [meta, setMeta] = useState({
    title: '',
    description: '',
    expiresAt: '',
    responseQuota: 10,
  });
  const [formJson, setFormJson] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    alert('설문 수정 기능이 비활성화되었습니다.');
    navigate(/community/survey/, { replace: true });
  }, [id, isEdit, navigate]);

  const handleSaveForm = (data) => {
    setFormJson(data.task_data || data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEdit) {
      alert('설문을 수정할 수 없습니다.');
      return;
    }
    if (!meta.title || formJson.length === 0) {
      alert('제목과 질문을 최소 1개 이상 작성해주세요.');
      return;
    }

    setSaving(true);
    const payload = {
      title: meta.title,
      description: meta.description,
      expiresAt: meta.expiresAt || null,
      responseQuota: Number(meta.responseQuota) || 10,
      formJson,
    };

    try {
      const res = await surveyApi.create(payload);
      alert('저장되었습니다.');
      navigate(/community/survey/, { replace: true, state: { from: location.pathname } });
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className= page-shell>
      <div className={styles.pageHeader}>
        <div>
          <p className=eyebrow>설문 작성</p>
          <h1>새 설문 만들기</h1>
          <p className=lede>react-form-builder2로 질문을 작성하세요.</p>
        </div>
        <button className=btn btn-secondary type=button onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> 뒤로가기
        </button>
      </div>

      {loading ? <p>불러오는 중...</p> : null}

      <form onSubmit={handleSubmit}>
        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <label>
            제목
            <input
              className={styles.search}
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder=예: 학교 생활 만족도 설문
              required
            />
          </label>
          <label>
            마감일(선택)
            <input
              type=date
              className={styles.search}
              value={meta.expiresAt}
              onChange={(e) => setMeta((m) => ({ ...m, expiresAt: e.target.value }))}
            />
          </label>
          <label>
            기본 응답권
            <input
              type=number
              min={10}
              className={styles.search}
              value={meta.responseQuota}
              onChange={(e) => setMeta((m) => ({ ...m, responseQuota: e.target.value }))}
            />
          </label>
        </section>

        <label style={{ display: 'block', marginTop: 12 }}>
          설명
          <textarea
            className={styles.search}
            style={{ minHeight: 90, width: '100%' }}
            value={meta.description}
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            placeholder=설문 목적과 응답 안내를 적어주세요.
          />
        </label>

        <section style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>폼 빌더</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type=submit className=btn btn-primary disabled={saving}>
                <Save size={16} />
                {saving ? '저장중' : '저장'}
              </button>
            </div>
          </div>
          <ReactFormBuilder data={formJson} onPost={handleSaveForm} />
        </section>
      </form>
    </div>
  );
}
