/**
 * @file src/pages/LostFound/LostFoundDetailView.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../api/lostFound
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Eye, MapPin, PackageCheck } from 'lucide-react';
import { lostFoundApi } from '../../api/lostFound';
import { useAuth } from '../../context/AuthContext';
import RoleName from '../../components/RoleName/RoleName';
import LostFoundCommentsPanel from '../../components/lostfound/LostFoundCommentsPanel';
import styles from '../../components/lostfound/lostfound.module.css';
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

/**
 * LostFoundDetailView module entry point.
 */
export default function LostFoundDetailView() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const canManageStatus = lostFoundApi.canWrite(user);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [changingStatus, setChangingStatus] = useState(false);

  const coverImage = useMemo(() => item?.images?.[activeImageIndex] || item?.images?.[0], [item, activeImageIndex]);
  const statusClass = item?.status === 'found' ? styles.statusFound : styles.statusSearching;

  useEffect(() => {
    let cancelled = false;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await lostFoundApi.detail(id);
        if (cancelled) return;
        setItem(res);
        setActiveImageIndex(0);
      } catch {
        if (cancelled) return;
        setError('분실물 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStatusChange = async (nextStatus) => {
    if (!item || !canManageStatus || changingStatus) return;
    if (item.status === nextStatus) return;
    setChangingStatus(true);
    try {
      const updated = await lostFoundApi.updateStatus(item.id, nextStatus);
      setItem(updated);
    } catch {
      setError('상태 변경에 실패했습니다.');
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>분실물 정보를 불러오는 중입니다.</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-shell">
        <div className={styles.empty}>
          <p>{error || '존재하지 않는 게시글입니다.'}</p>
          <Link className="btn btn-secondary" to="/community/lost-found">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={styles.detailWrap}>
        <div className={styles.detailMain}>
          <div className={styles.cardBadgeRow} style={{ position: 'static' }}>
            <span className={`${styles.statusBadge} ${statusClass}`}>{lostFoundApi.statusLabel[item.status]}</span>
            <span className={styles.categoryBadge}>{lostFoundApi.categoryLabel[item.category]}</span>
          </div>

          <h1 className={styles.detailTitle}>{item.title}</h1>
          <div className={styles.detailMeta}>
            <span className={styles.detailMetaRow}>
              <RoleName nickname={item.author?.name || '운영진'} role={item.author?.role || 'student_council'} size="sm" />
            </span>
            <span className={styles.detailMetaRow}>
              <CalendarDays size={14} />
              등록일 {formatDateTime(item.createdAt)}
            </span>
            <span className={styles.detailMetaRow}>
              <Eye size={14} />
              조회 {item.views || 0}
            </span>
          </div>

          <p className={styles.detailBody}>{item.description}</p>

          <div className={styles.detailMeta}>
            <span className={styles.detailMetaRow}>
              <CalendarDays size={14} />
              습득일 {formatDateTime(item.foundAt)}
            </span>
            <span className={styles.detailMetaRow}>
              <MapPin size={14} />
              습득장소 {item.foundLocation}
            </span>
            <span className={styles.detailMetaRow}>
              <PackageCheck size={14} />
              보관장소 {item.storageLocation}
            </span>
          </div>

          <LostFoundCommentsPanel itemId={item.id} currentUser={user} isAuthenticated={isAuthenticated} />
        </div>

        <aside className={styles.detailAside}>
          <section className={styles.detailGallery}>
            {coverImage ? (
              <img className={styles.heroImage} src={coverImage.url} alt={`${item.title} 대표 사진`} />
            ) : (
              <div className={styles.placeholder}>등록된 사진이 없습니다.</div>
            )}

            {item.images?.length > 1 ? (
              <div className={styles.thumbRow}>
                {item.images.map((image, index) => (
                  <button
                    type="button"
                    key={image.id}
                    className={`${styles.thumbButton} ${index === activeImageIndex ? styles.thumbActive : ''}`}
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`${index + 1}번째 사진 보기`}
                  >
                    <img src={image.url} alt={`${item.title} 썸네일 ${index + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className={styles.asideCard}>
            <h2 className={styles.asideTitle}>상태 관리</h2>
            {canManageStatus ? (
              <div className={styles.statusActionRow}>
                <button
                  type="button"
                  className={`${styles.statusAction} ${item.status === 'searching' ? styles.statusActionActive : ''}`}
                  onClick={() => handleStatusChange('searching')}
                  disabled={changingStatus}
                >
                  주인 찾는 중
                </button>
                <button
                  type="button"
                  className={`${styles.statusAction} ${item.status === 'found' ? styles.statusActionActive : ''}`}
                  onClick={() => handleStatusChange('found')}
                  disabled={changingStatus}
                >
                  주인 찾음
                </button>
              </div>
            ) : (
              <p className={styles.commentLocked}>상태 변경은 관리자 또는 학생회만 가능합니다.</p>
            )}
            {error ? <p className={styles.errorText}>{error}</p> : null}
          </section>

          <Link className="btn btn-secondary" to="/community/lost-found">
            목록으로
          </Link>
        </aside>
      </div>
    </div>
  );
}


