/**
 * @file src/components/Community/ValuePick/ValuePickCommentsPanel.jsx
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import RoleName from '../../RoleName/RoleName';
import { valuePickApi } from '../../../api/valuePick';
import styles from './valuepick.module.css';

export default function ValuePickCommentsPanel({
  postId,
  currentUser,
  isAuthenticated,
  loginState,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await valuePickApi.listComments(postId, { page: 1, pageSize: 50 });
      setItems(response.items || []);
      setError('');
    } catch {
      setError('댓글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!body.trim() || posting) return;

    setPosting(true);
    try {
      const created = await valuePickApi.createComment(postId, body.trim());
      setItems((prev) => [...prev, created]);
      setBody('');
      setError('');
    } catch {
      setError('댓글 작성에 실패했습니다.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      await valuePickApi.deleteComment(postId, commentId);
      setItems((prev) => prev.filter((comment) => comment.id !== commentId));
    } catch {
      setError('댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <section className={styles.commentPanel}>
      <div className={styles.commentHeader}>
        <div className={styles.commentTitle}>
          <MessageSquare size={16} />
          <span>응원 댓글</span>
        </div>
        <span className={styles.commentCount}>{items.length}개</span>
      </div>

      <div className={styles.commentForm}>
        {!isAuthenticated ? (
          <div className={styles.commentPlaceholder}>
            <p>로그인 후 서로의 다짐을 응원하는 댓글을 남길 수 있습니다.</p>
            <Link className="btn btn-primary" to="/login" state={loginState}>
              로그인하고 댓글 쓰기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              className={styles.commentInput}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="실천을 응원하는 한마디를 남겨보세요. (최대 1000자)"
              maxLength={1000}
              required
            />
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={posting || !body.trim()}>
                {posting ? <Loader2 size={16} className={styles.spinner} /> : null}
                댓글 등록
              </button>
            </div>
          </form>
        )}
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>

      <div className={styles.commentList}>
        {loading ? (
          <div className={styles.commentPlaceholder}>댓글을 불러오는 중입니다...</div>
        ) : items.length === 0 ? (
          <div className={styles.commentPlaceholder}>첫 응원 댓글을 남겨보세요.</div>
        ) : (
          items.map((comment) => (
            <article key={comment.id} className={styles.commentItem}>
              <div className={styles.commentMeta}>
                <RoleName
                  nickname={comment.author?.name || '작성자'}
                  role={comment.author?.role || 'student'}
                  size="sm"
                />
                <span>•</span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className={styles.commentBody}>{comment.body}</p>
              {currentUser?.role === 'admin' ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => handleDelete(comment.id)}
                  title="댓글 삭제"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
