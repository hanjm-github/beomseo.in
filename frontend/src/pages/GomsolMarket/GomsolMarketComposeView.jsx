/**
 * @file src/pages/GomsolMarket/GomsolMarketComposeView.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../api/gomsolMarket
 * Side effects:
 * - Influences client-side routing and navigation state.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { gomsolMarketApi } from '../../api/gomsolMarket';
import { toSafeOpenChatHref } from '../../security/urlPolicy';
import { useAuth } from '../../context/AuthContext';
import styles from '../../components/gomsolmarket/gomsolmarket.module.css';
import '../page-shell.css';

/**
 * GomsolMarketComposeView module entry point.
 */
export default function GomsolMarketComposeView() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const canWrite = gomsolMarketApi.canWrite(user);
  const isAdmin = gomsolMarketApi.canManageApproval(user);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('etc');
  const [status, setStatus] = useState('selling');
  const [studentId, setStudentId] = useState('');
  const [openChatUrl, setOpenChatUrl] = useState('');
  const [extraContact, setExtraContact] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || uploading) return;

    const remaining = gomsolMarketApi.MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`이미지는 최대 ${gomsolMarketApi.MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }

    const queue = files.slice(0, remaining);
    for (const file of queue) {
      if (!file.type?.startsWith('image/')) {
        setError('이미지 파일만 업로드할 수 있습니다.');
        event.target.value = '';
        return;
      }
      if (file.size > gomsolMarketApi.MAX_FILE_SIZE) {
        const maxFileSizeMb = Math.floor(gomsolMarketApi.MAX_FILE_SIZE / (1024 * 1024));
        setError(`이미지는 ${maxFileSizeMb}MB 이하만 업로드할 수 있습니다.`);
        event.target.value = '';
        return;
      }
    }

    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of queue) {
        const res = await gomsolMarketApi.upload(file);
        uploaded.push({
          id: res.id || `upload-${Date.now()}`,
          url: res.url,
          name: res.name || file.name,
          size: res.size,
          mime: res.mime || file.type,
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
    if (price === '') return '가격을 입력해주세요.';
    const numericPrice = Number(price);
    if (!Number.isInteger(numericPrice) || numericPrice < 0) {
      return '가격은 0 이상의 정수여야 합니다.';
    }
    if (images.length < 1) return '상품 이미지는 최소 1장 필요합니다.';
    if (images.length > gomsolMarketApi.MAX_IMAGES) {
      return `상품 이미지는 최대 ${gomsolMarketApi.MAX_IMAGES}장까지 등록할 수 있습니다.`;
    }
    if (!studentId.trim() && !openChatUrl.trim() && !extraContact.trim()) {
      return '학번, 오픈채팅, 기타 연락 방법 중 최소 1개를 입력해주세요.';
    }
    if (openChatUrl.trim() && !toSafeOpenChatHref(openChatUrl.trim())) {
      return '오픈채팅 링크는 open.kakao.com 형식의 안전한 URL만 사용할 수 있습니다.';
    }
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
      const safeOpenChatUrl = openChatUrl.trim() ? toSafeOpenChatHref(openChatUrl.trim()) : '';
      const created = await gomsolMarketApi.create({
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        status,
        images,
        contact: {
          studentId: studentId.trim(),
          openChatUrl: safeOpenChatUrl || '',
          extra: extraContact.trim(),
        },
        author: {
          id: user?.id ?? 'me',
          name: user?.nickname ?? '익명',
          role: user?.role ?? 'student',
        },
      });

      if (isAdmin) {
        navigate(`/community/gomsol-market/${created.id}`, { replace: true });
      } else {
        navigate('/community/gomsol-market?submitted=pending', { replace: true });
      }
    } catch {
      setError('상품 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>권한 정보를 확인하는 중입니다.</div>
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="page-shell">
        <div className={styles.permissionCard}>
          <p className="eyebrow">곰솔마켓 등록 권한</p>
          <h1>로그인이 필요합니다.</h1>
          <p className="lede">곰솔마켓 글 작성은 로그인한 사용자만 가능합니다.</p>
          <div className={styles.permissionActions}>
            <Link className="btn btn-secondary" to="/community/gomsol-market">
              목록으로
            </Link>
            {!isAuthenticated ? (
              <Link className="btn btn-primary" to="/login" state={{ from: '/community/gomsol-market/new' }}>
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
          <p className="eyebrow">곰솔마켓</p>
          <h1>상품 등록</h1>
          <p className="lede">등록한 글은 관리자 승인 후 일반 사용자에게 공개됩니다.</p>
        </div>
      </div>

      <form className={styles.composeCard} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="gm-title">제목 *</label>
          <input
            id="gm-title"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 상태 좋은 그래픽 계산기"
            maxLength={120}
            required
          />
        </div>

        <div className={styles.inlineGrid}>
          <div className={styles.field}>
            <label htmlFor="gm-price">가격 (원) *</label>
            <input
              id="gm-price"
              className={styles.numberField}
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="gm-category">카테고리 *</label>
            <select
              id="gm-category"
              className={styles.selectField}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {Object.entries(gomsolMarketApi.categoryLabel).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="gm-status">판매 상태 *</label>
          <select
            id="gm-status"
            className={styles.selectField}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="selling">판매 중</option>
            <option value="sold">판매 완료</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="gm-description">설명 *</label>
          <textarea
            id="gm-description"
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="상품 상태, 구성품, 거래 희망 시간을 입력해주세요."
            maxLength={2000}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="gm-images">상품 이미지 * (최소 1장, 최대 {gomsolMarketApi.MAX_IMAGES}장)</label>
          <div className={styles.uploadBox}>
            <input
              id="gm-images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              disabled={uploading || images.length >= gomsolMarketApi.MAX_IMAGES}
            />
            <p className={styles.uploadHint}>
              목록 썸네일로 노출됩니다. 대표 이미지를 포함해 등록해주세요.
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

        <div className={styles.field}>
          <label htmlFor="gm-student-id">학번 (연락 방법 중 1개 이상 필수)</label>
          <input
            id="gm-student-id"
            className={styles.input}
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="예: 23015"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="gm-openchat">오픈채팅 링크</label>
          <input
            id="gm-openchat"
            className={styles.input}
            value={openChatUrl}
            onChange={(event) => setOpenChatUrl(event.target.value)}
            placeholder="https://open.kakao.com/..."
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="gm-extra-contact">기타 연락 방법</label>
          <input
            id="gm-extra-contact"
            className={styles.input}
            value={extraContact}
            onChange={(event) => setExtraContact(event.target.value)}
            placeholder="예: 점심시간 2학년 복도에서 직거래 가능"
          />
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


