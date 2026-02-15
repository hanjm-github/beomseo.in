import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Pin,
  AlertTriangle,
  GraduationCap,
  Eye,
  Pencil,
  ArrowLeft,
  Trash2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import styles from '../../components/notices/notices.module.css';
import { noticesApi } from '../../api/notices';
import Attachments from '../../components/notices/Attachments';
import { useAuth } from '../../context/AuthContext';
import RoleName from '../../components/RoleName/RoleName';
import CommentsPanel from '../../components/notices/CommentsPanel';

const VALID_CATEGORIES = ['school', 'council'];

export default function DetailView() {
  const { category = 'school', id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const canEdit = ['admin', 'council', 'student_council'].includes(user?.role);

  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!VALID_CATEGORIES.includes(category)) {
      navigate('/notices/school', { replace: true });
      return;
    }
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, [category, id, navigate]);

  const handleReact = async (type) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!notice) return;
    const prev = notice;
    // optimistic update
    const next = { ...notice };
    const current = notice.myReaction;
    if (current === type) {
      next.myReaction = null;
      if (type === 'like' && next.likes > 0) next.likes -= 1;
      if (type === 'dislike' && next.dislikes > 0) next.dislikes -= 1;
    } else {
      if (current === 'like' && next.likes > 0) next.likes -= 1;
      if (current === 'dislike' && next.dislikes > 0) next.dislikes -= 1;
      next.myReaction = type;
      if (type === 'like') next.likes += 1;
      else next.dislikes += 1;
    }
    setNotice(next);
    try {
      const res = await noticesApi.react(id, type);
      setNotice({ ...next, ...res });
      setError('');
    } catch (err) {
      setNotice(prev);
      setError('리액션 처리에 실패했습니다.');
    }
  };

  useEffect(() => {
    // ensure scroll top when notice is loaded
    if (!loading) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading]);

  const badges = useMemo(
    () => [
      notice?.pinned ? { icon: Pin, label: '상단 고정', tone: 'primary' } : null,
      notice?.important ? { icon: AlertTriangle, label: '중요', tone: 'warn' } : null,
      notice?.examRelated ? { icon: GraduationCap, label: '시험', tone: 'info' } : null,
    ].filter(Boolean),
    [notice]
  );

  if (loading) {
    return <div className={styles.placeholder}>불러오는 중...</div>;
  }

  if (!notice) {
    return (
      <div className={styles.placeholder}>
        공지를 찾을 수 없습니다.
        <div style={{ marginTop: '8px' }}>
          <Link to={`/notices/${category}`} className={styles.btnGhost}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const metaTitle = category === 'school' ? '학교 공지' : '학생회 공지';

  return (
    <div className={styles.detail}>
      <div className={styles.detailBody}>
        <div className={styles.titleRow}>
          {badges.map((b) => (
            <span key={b.label} className={`${styles.badge} ${styles[`badge-${b.tone}`]}`}>
              <b.icon size={12} />
              {b.label}
            </span>
          ))}
        </div>
        <h1 className={styles.detailTitle}>{notice.title}</h1>
        <div className={styles.detailMeta}>
          <RoleName nickname={notice.author?.name || '관리자'} role={notice.author?.role || 'admin'} size="sm" />
          <span className={styles.metaDivider}>•</span>
          <span>{new Date(notice.createdAt).toLocaleString()}</span>
          {notice.views != null && (
            <>
              <span className={styles.metaDivider}>•</span>
              <Eye size={12} />
              {notice.views}
            </>
          )}
        </div>

        <div className={styles.reactionBar}>
          <button
            type="button"
            className={`${styles.reactionButton} ${notice.myReaction === 'like' ? styles.reactionButtonActive : ''}`}
            onClick={() => handleReact('like')}
          >
            <ThumbsUp size={14} />
            <span className={styles.reactionCount}>{notice.likes ?? 0}</span>
          </button>
          <button
            type="button"
            className={`${styles.reactionButton} ${notice.myReaction === 'dislike' ? styles.reactionButtonActive : ''}`}
            onClick={() => handleReact('dislike')}
          >
            <ThumbsDown size={14} />
            <span className={styles.reactionCount}>{notice.dislikes ?? 0}</span>
          </button>
        </div>

        <div
          className={styles.detailContent}
          dangerouslySetInnerHTML={{ __html: notice.body || '<p>본문이 없습니다.</p>' }}
        />

        <Attachments items={notice.attachments} />

        <CommentsPanel noticeId={id} currentUser={user} isAuthenticated={isAuthenticated} />
      </div>

      <aside className={styles.sidePanel}>
        <div className={styles.sidebarCard}>
          <h4 className={styles.sidebarTitle}>정보</h4>
          <div className={styles.pillRow}>
            <span className={styles.pill}>{metaTitle}</span>
            <span className={styles.pill}>작성일 {new Date(notice.createdAt).toLocaleDateString()}</span>
          </div>
          <div className={styles.pillRow}>
            {notice.tags?.length
              ? notice.tags.map((tag) => (
                  <span className={styles.tag} key={tag}>
                    #{tag}
                  </span>
                ))
              : '태그 없음'}
          </div>
        </div>

        <div className={styles.sidebarCard}>
          <h4 className={styles.sidebarTitle}>작업</h4>
          <div className={styles.sideActions}>
            <Link to={`/notices/${category}`} className={styles.btnGhost}>
              <ArrowLeft size={14} />
              목록으로
            </Link>
            {canEdit ? (
              <>
                <Link to={`/notices/${category}/${id}/edit`} className={styles.btnPrimary}>
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
                      navigate(`/notices/${category}`, { replace: true });
                    } catch (err) {
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
