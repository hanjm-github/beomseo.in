import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import fieldTripApi, { getFieldTripErrorMessage } from '../../api/fieldTrip';
import FieldTripPostDetail from '../../components/fieldTrip/FieldTripPostDetail';
import NotFoundPage from '../NotFoundPage';
import { useAuth } from '../../context/AuthContext';
import {
  canEditFieldTripPost,
  getFieldTripClassLabel,
  getFieldTripClassPath,
  getFieldTripHubPath,
  getFieldTripPostEditPath,
  isClassUnlocked,
  isFieldTripClassId,
} from '../../features/fieldTrip/utils';
import '../page-shell.css';
import styles from './FieldTripPage.module.css';

export default function FieldTripPostDetailPage() {
  const { classId = '', postId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classRows, setClassRows] = useState([]);
  const [post, setPost] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [postError, setPostError] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedClass = useMemo(() => {
    const found = classRows.find((row) => row.classId === classId);
    if (found) {
      return found;
    }

    return {
      classId,
      label: getFieldTripClassLabel(classId),
      isUnlocked: isClassUnlocked(classId),
    };
  }, [classId, classRows]);

  useEffect(() => {
    if (!isFieldTripClassId(classId)) {
      return undefined;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setOverviewError('');
      setPostError('');

      try {
        const [classesResult, postResult] = await Promise.allSettled([
          fieldTripApi.listClasses(),
          fieldTripApi.getPost(classId, postId),
        ]);

        if (cancelled) {
          return;
        }

        if (classesResult.status === 'fulfilled') {
          setClassRows(classesResult.value);
        } else {
          setOverviewError(
            getFieldTripErrorMessage(
              classesResult.reason,
              '반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
            )
          );
        }

        if (postResult.status === 'fulfilled') {
          setPost(postResult.value);
        } else {
          setPostError(
            getFieldTripErrorMessage(
              postResult.reason,
              '게시글 상세를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [classId, postId]);

  if (!isFieldTripClassId(classId)) {
    return (
      <NotFoundPage
        eyebrow="수학여행 게시판"
        title="존재하지 않는 반 게시판입니다."
        description="반 번호를 다시 확인하고 수학여행 허브에서 원하는 반 게시판으로 이동해 주세요."
        primaryAction={{ label: '수학여행 허브', to: getFieldTripHubPath() }}
      />
    );
  }

  const canEdit = canEditFieldTripPost(post, user);

  return (
    <div className={`page-shell ${styles.page}`}>
      <section className={styles.sectionCard}>
        <div className={styles.boardHeader}>
          <div className={styles.boardHeaderContent}>
            <p className={styles.sectionEyebrow}>학급별 현장 기록 보드</p>
            <h1 className={styles.boardTitle}>{selectedClass.label} 상세 기록</h1>
            {/* Detail and edit are separate routes so direct links can land on a
                stable read view without coupling to the board's compose state. */}
            <p className={styles.sectionDescription}>
              게시글 내용을 확인하고, 권한이 있으면 바로 수정 화면으로 이동할 수 있습니다.
            </p>
          </div>
          <div className={styles.boardHeaderActions}>
            <Link className={styles.secondaryButton} to={getFieldTripClassPath(classId)}>
              게시판으로
            </Link>
            {canEdit ? (
              <Link
                className={styles.primaryButton}
                to={getFieldTripPostEditPath(classId, postId)}
              >
                수정
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {overviewError ? (
        <section className={`${styles.sectionCard} ${styles.alertCard}`}>
          <p className={styles.alertTitle}>게시글 정보를 불러오지 못했습니다.</p>
          <p className={styles.alertMessage}>{overviewError}</p>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate(-1)}>
              돌아가기
            </button>
          </div>
        </section>
      ) : null}

      <FieldTripPostDetail classSummary={selectedClass} post={post} loading={loading} />

      {postError ? (
        <section className={`${styles.sectionCard} ${styles.alertCard}`}>
          <p className={styles.alertTitle}>게시글 상세를 불러오지 못했습니다.</p>
          <p className={styles.alertMessage}>{postError}</p>
        </section>
      ) : null}
    </div>
  );
}
