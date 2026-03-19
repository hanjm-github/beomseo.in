import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import Editor from '../notices/Editor';
import RoleName from '../RoleName/RoleName';
import { sanitizeRichHtml, toPlainText } from '../../security/htmlSanitizer';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';

export default function FieldTripPostComposer({
  classSummary,
  mode = 'create',
  initialPost = null,
  onCancel,
  onSubmit,
  onDelete,
  onUploadFile,
  isAuthenticated = false,
  currentUser = null,
  allowAnonymousWrite = false,
}) {
  const isEditMode = mode === 'edit';
  // Anonymous nickname input is only needed for fresh, unlocked non-auth flows.
  const showNicknameInput = !isAuthenticated && !isEditMode;
  const [nickname, setNickname] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNickname(initialPost?.authorRole === 'anonymous' ? initialPost?.nickname || '' : '');
    setTitle(initialPost?.title || '');
    setBody(initialPost?.body || '');
    setAttachments(initialPost?.attachments || []);
    setUploading(false);
    setSubmitting(false);
    setDeleting(false);
    setError('');
  }, [classSummary?.classId, initialPost, mode]);

  const displayAuthor = useMemo(() => {
    if (isEditMode && initialPost) {
      if (initialPost.authorRole === 'anonymous') {
        return {
          nickname: initialPost.nickname,
          role: 'anonymous',
        };
      }

      if (
        currentUser?.id != null &&
        initialPost.authorUserId != null &&
        Number(currentUser.id) === Number(initialPost.authorUserId)
      ) {
        return {
          nickname: currentUser.nickname,
          role: currentUser.role,
        };
      }

      return {
        nickname: initialPost.nickname,
        role: initialPost.authorRole || 'student',
      };
    }

    if (isAuthenticated) {
      return {
        nickname: currentUser?.nickname || '로그인 사용자',
        role: currentUser?.role || 'student',
      };
    }

    if (nickname.trim()) {
      return {
        nickname: nickname.trim(),
        role: 'anonymous',
      };
    }

    return null;
  }, [currentUser, initialPost, isAuthenticated, isEditMode, nickname]);

  const handleUploadImage = async (file) => {
    if (!onUploadFile) {
      throw new Error('이미지 업로드를 사용할 수 없습니다.');
    }

    setUploading(true);
    try {
      return await onUploadFile(file);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isAuthenticated && !allowAnonymousWrite) {
      setError('로그인 또는 반 비밀번호 확인 후 작성할 수 있습니다.');
      return;
    }

    if (uploading) {
      setError('이미지 업로드가 끝난 뒤에 글을 올릴 수 있습니다.');
      return;
    }

    const trimmedNickname = nickname.trim();
    const trimmedTitle = title.trim();
    // Keep the stored payload rich-text safe while validating emptiness against
    // the plain-text projection that users actually see in previews.
    const safeBody = sanitizeRichHtml(body);
    const plainBody = toPlainText(safeBody);

    if (!trimmedTitle || !plainBody) {
      setError(showNicknameInput ? '닉네임, 제목, 본문을 모두 입력해 주세요.' : '제목과 본문을 모두 입력해 주세요.');
      return;
    }

    if (showNicknameInput && !trimmedNickname) {
      setError('닉네임, 제목, 본문을 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        title: trimmedTitle,
        body: safeBody,
        // Preserve legacy attachments on edit, but new attachments are no longer
        // managed from the field-trip composer UI.
        attachments: attachments || [],
      };

      if (showNicknameInput) {
        // Authenticated writers always inherit the server-side nickname/role.
        payload.nickname = trimmedNickname;
      }

      await onSubmit?.(payload);
    } catch (submitError) {
      setError(submitError?.message || '게시글 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !onDelete) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError?.message || '게시글 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className={`${styles.sectionCard} ${styles.composeCard}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.sectionEyebrow}>{isEditMode ? '글 수정' : '새 글 작성'}</p>
          <h2 className={styles.sectionTitle}>
            {isEditMode ? `${classSummary.label} 게시글 수정` : `${classSummary.label} 미션 글 올리기`}
          </h2>
          <p className={styles.sectionDescription}>
            본문은 공지사항 편집기처럼 이미지와 서식을 함께 사용할 수 있습니다.
          </p>
        </div>
      </div>

      <form className={styles.composeForm} onSubmit={handleSubmit}>
        {showNicknameInput ? (
          <label className={styles.formGroup} htmlFor="field-trip-nickname">
            <span>표시할 닉네임</span>
            <input
              id="field-trip-nickname"
              className={styles.textField}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="예: 3반 기록팀"
              maxLength={20}
            />
          </label>
        ) : displayAuthor ? (
          <div className={styles.formGroup}>
            <span>작성자 표시</span>
            {/* Show the resolved author badge so anonymous and authenticated flows
                preview the exact identity contract before submit. */}
            <div className={styles.authorDisplayBox}>
              <RoleName nickname={displayAuthor.nickname} role={displayAuthor.role} size="sm" />
            </div>
          </div>
        ) : null}

        <label className={styles.formGroup} htmlFor="field-trip-title">
          <span>제목</span>
          <input
            id="field-trip-title"
            className={styles.textField}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="미션 내용을 한 줄로 적어 주세요"
            maxLength={80}
          />
        </label>

        <div className={styles.formGroup}>
          <span>본문</span>
          <Editor
            value={body}
            onChange={setBody}
            placeholder="미션 진행 상황이나 메모를 자유롭게 적어 주세요"
            onUploadImage={onUploadFile ? handleUploadImage : undefined}
            uploading={uploading}
          />
        </div>

        {error ? <p className={styles.formError}>{error}</p> : null}

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>
            목록으로
          </button>
          {isEditMode ? (
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.dangerButton}`}
              onClick={handleDelete}
              disabled={deleting || submitting || uploading}
            >
              {deleting ? <Loader2 size={16} className={styles.spinner} /> : <Trash2 size={16} />}
              글 삭제
            </button>
          ) : null}
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={submitting || uploading || deleting}
          >
            {submitting || uploading ? (
              <Loader2 size={16} className={styles.spinner} />
            ) : (
              <Send size={16} />
            )}
            {uploading ? '업로드 중…' : submitting ? '저장 중…' : isEditMode ? '글 수정' : '글 올리기'}
          </button>
        </div>
      </form>
    </section>
  );
}
