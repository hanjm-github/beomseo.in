import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ReactFormBuilder, ReactFormGenerator } from 'react-form-builder2';
import 'react-form-builder2/dist/app.css';
import { ArrowLeft, Check, Eye, Save } from 'lucide-react';
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
  });
  const [formJson, setFormJson] = useState([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const loading = isEdit;

  useEffect(() => {
    if (!isEdit) return;
    alert('설문 수정 기능이 비활성화되었습니다.');
    navigate(`/community/survey/${id}`, { replace: true });
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
      formJson,
    };

    try {
      const res = isEdit ? await surveyApi.update(id, payload) : await surveyApi.create(payload);
      alert('저장되었습니다.');
      navigate(`/community/survey/${res.id}`, { replace: true, state: { from: location.pathname } });
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">설문 {isEdit ? '수정' : '작성'}</p>
          <h1>{isEdit ? '설문 수정' : '새 설문 만들기'}</h1>
          <p className="lede">승인 후 응답권 30개가 부여됩니다. 질문을 구성하고 미리보기로 확인하세요.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> 뒤로가기
        </button>
      </div>

      {loading ? <p>불러오는 중…</p> : null}

      <form onSubmit={handleSubmit}>
        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <label>
            제목
            <input
              className={styles.search}
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder="예: 급식 만족도 설문"
              required
            />
          </label>
          <label>
            만료일 (선택)
            <input
              type="date"
              className={styles.search}
              value={meta.expiresAt}
              onChange={(e) => setMeta((m) => ({ ...m, expiresAt: e.target.value }))}
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
            placeholder="설문 목적과 응답 안내를 적어주세요."
          />
        </label>

        <section style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>질문 빌더</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPreview((v) => !v)}>
                <Eye size={16} /> 미리보기
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} />
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
          <ReactFormBuilder data={formJson} onPost={handleSaveForm} />
        </section>
      </form>

      {preview ? (
        <div className={styles.previewCard}>
          <h4 style={{ marginTop: 0 }}>미리보기</h4>
          <ReactFormGenerator data={formJson} answer_data={[]} />
        </div>
      ) : null}
    </div>
  );
}
