/**
 * @file src/pages/NoticesPage/ComposeView.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - ../../components/notices/notices.module.css
 * - ../../components/notices/Editor
 * Side effects:
 * - Reads or writes localStorage for persisted client state.
 * - Influences client-side routing and navigation state.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import styles from '../../components/notices/notices.module.css';
import Editor from '../../components/notices/Editor';
import Attachments from '../../components/notices/Attachments';
import { noticesApi } from '../../api/notices';
import { sanitizeRichHtml, toPlainText } from '../../security/htmlSanitizer';
import { useAuth } from '../../context/AuthContext';
const TAG_SPLIT_REGEX = /[,\n;，]+/;

function safeGetLocalStorageItem(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode, quota exceeded, etc.).
  }
}

function safeRemoveLocalStorageItem(key) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function normalizeTags(raw) {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value ?? '').split(TAG_SPLIT_REGEX))
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return String(raw ?? '')
    .split(TAG_SPLIT_REGEX)
    .map((value) => value.trim())
    .filter(Boolean);
}

const initialState = {
  title: '',
  body: '',
  pinned: false,
  important: false,
  examRelated: false,
  tags: [],
  attachments: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.payload };
    case 'ADD_ATTACHMENT':
      return { ...state, attachments: [...state.attachments, action.payload] };
    case 'REMOVE_ATTACHMENT':
      return { ...state, attachments: state.attachments.filter((f) => f.id !== action.id) };
    default:
      return state;
  }
}

/**
 * ComposeView module entry point.
 */
