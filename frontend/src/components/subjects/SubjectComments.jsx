import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Trash2, Loader2 } from "lucide-react";
import { subjectChangesApi } from "../../api/subjectChanges";
import { useAuth } from "../../context/AuthContext";
import styles from "./subjects.module.css";

export default function SubjectComments({ postId }) {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await subjectChangesApi.listComments(postId, { page: 1, pageSize: 100, order: "asc" });
      setItems(res.items || []);
      setError("");
    } catch {
      setError("댓글을 불러오지 못했습니다.");
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
      const res = await subjectChangesApi.createComment(postId, body.trim());
      setItems((prev) => [...prev, res]);
      setBody("");
      setError("");
    } catch (err) {
      const message = err.response?.data?.error || "댓글 작성에 실패했습니다.";
      setError(message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await subjectChangesApi.deleteComment(postId, commentId);
      setItems((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError("댓글 삭제에 실패했습니다.");
    }
  };

  return (
    <div className={styles.commentsBox}>
      <div className={styles.commentHeader}>
        <span>
          <MessageSquare size={16} /> 댓글 ({items.length})
        </span>
      </div>

      <div className={styles.commentForm}>
        {!isAuthenticated ? (
          <div className={styles.commentPlaceholder}>로그인 후 댓글을 작성할 수 있습니다.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              className={styles.commentTextarea}
              placeholder="댓글을 입력하세요. (최대 800자)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={800}
              disabled={posting}
              required
            />
            <div className={styles.commentActions}>
              <button type="submit" className="btn btn-primary" disabled={posting || !body.trim()}>
                {posting ? <Loader2 className="spinner" size={14} /> : null}
                등록
              </button>
            </div>
          </form>
        )}
        {error ? <p className="muted" style={{ color: "var(--color-error)" }}>{error}</p> : null}
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
                <strong>{comment.author?.name || "익명"}</strong>
                <span>·</span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <div className={styles.commentBody}>{comment.body}</div>
              {user?.role === "admin" || user?.id === comment.author?.id ? (
                <button
                  type="button"
                  className="btn btn-tertiary"
                  style={{ padding: "4px 8px", marginTop: 6 }}
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 size={14} /> 삭제
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}