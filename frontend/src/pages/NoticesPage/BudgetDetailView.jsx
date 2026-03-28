/**
 * @file src/pages/NoticesPage/BudgetDetailView.jsx
 * @description Detail page for a budget disclosure notice.
 * Responsibilities:
 * - Render notice detail, attachments, comments, and reactions for budget posts.
 * - Preserve cycle/month-aware navigation actions.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../api/notices
 * Side effects:
 * - Influences client-side routing and navigation state.
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Owns budget disclosure post detail rendering.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { Eye, Pencil, ArrowLeft, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import styles from '../../components/notices/notices.module.css';
import { noticesApi } from '../../api/notices';
import Attachments from '../../components/notices/Attachments';
import SafeHtml from '../../components/security/SafeHtml';
import { useAuth } from '../../context/AuthContext';
import RoleName from '../../components/RoleName/RoleName';
import CommentsPanel from '../../components/notices/CommentsPanel';
import { buildAuthRedirectState } from '../../utils/authRedirect';
import { buildBudgetListPath, formatBudgetPeriodLabel } from './budgetUtils';

/**
 * BudgetDetailView module entry point.
 */
export default function BudgetDetailView() {
  const { budgetYear, budgetMonth, id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      noticesApi
        .get(id)
        .then((res) => {
          if (cancelled) return;
          setNotice(res);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setNotice(null);
          setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  const resolvedBudgetYear = notice?.budgetYear != null ? String(notice.budgetYear) : budgetYear;
  const resolvedBudgetMonth = notice?.budgetMonth
    ? String(notice.budgetMonth).padStart(2, '0')
    : budgetMonth;
  // Detail responses stay authoritative because edits can move a post into a
  // different budget period than the path the user originally visited.
  const listPath = buildBudgetListPath(resolvedBudgetYear, resolvedBudgetMonth);
  const editPath = `${listPath}/${id}/edit`;

  const handleReact = async (type) => {
    if (!isAuthenticated) {
      navigate('/login', { state: buildAuthRedirectState(location) });
      return;
    }
    if (!notice) return;
    // Budget posts reuse the generic notice reaction contract, so the optimistic
    // update path can mirror the existing school/council board behavior.
    const previousNotice = notice;
    const nextNotice = { ...notice };
    const currentReaction = notice.myReaction;
    if (currentReaction === type) {
      nextNotice.myReaction = null;
      if (type === 'like' && nextNotice.likes > 0) nextNotice.likes -= 1;
      if (type === 'dislike' && nextNotice.dislikes > 0) nextNotice.dislikes -= 1;
    } else {
      if (currentReaction === 'like' && nextNotice.likes > 0) nextNotice.likes -= 1;
      if (currentReaction === 'dislike' && nextNotice.dislikes > 0) nextNotice.dislikes -= 1;
      nextNotice.myReaction = type;
      if (type === 'like') nextNotice.likes += 1;
      else nextNotice.dislikes += 1;
    }
    setNotice(nextNotice);
    try {
      const res = await noticesApi.react(id, type);
      setNotice({ ...nextNotice, ...res });
      setError('');
    } catch {
      setNotice(previousNotice);
      setError('리액션 처리에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (!loading) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading]);

  if (loading) {
    return <div className={styles.placeholder}>불러오는 중...</div>;
  }

  if (!notice) {
    return (
      <div className={styles.placeholder}>
        예산 공개 글을 찾을 수 없습니다.
        <div style={{ marginTop: '8px' }}>
          <Link to={listPath} className={styles.btnGhost}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  if (notice.category !== 'budget') {
    return (
      <div className={styles.placeholder}>
        예산 공개 글로 연결되지 않는 게시물입니다.
        <div style={{ marginTop: '8px' }}>
          <Link to={listPath} className={styles.btnGhost}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isCouncilOwner =
    user?.role === 'student_council' &&
    user?.id != null &&
    notice?.author?.id != null &&
    Number(user.id) === Number(notice.author.id);
  const canEdit = isAdmin || isCouncilOwner;

  return (
    <div className={styles.detail}>
      <div className={styles.detailBody}>
        <h1 className={styles.detailTitle}>{notice.title}</h1>
        <div className={styles.detailMeta}>
          <RoleName
            nickname={notice.author?.name || '관리자'}
            role={notice.author?.role || 'admin'}
            size="sm"
          />
          <span className={styles.metaDivider}>•</span>
          <span>{new Date(notice.createdAt).toLocaleString()}</span>
          {notice.views != null ? (
            <>
              <span className={styles.metaDivider}>•</span>
              <Eye size={12} />
              {notice.views}
            </>
          ) : null}
        </div>

        <div className={styles.reactionBar}>
          <button
            type="button"
            className={`${styles.reactionButton} ${
              notice.myReaction === 'like' ? styles.reactionButtonActive : ''
            }`}
            onClick={() => handleReact('like')}
          >
            <ThumbsUp size={14} />
            <span className={styles.reactionCount}>{notice.likes ?? 0}</span>
          </button>
          <button
            type="button"
            className={`${styles.reactionButton} ${
              notice.myReaction === 'dislike' ? styles.reactionButtonActive : ''
            }`}
            onClick={() => handleReact('dislike')}
          >
            <ThumbsDown size={14} />
            <span className={styles.reactionCount}>{notice.dislikes ?? 0}</span>
          </button>
        </div>

        <SafeHtml
          className={styles.detailContent}
          html={notice.body || ''}
          fallback="<p>본문이 없습니다.</p>"
        />

        <Attachments items={notice.attachments} />

        <CommentsPanel noticeId={id} currentUser={user} isAuthenticated={isAuthenticated} />
      </div>

      <aside className={styles.sidePanel}>
        <div className={styles.sidebarCard}>
          <h4 className={styles.sidebarTitle}>정보</h4>
          <div className={styles.pillRow}>
            <span className={styles.pill}>예산 공개</span>
            <span className={styles.pill}>
              {formatBudgetPeriodLabel(resolvedBudgetYear, resolvedBudgetMonth)}
            </span>
          </div>
        </div>

        <div className={styles.sidebarCard}>
          <h4 className={styles.sidebarTitle}>작업</h4>
          <div className={styles.sideActions}>
            <Link to={listPath} className={styles.btnGhost}>
              <ArrowLeft size={14} />
              목록으로
            </Link>
            {canEdit ? (
              <>
                <Link to={editPath} className={styles.btnPrimary}>
                  <Pencil size={14} />
                  수정
                </Link>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={async () => {
                    if (!window.confirm('정말 삭제하시겠습니까?')) return;
                    try {
                      await noticesApi.remove(id);
                      navigate(listPath, { replace: true });
                    } catch {
                      setError('삭제에 실패했습니다. 다시 시도해주세요.');
                    }
                  }}
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </>
            ) : null}
          </div>
          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>
      </aside>
    </div>
  );
}
