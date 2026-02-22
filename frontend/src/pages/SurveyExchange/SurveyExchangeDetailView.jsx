import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Loader2, PieChart, Send, CheckCircle2, XCircle } from 'lucide-react';
import styles from '../../components/survey/survey.module.css';
import { surveyApi } from '../../api/survey';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';

const loadSurveyResponseModal = () => import('../../components/survey/SurveyResponseModal');
const SurveyResponseModal = lazy(loadSurveyResponseModal);

export default function SurveyExchangeDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwner = survey && user && (user.role === 'admin' || survey.owner?.id === user.id);
  const isAdmin = user?.role === 'admin';
  const canSeeApprovalStatus =
    Boolean(isAdmin) || Boolean(survey && user && survey.owner?.id && String(survey.owner.id) === String(user.id));
  const alreadyAnswered = survey?.isAnsweredByMe;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    surveyApi
      .detail(id)
      .then((res) => {
        if (!cancelled) {
          setSurvey(res);
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

  const ensureLogin = () => {
    if (!user) {
      navigate('/login', { state: { from: `/community/survey/${id}` } });
      return false;
    }
    return true;
  };

  const prefetchResponseModal = () => {
    void loadSurveyResponseModal();
  };

  const handleSubmit = async (answers) => {
    if (!ensureLogin()) return;
    setSubmitting(true);
    try {
      await surveyApi.submitResponse(id, answers);
      const res = await surveyApi.detail(id);
      setSurvey(res);
      alert('응답이 기록됐어요. +5 응답권이 적립됩니다.');
      setModalOpen(false);
    } catch {
      alert('응답을 제출하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    try {
      const res = await surveyApi.approve(id);
      setSurvey(res);
    } catch {
      alert('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleUnapprove = async () => {
    try {
      const res = await surveyApi.unapprove(id);
      setSurvey(res);
    } catch {
      alert('승인 해제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="page-shell u-flex-center-gap-2">
        <Loader2 className="spin" size={18} /> 불러오는 중…
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="page-shell">
        <p>설문을 불러올 수 없습니다.</p>
      </div>
    );
  }

  const remaining = Math.max(0, (survey.responseQuota || 0) - (survey.responsesReceived || 0));

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">설문 상세</p>
          <h1>{survey.title}</h1>
          <p className="lede">{survey.description}</p>
          <div className={styles.badgeRow}>
            {survey.status === 'closed' ? <span className={styles.chip}>마감</span> : null}
            {canSeeApprovalStatus && survey.approvalStatus ? (
              <span className={`${styles.chip} ${survey.approvalStatus === 'approved' ? styles.chipActive : ''}`}>
                {survey.approvalStatus === 'approved' ? '승인됨' : '승인대기'}
              </span>
            ) : null}
          </div>
        </div>
        <div className="u-flex-gap-2">
          {isOwner ? (
            <Link className="btn btn-secondary" to={`/community/survey/${id}/results`}>
              <PieChart size={16} /> 결과 보기
            </Link>
          ) : null}
          {isAdmin ? (
            survey.approvalStatus === 'approved' ? (
              <button className="btn btn-ghost" type="button" onClick={handleUnapprove} disabled={submitting}>
                <XCircle size={16} /> 승인 해제
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={handleApprove} disabled={submitting}>
                <CheckCircle2 size={16} /> 승인
              </button>
            )
          ) : null}
          <button
            className="btn btn-primary"
            onClick={() => (ensureLogin() && !alreadyAnswered ? setModalOpen(true) : null)}
            onMouseEnter={prefetchResponseModal}
            onFocus={prefetchResponseModal}
            disabled={survey.status === 'closed' || alreadyAnswered}
            title={alreadyAnswered ? '이미 응답한 설문입니다.' : undefined}
          >
            <Send size={16} />
            {survey.status === 'closed'
              ? '마감됨'
              : alreadyAnswered
              ? '이미 응답함'
              : '응답하기'}
          </button>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <h2>응답 현황</h2>
          <p>현재 {survey.responsesReceived}명 응답 · 잔여 {remaining} · 목표 {survey.responseQuota}</p>
        </div>
        <div className={`${styles.badgeRow} u-flex-end-start`}>
          {survey.expiresAt ? (
            <span className={`${styles.chip} u-inline-flex-center-gap-2`}>
              <Calendar size={14} /> 마감 {new Date(survey.expiresAt).toLocaleDateString()}
            </span>
          ) : (
            <span className={styles.chip}>상시 응답</span>
          )}
        </div>
      </div>

      <section className="u-mt-4">
        <h3>설문 안내</h3>
        <ul className="u-text-muted">
          <li>설문은 관리자 승인 후 응답권 30개가 부여됩니다.</li>
          <li>응답하면 내 설문 응답권 +5</li>
          <li>작성자/관리자는 결과 페이지에서 개별/그래프/다운로드 확인</li>
          <li>응답권이 0이 되거나 마감일이 지나면 자동으로 마감됩니다.</li>
        </ul>
      </section>

      {modalOpen ? (
        <Suspense fallback={<div className="route-fallback">응답 폼을 불러오는 중...</div>}>
          <SurveyResponseModal
            survey={survey}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
