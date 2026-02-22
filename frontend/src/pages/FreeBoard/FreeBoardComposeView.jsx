import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import Editor from '../../components/notices/Editor';
import styles from '../../components/freeboard/freeboard.module.css';
import { communityApi } from '../../api/community';
import { sanitizeRichHtml, toPlainText } from '../../security/htmlSanitizer';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';

const CATEGORIES = [
  { key: 'chat', label: '잡담' },
  { key: 'info', label: '정보' },
  { key: 'qna', label: 'QnA' },
];

export default function FreeBoardComposeView({ mode = 'create' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = mode === 'edit';
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('chat');
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editAccessChecked, setEditAccessChecked] = useState(!isEdit);
  const [hasEditAccess, setHasEditAccess] = useState(!isEdit);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!isEdit || !id) return;
    let cancelled = false;
    setEditAccessChecked(false);
    setHasEditAccess(false);
    setError('');
    communityApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        const isAdmin = user?.role === 'admin';
        const isOwner =
          user?.id != null &&
          res?.author?.id != null &&
          Number(user.id) === Number(res.author.id);
        if (!isAdmin && !isOwner) {
          setHasEditAccess(false);
          setEditAccessChecked(true);
          setError('수정 권한이 없습니다.');
          return;
        }
        setHasEditAccess(true);
        setTitle(res.title || '');
        setCategory(res.category || 'chat');
        setBody(res.body || '');
        setEditAccessChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHasEditAccess(false);
          setEditAccessChecked(true);
          setError('게시글을 불러오지 못했습니다.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isEdit, id, user?.id, user?.role]);

  const handleUploadImage = async (file) => {
    setUploading(true);
    try {
      const res = await communityApi.upload(file);
      return res;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEdit && !hasEditAccess) return;
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const safeBody = sanitizeRichHtml(body);
      if (!toPlainText(safeBody)) {
        setError('본문을 입력해주세요.');
        setSubmitting(false);
        return;
      }
      const payload = { title, category, body: safeBody };
      const res = isEdit ? await communityApi.update(id, payload) : await communityApi.create(payload);
      navigate(`/community/free/${res.id}`);
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isEdit && !hasEditAccess) return;
    if (!window.confirm('글을 삭제하시겠습니까?')) return;
    try {
      await communityApi.remove(id);
      navigate('/community/free');
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  if (authLoading) {
    return (
      <div className="page-shell">
        <div className="placeholder">권한 정보를 확인하는 중입니다.</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className="card">
          <p className="eyebrow">자유 게시판 작성 권한</p>
          <h1>로그인이 필요합니다.</h1>
          <p className="lede">자유 게시판 글 작성 및 수정은 로그인한 사용자만 가능합니다.</p>
          <div className="u-action-stack">
            <Link className="btn btn-secondary" to="/community/free">
              목록으로
            </Link>
            <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && !editAccessChecked) {
    return (
      <div className="page-shell">
        <div className="placeholder">수정 권한을 확인하는 중입니다.</div>
      </div>
    );
  }

  if (isEdit && !hasEditAccess) {
    return (
      <div className="page-shell">
        <div className="card">
          <p className="eyebrow">자유 게시판 수정 권한</p>
          <h1>권한이 없습니다.</h1>
          <p className="lede">{error || '해당 게시글은 작성자 또는 관리자만 수정할 수 있습니다.'}</p>
          <div className="u-action-stack">
            <Link className="btn btn-secondary" to={`/community/free/${id}`}>
              상세로
            </Link>
            <Link className="btn btn-secondary" to="/community/free">
              목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">자유 게시판</p>
          <h1>{isEdit ? '글 수정' : '글 작성'}</h1>
          <p className="lede">이야기를 자유롭게 공유하세요. 등록한 글은 관리자 승인 후 일반 사용자에게 공개됩니다.</p>
        </div>
      </div>

      <form className={styles.composeShell} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="title">제목</label>
          <input
            id="title"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="category">카테고리</label>
          <select
            id="category"
            className={styles.selectField}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>내용</label>
          <Editor
            value={body}
            onChange={setBody}
            placeholder="자유롭게 작성하세요. 이미지 버튼으로 사진을 첨부할 수 있습니다. 모든 글은 학생회 승인 후에 게시됩니다. 모든 작성자는 본인이 작성한 의견에 대해 법적 책임을 갖는다는 점 유의하시기 바랍니다."
            onUploadImage={handleUploadImage}
            uploading={uploading}
          />
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.formActions}>
          {isEdit ? (
            <button type="button" className={`${styles.btnGhost} ${styles.danger}`} onClick={handleDelete}>
              <Trash2 size={14} />
              삭제
            </button>
          ) : null}
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? <Loader2 size={16} className={styles.spinner} /> : null}
            {isEdit ? '수정 완료' : '작성 완료'}
          </button>
        </div>
      </form>
    </div>
  );
}
