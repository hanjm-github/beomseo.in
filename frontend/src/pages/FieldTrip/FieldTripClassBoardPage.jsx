import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import fieldTripApi, { getFieldTripErrorMessage } from '../../api/fieldTrip';
import FieldTripMissionList from '../../components/fieldTrip/FieldTripMissionList';
import FieldTripPasswordManager from '../../components/fieldTrip/FieldTripPasswordManager';
import FieldTripPostComposer from '../../components/fieldTrip/FieldTripPostComposer';
import NotFoundPage from '../NotFoundPage';
import { useAuth } from '../../context/AuthContext';
import {
  canEditFieldTripPost,
  getFieldTripClassLabel,
  getFieldTripClassPath,
  getFieldTripComposePath,
  getFieldTripHubPath,
  getFieldTripPostPath,
  isClassUnlocked,
  isFieldTripClassId,
  isFieldTripManagerRole,
  resolveFieldTripBoardDescription,
} from '../../features/fieldTrip/utils';
import '../page-shell.css';
import styles from './FieldTripPage.module.css';

function LoginRequiredCard({ classId, returnPath }) {
  return (
    <section className={`${styles.sectionCard} ${styles.loginGateCard}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.sectionEyebrow}>작성 권한</p>
          <h2 className={styles.sectionTitle}>로그인이 필요합니다.</h2>
          <p className={styles.sectionDescription}>
            현장 기록 글 작성과 수정은 로그인한 사용자만 가능합니다.
          </p>
        </div>
      </div>
      <div className={styles.formActions}>
        <Link className={styles.secondaryButton} to={getFieldTripClassPath(classId)}>
          게시판으로
        </Link>
        <Link
          className={styles.primaryButton}
          to="/login"
          state={{ from: returnPath || getFieldTripComposePath(classId) }}
        >
          로그인
        </Link>
      </div>
    </section>
  );
}

function PermissionDeniedCard({ classId, postId, errorMessage }) {
  return (
    <section className={`${styles.sectionCard} ${styles.alertCard}`}>
      <p className={styles.alertTitle}>게시글 수정 권한이 없습니다.</p>
      <p className={styles.alertMessage}>
        {errorMessage || '해당 게시글은 작성자 또는 학생회/관리자만 수정할 수 있습니다.'}
      </p>
      <div className={styles.formActions}>
        <Link className={styles.secondaryButton} to={getFieldTripClassPath(classId)}>
          게시판으로
        </Link>
        <Link className={styles.primaryButton} to={getFieldTripPostPath(classId, postId)}>
          상세로
        </Link>
      </div>
    </section>
  );
}

function ComposeLauncher({ classId }) {
  const handleOpenCompose = () => {
    if (typeof window !== 'undefined') {
      window.open(getFieldTripComposePath(classId), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section className={`${styles.sectionCard} ${styles.composeLauncherCard}`}>
      <div className={styles.composeLauncherCompact}>
        <div>
          <p className={styles.sectionEyebrow}>새 글 작성</p>
          <h2 className={styles.sectionTitle}>새 탭에서 글 추가</h2>
          <p className={styles.sectionDescription}>
            글쓰기는 새 탭에서 열리고, 목록은 이 페이지에서 계속 확인할 수 있습니다.
          </p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={handleOpenCompose}>
          <ExternalLink size={16} />
          새 탭에서 글 추가
        </button>
      </div>
    </section>
  );
}

export default function FieldTripClassBoardPage() {
  const { classId = '', postId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [classRows, setClassRows] = useState([]);
  const [posts, setPosts] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState('');
  const [editingPostLoading, setEditingPostLoading] = useState(false);
  const [editingPostError, setEditingPostError] = useState('');
  const [remoteEditingPost, setRemoteEditingPost] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('');
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [descriptionSuccessMessage, setDescriptionSuccessMessage] = useState('');

  const isCreateRoute = location.pathname.endsWith('/new');
  const isEditRoute = location.pathname.endsWith('/edit');
  const isComposerRoute = isCreateRoute || isEditRoute;
  const canManage = isFieldTripManagerRole(user?.role);

  const selectedClass = useMemo(() => {
    const found = classRows.find((row) => row.classId === classId);
    if (found) {
      return found;
    }

    return {
      classId,
      label: getFieldTripClassLabel(classId),
      postCount: 0,
      isUnlocked: isClassUnlocked(classId),
      boardDescription: '',
    };
  }, [classId, classRows]);

  const resolvedBoardDescription = resolveFieldTripBoardDescription(selectedClass);
  const editingListPost = useMemo(
    () => posts.find((post) => post.id === postId) || null,
    [postId, posts]
  );
  const editingPost = editingListPost || remoteEditingPost;
  const canEditCurrentPost = canEditFieldTripPost(editingPost, user);

  useEffect(() => {
    setUnlockError('');
    setUnlockPassword('');
    setPasswordError('');
    setPasswordSuccessMessage('');
    setDescriptionEditing(false);
    setDescriptionError('');
    setDescriptionSuccessMessage('');
  }, [classId]);

  useEffect(() => {
    setDescriptionDraft(resolvedBoardDescription);
  }, [resolvedBoardDescription]);

  useEffect(() => {
    if (!isFieldTripClassId(classId)) {
      return undefined;
    }

    let cancelled = false;

    const fetchOverview = async () => {
      setOverviewLoading(true);
      setOverviewError('');

      try {
        const classes = await fieldTripApi.listClasses();
        if (cancelled) {
          return;
        }
        setClassRows(classes);
      } catch (error) {
        if (!cancelled) {
          setOverviewError(
            getFieldTripErrorMessage(
              error,
              '반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
            )
          );
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    };

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  useEffect(() => {
    if (!selectedClass?.isUnlocked) {
      setPosts([]);
      setMissionLoading(false);
      setMissionError('');
      return;
    }

    let cancelled = false;

    const fetchPosts = async () => {
      setMissionLoading(true);
      setMissionError('');

      try {
        const nextPosts = await fieldTripApi.listPosts(classId);
        if (cancelled) {
          return;
        }
        setPosts(nextPosts);
      } catch (error) {
        if (!cancelled) {
          setPosts([]);
          setMissionError(
            getFieldTripErrorMessage(error, '게시글 목록을 불러오지 못했습니다.')
          );
        }
      } finally {
        if (!cancelled) {
          setMissionLoading(false);
        }
      }
    };

    fetchPosts();

    return () => {
      cancelled = true;
    };
  }, [classId, selectedClass?.isUnlocked]);

  useEffect(() => {
    if (!selectedClass?.isUnlocked || !isEditRoute || !postId) {
      setRemoteEditingPost(null);
      setEditingPostLoading(false);
      setEditingPostError('');
      return;
    }

    if (editingListPost) {
      setRemoteEditingPost(editingListPost);
      setEditingPostLoading(false);
      setEditingPostError('');
      return;
    }

    let cancelled = false;

    const fetchEditingPost = async () => {
      setEditingPostLoading(true);
      setEditingPostError('');

      try {
        const nextPost = await fieldTripApi.getPost(classId, postId);
        if (cancelled) {
          return;
        }
        setRemoteEditingPost(nextPost);
      } catch (error) {
        if (!cancelled) {
          setRemoteEditingPost(null);
          setEditingPostError(
            getFieldTripErrorMessage(error, '수정할 게시글을 불러오지 못했습니다.')
          );
        }
      } finally {
        if (!cancelled) {
          setEditingPostLoading(false);
        }
      }
    };

    fetchEditingPost();

    return () => {
      cancelled = true;
    };
  }, [classId, editingListPost, isEditRoute, postId, selectedClass?.isUnlocked]);

  if (!isFieldTripClassId(classId)) {
    return (
      <NotFoundPage
        eyebrow="수학여행 게시판"
        title="존재하지 않는 반 게시판입니다."
        description="반 번호를 다시 확인하고 수학여행 허브에서 원하는 반 게시판으로 이동해 주세요."
        primaryAction={{ label: '수학여행 허브', to: getFieldTripHubPath() }}
        secondaryActions={[{ label: '점수판 보기', to: getFieldTripHubPath('scoreboard') }]}
      />
    );
  }

  const handleUnlockSubmit = async (event) => {
    event.preventDefault();
    setUnlocking(true);
    setUnlockError('');

    try {
      await fieldTripApi.unlockClass(classId, unlockPassword);
      setClassRows((current) =>
        current.map((row) =>
          row.classId === classId ? { ...row, isUnlocked: true } : row
        )
      );
      setUnlockPassword('');
    } catch (error) {
      setUnlockError(
        getFieldTripErrorMessage(error, '비밀번호를 확인하지 못했습니다. 다시 시도해 주세요.')
      );
    } finally {
      setUnlocking(false);
    }
  };

  const handleOpenPost = (nextPostId) => {
    if (typeof window !== 'undefined') {
      window.open(getFieldTripPostPath(classId, nextPostId), '_blank', 'noopener,noreferrer');
    }
  };

  const handleCancelCompose = () => {
    navigate(getFieldTripClassPath(classId));
  };

  const handleCreatePost = async (payload) => {
    const createdPost = await fieldTripApi.createPost(classId, payload);
    setPosts((current) => [createdPost, ...current]);
    setClassRows((current) =>
      current.map((row) =>
        row.classId === classId
          ? { ...row, isUnlocked: true, postCount: row.postCount + 1 }
          : row
      )
    );
    navigate(getFieldTripPostPath(classId, createdPost.id));
  };

  const handleUpdatePost = async (payload) => {
    const updatedPost = await fieldTripApi.updatePost(classId, postId, payload);
    setPosts((current) =>
      current.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    );
    setRemoteEditingPost(updatedPost);
    navigate(getFieldTripPostPath(classId, updatedPost.id));
  };

  const handleDeletePost = async () => {
    if (!window.confirm('이 게시글을 삭제할까요?')) {
      return;
    }

    await fieldTripApi.deletePost(classId, postId);
    setPosts((current) => current.filter((post) => post.id !== postId));
    setClassRows((current) =>
      current.map((row) =>
        row.classId === classId
          ? { ...row, postCount: Math.max(0, Number(row.postCount || 0) - 1) }
          : row
      )
    );
    navigate(getFieldTripClassPath(classId));
  };

  const handlePasswordUpdate = async (password) => {
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccessMessage('');

    try {
      await fieldTripApi.updateClassPassword(classId, password);
      setPasswordSuccessMessage(`${selectedClass.label} 게시판 비밀번호를 변경했습니다.`);
    } catch (error) {
      setPasswordError(
        getFieldTripErrorMessage(error, '비밀번호를 저장하지 못했습니다. 다시 시도해 주세요.')
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDescriptionSave = async () => {
    setDescriptionSaving(true);
    setDescriptionError('');
    setDescriptionSuccessMessage('');

    try {
      const updated = await fieldTripApi.updateBoardDescription(classId, descriptionDraft);
      setClassRows((current) =>
        current.map((row) =>
          row.classId === classId
            ? { ...row, boardDescription: updated.boardDescription }
            : row
        )
      );
      setDescriptionDraft(updated.boardDescription);
      setDescriptionEditing(false);
      setDescriptionSuccessMessage('게시판 설명을 저장했습니다.');
    } catch (error) {
      setDescriptionError(
        getFieldTripErrorMessage(error, '게시판 설명을 저장하지 못했습니다.')
      );
    } finally {
      setDescriptionSaving(false);
    }
  };

  const renderComposerArea = () => {
    if (!isComposerRoute) {
      return null;
    }

    if (authLoading) {
      return (
        <section className={`${styles.sectionCard} ${styles.loginGateCard}`}>
          <div className={styles.inlineState}>권한 정보를 확인하는 중입니다.</div>
        </section>
      );
    }

    if (!isAuthenticated) {
      return (
        <LoginRequiredCard
          classId={classId}
          returnPath={isEditRoute ? location.pathname : getFieldTripComposePath(classId)}
        />
      );
    }

    if (isEditRoute && editingPostLoading) {
      return (
        <section className={`${styles.sectionCard} ${styles.loginGateCard}`}>
          <div className={styles.inlineState}>수정할 게시글을 불러오는 중입니다.</div>
        </section>
      );
    }

    if (isEditRoute && editingPostError) {
      return (
        <section className={`${styles.sectionCard} ${styles.alertCard}`}>
          <p className={styles.alertTitle}>수정할 게시글을 불러오지 못했습니다.</p>
          <p className={styles.alertMessage}>{editingPostError}</p>
        </section>
      );
    }

    if (isEditRoute && !editingPost) {
      return (
        <section className={`${styles.sectionCard} ${styles.alertCard}`}>
          <p className={styles.alertTitle}>수정할 게시글을 찾지 못했습니다.</p>
          <p className={styles.alertMessage}>
            삭제되었거나 접근할 수 없는 게시글입니다. 목록에서 다시 확인해 주세요.
          </p>
        </section>
      );
    }

    if (isEditRoute && editingPost && !canEditCurrentPost) {
      return (
        <PermissionDeniedCard
          classId={classId}
          postId={postId}
          errorMessage="해당 게시글은 작성자 또는 학생회/관리자만 수정할 수 있습니다."
        />
      );
    }

    return (
      <FieldTripPostComposer
        classSummary={selectedClass}
        mode={isEditRoute ? 'edit' : 'create'}
        initialPost={isEditRoute ? editingPost : null}
        onCancel={handleCancelCompose}
        onDelete={isEditRoute ? handleDeletePost : undefined}
        onSubmit={isEditRoute ? handleUpdatePost : handleCreatePost}
        onUploadFile={(file) => fieldTripApi.upload(file)}
        uploadMaxAttachments={fieldTripApi.MAX_ATTACHMENTS}
        uploadMaxFileSizeBytes={fieldTripApi.MAX_FILE_SIZE}
        uploadMaxFileSizeMb={Math.round(fieldTripApi.MAX_FILE_SIZE / (1024 * 1024))}
      />
    );
  };

  return (
    <div className={`page-shell ${styles.page}`}>
      <section className={styles.sectionCard}>
        <div className={styles.boardHeader}>
          <div className={styles.boardHeaderContent}>
            <p className={styles.sectionEyebrow}>학급별 현장 기록 보드</p>
            <h1 className={styles.boardTitle}>{selectedClass.label} 게시판</h1>
            {!descriptionEditing ? (
              <p className={styles.sectionDescription}>{resolvedBoardDescription}</p>
            ) : (
              <div className={styles.descriptionEditor}>
                <textarea
                  className={`${styles.textArea} ${styles.descriptionEditorField}`}
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  rows={3}
                  maxLength={240}
                />
                <div className={styles.descriptionEditorActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setDescriptionEditing(false);
                      setDescriptionDraft(resolvedBoardDescription);
                      setDescriptionError('');
                    }}
                    disabled={descriptionSaving}
                  >
                    <X size={16} />
                    취소
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleDescriptionSave}
                    disabled={descriptionSaving}
                  >
                    {descriptionSaving ? (
                      <Loader2 size={16} className={styles.spinner} />
                    ) : (
                      <Save size={16} />
                    )}
                    설명 저장
                  </button>
                </div>
              </div>
            )}
            {descriptionError ? <p className={styles.formError}>{descriptionError}</p> : null}
            {!descriptionError && descriptionSuccessMessage ? (
              <p className={styles.formSuccess}>{descriptionSuccessMessage}</p>
            ) : null}
          </div>

          <div className={styles.boardHeaderActions}>
            {canManage && !descriptionEditing ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setDescriptionEditing(true);
                  setDescriptionSuccessMessage('');
                  setDescriptionError('');
                }}
              >
                <Pencil size={16} />
                설명 수정
              </button>
            ) : null}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(getFieldTripHubPath())}
            >
              수학여행 허브로
            </button>
          </div>
        </div>

        <div className={styles.boardMeta}>
          <span className={styles.sectionPill}>
            <LockKeyhole size={14} />
            {selectedClass.isUnlocked ? '잠금 해제 완료' : '비밀번호 확인 필요'}
          </span>
          <span className={styles.sectionPill}>게시글 {selectedClass.postCount || posts.length}개</span>
        </div>
      </section>

      {overviewError ? (
        <section className={`${styles.sectionCard} ${styles.alertCard}`}>
          <p className={styles.alertTitle}>반 정보를 불러오지 못했습니다.</p>
          <p className={styles.alertMessage}>{overviewError}</p>
        </section>
      ) : null}

      {overviewLoading && !classRows.length ? (
        <section className={`${styles.sectionCard} ${styles.loginGateCard}`}>
          <div className={styles.inlineState}>반 게시판 정보를 불러오는 중입니다.</div>
        </section>
      ) : null}

      {!overviewLoading && !selectedClass.isUnlocked ? (
        <section className={`${styles.sectionCard} ${styles.lockedStateCard}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>게시판 잠금 해제</p>
              <h2 className={styles.sectionTitle}>{selectedClass.label} 비밀번호 입력</h2>
              <p className={styles.sectionDescription}>
                반 비밀번호를 입력하면 글 목록과 상세 페이지를 확인할 수 있습니다.
              </p>
            </div>
          </div>

          <form className={styles.inlineForm} onSubmit={handleUnlockSubmit}>
            <label className={styles.formGroup} htmlFor={`field-trip-unlock-${classId}`}>
              <span>비밀번호</span>
              <div className={styles.passwordInputWrap}>
                <KeyRound size={16} />
                <input
                  id={`field-trip-unlock-${classId}`}
                  className={styles.textField}
                  type="password"
                  value={unlockPassword}
                  onChange={(event) => setUnlockPassword(event.target.value)}
                  placeholder={`${selectedClass.label} 비밀번호를 입력해 주세요`}
                  autoComplete="off"
                />
              </div>
            </label>

            <div className={styles.inlineActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={unlocking || overviewLoading}
              >
                {unlocking ? <Loader2 size={16} className={styles.spinner} /> : null}
                {unlocking ? '확인 중…' : '잠금 해제'}
              </button>
            </div>
          </form>

          {unlockError ? <p className={styles.formError}>{unlockError}</p> : null}
        </section>
      ) : !overviewLoading ? (
        <>
          {!isComposerRoute ? (
            <div
              className={`${styles.boardActionGrid} ${
                canManage ? styles.boardActionGridDual : styles.boardActionGridSingle
              }`}
            >
              {canManage ? (
                <FieldTripPasswordManager
                  key={selectedClass.classId}
                  classSummary={selectedClass}
                  saving={passwordSaving}
                  error={passwordError}
                  successMessage={passwordSuccessMessage}
                  onSubmit={handlePasswordUpdate}
                />
              ) : null}
              <ComposeLauncher classId={classId} />
            </div>
          ) : null}

          {renderComposerArea()}

          <div className={styles.boardStack}>
            <FieldTripMissionList
              classSummary={selectedClass}
              posts={posts}
              loading={missionLoading}
              onSelectPost={handleOpenPost}
            />
          </div>

          {missionError ? (
            <section className={`${styles.sectionCard} ${styles.alertCard}`}>
              <p className={styles.alertTitle}>게시글 목록을 불러오지 못했습니다.</p>
              <p className={styles.alertMessage}>{missionError}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
