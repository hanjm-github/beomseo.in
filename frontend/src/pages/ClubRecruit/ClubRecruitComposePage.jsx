import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clubRecruitApi } from '../../api/clubRecruit';
import Editor from '../../components/notices/Editor';
import { sanitizeRichHtml } from '../../security/htmlSanitizer';
import { UPLOAD_MAX_FILE_SIZE_BYTES, UPLOAD_MAX_FILE_SIZE_MB } from '../../config/env';
import '../page-shell.css';
import styles from './ClubRecruitComposePage.module.css';

const MAX_IMAGE_UPLOAD_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

export default function ClubRecruitComposePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    clubName: '',
    field: '',
    gradeGroup: 'lower',
    applyStart: '',
    applyEnd: '',
    extraNote: '',
    posterUrl: '',
    body: '',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Poster upload (sets posterUrl + preview)
  const handlePosterUpload = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      setError(`이미지는 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const res = await clubRecruitApi.upload(file);
      handleChange('posterUrl', res.url || URL.createObjectURL(file));
    } catch (err) {
      setError(err?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // Editor image upload (does not overwrite posterUrl)
  const handleEditorImageUpload = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드할 수 있습니다.');
    }
    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      throw new Error(`이미지는 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
    }
    return clubRecruitApi.upload(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clubName || !form.field || !form.applyStart || !form.extraNote) {
      setError('동아리 이름, 분야, 모집 시작일, 기타 사항은 필수입니다.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const safeBody = sanitizeRichHtml(form.body);
      await clubRecruitApi.create({
        clubName: form.clubName,
        field: form.field,
        gradeGroup: form.gradeGroup,
        applyPeriod: { start: form.applyStart, end: form.applyEnd || null },
        extraNote: form.extraNote,
        posterUrl: form.posterUrl,
        body: safeBody,
      });
      navigate('/community/club-recruit');
    } catch (err) {
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">동아리 모집</p>
          <h1>모집 글 작성</h1>
          <p className="lede">포스터와 핵심 정보를 입력해 주세요. 등록한 글은 관리자 승인 후 일반 사용자에게 공개됩니다.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>동아리 이름 *</span>
            <input
              value={form.clubName}
              onChange={(e) => handleChange('clubName', e.target.value)}
              placeholder="예) 코딩나무"
              required
            />
          </label>
          <label className={styles.field}>
            <span>학년 구분 *</span>
            <select value={form.gradeGroup} onChange={(e) => handleChange('gradeGroup', e.target.value)}>
              <option value="lower">1·2학년</option>
              <option value="upper">3학년</option>
            </select>
          </label>
        </div>

        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>동아리 활동 분야 *</span>
            <input
              value={form.field}
              onChange={(e) => handleChange('field', e.target.value)}
              placeholder="예) IT·개발, 밴드, 봉사"
              required
            />
          </label>
          <label className={styles.field}>
            <span>모집 기간 *</span>
            <div className={styles.period}>
              <input
                type="date"
                value={form.applyStart}
                onChange={(e) => handleChange('applyStart', e.target.value)}
                required
              />
              <span className={styles.divider}>~</span>
              <input
                type="date"
                value={form.applyEnd}
                onChange={(e) => handleChange('applyEnd', e.target.value)}
                placeholder="상시 모집이면 비워두세요"
              />
            </div>
          </label>
        </div>

        <label className={styles.field}>
          <span>기타 사항 *</span>
          <input
            value={form.extraNote}
            onChange={(e) => handleChange('extraNote', e.target.value)}
            placeholder="한 줄로 간단히 (예: 매주 목 17시, 면접 O)"
            maxLength={120}
            required
          />
        </label>

        <label className={styles.field}>
          <span>본문 (상세 안내)</span>
          <Editor
            value={form.body}
            onChange={(val) => handleChange('body', val)}
            placeholder="지원 방법, 활동 일정, 문의처 등을 자세히 작성하세요."
            onUploadImage={handleEditorImageUpload}
            uploading={uploading}
          />
        </label>

        <label className={styles.field}>
          <span>포스터 업로드</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handlePosterUpload(e.target.files?.[0])}
            disabled={uploading}
          />
          {form.posterUrl ? (
            <div className={styles.posterPreview}>
              <img src={form.posterUrl} alt="포스터 미리보기" />
            </div>
          ) : null}
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
