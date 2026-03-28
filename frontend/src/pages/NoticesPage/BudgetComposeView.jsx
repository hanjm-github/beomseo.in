/**
 * @file src/pages/NoticesPage/BudgetComposeView.jsx
 * @description Create/edit page for budget disclosure notices.
 * Responsibilities:
 * - Reuse the notice editor flow while binding posts to a cycle year and month.
 * - Preserve budget list/detail navigation context during save and cancel flows.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - ../../components/notices/Editor
 * - ../../components/notices/Attachments
 * Side effects:
 * - Reads or writes localStorage for persisted client state.
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns budget notice compose/edit interactions.
 */
import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import styles from '../../components/notices/notices.module.css';
import Editor from '../../components/notices/Editor';
import Attachments from '../../components/notices/Attachments';
import { noticesApi } from '../../api/notices';
import { sanitizeRichHtml, toPlainText } from '../../security/htmlSanitizer';
import { useAuth } from '../../context/AuthContext';
import { buildBudgetListPath, formatBudgetPeriodLabel } from './budgetUtils';

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

const initialState = {
  title: '',
  body: '',
  attachments: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.payload };
    case 'ADD_ATTACHMENT':
      return { ...state, attachments: [...state.attachments, action.payload] };
    case 'REMOVE_ATTACHMENT':
      return { ...state, attachments: state.attachments.filter((file) => file.id !== action.id) };
    default:
      return state;
  }
}

function getApiErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.errors?.[0] || error?.response?.data?.error || fallbackMessage;
}

/**
 * BudgetComposeView module entry point.
 */
