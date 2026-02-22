/**
 * @file src/components/lostfound/LostFoundCommentsPanel.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react
 * - lucide-react
 * - ../RoleName/RoleName
 * - ../../api/lostFound
 * Side effects:
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import RoleName from '../RoleName/RoleName';
import { lostFoundApi } from '../../api/lostFound';
import styles from './lostfound.module.css';

/**
 * LostFoundCommentsPanel module entry point.
 */
export default function LostFoundCommentsPanel({ itemId, currentUser, isAuthenticated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lostFoundApi.listComments(itemId, { page: 1, pageSize: 50 });
      setItems(res.items || []);
      setError('');
    } catch {
      setError('댓글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!body.trim() || posting) return;

    setPosting(true);
    try {
      const created = await lostFoundApi.createComment(itemId, body.trim());
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
      await lostFoundApi.deleteComment(itemId, commentId);
      setItems((prev) => prev.filter((comment) => String(comment.id) !== String(commentId)));
    } catch {
      setError('댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <section className={styles.commentsPanel} aria-label="댓글">
      <header className={styles.commentsHeader}>
        <h2 className={styles.commentsTitle}>
          <MessageSquare size={16} />
          댓글
        </h2>
        <span className={styles.commentsCount}>{items.length}개</span>
      </header>

      {isAuthenticated ? (
        <form className={styles.commentForm} onSubmit={handleSubmit}>
          <label htmlFor="lostfound-comment" className="sr-only">
            댓글 입력
          </label>
          <textarea
            id="lostfound-comment"
            className={styles.commentInput}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="소유자 확인을 위한 질문을 남겨주세요."
            maxLength={1000}
          />
          <div className={styles.commentActions}>
            <button type="submit" className="btn btn-primary" disabled={posting || !body.trim()}>
              {posting ? <Loader2 size={16} className={styles.spinner} /> : null}
              댓글 등록
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.commentLocked}>로그인 후 댓글을 작성할 수 있습니다.</p>
      )}

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {loading ? (
        <p className={styles.commentPlaceholder}>댓글을 불러오는 중입니다.</p>
      ) : items.length === 0 ? (
        <p className={styles.commentPlaceholder}>아직 댓글이 없습니다.</p>
      ) : (
        <div className={styles.commentList}>
          {items.map((comment) => (
            <article className={styles.commentItem} key={comment.id}>
              <div className={styles.commentMeta}>
                <RoleName
                  nickname={comment.author?.name || comment.author?.nickname || '작성자'}
                  role={comment.author?.role || 'student'}
                  size="sm"
                />
                <span>•</span>
                <time dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleString()}
                </time>
              </div>
              <p className={styles.commentBody}>{comment.body}</p>
              {currentUser?.role === 'admin' ? (
                <button
                  type="button"
                  className={styles.commentDelete}
                  onClick={() => handleDelete(comment.id)}
                  aria-label="댓글 삭제"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}


