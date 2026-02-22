import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ReactFormBuilder, ReactFormGenerator } from 'react-form-builder2';
import 'react-form-builder2/dist/app.css';
import '../../components/survey/survey-form-builder.css';
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
          <p className="lede">승인 후 응답권 30개가 부여됩니다. 등록한 글은 관리자 승인 후 일반 사용자에게 공개됩니다.</p>
          <p className="lede">현재 미리보기 기능 사용시 글 작성이 초기화되는 버그가 발생중입니다. 이용에 참고 부탁드립니다.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> 뒤로가기
        </button>
      </div>

      {loading ? <p>불러오는 중…</p> : null}

      <form onSubmit={handleSubmit}>
        <section className={styles.composeMetaGrid}>
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

        <label className={styles.composeDescription}>
          설명
          <textarea
            className={`${styles.search} ${styles.composeDescriptionField}`}
            value={meta.description}
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            placeholder="설문 목적과 응답 안내를 적어주세요."
          />
        </label>

        <section className={styles.composeBuilderSection}>
          <div className={styles.composeBuilderHeader}>
            <h3 className={styles.composeBuilderTitle}>질문 빌더</h3>
            <div className={styles.composeBuilderActions}>
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
          <h4 className={styles.previewTitle}>미리보기</h4>
          <ReactFormGenerator data={formJson} answer_data={[]} />
        </div>
      ) : null}
    </div>
  );
}
