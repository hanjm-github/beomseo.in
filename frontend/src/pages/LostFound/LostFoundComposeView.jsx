import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { lostFoundApi } from '../../api/lostFound';
import { useAuth } from '../../context/AuthContext';
import styles from '../../components/lostfound/lostfound.module.css';
import '../page-shell.css';

export default function LostFoundComposeView() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const canWrite = lostFoundApi.canWrite(user);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('searching');
  const [category, setCategory] = useState('electronics');
  const [foundAt, setFoundAt] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || uploading) return;

    const remaining = lostFoundApi.MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`이미지는 최대 ${lostFoundApi.MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }

    const queue = files.slice(0, remaining);
    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of queue) {
        const res = await lostFoundApi.upload(file);
        uploaded.push({
          id: res.id || `upload-${Date.now()}`,
          url: res.url,
          name: res.name || file.name,
        });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (caughtError) {
      setError(caughtError?.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveImage = (id) => {
    setImages((prev) => prev.filter((image) => String(image.id) !== String(id)));
  };

  const validate = () => {
    if (!title.trim()) return '제목을 입력해주세요.';
    if (!description.trim()) return '설명을 입력해주세요.';
    if (!foundAt) return '습득일시를 입력해주세요.';
    if (!foundLocation.trim()) return '습득장소를 입력해주세요.';
    if (!storageLocation.trim()) return '보관장소를 입력해주세요.';
    if (!images.length) return '최소 1장의 분실물 사진이 필요합니다.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || uploading) return;

    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const created = await lostFoundApi.create({
        title: title.trim(),
        description: description.trim(),
        status,
        category,
        foundAt: new Date(foundAt).toISOString(),
        foundLocation: foundLocation.trim(),
        storageLocation: storageLocation.trim(),
        images,
        author: {
          id: user?.id ?? 'me',
          name: user?.nickname ?? '운영진',
          role: user?.role ?? 'student_council',
        },
      });
      navigate(`/community/lost-found/${created.id}`, { replace: true });
    } catch {
      setError('분실물 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="page-shell">
        <div className={styles.permissionCard}>
          <p className="eyebrow">분실물 센터 등록 권한</p>
          <h1>등록 권한이 없습니다.</h1>
          <p className="lede">분실물 등록은 관리자 또는 학생회 계정으로만 가능합니다.</p>
          <div className={styles.permissionActions}>
            <Link className="btn btn-secondary" to="/community/lost-found">
              목록으로
            </Link>
            {!isAuthenticated ? (
              <Link className="btn btn-primary" to="/login" state={{ from: '/community/lost-found/new' }}>
                로그인
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">분실물 센터</p>
          <h1>분실물 등록</h1>
          <p className="lede">사진과 습득/보관 정보를 정확히 입력해주세요.</p>
        </div>
      </div>

      <form className={styles.composeCard} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="lf-title">제목 *</label>
          <input
            id="lf-title"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 검은색 무선 이어폰 케이스"
            maxLength={120}
            required
          />
        </div>

        <div className={styles.inlineGrid}>
          <div className={styles.field}>
            <label htmlFor="lf-status">상태 *</label>
            <select
              id="lf-status"
              className={styles.selectField}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="searching">주인 찾는 중</option>
              <option value="found">주인 찾음</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="lf-category">카테고리 *</label>
            <select
              id="lf-category"
              className={styles.selectField}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {Object.entries(lostFoundApi.categoryLabel).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.inlineGrid}>
          <div className={styles.field}>
            <label htmlFor="lf-found-at">습득일시 *</label>
            <input
              id="lf-found-at"
              className={styles.datetimeField}
              type="datetime-local"
              value={foundAt}
              onChange={(event) => setFoundAt(event.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="lf-found-location">습득장소 *</label>
            <input
              id="lf-found-location"
              className={styles.input}
              value={foundLocation}
              onChange={(event) => setFoundLocation(event.target.value)}
              placeholder="예: 본관 2층 복도"
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="lf-storage-location">보관장소 *</label>
          <input
            id="lf-storage-location"
            className={styles.input}
            value={storageLocation}
            onChange={(event) => setStorageLocation(event.target.value)}
            placeholder="예: 학생회실 분실물 보관함 A"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="lf-description">설명 *</label>
          <textarea
            id="lf-description"
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="특징, 발견 상황, 인수 절차 등을 입력하세요."
            maxLength={2000}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="lf-images">사진 업로드 * (최대 {lostFoundApi.MAX_IMAGES}장)</label>
          <div className={styles.uploadBox}>
            <input
              id="lf-images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              disabled={uploading || images.length >= lostFoundApi.MAX_IMAGES}
            />
            <p className={styles.uploadHint}>
              목록에서 바로 보이는 사진입니다. 물품이 잘 보이게 촬영해주세요.
            </p>
          </div>
          {images.length ? (
            <div className={styles.previewGrid}>
              {images.map((image) => (
                <div className={styles.previewItem} key={image.id}>
                  <img src={image.url} alt={`${image.name} 미리보기`} />
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => handleRemoveImage(image.id)}
                    aria-label="이미지 제거"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.formActions}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
            {submitting ? <Loader2 size={16} className={styles.spinner} /> : null}
            {submitting ? '등록 중...' : '등록 완료'}
          </button>
        </div>
      </form>
    </div>
  );
}
