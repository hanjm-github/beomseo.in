import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';

import RoleName from '../../../components/RoleName/RoleName';
import { mealsApi } from '../../../api/meals';
import styles from './MealPage.module.css';

const COMMENT_MAX_LENGTH = 1000;

const formatCommentTime = (value) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

export default function MealCommentsPanel({
  dateKey,
  disabled,
  currentUser,
  isAuthenticated,
}) {
  const isAdmin = currentUser?.role === 'admin';
  const [comments, setComments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [moderatingId, setModeratingId] = useState(null);
  const [error, setError] = useState('');
  const canUseComments = Boolean(dateKey) && !disabled;
  const trimmedBody = body.trim();
  const remainingCharacters = COMMENT_MAX_LENGTH - body.length;

  useEffect(() => {
    let isActive = true;

    if (!canUseComments) {
      setComments([]);
      setTotalCount(0);
      setError('');
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    // Comment visibility depends on auth and role, so reload when the viewer context changes.
    async function loadComments() {
      setIsLoading(true);
      setError('');
      try {
        const payload = await mealsApi.listComments(dateKey, {
          page: 1,
          pageSize: 50,
          order: 'asc',
        });
        if (!isActive) {
          return;
        }
        setComments(payload.items);
        setTotalCount(payload.total);
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setComments([]);
        setTotalCount(0);
        setError(loadError instanceof Error ? loadError.message : '급식 댓글을 불러오지 못했어요.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      isActive = false;
    };
  }, [canUseComments, dateKey, currentUser?.id, currentUser?.role]);

  const visibleStateText = useMemo(() => {
    if (!canUseComments) {
      return '운영되는 급식이 없는 날짜입니다.';
    }
    if (!isAuthenticated) {
      return '로그인 후 댓글을 남길 수 있어요.';
    }
    if (isPosting) {
      return '등록 중...';
    }
    return '승인 대기 상태로 등록됩니다.';
  }, [canUseComments, isAuthenticated, isPosting]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canUseComments || !isAuthenticated || !trimmedBody || isPosting) {
      return;
    }

    setIsPosting(true);
    setError('');
    try {
      const created = await mealsApi.createComment(dateKey, trimmedBody);
      // The author can see their pending comment immediately even before admin approval.
      setComments((previous) => [...previous, created]);
      setTotalCount((previous) => previous + 1);
      setBody('');
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : '급식 댓글을 저장하지 못했어요.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleApprovalChange = async (comment, nextApproved) => {
    if (!isAdmin || moderatingId) {
      return;
    }

    setModeratingId(comment.id);
    setError('');
    try {
      const updated = await mealsApi.setCommentApproval(dateKey, comment.id, nextApproved);
      setComments((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (approvalError) {
      setError(
        approvalError instanceof Error ? approvalError.message : '댓글 승인 상태를 변경하지 못했어요.',
      );
    } finally {
      setModeratingId(null);
    }
  };

  return (
    <section className={styles.commentsSection}>
      <article className={styles.commentsPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>급식 댓글</p>
            <h2 className={styles.sectionTitle}>오늘 메뉴에 대한 한마디</h2>
          </div>
          <div className={styles.commentCountBadge}>
            <MessageSquare size={16} />
            {totalCount}개
          </div>
        </div>

        {error ? (
          <div className={`${styles.pageNotice} ${styles.pageNoticeError}`}>{error}</div>
        ) : null}

        <form className={styles.commentForm} onSubmit={handleSubmit}>
          <label className={styles.commentFieldLabel} htmlFor="meal-comment-body">
            댓글 작성
          </label>
          <textarea
            id="meal-comment-body"
            className={styles.commentTextarea}
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
            disabled={!canUseComments || !isAuthenticated || isPosting}
            maxLength={COMMENT_MAX_LENGTH}
            rows={3}
            placeholder={isAuthenticated ? '댓글을 입력하세요.' : '로그인이 필요합니다.'}
          />
          <div className={styles.commentFormFooter}>
            <span className={styles.commentFormState}>{visibleStateText}</span>
            <span className={styles.commentCounter}>{remainingCharacters}자</span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canUseComments || !isAuthenticated || !trimmedBody || isPosting}
            >
              {isPosting ? <Loader2 size={16} className={styles.spinIcon} /> : <Send size={16} />}
              등록
            </button>
          </div>
        </form>

        <div className={styles.commentList} aria-busy={isLoading}>
          {isLoading ? (
            <div className={styles.commentEmptyState}>
              <Loader2 size={18} className={styles.spinIcon} />
              댓글을 불러오는 중입니다.
            </div>
          ) : comments.length ? (
            comments.map((comment) => {
              const isPending = comment.approvalStatus !== 'approved';
              const isOwnComment = Boolean(currentUser?.id)
                && Number(comment.author.id) === Number(currentUser.id);
              const showPendingBadge = isPending && isOwnComment;
              const showFooter = showPendingBadge || isAdmin;
              const isModerating = moderatingId === comment.id;

              // Pending rows are only exposed to their author and admins; the footer mirrors that contract.
              return (
                <article key={comment.id} className={styles.commentItem}>
                  <header className={styles.commentHeader}>
                    <RoleName
                      nickname={comment.author.name}
                      role={comment.author.role}
                      size="sm"
                    />
                    <time dateTime={comment.createdAt || undefined}>
                      {formatCommentTime(comment.createdAt)}
                    </time>
                  </header>
                  <p className={styles.commentBody}>{comment.body}</p>
                  {showFooter ? (
                    <footer className={styles.commentFooter}>
                      {showPendingBadge ? (
                        <span className={styles.commentPendingBadge}>미승인</span>
                      ) : null}

                      {isAdmin ? (
                        <label className={styles.commentApprovalToggle}>
                          <input
                            type="checkbox"
                            checked={!isPending}
                            onChange={(event) => handleApprovalChange(comment, event.target.checked)}
                            disabled={isModerating}
                          />
                          <span>{isModerating ? '변경 중...' : isPending ? '미승인' : '승인'}</span>
                        </label>
                      ) : null}
                    </footer>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className={styles.commentEmptyState}>
              <MessageSquare size={18} />
              아직 표시할 댓글이 없습니다.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
