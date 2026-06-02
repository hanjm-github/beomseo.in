import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import RoleName from '../../../components/RoleName/RoleName';
import { mealsApi } from '../../../api/meals';
import { buildAuthRedirectState } from '../../../utils/authRedirect';
import styles from './MealPage.module.css';

const OPINION_MAX_LENGTH = 1000;
const OPINION_MANAGER_ROLES = ['admin', 'student_council'];

const formatOpinionTime = (value) => {
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
  const location = useLocation();
  const navigate = useNavigate();
  const canViewOpinions = OPINION_MANAGER_ROLES.includes(currentUser?.role);
  // Non-managers can submit an opinion but never request the private inbox.
  const [opinions, setOpinions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState('');
  const [submitNotice, setSubmitNotice] = useState('');
  const canUseOpinions = Boolean(dateKey) && !disabled;
  const shouldPromptLogin = canUseOpinions && !isAuthenticated;
  const isCommentInputDisabled = !canUseOpinions || isPosting;
  const trimmedBody = body.trim();
  const remainingCharacters = OPINION_MAX_LENGTH - body.length;

  useEffect(() => {
    let isActive = true;

    if (!canUseOpinions || !canViewOpinions) {
      setOpinions([]);
      setTotalCount(0);
      setError('');
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    async function loadOpinions() {
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
        setOpinions(payload.items);
        setTotalCount(payload.total);
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setOpinions([]);
        setTotalCount(0);
        setError(loadError instanceof Error ? loadError.message : '비공개 급식 의견을 불러오지 못했어요.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadOpinions();

    return () => {
      isActive = false;
    };
  }, [canUseOpinions, canViewOpinions, dateKey, currentUser?.id, currentUser?.role]);

  const visibleStateText = useMemo(() => {
    if (!canUseOpinions) {
      return '운영되는 급식이 없는 날짜입니다.';
    }
    if (!isAuthenticated) {
      return '로그인 후 학생회에 의견을 보낼 수 있어요.';
    }
    if (isPosting) {
      return '의견을 보내는 중...';
    }
    return '입력한 내용은 학생회와 관리자만 확인합니다.';
  }, [canUseOpinions, isAuthenticated, isPosting]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canUseOpinions || !isAuthenticated || !trimmedBody || isPosting) {
      return;
    }

    setIsPosting(true);
    setError('');
    setSubmitNotice('');
    try {
      const created = await mealsApi.createComment(dateKey, trimmedBody);
      if (canViewOpinions) {
        // Manager authors see their own submitted opinion immediately in the inbox.
        setOpinions((previous) => [...previous, created]);
        setTotalCount((previous) => previous + 1);
      }
      setBody('');
      setSubmitNotice(
        canViewOpinions
          ? '비공개 의견을 접수했어요.'
          : '의견을 보냈어요. 학생회와 관리자만 확인할 수 있습니다.',
      );
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : '비공개 급식 의견을 저장하지 못했어요.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLoginRequiredInteraction = (event) => {
    if (!shouldPromptLogin) {
      return;
    }

    event.preventDefault();
    // Keep the read-only field and button useful for signed-out users by preserving the return URL.
    navigate('/login', { state: buildAuthRedirectState(location) });
  };

  return (
    <section className={styles.commentsSection}>
      <article className={styles.commentsPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>비공개 급식 의견</p>
            <h2 className={styles.sectionTitle}>학생회에 보낼 의견</h2>
            <p className={styles.sectionDescription}>
              입력한 내용은 학생회와 관리자만 확인합니다.
            </p>
          </div>
          {canViewOpinions ? (
            <div className={styles.commentCountBadge}>
              <MessageSquare size={16} />
              {totalCount}개
            </div>
          ) : (
            <div className={styles.commentCountBadge}>
              <ShieldCheck size={16} />
              비공개
            </div>
          )}
        </div>

        {error ? (
          <div className={`${styles.pageNotice} ${styles.pageNoticeError}`}>{error}</div>
        ) : null}
        {submitNotice ? (
          <div className={styles.pageNotice}>{submitNotice}</div>
        ) : null}

        <form className={styles.commentForm} onSubmit={handleSubmit}>
          <label className={styles.commentFieldLabel} htmlFor="meal-opinion-body">
            의견 작성
          </label>
          <textarea
            id="meal-opinion-body"
            className={styles.commentTextarea}
            value={body}
            onChange={(event) => {
              setBody(event.target.value.slice(0, OPINION_MAX_LENGTH));
              setSubmitNotice('');
            }}
            onClick={handleLoginRequiredInteraction}
            onFocus={handleLoginRequiredInteraction}
            disabled={isCommentInputDisabled}
            readOnly={!isAuthenticated}
            aria-readonly={!isAuthenticated}
            maxLength={OPINION_MAX_LENGTH}
            rows={3}
            placeholder={isAuthenticated ? '학생회에 전달할 의견을 입력하세요.' : '로그인이 필요합니다.'}
          />
          <div className={styles.commentFormFooter}>
            <span className={styles.commentFormState}>{visibleStateText}</span>
            <span className={styles.commentCounter}>{remainingCharacters}자</span>
            <button
              type={isAuthenticated ? 'submit' : 'button'}
              className="btn btn-primary"
              onClick={!isAuthenticated ? handleLoginRequiredInteraction : undefined}
              disabled={
                isAuthenticated
                  ? !canUseOpinions || !trimmedBody || isPosting
                  : !canUseOpinions || isPosting
              }
            >
              {isPosting ? <Loader2 size={16} className={styles.spinIcon} /> : <Send size={16} />}
              의견 보내기
            </button>
          </div>
        </form>

        {canViewOpinions ? (
          <div className={styles.commentList} aria-busy={isLoading}>
            {isLoading ? (
              <div className={styles.commentEmptyState}>
                <Loader2 size={18} className={styles.spinIcon} />
                비공개 의견을 불러오는 중입니다.
              </div>
            ) : opinions.length ? (
              opinions.map((opinion) => (
                <article key={opinion.id} className={styles.commentItem}>
                  <header className={styles.commentHeader}>
                    <RoleName
                      nickname={opinion.author.name}
                      role={opinion.author.role}
                      size="sm"
                    />
                    <time dateTime={opinion.createdAt || undefined}>
                      {formatOpinionTime(opinion.createdAt)}
                    </time>
                  </header>
                  <p className={styles.commentBody}>{opinion.body}</p>
                </article>
              ))
            ) : (
              <div className={styles.commentEmptyState}>
                <MessageSquare size={18} />
                아직 접수된 의견이 없습니다.
              </div>
            )}
          </div>
        ) : null}
      </article>
    </section>
  );
}
