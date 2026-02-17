import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { voteApi } from '../../api/vote';
import VoteOptionEditor from '../../components/vote/VoteOptionEditor';
import styles from '../../components/vote/vote.module.css';
import '../page-shell.css';

function normalizeOptions(options) {
  return options
    .map((option) => ({
      ...option,
      text: option.text.trim(),
    }))
    .filter((option) => Boolean(option.text));
}

export default function VoteComposeView() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const canWrite = voteApi.canWrite(user);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [options, setOptions] = useState([
    { id: 'opt-1', text: '' },
    { id: 'opt-2', text: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const optionCount = useMemo(() => normalizeOptions(options).length, [options]);

  const validate = () => {
    if (!title.trim()) return '제목은 필수입니다.';
    const cleaned = normalizeOptions(options);
    if (cleaned.length < 2) return '선택지는 최소 2개 이상 입력해야 합니다.';
    if (cleaned.length > 8) return '선택지는 최대 8개까지 가능합니다.';
    const seen = new Set();
    for (const option of cleaned) {
      const key = option.text.toLowerCase();
      if (seen.has(key)) return '동일한 선택지를 중복해서 입력할 수 없습니다.';
      seen.add(key);
    }
    if (closesAt) {
      const t = new Date(closesAt).getTime();
      if (!Number.isFinite(t)) return '마감일시 형식이 올바르지 않습니다.';
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canWrite || submitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const cleaned = normalizeOptions(options);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        options: cleaned.map((option, index) => ({
          id: option.id || `opt-${index + 1}`,
          text: option.text,
        })),
        author: {
          id: user?.id ?? 'me',
          name: user?.nickname ?? '학생회',
          role: user?.role ?? 'student_council',
        },
      };
      const created = await voteApi.create(payload);
      navigate(`/community/vote/${created.id}`, { replace: true });
    } catch {
      setError('투표 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="page-shell">
        <div className={styles.permissionCard}>
          <p className="eyebrow">실시간 투표 작성 권한</p>
          <h1>투표 생성 권한이 없습니다.</h1>
          <p className="lede">실시간 투표 작성은 학생회 또는 관리자 계정만 가능합니다.</p>
          <div className={styles.permissionActions}>
            <Link className="btn btn-secondary" to="/community/vote">
              <ArrowLeft size={16} />
              목록으로
            </Link>
            {!isAuthenticated ? (
              <Link className="btn btn-primary" to="/login" state={{ from: '/community/vote/new' }}>
                로그인
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className={styles.pageHeader}>
        <div>
          <p className="eyebrow">실시간 투표</p>
          <h1>새 투표 만들기</h1>
          <p className="lede">다지선다형 문항을 만들고, 학생들의 의견을 바로 확인하세요.</p>
        </div>
      </div>

      <form className={styles.composeShell} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="vote-title">제목 *</label>
          <input
            id="vote-title"
            className={styles.textInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 현재 학생회 운영 만족도"
            maxLength={120}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="vote-description">설명</label>
          <textarea
            id="vote-description"
            className={styles.textArea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="투표 목적이나 안내를 입력하세요."
            maxLength={1000}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="vote-closes-at">마감일시 (선택)</label>
          <input
            id="vote-closes-at"
            className={styles.datetimeInput}
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>선택지 * ({optionCount}개 입력됨)</label>
          <VoteOptionEditor options={options} onChange={setOptions} />
        </div>

        {error ? <div className={styles.errorText}>{error}</div> : null}

        <div className={styles.composeActions}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <Loader2 size={16} className="spin" /> : null}
            {submitting ? '생성 중…' : '투표 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}

