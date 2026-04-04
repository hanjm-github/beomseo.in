/**
 * @file src/pages/Community/ValuePick/ValuePickDetailView.jsx
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  MessageCircle,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import SEO from '../../../components/SEO';
import SafeHtml from '../../../components/security/SafeHtml';
import RoleName from '../../../components/RoleName/RoleName';
import { useAuth } from '../../../context/AuthContext';
import { valuePickApi } from '../../../api/valuePick';
import { buildSeoExcerpt } from '../../../seo/text';
import ValuePickCommentsPanel from '../../../components/Community/ValuePick/ValuePickCommentsPanel';
import '../../page-shell.css';
import styles from '../../../components/Community/ValuePick/valuepick.module.css';

function hasRichContent(html) {
  if (!html) return false;
  const withoutTags = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return Boolean(withoutTags) || /<img\b/i.test(html);
}

export default function ValuePickDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    valuePickApi
      .get(id)
      .then((response) => {
        if (cancelled) return;
        setPost(response);
        setError(null);
      })
      .catch((requestError) => {
        if (cancelled) return;

        const status = requestError?.response?.status;
        const message =
          status === 403
            ? '아직 승인되지 않은 글이라 작성자 또는 관리자만 볼 수 있습니다.'
            : status === 404
              ? '게시글을 찾을 수 없습니다.'
              : '게시글을 불러오지 못했습니다.';

        setError({ id, message });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const detailPath = useMemo(() => `/community/value-pick/${id}`, [id]);
  const activeError = error?.id === id ? error.message : '';
  const loading = !activeError && (!post || String(post.id) !== String(id));

  const handleReact = async (type) => {
    if (!post) return;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: detailPath } });
      return;
    }

    try {
      const response = await valuePickApi.react(post.id, type);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likes: response.likes ?? prev.likes,
              dislikes: response.dislikes ?? prev.dislikes,
              myReaction: response.myReaction ?? null,
            }
          : prev
      );
    } catch {
      // Keep current UI state on transient failures.
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>다짐을 불러오는 중입니다...</div>
      </div>
    );
  }

  if (activeError || !post) {
    return (
      <div className="page-shell">
        <p className={styles.errorText}>{activeError || '존재하지 않는 글입니다.'}</p>
        <button className={styles.btnGhost} onClick={() => navigate(-1)}>
          돌아가기
        </button>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.id && post.author?.id && Number(user.id) === Number(post.author.id);
  const showRecord = hasRichContent(post.body);

  return (
    <div className="page-shell">
      <SEO
        title={`${post.competency} · ${post.pledge}`}
        description={buildSeoExcerpt(post.body || post.pledge) || '인성 가치 PICK 상세 페이지입니다.'}
        path={detailPath}
        type="article"
        noindex={post.status === 'pending'}
        breadcrumbs={[
          { name: '홈', url: '/' },
          { name: '커뮤니티', url: '/community/value-pick' },
          { name: '인성 가치 PICK!', url: '/community/value-pick' },
          { name: post.pledge, url: detailPath },
        ]}
      />

      <Link to="/community/value-pick" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} />
        목록으로
      </Link>

      <div className={styles.detailShell}>
        <section className={styles.detailHero}>
          <div className={styles.detailHeaderRow}>
            <span className={styles.competencyBadge}>인성 역량 · {post.competency || '기록 중'}</span>
            {post.status === 'pending' ? (
              <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                <ShieldAlert size={12} />
                미승인
              </span>
            ) : null}
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <p className={styles.quoteLabel}>나만의 다짐 한 줄</p>
            <blockquote className={styles.pledgeQuote}>{post.pledge}</blockquote>
          </div>

          <div className={styles.detailMeta} style={{ marginTop: 'var(--space-4)' }}>
            <span className={styles.metaItem}>
              <RoleName nickname={post.author?.name || '작성자'} role={post.author?.role || 'student'} size="sm" />
            </span>
            <span className={styles.metaItem}>{new Date(post.createdAt).toLocaleString()}</span>
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
              <ThumbsUp size={14} />
              추천 {post.likes || 0}
            </button>
            <button
              type="button"
              className={`${styles.reactionButton} ${
                post.myReaction === 'dislike' ? styles.reactionButtonActiveNegative : ''
              }`}
              onClick={() => handleReact('dislike')}
            >
              <ThumbsDown size={14} />
              비추천 {post.dislikes || 0}
            </button>
            {isAdmin || isOwner ? (
              <Link to={`/community/value-pick/${post.id}/edit`} className={styles.reactionButton}>
                수정
              </Link>
            ) : null}
            {isAdmin ? (
              post.status === 'pending' ? (
                <button
                  type="button"
                  className={styles.reactionButton}
                  onClick={async () => {
                    const response = await valuePickApi.approve(post.id);
                    setPost(response);
                  }}
                >
                  승인하기
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.reactionButton}
                  onClick={async () => {
                    const response = await valuePickApi.unapprove(post.id);
                    setPost(response);
                  }}
                >
                  승인 취소
                </button>
              )
            ) : null}
          </div>
        </section>

        <section className={styles.recordCard}>
          <p className={styles.recordLabel}>상세 기록</p>
          <h2 className={styles.recordHeading}>실천 메모</h2>
          {showRecord ? (
            <SafeHtml className={styles.recordBody} html={post.body} />
          ) : (
            <p className={styles.emptyRecord}>
              아직 상세 기록은 남겨져 있지 않아요. 한 줄 다짐을 먼저 실천해 보고, 나중에 변화나 배운 점을
              이어서 적어 보세요.
            </p>
          )}
        </section>

        <ValuePickCommentsPanel
          postId={post.id}
          currentUser={user}
          isAuthenticated={isAuthenticated}
          loginState={{ from: detailPath }}
        />
      </div>
    </div>
  );
}
