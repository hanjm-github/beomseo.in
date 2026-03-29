import { useEffect, useMemo, useRef, useState } from 'react';
import { Film, Loader2, Send, Trash2, Upload, X } from 'lucide-react';
import Editor from '../../notices/NoticeCenter/Editor';
import RoleName from '../../RoleName/RoleName';
import {
  FIELD_TRIP_VIDEO_MAX_SIZE_BYTES,
  FIELD_TRIP_VIDEO_MAX_SIZE_MB,
} from '../../../config/env';
import { sanitizeRichHtml, toPlainText } from '../../../security/htmlSanitizer';
import styles from '../../../pages/Community/FieldTrip/FieldTripPage.module.css';

const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;

function isVideoFile(file) {
  return Boolean(file?.type?.startsWith('video/') || VIDEO_EXTENSIONS.test(file?.name || ''));
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return '0MB';
  }

  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

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
  const showNicknameInput = !isAuthenticated && !isEditMode;
  const videoInputRef = useRef(null);

  const [nickname, setNickname] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [videoAttachment, setVideoAttachment] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isUploading = imageUploading || videoUploading;

  useEffect(() => {
    setNickname(initialPost?.authorRole === 'anonymous' ? initialPost?.nickname || '' : '');
    setTitle(initialPost?.title || '');
    setBody(initialPost?.body || '');
    setAttachments(initialPost?.attachments || []);
    setVideoAttachment(initialPost?.videoAttachment || null);
    setImageUploading(false);
    setVideoUploading(false);
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

    setImageUploading(true);
    try {
      return await onUploadFile(file);
    } finally {
      setImageUploading(false);
    }
  };

  const openVideoPicker = () => {
    if (!onUploadFile) {
      setError('영상 업로드를 사용할 수 없습니다.');
      return;
    }

    videoInputRef.current?.click();
  };

  const handleVideoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isVideoFile(file)) {
      setError('MP4, WEBM, MOV 영상만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > FIELD_TRIP_VIDEO_MAX_SIZE_BYTES) {
      setError(`영상은 ${FIELD_TRIP_VIDEO_MAX_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
      return;
    }

    setError('');
    setVideoUploading(true);
    try {
      const uploaded = await onUploadFile(file);
      if (uploaded?.kind !== 'video') {
        throw new Error('영상 업로드 결과가 올바르지 않습니다.');
      }
      setVideoAttachment(uploaded);
    } catch (uploadError) {
      setError(uploadError?.message || '영상 업로드에 실패했습니다.');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleRemoveVideo = () => {
    setVideoAttachment(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isAuthenticated && !allowAnonymousWrite) {
      setError('로그인하거나 반 비밀번호를 확인한 뒤에만 글을 작성할 수 있습니다.');
      return;
    }

    if (isUploading) {
      setError('업로드가 끝난 뒤에 글을 저장할 수 있습니다.');
      return;
    }

    const trimmedNickname = nickname.trim();
    const trimmedTitle = title.trim();
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
        attachments: [...(attachments || []), ...(videoAttachment ? [videoAttachment] : [])],
      };

      if (showNicknameInput) {
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
            본문에는 이미지와 링크를 넣을 수 있고, 필요하면 아래 카드에서 영상을 따로 첨부할 수 있습니다.
          </p>
        </div>
      </div>

      <form className={styles.composeForm} onSubmit={handleSubmit}>
        {showNicknameInput ? (
          <label className={styles.formGroup} htmlFor="field-trip-nickname">
            <span>표시 닉네임</span>
            <input
              id="field-trip-nickname"
              className={styles.textField}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="예: 3반 기록장"
              maxLength={20}
            />
          </label>
        ) : displayAuthor ? (
          <div className={styles.formGroup}>
            <span>작성자 표시</span>
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
            placeholder="미션 내용을 한 줄로 적어 주세요."
            maxLength={80}
          />
        </label>

        <div className={styles.formGroup}>
          <span>본문</span>
          <Editor
            value={body}
            onChange={setBody}
            placeholder="미션 진행 상황이나 메모를 자유롭게 적어 주세요."
            onUploadImage={onUploadFile ? handleUploadImage : undefined}
            uploading={imageUploading}
          />
        </div>

        <div className={styles.formGroup}>
          <span>영상 첨부</span>
          <div className={styles.videoUploadCard}>
            <div className={styles.videoUploadHeader}>
              <div className={styles.videoUploadTitleWrap}>
                <span className={styles.videoUploadBadge}>
                  <Film size={14} />
                  선택 첨부
                </span>
                <p className={styles.videoUploadTitle}>에디터 아래에 표시될 영상</p>
                <p className={styles.formHint}>
                  MP4, WEBM, MOV 형식만 지원하며 최대 {FIELD_TRIP_VIDEO_MAX_SIZE_MB}MB까지 업로드할 수 있습니다.
                </p>
              </div>
            </div>

            {videoAttachment ? (
              <div className={styles.videoUploadPreview}>
                <video
                  className={styles.videoUploadPlayer}
                  controls
                  preload="metadata"
                  src={videoAttachment.url}
                />
                <div className={styles.videoUploadMeta}>
                  <div>
                    <p className={styles.videoUploadFileName}>{videoAttachment.name}</p>
                    <p className={styles.videoUploadFileInfo}>
                      {formatFileSize(videoAttachment.size)} · {videoAttachment.mime}
                    </p>
                  </div>
                  <div className={styles.videoUploadActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={openVideoPicker}
                      disabled={videoUploading || submitting || deleting}
                    >
                      {videoUploading ? <Loader2 size={16} className={styles.spinner} /> : <Upload size={16} />}
                      {videoUploading ? '업로드 중...' : '영상 교체'}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={handleRemoveVideo}
                      disabled={videoUploading || submitting || deleting}
                    >
                      <X size={16} />
                      제거
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.videoUploadEmptyState}>
                <p className={styles.videoUploadEmptyTitle}>첨부한 영상이 없습니다.</p>
                <p className={styles.videoUploadEmptyBody}>
                  영상 첨부는 선택입니다. 올리면 게시글 본문 아래에서 바로 재생할 수 있습니다.
                </p>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={openVideoPicker}
                  disabled={videoUploading || submitting || deleting}
                >
                  {videoUploading ? <Loader2 size={16} className={styles.spinner} /> : <Upload size={16} />}
                  {videoUploading ? '업로드 중...' : '영상 업로드'}
                </button>
              </div>
            )}
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            style={{ display: 'none' }}
            onChange={handleVideoSelected}
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
              disabled={deleting || submitting || isUploading}
            >
              {deleting ? <Loader2 size={16} className={styles.spinner} /> : <Trash2 size={16} />}
              글 삭제
            </button>
          ) : null}
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={submitting || isUploading || deleting}
          >
            {submitting || isUploading ? (
              <Loader2 size={16} className={styles.spinner} />
            ) : (
              <Send size={16} />
            )}
            {isUploading ? '업로드 중...' : submitting ? '저장 중...' : isEditMode ? '글 수정' : '글 올리기'}
          </button>
        </div>
      </form>
    </section>
  );
}
