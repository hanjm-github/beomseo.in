import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Share2, ThumbsUp } from 'lucide-react';
import { petitionApi, THRESHOLD_DEFAULT } from '../../api/petition';
import { useAuth } from '../../context/AuthContext';
import RoleName from '../../components/RoleName/RoleName';
import styles from '../../components/petition/petition.module.css';
import '../page-shell.css';

const statusLabel = {
  'needs-support': '추천 필요',
  'waiting-answer': '답변 대기',
  answered: '답변 완료',
  pending: '승인 대기',
  rejected: '반려',
};

const statusClassName = (status) => {
  switch (status) {
    case 'waiting-answer':
      return `${styles.status} ${styles.waiting}`;
    case 'answered':
      return `${styles.status} ${styles.answered}`;
    case 'pending':
      return `${styles.status} ${styles.pending}`;
    case 'rejected':
      return `${styles.status} ${styles.pending}`;
    default:
      return `${styles.status} ${styles.needs}`;
  }
};

const deriveStatus = (item, threshold) => {
  if (!item) return 'needs-support';
  if (item.status && item.status !== 'approved') return item.status === 'rejected' ? 'rejected' : 'pending';
  if (item.answer) return 'answered';
  const votes = item.votes || 0;
  const th = threshold || THRESHOLD_DEFAULT;
  if (votes >= th) return 'waiting-answer';
  return 'needs-support';
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function PetitionDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voting, setVoting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [copied, setCopied] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await petitionApi.detail(id);
        if (cancelled) return;
        setItem(res);
      } catch (err) {
        if (cancelled) return;
        setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleVote = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/community/petition/${id}` } });
      return;
    }
    if (!item || voting) return;
    setVoting(true);
    try {
      const action = item.isVotedByMe ? 'cancel' : 'up';
      const res = await petitionApi.vote(item.id, action);
      setItem((prev) =>
        prev
          ? { ...prev, votes: res.votes, isVotedByMe: res.isVotedByMe, statusDerived: res.status }
          : prev
      );
    } finally {
      setVoting(false);
    }
  };

  const threshold = item?.threshold || THRESHOLD_DEFAULT;
  const pct = item ? Math.min(100, Math.round(((item.votes || 0) / threshold) * 100)) : 0;
  const derivedStatus = deriveStatus(item, threshold);

  const handleApprove = async () => {
    if (!item) return;
    setActionLoading(true);
    try {
      const res = await petitionApi.approve(item.id);
      setItem(res);
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnapprove = async () => {
    if (!item) return;
    setActionLoading(true);
    try {
      const res = await petitionApi.unapprove(item.id);
      setItem(res);
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAnswer = async () => {
    if (!item || !answerText.trim()) return;
    setActionLoading(true);
    try {
      const res = await petitionApi.answer(item.id, { content: answerText.trim() });
      setItem(res);
      setAnswerText('');
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page-shell">
      <button
        className="btn btn-secondary"
        onClick={() => navigate(location.state?.from || '/community/petition')}
        style={{ width: 'fit-content' }}
      >
        <ArrowLeft size={16} />
        뒤로
      </button>

      {loading ? (
        <div className={styles.skeleton} style={{ height: 240 }} />
      ) : error ? (
        <div className={styles.error}>청원을 불러오지 못했습니다.</div>
      ) : item ? (
        <div className={styles.detailShell}>
          <div className={styles.detailHeader}>
            <div className={styles.badgeRow}>
              <span className={statusClassName(derivedStatus)}>{statusLabel[derivedStatus]}</span>
              <span className={styles.voteBadge}>
                <ThumbsUp size={14} />
                {item.votes}/{threshold} 추천
              </span>
              {isAdmin ? (
                <span className={styles.voteBadge}>관리자 기능</span>
              ) : null}
            </div>
            <h1 className={styles.detailTitle}>{item.title}</h1>
            <div className={styles.detailMeta}>
              <span>
                <BookOpen size={14} style={{ verticalAlign: 'text-bottom' }} /> {item.category || '기타'}
              </span>
              <span>
                <Clock3 size={14} style={{ verticalAlign: 'text-bottom' }} /> {formatDate(item.createdAt)}
              </span>
              <span>
                <RoleName nickname={item.author?.nickname || '익명'} role={item.author?.role || 'student'} size="sm" />
              </span>
            </div>
            <div className={styles.detailActions}>
              <button
                type="button"
                className={`${styles.voteBtn} ${item.isVotedByMe ? styles.voteActive : ''}`}
                onClick={handleVote}
                disabled={voting}
              >
                <ThumbsUp size={16} />
                {item.isVotedByMe ? '추천 취소' : '추천하기'}
              </button>
              {isAdmin ? (
                <div className={styles.detailActions} style={{ gap: '8px', flexWrap: 'wrap' }}>
                  <span className={styles.pill}>현재 상태: {item.status}</span>
                  {item.status === 'approved' ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleUnapprove}
                      disabled={actionLoading}
                    >
                      승인 해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleApprove}
                      disabled={actionLoading}
                    >
                      승인하기
                    </button>
                  )}
                </div>
              ) : null}
              <div className={styles.progressRow} style={{ flex: 1 }}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.metaItem}>{pct}%</span>
              </div>
              <button type="button" className={styles.chip} onClick={handleCopy}>
                <Share2 size={16} />
                {copied ? '복사됨!' : '링크 복사'}
              </button>
              {copied ? <span className={styles.hint} aria-live="polite">링크를 복사했습니다.</span> : null}
            </div>
          </div>

          <div className={styles.detailBody}>
            <p className={styles.hint}>요약</p>
            <p>{item.summary}</p>
            <div className={styles.divider} />
            <p className={styles.hint}>본문</p>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{item.body || item.summary}</div>
          </div>

          <div className={styles.detailBody}>
            <p className={styles.hint}>추천 현황</p>
            <div className={styles.progressRow}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.metaItem}>
                {item.votes}/{threshold} ( {pct}% )
              </span>
            </div>
          </div>

          {item.answer ? (
            <div className={styles.answerCard}>
              <div className={styles.answerTitle}>
                <CheckCircle2 size={18} color="#2a3f9c" />
                학생회장 답변
              </div>
              <p className={styles.hint}>
                {item.answer.responder} · {formatDate(item.answer.updatedAt)}
              </p>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.answer.content}</div>
            </div>
          ) : isAdmin ? (
            <div className={styles.answerCard}>
              <div className={styles.answerTitle}>
                <CheckCircle2 size={18} color="#2a3f9c" />
                답변 작성 (관리자)
              </div>
              <textarea
                className={styles.textarea}
                placeholder="답변 내용을 입력하세요."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
              <div className={styles.formActions}>
                <button className="btn btn-primary" type="button" onClick={handleSaveAnswer} disabled={actionLoading}>
                  답변 등록
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.answerCard} style={{ background: '#f8fafc' }}>
              답변을 준비 중입니다. 추천 {THRESHOLD_DEFAULT}표 이상 시 학생회가 확인합니다.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