export default function BudgetComposeView({ mode = 'create' }) {
  const { budgetYear, budgetMonth, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const canManageNotices = ['admin', 'student_council'].includes(user?.role);
  const listPath = buildBudgetListPath(budgetYear, budgetMonth);

  const [state, dispatch] = useReducer(reducer, initialState);
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
        if (data?.category !== 'budget') {
          // Guard against deep links that reuse a numeric id from another
          // notice board path but should never be editable as a budget post.
          setHasEditPermission(false);
          setError('예산 공개 글로 연결되지 않는 게시물입니다.');
          setCheckingEditPermission(false);
          return;
        }

        const isAdmin = user?.role === 'admin';
        const isCouncilAuthor =
          user?.role === 'student_council' &&
          user?.id != null &&
          data?.author?.id != null &&
          Number(user.id) === Number(data.author.id);
        if (!isAdmin && !isCouncilAuthor) {
          setHasEditPermission(false);
          setError('예산 공개 글 수정 권한이 없습니다.');
          setCheckingEditPermission(false);
          return;
        }

        setHasEditPermission(true);
        dispatch({
          type: 'SET',
          payload: {
            title: data.title,
            body: data.body,
            attachments: data.attachments || [],
          },
        });
        setCheckingEditPermission(false);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setHasEditPermission(false);
        setCheckingEditPermission(false);
        setError(getApiErrorMessage(requestError, '예산 공개 글 정보를 불러오지 못했습니다.'));
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, canManageNotices, mode, id, user?.id, user?.role]);

  const draftKey = useMemo(
    () =>
      // Scope drafts by cycle, user, and mode so composing March data never
      // overwrites an April draft or an edit session for another post.
      `draft-budget-${budgetYear}-${budgetMonth}-${user?.id || 'guest'}-${
        mode === 'edit' ? id : 'new'
      }`,
    [budgetMonth, budgetYear, user?.id, mode, id]
  );

  useEffect(() => {
    const saved = safeGetLocalStorageItem(draftKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      dispatch({
        type: 'SET',
        payload: {
          title: parsed.title || '',
          body: parsed.body || '',
          attachments: parsed.attachments || [],
        },
      });
    } catch {
      // Ignore malformed drafts.
    }
  }, [draftKey]);

  useEffect(() => {
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (uploadingImage) {
      setError('이미지 업로드가 끝난 뒤에 저장할 수 있습니다.');
      return;
    }
    if (mode === 'edit' && !hasEditPermission) {
      setError('예산 공개 글 수정 권한이 없습니다.');
      return;
    }
    const sanitizedBody = sanitizeRichHtml(state.body);
    if (!state.title.trim() || !toPlainText(sanitizedBody)) {
      setError('제목과 본문을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    const payload = {
      title: state.title,
      body: sanitizedBody,
      // The route determines the target accounting period, so keep the payload
      // pinned to the URL instead of trusting mutable editor state.
      category: 'budget',
      budgetYear: String(budgetYear),
      budgetMonth: String(budgetMonth).padStart(2, '0'),
      attachments: state.attachments,
      summary: toPlainText(sanitizedBody).slice(0, 120),
    };

    try {
      const res =
        mode === 'edit' && id
          ? await noticesApi.update(id, payload)
          : await noticesApi.create(payload);
      const targetBudgetYear = res?.budgetYear != null ? String(res.budgetYear) : payload.budgetYear;
      const targetBudgetMonth = res?.budgetMonth
        ? String(res.budgetMonth).padStart(2, '0')
        : payload.budgetMonth;
      safeRemoveLocalStorageItem(draftKey);
      navigate(`${buildBudgetListPath(targetBudgetYear, targetBudgetMonth)}/${res.id}`, {
        replace: true,
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '저장에 실패했습니다. 잠시 후 다시 시도해주세요.'));
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
        <p className="eyebrow">예산 공개 작성 권한</p>
        <h2>로그인이 필요합니다.</h2>
        <p className="muted">예산 공개 글 작성 및 수정은 로그인한 사용자만 가능합니다.</p>
        <div className="u-action-stack" style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to={listPath}>
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
        <p className="eyebrow">예산 공개 작성 권한</p>
        <h2>권한이 없습니다.</h2>
        <p className="muted">예산 공개 글 작성 및 수정은 학생회 또는 관리자 계정만 가능합니다.</p>
        <div className="u-action-stack" style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to={listPath}>
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
        <p className="eyebrow">예산 공개 수정 권한</p>
        <h2>권한이 없습니다.</h2>
        <p className="muted">{error || '해당 글은 작성자 또는 관리자만 수정할 수 있습니다.'}</p>
        <div className="u-action-stack" style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to={`${listPath}/${id}`}>
            상세로
          </Link>
          <Link className="btn btn-secondary" to={listPath}>
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
          <p className="eyebrow">{mode === 'edit' ? '예산 공개 수정' : '예산 공개 작성'}</p>
          <h2>{formatBudgetPeriodLabel(budgetYear, budgetMonth)}</h2>
        </div>
        <Link to={listPath} className={styles.btnGhost}>
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
              onChange={(event) => dispatch({ type: 'SET', payload: { title: event.target.value } })}
              placeholder="제목을 입력하세요"
            />
          </div>

          <div className={styles.formGroup}>
            <label>본문</label>
            <Editor
              value={state.body}
              onChange={(nextValue) => dispatch({ type: 'SET', payload: { body: nextValue } })}
              placeholder="이달 예산 공개 내용을 입력하세요"
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
            <h4 className={styles.sidebarTitle}>기준 범위</h4>
            <div className={styles.pillRow}>
              <span className={styles.pill}>예산 공개</span>
              <span className={styles.pill}>{formatBudgetPeriodLabel(budgetYear, budgetMonth)}</span>
            </div>
          </div>

          <div className={styles.sidebarCard}>
            <h4 className={styles.sidebarTitle}>첨부파일</h4>
            <input
              type="file"
              multiple
              onChange={(event) => handleFileChange(event.target.files)}
              className={styles.input}
            />
            <Attachments
              items={state.attachments}
              onRemove={(attachmentId) => dispatch({ type: 'REMOVE_ATTACHMENT', id: attachmentId })}
              compact
            />
            <p className={styles.metaMuted}>
              최대 {noticesApi.MAX_ATTACHMENTS}개,{' '}
              {Math.floor(noticesApi.MAX_FILE_SIZE / (1024 * 1024))}MB/개
            </p>
          </div>
        </div>
      </form>

      {error ? <p className={styles.errorText}>{error}</p> : null}

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
          {uploadingImage
            ? '이미지 업로드 중...'
            : submitting
              ? '저장 중...'
              : mode === 'edit'
                ? '수정 완료'
                : '작성 완료'}
        </button>
      </div>
    </div>
  );
}
