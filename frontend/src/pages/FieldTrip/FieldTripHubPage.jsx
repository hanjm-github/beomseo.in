import { startTransition, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import fieldTripApi, { getFieldTripErrorMessage } from '../../api/fieldTrip';
import FieldTripClassGrid from '../../components/fieldTrip/FieldTripClassGrid';
import FieldTripScoreboard from '../../components/fieldTrip/FieldTripScoreboard';
import FieldTripTabBar from '../../components/fieldTrip/FieldTripTabBar';
import { useAuth } from '../../context/AuthContext';
import {
  getFieldTripClassPath,
  isFieldTripManagerRole,
  normalizeFieldTripTab,
} from '../../features/fieldTrip/utils';
import '../page-shell.css';
import styles from './FieldTripPage.module.css';

export default function FieldTripHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classRows, setClassRows] = useState([]);
  const [scoreRows, setScoreRows] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [scoreActionError, setScoreActionError] = useState('');
  const [pendingClassId, setPendingClassId] = useState('');

  const activeTab = normalizeFieldTripTab(searchParams.get('tab'));
  const canManage = isFieldTripManagerRole(user?.role);

  useEffect(() => {
    let cancelled = false;

    const fetchOverview = async () => {
      setOverviewLoading(true);
      setOverviewError('');

      try {
        const [classes, scoreboard] = await Promise.all([
          fieldTripApi.listClasses(),
          fieldTripApi.getScoreboard(),
        ]);

        if (cancelled) {
          return;
        }

        setClassRows(classes);
        setScoreRows(scoreboard);
      } catch (error) {
        if (!cancelled) {
          setOverviewError(
            getFieldTripErrorMessage(
              error,
              '수학여행 게시판 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
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
  }, []);

  const handleChangeTab = (tabKey) => {
    const next = new URLSearchParams(searchParams);
    const normalizedTab = normalizeFieldTripTab(tabKey);

    if (normalizedTab === 'mission') {
      next.delete('tab');
    } else {
      next.set('tab', normalizedTab);
    }

    startTransition(() => {
      setSearchParams(next);
    });
  };

  const handleOpenClass = (classId) => {
    navigate(getFieldTripClassPath(classId));
  };

  const handleAdjustScore = async (classId, delta) => {
    setPendingClassId(classId);
    setScoreActionError('');

    try {
      const updatedRow = await fieldTripApi.adjustScore(classId, delta);
      setScoreRows((current) =>
        current.map((row) => (row.classId === classId ? updatedRow : row))
      );
    } catch (error) {
      setScoreActionError(
        getFieldTripErrorMessage(error, '점수를 저장하지 못했습니다. 다시 시도해 주세요.')
      );
    } finally {
      setPendingClassId('');
    }
  };

  return (
    <div className={`page-shell ${styles.page}`}>
      <section className={`${styles.hero} ${styles.heroMinimal}`}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <p className={styles.heroEyebrow}>수학여행 미션 아카이브</p>
            <h1 className={styles.heroTitle}>학급별 현장 기록 보드</h1>
            {/* The hub now reflects the same in-app flow as the board: class entry,
                compose, detail, and edit all stay inside the SPA. */}
            <p className={styles.heroDescription}>
              반별 게시판으로 들어가 현장 기록을 확인하고, 자유게시판처럼 현재 페이지에서
              바로 글을 작성할 수 있습니다.
            </p>
          </div>
        </div>
        <div className={styles.heroStamp} aria-hidden="true" />
      </section>

      <FieldTripTabBar activeTab={activeTab} onChange={handleChangeTab} />

      {overviewError ? (
        <section className={`${styles.sectionCard} ${styles.alertCard}`}>
          <p className={styles.alertTitle}>수학여행 게시판 정보를 불러오지 못했습니다.</p>
          <p className={styles.alertMessage}>{overviewError}</p>
        </section>
      ) : null}

      {activeTab === 'mission' ? (
        <FieldTripClassGrid
          classes={classRows}
          selectedClassId=""
          loading={overviewLoading}
          onSelectClass={handleOpenClass}
        />
      ) : (
        <FieldTripScoreboard
          rows={scoreRows}
          loading={overviewLoading}
          canManage={canManage}
          pendingClassId={pendingClassId}
          actionError={scoreActionError}
          onAdjustScore={handleAdjustScore}
        />
      )}
    </div>
  );
}
