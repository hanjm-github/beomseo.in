/**
 * @file src/pages/GomsolMarket/GomsolMarketDetailView.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../api/gomsolMarket
 * Side effects:
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Eye, ShieldCheck, Store, UserRound } from 'lucide-react';
import { gomsolMarketApi } from '../../api/gomsolMarket';
import { toSafeExternalHref } from '../../security/urlPolicy';
import { useAuth } from '../../context/AuthContext';
import RoleName from '../../components/RoleName/RoleName';
import styles from '../../components/gomsolmarket/gomsolmarket.module.css';
import '../page-shell.css';

function formatDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price) {
  const safe = Number(price) || 0;
  return `${new Intl.NumberFormat('ko-KR').format(safe)}원`;
}

/**
 * GomsolMarketDetailView module entry point.
 */
export default function GomsolMarketDetailView() {
  const { id } = useParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const isAdmin = gomsolMarketApi.canManageApproval(user);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const coverImage = useMemo(
    () => post?.images?.[activeImageIndex] || post?.images?.[0],
    [activeImageIndex, post]
  );
  const canManageSaleStatus = gomsolMarketApi.canManageSaleStatus(user, post);
  const isOwner = Boolean(user?.id && post?.author?.id && String(user.id) === String(post.author.id));
  const isBlockedPending = post && post.approvalStatus !== 'approved' && !isAdmin && !isOwner;

  const contactItems = useMemo(() => {
    if (!post?.contact) return [];
    const next = [];
    if (post.contact.studentId) {
      next.push({ label: '학번 연락', value: post.contact.studentId, type: 'text' });
    }
    if (post.contact.openChatUrl) {
      next.push({
        label: '오픈채팅',
        value: post.contact.openChatUrl,
        safeHref: toSafeExternalHref(post.contact.openChatUrl),
        type: 'link',
      });
    }
    if (post.contact.extra) {
      next.push({ label: '기타 연락', value: post.contact.extra, type: 'text' });
    }
    return next;
  }, [post]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      setPost(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await gomsolMarketApi.detail(id);
        if (cancelled) return;
        setPost(res);
        setActiveImageIndex(0);
      } catch {
        if (cancelled) return;
        setError('게시글을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [authLoading, id, isAuthenticated]);

  const toggleApproval = async () => {
    if (!post || !isAdmin || actionLoading) return;
    setActionLoading(true);
    setError('');
    try {
      const updated =
        post.approvalStatus === 'approved'
          ? await gomsolMarketApi.unapprove(post.id)
          : await gomsolMarketApi.approve(post.id);
      setPost(updated);
    } catch {
      setError('승인 상태 변경에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const updateSaleStatus = async (status) => {
    if (!post || !canManageSaleStatus || actionLoading) return;
    if (post.status === status) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await gomsolMarketApi.updateStatus(post.id, status);
      setPost(updated);
    } catch {
      setError('판매 상태 변경에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>권한 정보를 확인하는 중입니다.</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className={styles.permissionCard}>
          <p className="eyebrow">곰솔마켓 열람 권한</p>
          <h1>로그인이 필요합니다.</h1>
          <p className="lede">곰솔마켓 상세 페이지는 로그인 사용자만 볼 수 있습니다.</p>
          <div className={styles.permissionActions}>
            <Link className="btn btn-secondary" to="/community/gomsol-market">
              목록으로
            </Link>
            <Link className="btn btn-primary" to="/login" state={{ from: `/community/gomsol-market/${id}` }}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>게시글을 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="page-shell">
        <div className={styles.empty}>
          <p>{error || '존재하지 않는 게시글입니다.'}</p>
          <Link className="btn btn-secondary" to="/community/gomsol-market">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  if (isBlockedPending) {
    return (
      <div className="page-shell">
        <div className={styles.permissionCard}>
          <p className="eyebrow">곰솔마켓 검수 상태</p>
          <h1>이 게시글은 아직 공개되지 않았습니다.</h1>
          <p className="lede">미승인 게시글은 관리자만 확인할 수 있습니다.</p>
          <div className={styles.permissionActions}>
            <Link className="btn btn-secondary" to="/community/gomsol-market">
              목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={styles.detailWrap}>
        <section className={styles.detailMain}>
          <div className={styles.cardBadgeRow} style={{ position: 'static' }}>
            <span
              className={`${styles.statusBadge} ${
                post.status === 'sold' ? styles.statusSold : styles.statusSelling
              }`}
            >
              {gomsolMarketApi.statusLabel[post.status]}
            </span>
            <span className={styles.categoryBadge}>
              {gomsolMarketApi.categoryLabel[post.category] || gomsolMarketApi.categoryLabel.etc}
            </span>
            {isAdmin || isOwner ? (
              <span
                className={`${styles.approvalBadge} ${
                  post.approvalStatus === 'approved' ? styles.approvalApproved : styles.approvalPending
                }`}
              >
                <ShieldCheck size={12} />
                {gomsolMarketApi.approvalLabel[post.approvalStatus]}
              </span>
            ) : null}
          </div>

          <h1 className={styles.detailTitle}>{post.title}</h1>
          <p className={styles.price}>{formatPrice(post.price)}</p>
          <p className={styles.detailBody}>{post.description}</p>

          <div className={styles.detailMeta}>
            <span className={styles.detailMetaRow}>
              <RoleName nickname={post.author?.name} role={post.author?.role} size="sm" />
            </span>
            <span className={styles.detailMetaRow}>
              <CalendarDays size={14} />
              등록일 {formatDateTime(post.createdAt)}
            </span>
            <span className={styles.detailMetaRow}>
              <Store size={14} />
              수정일 {formatDateTime(post.updatedAt)}
            </span>
            <span className={styles.detailMetaRow}>
              <Eye size={14} />
              조회 {post.views || 0}
            </span>
          </div>

          <section className={styles.asideCard}>
            <h2 className={styles.asideTitle}>
              <UserRound size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              연락 방법
            </h2>
            {contactItems.length ? (
              <ul className={styles.contactList}>
                {contactItems.map((item) => (
                  <li key={`${item.label}-${item.value}`} className={styles.contactItem}>
                    <span className={styles.contactLabel}>{item.label}</span>
                    <span className={styles.contactValue}>
                      {item.type === 'link' && item.safeHref ? (
                        <a href={item.safeHref} target="_blank" rel="noopener noreferrer">
                          {item.value}
                        </a>
                      ) : (
                        item.value
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.detailMetaRow}>등록된 연락 방법이 없습니다.</p>
            )}
          </section>
        </section>

        <aside className={styles.detailAside}>
          <section className={styles.detailGallery}>
            {coverImage ? (
              <img className={styles.heroImage} src={coverImage.url} alt={`${post.title} 대표 이미지`} />
            ) : (
              <div className={styles.placeholder}>등록된 이미지가 없습니다.</div>
            )}
            {post.images?.length > 1 ? (
              <div className={styles.thumbRow}>
                {post.images.map((image, index) => (
                  <button
                    type="button"
                    key={image.id}
                    className={`${styles.thumbButton} ${index === activeImageIndex ? styles.thumbActive : ''}`}
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`${index + 1}번째 이미지 보기`}
                  >
                    <img src={image.url} alt={`${post.title} 썸네일 ${index + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className={styles.asideCard}>
            <h2 className={styles.asideTitle}>관리 액션</h2>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={toggleApproval}>
                {post.approvalStatus === 'approved' ? '승인 해제' : '승인'}
              </button>
            ) : (
              <p className={styles.detailMetaRow}>승인 관리는 관리자만 가능합니다.</p>
            )}

            {canManageSaleStatus ? (
              <div className={styles.statusActionRow}>
                <button
                  type="button"
                  className={`${styles.statusAction} ${
                    post.status === 'selling' ? styles.statusActionActive : ''
                  }`}
                  disabled={actionLoading}
                  onClick={() => updateSaleStatus('selling')}
                >
                  판매 중
                </button>
                <button
                  type="button"
                  className={`${styles.statusAction} ${
                    post.status === 'sold' ? styles.statusActionActive : ''
                  }`}
                  disabled={actionLoading}
                  onClick={() => updateSaleStatus('sold')}
                >
                  판매 완료
                </button>
              </div>
            ) : (
              <p className={styles.detailMetaRow}>판매 상태는 작성자 또는 관리자만 변경할 수 있습니다.</p>
            )}
            {error ? <p className={styles.errorText}>{error}</p> : null}
          </section>

          <Link className="btn btn-secondary" to="/community/gomsol-market">
            목록으로
          </Link>
        </aside>
      </div>
    </div>
  );
}


