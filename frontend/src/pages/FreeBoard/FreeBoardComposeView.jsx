import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import Editor from '../../components/notices/Editor';
import styles from '../../components/freeboard/freeboard.module.css';
import { communityApi } from '../../api/community';
import '../page-shell.css';

const CATEGORIES = [
  { key: 'chat', label: '잡담' },
  { key: 'info', label: '정보' },
  { key: 'qna', label: 'QnA' },
];

export default function FreeBoardComposeView({ mode = 'create' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('chat');
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    communityApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setTitle(res.title || '');
        setCategory(res.category || 'chat');
        setBody(res.body || '');
      })
      .catch(() => {
        if (!cancelled) setError('게시글을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

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
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = { title, category, body };
      const res = isEdit ? await communityApi.update(id, payload) : await communityApi.create(payload);
      navigate(`/community/free/${res.id}`);
    } catch (err) {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('글을 삭제하시겠습니까?')) return;
    try {
      await communityApi.remove(id);
      navigate('/community/free');
    } catch (err) {
      setError('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">자유 게시판</p>
          <h1>{isEdit ? '글 수정' : '글 작성'}</h1>
          <p className="lede">이야기를 자유롭게 공유하세요.</p>
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
            placeholder="자유롭게 작성하세요. 이미지 버튼으로 사진을 첨부할 수 있습니다."
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
