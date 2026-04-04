/**
 * @file src/pages/Community/ValuePick/ValuePickComposeView.jsx
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import Editor from '../../../components/notices/NoticeCenter/Editor';
import { valuePickApi } from '../../../api/valuePick';
import { sanitizeRichHtml, toPlainText } from '../../../security/htmlSanitizer';
import { useAuth } from '../../../context/AuthContext';
import '../../page-shell.css';
import styles from '../../../components/Community/ValuePick/valuepick.module.css';

function hasMeaningfulBody(html) {
  if (!html) return false;
  return Boolean(toPlainText(html)) || /<img\b/i.test(html);
}

export default function ValuePickComposeView({ mode = 'create' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const isEdit = mode === 'edit';

  const [competency, setCompetency] = useState('');
  const [pledge, setPledge] = useState('');
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editAccessChecked, setEditAccessChecked] = useState(!isEdit);
  const [hasEditAccess, setHasEditAccess] = useState(!isEdit);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isEdit || !id) return;

    let cancelled = false;
    setEditAccessChecked(false);
    setHasEditAccess(false);
    setError('');

    valuePickApi
      .get(id)
      .then((response) => {
        if (cancelled) return;

        const isAdmin = user?.role === 'admin';
        const isOwner =
          user?.id != null &&
          response?.author?.id != null &&
          Number(user.id) === Number(response.author.id);

        if (!isAdmin && !isOwner) {
          setHasEditAccess(false);
          setEditAccessChecked(true);
          setError('수정 권한이 없습니다.');
          return;
        }

        setHasEditAccess(true);
        setCompetency(response.competency || '');
        setPledge(response.pledge || '');
        setBody(response.body || '');
        setEditAccessChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHasEditAccess(false);
        setEditAccessChecked(true);
        setError('게시글을 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isEdit, id, user?.id, user?.role]);

  const handleUploadImage = async (file) => {
    setUploading(true);
    try {
      return await valuePickApi.upload(file);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isEdit && !hasEditAccess) return;
    if (submitting || uploading) return;

    const trimmedCompetency = competency.trim();
    const trimmedPledge = pledge.trim();

    if (!trimmedCompetency) {
      setError('인성 역량을 입력해주세요.');
      return;
    }

    if (!trimmedPledge) {
      setError('나만의 다짐 한 줄을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const safeBody = sanitizeRichHtml(body);
      const payload = {
        competency: trimmedCompetency,
        pledge: trimmedPledge,
        body: hasMeaningfulBody(safeBody) ? safeBody : undefined,
      };

      const response = isEdit ? await valuePickApi.update(id, payload) : await valuePickApi.create(payload);
      navigate(`/community/value-pick/${response.id}`);
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isEdit && !hasEditAccess) return;
    if (!window.confirm('이 다짐을 삭제하시겠습니까?')) return;

    try {
      await valuePickApi.remove(id);
      navigate('/community/value-pick');
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  if (authLoading) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>권한 정보를 확인하는 중입니다...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className="card">
          <p className="eyebrow">인성 가치 PICK! 작성 권한</p>
          <h1>로그인이 필요합니다.</h1>
          <p className="lede">다짐 작성과 수정은 로그인한 사용자만 가능합니다.</p>
          <div className="u-action-stack">
            <Link className="btn btn-secondary" to="/community/value-pick">
              목록으로
            </Link>
            <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && !editAccessChecked) {
    return (
      <div className="page-shell">
        <div className={styles.placeholder}>수정 권한을 확인하는 중입니다...</div>
      </div>
    );
  }

  if (isEdit && !hasEditAccess) {
    return (
      <div className="page-shell">
        <div className="card">
          <p className="eyebrow">인성 가치 PICK! 수정 권한</p>
          <h1>권한이 없습니다.</h1>
          <p className="lede">{error || '해당 글은 작성자 또는 관리자만 수정할 수 있습니다.'}</p>
          <div className="u-action-stack">
            <Link className="btn btn-secondary" to={`/community/value-pick/${id}`}>
              상세로
            </Link>
            <Link className="btn btn-secondary" to="/community/value-pick">
              목록으로
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
          <p className="eyebrow">인성 가치 PICK!</p>
          <h1>{isEdit ? '다짐 수정' : '다짐 작성'}</h1>
          <p className="lede">
            올해 실천하고 싶은 인성 가치를 고르고, 나만의 다짐 한 줄로 실천 의지를 분명하게 남겨보세요.
          </p>
        </div>
      </div>

      <form className={styles.composeShell} onSubmit={handleSubmit}>
        <section className={styles.composeIntro}>
          <h2 className={styles.composeIntroTitle}>작은 실천이 큰 변화를 만듭니다.</h2>
          <p className={styles.composeIntroText}>
            사업 계획서에 따라 학생이 스스로 필요한 인성 역량을 정하고, 어떻게 실천할지 한 줄로 기록하는
            게시판입니다. 작성된 다짐은 학생회가 시각화 자료로 소개할 수 있습니다.
          </p>
        </section>

        <section className={styles.infoCard}>
          <p className={styles.fieldHint}>예시 인성 역량</p>
          <ul className={styles.infoList}>
            <li>정직, 성실, 배려, 존중, 책임, 협력, 경청</li>
            <li>한 줄 다짐은 “어떻게 실천할지”가 드러나게 적으면 더 좋아요.</li>
          </ul>
        </section>

        <div className={styles.formGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor="competency">
              인성 역량
            </label>
          </div>
          <input
            id="competency"
            className={styles.input}
            value={competency}
            onChange={(event) => setCompetency(event.target.value)}
            placeholder="예: 정직, 성실, 배려, 존중"
            maxLength={50}
            required
          />
          <p className={styles.fieldHint}>1년 동안 가장 실천해 보고 싶은 가치를 자유롭게 적어주세요.</p>
        </div>

        <div className={styles.formGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor="pledge">
              나만의 다짐 한 줄
            </label>
          </div>
          <textarea
            id="pledge"
            className={styles.textarea}
            value={pledge}
            onChange={(event) => setPledge(event.target.value)}
            placeholder="예: 하루에 한 번 먼저 인사하고, 작은 약속도 꼭 지키겠습니다."
            maxLength={180}
            required
          />
          <p className={styles.fieldHint}>내가 이 가치를 어떻게 실천할지 한 문장으로 또렷하게 남겨보세요.</p>
        </div>

        <div className={styles.formGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel}>상세 기록</label>
            <span className={styles.optionalChip}>선택 입력</span>
          </div>
          <Editor
            value={body}
            onChange={setBody}
            placeholder="실천 계획, 독서 기록, 되돌아본 점, 앞으로의 다짐 등을 자유롭게 적어보세요. 이미지를 첨부해도 좋습니다."
            onUploadImage={handleUploadImage}
            uploading={uploading}
          />
          <p className={styles.fieldHint}>한 줄 다짐만으로도 등록할 수 있고, 상세 기록은 나중에 수정해서 추가해도 됩니다.</p>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.formActions}>
          {isEdit && user?.role === 'admin' ? (
            <button type="button" className={`${styles.btnGhost} ${styles.danger}`} onClick={handleDelete}>
              <Trash2 size={14} />
              삭제
            </button>
          ) : null}
          <button type="submit" className={styles.btnPrimary} disabled={submitting || uploading}>
            {submitting || uploading ? <Loader2 size={16} className={styles.spinner} /> : null}
            {uploading ? '이미지 업로드 중...' : isEdit ? '다짐 수정 완료' : '다짐 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
