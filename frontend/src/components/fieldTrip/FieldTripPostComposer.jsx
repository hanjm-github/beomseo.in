import { useEffect, useState } from 'react';
import { Loader2, Paperclip, Send, Trash2 } from 'lucide-react';
import Attachments from '../notices/Attachments';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';

export default function FieldTripPostComposer({
  classSummary,
  mode = 'create',
  initialPost = null,
  onCancel,
  onSubmit,
  onDelete,
  onUploadFile,
  uploadMaxAttachments,
  uploadMaxFileSizeBytes,
  uploadMaxFileSizeMb,
}) {
  const isEditMode = mode === 'edit';
  const [nickname, setNickname] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNickname(initialPost?.nickname || '');
    setTitle(initialPost?.title || '');
    setBody(initialPost?.body || '');
    setAttachments(initialPost?.attachments || []);
    setUploading(false);
    setSubmitting(false);
    setDeleting(false);
    setError('');
  }, [classSummary?.classId, initialPost, mode]);

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    setError('');

    if (attachments.length + files.length > uploadMaxAttachments) {
      setError(`첨부는 최대 ${uploadMaxAttachments}개까지 업로드할 수 있습니다.`);
      return;
    }

    const oversized = files.find((file) => file.size > uploadMaxFileSizeBytes);
    if (oversized) {
      setError(`파일 최대 용량은 ${uploadMaxFileSizeMb}MB입니다.`);
      return;
    }

    setUploading(true);

    try {
      const uploadedFiles = [];

      for (const file of files) {
        const uploaded = await onUploadFile?.(file);
        uploadedFiles.push(uploaded);
      }

      setAttachments((current) => [...current, ...uploadedFiles]);
    } catch (uploadError) {
      setError(uploadError?.message || '첨부 파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setAttachments((current) => current.filter((file) => file.id !== attachmentId));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedNickname = nickname.trim();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedNickname || !trimmedTitle || !trimmedBody) {
      setError('닉네임, 제목, 본문을 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit?.({
        nickname: trimmedNickname,
        title: trimmedTitle,
        body: trimmedBody,
        attachments,
      });
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
            사진이나 파일은 선택 사항입니다. 글 수정 시에는 오른쪽 버튼으로 삭제도 할 수 있습니다.
          </p>
        </div>
      </div>

      <form className={styles.composeForm} onSubmit={handleSubmit}>
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

        <label className={styles.formGroup} htmlFor="field-trip-body">
          <span>본문</span>
          <textarea
            id="field-trip-body"
            className={styles.textArea}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="미션 진행 상황이나 메모를 자유롭게 적어 주세요"
            rows={7}
            maxLength={1200}
          />
        </label>

        <div className={styles.formGroup}>
          <span>사진/파일 추가 (선택)</span>
          <div className={styles.attachmentToolbar}>
            <label className={styles.uploadButton}>
              <Paperclip size={14} />
              첨부 추가
              <input type="file" multiple onChange={handleFilesSelected} hidden />
            </label>
            <p className={styles.formHint}>
              {attachments.length}/{uploadMaxAttachments}개, 파일당 최대 {uploadMaxFileSizeMb}MB
            </p>
          </div>
          <Attachments items={attachments} onRemove={handleRemoveAttachment} />
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