export default function ComposeView({ mode = 'create' }) {
  const { category = 'school', id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const canManageNotices = ['admin', 'student_council'].includes(user?.role);

  const [state, dispatch] = useReducer(reducer, initialState);
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [checkingEditPermission, setCheckingEditPermission] = useState(mode === 'edit');
  const [hasEditPermission, setHasEditPermission] = useState(mode !== 'edit');

  useEffect(() => {
    if (authLoading || !canManageNotices) return;
    if (mode !== 'edit' || !id) {
      setCheckingEditPermission(false);
      setHasEditPermission(true);
      return;
    }

    let cancelled = false;
    setCheckingEditPermission(true);
    setHasEditPermission(false);
    setError('');

    noticesApi
      .get(id)
      .then((data) => {
        if (cancelled) return;
        // Edit mode permission is revalidated against server-owned author data
        // to prevent stale client role state from unlocking unauthorized edits.
        const isAdmin = user?.role === 'admin';
        const isCouncilAuthor =
          user?.role === 'student_council' &&
          user?.id != null &&
          data?.author?.id != null &&
          Number(user.id) === Number(data.author.id);
        if (!isAdmin && !isCouncilAuthor) {
          setHasEditPermission(false);
          setError('공지 수정 권한이 없습니다.');
          setCheckingEditPermission(false);
          return;
        }

        setHasEditPermission(true);
        dispatch({
          type: 'SET',
          payload: {
            title: data.title,
            body: data.body,
            pinned: data.pinned,
            important: data.important,
            examRelated: data.examRelated,
            tags: data.tags || [],
            attachments: data.attachments || [],
          },
        });
        setTagsInput((data.tags || []).join(', '));
        setCheckingEditPermission(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasEditPermission(false);
        setCheckingEditPermission(false);
        setError('공지 정보를 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageNotices, mode, id, user?.id, user?.role]);

  const draftKey = useMemo(
    () => `draft-${category}-${user?.id || 'guest'}-${mode === 'edit' ? id : 'new'}`,
    [category, user?.id, mode, id]
  );

  useEffect(() => {
    const saved = safeGetLocalStorageItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const normalizedTags = normalizeTags(parsed.tags);
        dispatch({
          type: 'SET',
          payload: {
            ...parsed,
            tags: normalizedTags,
          },
        });
        setTagsInput(normalizedTags.join(', '));
      } catch {
        /* ignore */
      }
    }
  }, [draftKey]);

  useEffect(() => {
    // Persist full draft state so route changes or refreshes do not destroy in-progress notice writing.
    const payload = { ...state, attachments: state.attachments };
    safeSetLocalStorageItem(draftKey, JSON.stringify(payload));
  }, [state, draftKey]);

  const handleFileChange = async (files) => {
    setError('');
    const list = Array.from(files || []);
    if (!list.length) return;
    if (state.attachments.length + list.length > noticesApi.MAX_ATTACHMENTS) {
      setError(`첨부는 최대 ${noticesApi.MAX_ATTACHMENTS}개까지 가능합니다.`);
      return;
    }
    for (const file of list) {
      if (file.size > noticesApi.MAX_FILE_SIZE) {
        const maxFileSizeMb = Math.floor(noticesApi.MAX_FILE_SIZE / (1024 * 1024));
        setError(`첨부 용량은 ${maxFileSizeMb}MB 이하만 가능합니다.`);
        return;
      }
    }
    let uploadedCount = 0;
    let failedCount = 0;
    for (const file of list) {
      try {
        const uploaded = await noticesApi.upload(file);
        dispatch({ type: 'ADD_ATTACHMENT', payload: uploaded });
        uploadedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    if (failedCount > 0) {
      setError(
        uploadedCount > 0
          ? `일부 첨부 업로드에 실패했습니다. (${uploadedCount}개 성공, ${failedCount}개 실패)`
          : '첨부 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.'
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (uploadingImage) {
      setError('이미지 업로드가 끝난 뒤에 저장할 수 있습니다.');
      return;
    }
    if (mode === 'edit' && !hasEditPermission) {
      setError('공지 수정 권한이 없습니다.');
      return;
    }
    const sanitizedBody = sanitizeRichHtml(state.body);
    if (!state.title.trim() || !toPlainText(sanitizedBody)) {
      setError('제목과 본문을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    const normalizedTags = normalizeTags(tagsInput);
    const payload = {
      ...state,
      body: sanitizedBody,
      category,
      tags: normalizedTags,
      // Generate a deterministic fallback summary so list cards remain populated
      // even when the backend does not return an explicit summary field.
      summary: state.summary || toPlainText(sanitizedBody).slice(0, 120),
    };
    try {
      const res =
        mode === 'edit' && id ? await noticesApi.update(id, payload) : await noticesApi.create(payload);
      safeRemoveLocalStorageItem(draftKey);
      navigate(`/notices/${category}/${res.id}`, { replace: true });
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="card surface">
        <div className="placeholder">권한 정보를 확인하는 중입니다.</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="card surface">
        <p className="eyebrow">공지 작성 권한</p>
        <h2>로그인이 필요합니다.</h2>
        <p className="muted">공지 작성 및 수정은 로그인한 사용자만 가능합니다.</p>
        <div className="u-action-stack" style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to={`/notices/${category}`}>
            목록으로
          </Link>
          <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>
            로그인
          </Link>
        </div>
      </div>
    );
  }

  if (!canManageNotices) {
    return (
      <div className="card surface">
        <p className="eyebrow">공지 작성 권한</p>
        <h2>권한이 없습니다.</h2>
        <p className="muted">공지 작성 및 수정은 학생회 또는 관리자 계정만 가능합니다.</p>
        <div className="u-action-stack" style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to={`/notices/${category}`}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && checkingEditPermission) {
    return (
      <div className="card surface">
        <div className="placeholder">수정 권한을 확인하는 중입니다.</div>
      </div>
    );
  }

  if (mode === 'edit' && !hasEditPermission) {
    return (
      <div className="card surface">
        <p className="eyebrow">공지 수정 권한</p>
        <h2>권한이 없습니다.</h2>
        <p className="muted">{error || '해당 공지는 작성자 또는 관리자만 수정할 수 있습니다.'}</p>
        <div className="u-action-stack" style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to={`/notices/${category}/${id}`}>
            상세로
          </Link>
          <Link className="btn btn-secondary" to={`/notices/${category}`}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card surface">
      <div className={styles.listHeader}>
        <div className={styles.listHeaderLeft}>
          <p className="eyebrow">{mode === 'edit' ? '공지 수정' : '새 공지 작성'}</p>
          <h2>{category === 'school' ? '학교 공지' : '학생회 공지'}</h2>
        </div>
        <Link to={`/notices/${category}`} className={styles.btnGhost}>
          목록으로
        </Link>
      </div>

      <form className={styles.composeShell} onSubmit={handleSubmit}>
        <div>
          <div className={styles.formGroup}>
            <label htmlFor="title">제목</label>
            <input
              id="title"
              className={styles.input}
              value={state.title}
              onChange={(e) => dispatch({ type: 'SET', payload: { title: e.target.value } })}
              placeholder="제목을 입력하세요"
            />
          </div>

          <div className={styles.formGroup}>
            <label>본문</label>
            <Editor
              value={state.body}
              onChange={(val) => dispatch({ type: 'SET', payload: { body: val } })}
              placeholder="내용을 입력하세요"
              onUploadImage={async (file) => {
                setUploadingImage(true);
                try {
                  const uploaded = await noticesApi.upload(file);
                  return uploaded;
                } finally {
                  setUploadingImage(false);
                }
              }}
              uploading={uploadingImage}
            />
          </div>
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.sidebarCard}>
            <h4 className={styles.sidebarTitle}>속성</h4>
            <label className={styles.inlineCheckbox}>
              <input
                type="checkbox"
                checked={state.pinned}
                onChange={(e) => dispatch({ type: 'SET', payload: { pinned: e.target.checked } })}
              />
              상단 고정
            </label>
            <label className={styles.inlineCheckbox}>
              <input
                type="checkbox"
                checked={state.important}
                onChange={(e) => dispatch({ type: 'SET', payload: { important: e.target.checked } })}
              />
              중요 표시
            </label>
            <label className={styles.inlineCheckbox}>
              <input
                type="checkbox"
                checked={state.examRelated}
                onChange={(e) => dispatch({ type: 'SET', payload: { examRelated: e.target.checked } })}
              />
              시험 관련
            </label>
          </div>

          <div className={styles.sidebarCard}>
            <h4 className={styles.sidebarTitle}>태그</h4>
            <input
              className={styles.input}
              value={tagsInput}
              onChange={(e) => {
                const next = e.target.value;
                setTagsInput(next);
                dispatch({
                  type: 'SET',
                  payload: {
                    tags: normalizeTags(next),
                  },
                });
              }}
              placeholder="쉼표로 구분 (예: 시험, 일정)"
            />
          </div>

          <div className={styles.sidebarCard}>
            <h4 className={styles.sidebarTitle}>첨부파일</h4>
            <input
              type="file"
              multiple
              onChange={(e) => handleFileChange(e.target.files)}
              className={styles.input}
            />
            <Attachments
              items={state.attachments}
              onRemove={(id) => dispatch({ type: 'REMOVE_ATTACHMENT', id })}
              compact
            />
            <p className={styles.metaMuted}>
              최대 {noticesApi.MAX_ATTACHMENTS}개, {Math.floor(noticesApi.MAX_FILE_SIZE / (1024 * 1024))}MB/개
            </p>
          </div>
        </div>
      </form>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => navigate(-1)}
          disabled={submitting}
        >
          취소
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleSubmit}
          disabled={submitting || uploadingImage}
        >
          {uploadingImage ? '이미지 업로드 중...' : submitting ? '저장 중...' : mode === 'edit' ? '수정 완료' : '작성 완료'}
        </button>
      </div>
    </div>
  );
}


