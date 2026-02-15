import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Heart, ThumbsDown, Eye, MessageCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import styles from '../../components/freeboard/freeboard.module.css';
import { communityApi } from '../../api/community';
import FreeCommentsPanel from '../../components/freeboard/FreeCommentsPanel';
import '../page-shell.css';
import { useAuth } from '../../context/AuthContext';
import RoleName from '../../components/RoleName/RoleName';

export default function FreeBoardDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    communityApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setPost(res);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('게시글을 불러오지 못했습니다.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleReact = async (type) => {
    if (!post) return;
    try {
      const res = await communityApi.react(post.id, type);
      setPost((p) => (p ? { ...p, ...res } : p));
    } catch {
      // ignore for mock
    }
  };

  const handleBookmark = async () => {
    if (!post || bookmarking) return;
    setBookmarking(true);
    try {
      const res = await communityApi.toggleBookmark(post.id);
      setPost((p) =>
        p
          ? {
              ...p,
              bookmarked: res.bookmarked ?? p.bookmarked,
              bookmarkedCount: res.bookmarkedCount ?? p.bookmarkedCount,
            }
          : p
      );
    } finally {
      setBookmarking(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>불러오는 중...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="page-shell">
        <p className={styles.errorText}>{error || '존재하지 않는 글입니다.'}</p>
        <button className={styles.btnGhost} onClick={() => navigate(-1)}>
          돌아가기
        </button>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.id && post?.author?.id && Number(user.id) === Number(post.author.id);

  return (
    <div className="page-shell">
      <Link to="/community/free" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} />
        목록으로
      </Link>

      <div className={styles.detailShell}>
        <div className={styles.detailHeader}>
          <div className={styles.detailTitle}>
            <span className={`${styles.badge} ${styles.badgeInfo}`}>
              {communityApi.categoryLabel[post.category] || '카테고리'}
            </span>
            {post.status === 'pending' ? (
              <span className={`${styles.badge} ${styles.badgePending}`}>
                <ShieldAlert size={12} />
                미승인
              </span>
            ) : null}
            <h1>{post.title}</h1>
          </div>
          <div className={styles.detailMeta}>
            <RoleName nickname={post.author?.name || '작성자'} role={post.author?.role || 'student'} size="sm" />
            <span>•</span>
            <span>{new Date(post.createdAt).toLocaleString()}</span>
            <span>•</span>
            <span className={styles.metaItem}>
              <Eye size={14} />
              {post.views || 0}
            </span>
            <span className={styles.metaItem}>
              <MessageCircle size={14} />
              {post.commentsCount || 0}
            </span>
          </div>
          <div className={styles.reactionBar}>
            <button
              type="button"
              className={`${styles.reactionButton} ${
                post.myReaction === 'like' ? styles.reactionButtonActive : ''
              }`}
              onClick={() => handleReact('like')}
            >
              <Heart size={14} />
              공감 {post.likes || 0}
            </button>
            <button
              type="button"
              className={`${styles.reactionButton} ${
                post.myReaction === 'dislike' ? styles.reactionButtonActiveNegative : ''
              }`}
              onClick={() => handleReact('dislike')}
            >
              <ThumbsDown size={14} />
              비공감 {post.dislikes || 0}
            </button>
            <button type="button" className={styles.reactionButton} onClick={handleBookmark} disabled={bookmarking}>
              {post.bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              {post.bookmarked ? '북마크됨' : '북마크'}
            </button>
            {isAdmin || isOwner ? (
              <Link to={`/community/free/${post.id}/edit`} className={styles.reactionButton}>
                수정
              </Link>
            ) : null}
            {isAdmin ? (
              post.status === 'pending' ? (
                <button
                  type="button"
                  className={styles.reactionButton}
                  onClick={async () => {
                    const res = await communityApi.approve(post.id);
                    setPost(res);
                  }}
                >
                  승인하기
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.reactionButton}
                  onClick={async () => {
                    const res = await communityApi.unapprove(post.id);
                    setPost(res);
                  }}
                >
                  승인 취소
                </button>
              )
            ) : null}
          </div>
        </div>

        <div className={styles.detailBody} dangerouslySetInnerHTML={{ __html: post.body || '' }} />

        <FreeCommentsPanel postId={post.id} currentUser={user} isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}
