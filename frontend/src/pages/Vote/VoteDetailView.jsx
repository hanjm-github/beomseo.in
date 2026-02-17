import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock, Vote as VoteIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { voteApi } from '../../api/vote';
import VoteResultsDonut from '../../components/vote/VoteResultsDonut';
import RoleName from '../../components/RoleName/RoleName';
import styles from '../../components/vote/vote.module.css';
import '../page-shell.css';

const formatDateTime = (iso) => {
  if (!iso) return '마감 없음';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '마감 없음';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function VoteDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let cancelled = false;
    voteApi
      .detail(id)
      .then((res) => {
        if (cancelled) return;
        setPost(res);
      })
      .catch(() => {
        if (!cancelled) setError('투표 글을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const canVote = useMemo(() => {
    if (!post) return false;
    return Boolean(user) && post.status === 'open' && !post.myVoteOptionId;
  }, [post, user]);

  const handleVote = async (optionId) => {
    if (!post) return;
    if (!user) {
      navigate('/login', { state: { from: `/community/vote/${id}` } });
      return;
    }
    if (!canVote || voting) return;

    setVoting(true);
    setError('');
    setFeedback('');
    try {
      const res = await voteApi.vote(post.id, optionId);
      setPost(res.poll);
      if (res.creditsEarned > 0) {
        setFeedback(`투표가 반영되었습니다. 설문 품앗이 응답권 +${res.creditsEarned} 적립`);
      } else {
        setFeedback('투표가 반영되었습니다.');
      }
    } catch (err) {
      setError(err?.message || '투표 처리에 실패했습니다.');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Loader2 size={18} className="spin" />
        불러오는 중…
      </div>
    );
  }

  if (!post) {
    return (
      <div className="page-shell">
        <div className={styles.empty}>
          <p>{error || '존재하지 않는 투표입니다.'}</p>
          <Link className="btn btn-secondary" to="/community/vote">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={styles.detailShell}>
        <div className={styles.detailHeader}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className={`${styles.statusBadge} ${post.status === 'open' ? styles.statusOpen : styles.statusClosed}`}>
              {post.status === 'open' ? '진행중' : '마감'}
            </span>
          </div>
          <h1>{post.title}</h1>
          <p className="lede">{post.description || '설명 없음'}</p>
          <div className={styles.detailMeta}>
            <RoleName nickname={post.author?.name} role={post.author?.role} size="sm" />
            <span>•</span>
            <span>생성 {formatDateTime(post.createdAt)}</span>
            <span>•</span>
            <span>마감 {formatDateTime(post.closesAt)}</span>
            <span>•</span>
            <span>총 {post.totalVotes}명 참여</span>
          </div>
          {feedback ? (
            <div className={styles.feedback}>
              <CheckCircle2 size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {feedback}
            </div>
          ) : null}
          {error ? <div className={styles.errorText}>{error}</div> : null}
        </div>

        <div className={styles.detailGrid}>
          <section className={styles.detailPanel}>
            <h3>투표 결과</h3>
            <VoteResultsDonut options={post.options} totalVotes={post.totalVotes} />
          </section>

          <section className={styles.detailPanel}>
            <h3>선택지</h3>
            {!user && post.status === 'open' ? (
              <div className={styles.loginPrompt}>
                투표에 참여하려면 로그인하세요. 결과는 비로그인 상태에서도 확인할 수 있습니다.
              </div>
            ) : null}
            {user && post.myVoteOptionId ? (
              <div className={styles.loginPrompt}>
                <Lock size={14} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                이미 투표에 참여했습니다. 선택 변경은 불가능합니다.
              </div>
            ) : null}
            <div className={styles.optionList}>
              {post.options.map((option) => {
                const isSelected = post.myVoteOptionId === option.id;
                const disabled = voting || post.status !== 'open' || Boolean(post.myVoteOptionId);
                return (
                  <div className={styles.optionItem} key={option.id}>
                    <button
                      type="button"
                      className={`${styles.optionButton} ${disabled ? styles.optionButtonDisabled : ''} ${isSelected ? styles.optionSelected : ''}`}
                      onClick={() => handleVote(option.id)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                    >
                      <span>{option.text}</span>
                      <span>{isSelected ? '내 선택' : !user && post.status === 'open' ? '로그인 후 투표' : '투표'}</span>
                    </button>
                    <div className={styles.optionStats}>
                      <span>{option.votes}표</span>
                      <span>{option.pct}%</span>
                    </div>
                    <div className={styles.optionBarTrack} aria-hidden="true">
                      <div className={styles.optionBarFill} style={{ width: `${option.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-secondary" to="/community/vote">
          목록으로
        </Link>
        <Link className="btn btn-ghost" to="/community/survey">
          <VoteIcon size={16} />
          설문 품앗이로 이동
        </Link>
      </div>
    </div>
  );
}
