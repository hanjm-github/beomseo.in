import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import styles from '../../components/notices/notices.module.css';
import Editor from '../../components/notices/Editor';
import Attachments from '../../components/notices/Attachments';
import { noticesApi } from '../../api/notices';
import { useAuth } from '../../context/AuthContext';

const VALID_CATEGORIES = ['school', 'council'];

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

export default function ComposeView({ mode = 'create' }) {
  const { category = 'school', id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const canEdit = ['admin', 'council', 'student_council'].includes(user?.role);

  const [state, dispatch] = useReducer(reducer, initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!VALID_CATEGORIES.includes(category)) {
      navigate('/notices/school', { replace: true });
    }
  }, [category, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!canEdit) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [canEdit, authLoading, navigate, location]);

  useEffect(() => {
    if (mode === 'edit' && id) {
      noticesApi
        .get(id)
        .then((data) => {
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
        })
        .catch(() => {
          setError('공지 정보를 불러오지 못했습니다.');
        });
    }
  }, [mode, id]);

  const draftKey = useMemo(
    () => `draft-${category}-${user?.id || 'guest'}-${mode === 'edit' ? id : 'new'}`,
    [category, user?.id, mode, id]
  );

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'SET', payload: parsed });
      } catch (e) {
        /* ignore */
      }
    }
  }, [draftKey]);

  useEffect(() => {
    const payload = { ...state, attachments: state.attachments };
    localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [state, draftKey]);

  const handleFileChange = async (files) => {
    setError('');
    const list = Array.from(files);
    if (state.attachments.length + list.length > noticesApi.MAX_ATTACHMENTS) {
      setError('첨부는 최대 5개까지 가능합니다.');
      return;
    }
    for (const file of list) {
      if (file.size > noticesApi.MAX_FILE_SIZE) {
        setError('첨부 용량은 10MB 이하만 가능합니다.');
        return;
      }
    }
    for (const file of list) {
      const uploaded = await noticesApi.upload(file);
      dispatch({ type: 'ADD_ATTACHMENT', payload: uploaded });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!state.title.trim() || !state.body.trim()) {
      setError('제목과 본문을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    const payload = {
      ...state,
      category,
      summary: state.summary || state.body.replace(/<[^>]+>/g, '').slice(0, 120),
    };
    try {
      const res =
        mode === 'edit' && id ? await noticesApi.update(id, payload) : await noticesApi.create(payload);
      localStorage.removeItem(draftKey);
      navigate(`/notices/${category}/${res.id}`, { replace: true });
    } catch (err) {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const tagString = state.tags.join(', ');

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
              value={tagString}
              onChange={(e) =>
                dispatch({
                  type: 'SET',
                  payload: {
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                })
              }
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
            <p className={styles.metaMuted}>최대 5개, 10MB/개</p>
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
        <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
          {submitting ? '저장 중...' : mode === 'edit' ? '수정 완료' : '작성 완료'}
        </button>
      </div>
    </div>
  );
}
