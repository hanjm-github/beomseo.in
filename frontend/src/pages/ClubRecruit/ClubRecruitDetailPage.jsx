/**
 * @file src/pages/ClubRecruit/ClubRecruitDetailPage.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - ../../api/clubRecruit
 * - ../../components/clubRecruit/RecruitCard
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { clubRecruitApi } from '../../api/clubRecruit';
import RecruitCard from '../../components/clubRecruit/RecruitCard';
import InfiniteLoader from '../../components/clubRecruit/InfiniteLoader';
import ErrorState from '../../components/clubRecruit/ErrorState';
import SafeHtml from '../../components/security/SafeHtml';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';

/**
 * ClubRecruitDetailPage module entry point.
 */
export default function ClubRecruitDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    clubRecruitApi
      .get(id)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page-shell">
        <InfiniteLoader message="상세 정보를 불러오는 중..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-shell">
        <ErrorState message="상세 정보를 불러올 수 없어요." />
      </div>
    );
  }

  const applyPeriod = data.applyPeriod || {};
  const applyLabel = applyPeriod.end
    ? `${applyPeriod.start} ~ ${applyPeriod.end}`
    : applyPeriod.start
      ? `${applyPeriod.start} ~ 모집 기간 미정`
      : '모집 기간 미정';
  const isAdmin = user?.role === 'admin';
  const isOwner = Boolean(user?.id && data?.author?.id && String(user.id) === String(data.author.id));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">동아리 모집</p>
          <h1>{data.clubName}</h1>
          <p className="lede">모집 기간: {applyLabel}</p>
        </div>
        {isAdmin || isOwner ? (
          <div className="header-actions" style={{ gap: '8px' }}>
            <span className="chip">
              상태: {data.status === 'approved' ? '승인됨' : '승인 대기'}
            </span>
            {isAdmin ? (
              data.status === 'approved' ? (
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const res = await clubRecruitApi.unapprove(id);
                      setData(res);
                    } catch {
                      setError('승인 해제 중 오류가 발생했습니다.');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  승인 해제
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const res = await clubRecruitApi.approve(id);
                      setData(res);
                    } catch {
                      setError('승인 중 오류가 발생했습니다.');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  승인하기
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      <RecruitCard item={data} />

      <div className="card surface">
        <div className="muted" style={{ marginBottom: '8px' }}>
          모집 기간: {applyLabel}
        </div>
        {data.extraNote ? <p style={{ fontWeight: 600 }}>{data.extraNote}</p> : null}
        {data.body ? (
          <SafeHtml html={data.body} />
        ) : (
          <p className="muted">본문이 없습니다.</p>
        )}
      </div>

    </div>
  );
}


