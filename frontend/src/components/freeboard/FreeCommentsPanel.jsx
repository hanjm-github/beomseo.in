/**
 * @file src/components/freeboard/FreeCommentsPanel.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react
 * - lucide-react
 * - ./freeboard.module.css
 * - ../../api/community
 * Side effects:
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Trash2, Loader2 } from 'lucide-react';
import styles from './freeboard.module.css';
import { communityApi } from '../../api/community';
import RoleName from '../RoleName/RoleName';

/**
 * FreeCommentsPanel module entry point.
 */
export default function FreeCommentsPanel({ postId, currentUser, isAuthenticated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communityApi.listComments(postId, { page: 1, pageSize: 50 });
      setItems(res.items || []);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      const res = await communityApi.createComment(postId, body.trim());
      setItems((prev) => [...prev, res]);
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
      await communityApi.deleteComment(postId, commentId);
      setItems((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError('댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <div className={styles.commentPanel}>
      <div className={styles.listHeader}>
        <div className={styles.listTitle}>
          <div className={styles.cardTitleRow}>
            <MessageSquare size={16} />
            댓글
          </div>
        </div>
        <div className={styles.metaRow}>{items.length}개</div>
      </div>

      <div className={styles.commentForm}>
        {!isAuthenticated ? (
          <div className={styles.commentPlaceholder}>로그인 후 댓글을 작성할 수 있습니다.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              className={styles.commentInput}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="댓글을 입력하세요 (최대 1000자)"
              maxLength={1000}
              required
            />
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={posting || !body.trim()}>
                {posting ? <Loader2 size={16} className={styles.spinner} /> : null}
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
          items.map((c) => (
            <div key={c.id} className={styles.commentItem}>
              <div className={styles.commentMeta}>
                <RoleName nickname={c.author?.name || '작성자'} role={c.author?.role || 'student'} size="sm" />
                <span>•</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className={styles.commentBody}>{c.body}</div>
              {currentUser?.role === 'admin' ? (
                <button type="button" className={styles.iconButton} onClick={() => handleDelete(c.id)} title="삭제">
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


