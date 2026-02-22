import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { petitionApi, THRESHOLD_DEFAULT } from '../../api/petition';
import { useAuth } from '../../context/AuthContext';
import '../page-shell.css';
import styles from '../../components/petition/petition.module.css';

const CATEGORY_OPTIONS = [
  '기타',
  '회장단',
  '3학년부',
  '2학년부',
  '정보기술부',
  '방송부',
  '학예부',
  '체육부',
  '진로부',
  '홍보부',
  '기후환경부',
  '학생지원부',
  '생활안전부',
  '융합인재부',
];

export default function PetitionComposeView() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('기타');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !body.trim()) {
      setError('제목, 요약, 본문을 모두 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await petitionApi.create({
        title: title.trim(),
        category,
        summary: summary.trim(),
        body: body.trim(),
        threshold: THRESHOLD_DEFAULT,
      });
      navigate(`/community/petition/${res.id}`, { replace: true, state: { from: '/community/petition' } });
    } catch {
      setError('청원 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className={styles.error}>
          청원을 작성하려면 로그인해주세요.
          <div style={{ marginTop: 12 }}>
            <Link to="/login" state={{ from: location.pathname }} className="btn btn-primary">
              로그인으로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">소통하는 범서고</p>
          <h1>청원 작성</h1>
          <p className="lede">추천 {THRESHOLD_DEFAULT}표를 달성하면 학생회가 답변합니다. 등록한 글은 관리자 승인 후 일반 사용자에게 공개됩니다.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.group}>
          <label className={styles.label}>제목</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="예) 자습실 콘센트 추가 요청"
            required
          />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>카테고리</label>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.group}>
          <label className={styles.label}>요약 (200자)</label>
          <textarea
            className={styles.textarea}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="요약을 입력해주세요."
            required
          />
          <div className={styles.hint}>{summary.length}/200</div>
        </div>

        <div className={styles.group}>
          <label className={styles.label}>본문</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="상세 내용을 적어주세요. 모든 글은 학생회 승인 후에 게시됩니다. 모든 작성자는 본인이 작성한 의견에 대해 법적 책임을 갖는다는 점 유의하시기 바랍니다."
            required
          />
        </div>

        <div className={styles.group}>
          <span className={styles.pill}>답변 임계치: {THRESHOLD_DEFAULT} 추천</span>
          <div className={styles.hint}>임계치는 학생회 운영 정책에 따라 고정됩니다.</div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.formActions}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
