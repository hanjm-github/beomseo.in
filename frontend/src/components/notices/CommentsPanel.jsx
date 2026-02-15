import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { noticesApi } from '../../api/notices';
import RoleName from '../RoleName/RoleName';
import styles from './notices.module.css';

export default function CommentsPanel({ noticeId, currentUser, isAuthenticated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await noticesApi.listComments(noticeId, { page: 1, pageSize: 50, order: 'asc' });
      setItems(res.items || []);
      setError('');
    } catch (err) {
      setError('댓글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      const res = await noticesApi.createComment(noticeId, body.trim());
      setItems((prev) => [...prev, res]);
      setBody('');
      setError('');
    } catch (err) {
      const message = err.response?.data?.error || '댓글 작성에 실패했습니다.';
      setError(message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await noticesApi.deleteComment(noticeId, commentId);
      setItems((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError('댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <div className={styles.commentsPanel}>
      <div className={styles.commentsHeader}>
        <div className={styles.commentsTitle}>
          <MessageSquare size={16} />
          댓글
        </div>
        <div className={styles.commentsMeta}>{items.length}개</div>
      </div>

      <div className={styles.commentForm}>
        {!isAuthenticated ? (
          <div className={styles.commentLocked}>로그인 후 댓글을 작성할 수 있습니다.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              className={styles.commentInput}
              placeholder="댓글을 입력하세요 (최대 1000자)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              disabled={posting}
              required
            />
            <div className={styles.commentFormActions}>
              <button type="submit" className={styles.btnPrimary} disabled={posting || !body.trim()}>
                {posting ? <Loader2 className={styles.spinner} size={16} /> : null}
                게시
              </button>
            </div>
          </form>
        )}
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>

      <div className={styles.commentList}>
        {loading ? (
          <div className={styles.commentPlaceholder}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className={styles.commentPlaceholder}>첫 댓글을 남겨보세요.</div>
        ) : (
          items.map((comment) => (
            <div key={comment.id} className={styles.commentItem}>
              <div className={styles.commentMeta}>
                <RoleName nickname={comment.author?.name || '익명'} role={comment.author?.role || 'student'} size="sm" />
                <span className={styles.metaDivider}>•</span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <div className={styles.commentBody}>{comment.body}</div>
              {currentUser?.role === 'admin' ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => handleDelete(comment.id)}
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
