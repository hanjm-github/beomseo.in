/**
 * @file src/pages/MainPage/MainPage.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - lucide-react
 * - react-router-dom
 * - ../../components/CountdownWidget
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  MessageCircle,
  Download,
  Utensils,
  Calendar,
  Radio,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import CountdownWidget from '../../components/CountdownWidget';
import AcademicUpcomingCard from '../../components/AcademicUpcomingCard/AcademicUpcomingCard';
import QuickLinkCard from '../../components/QuickLinkCard';
import AnnouncementCard from '../../components/AnnouncementCard';
import MealCard from '../../components/MealCard';
import { noticesApi } from '../../api/notices';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, CLUB_RECRUIT_BOARD_ENABLED } from '../../config/env';
import { getNextAcademicEvent } from '../../features/academicCalendar/utils';
import { buildAuthRedirectState } from '../../utils/authRedirect';

import styles from './MainPage.module.css';

/**
 * MainPage module entry point.
 */
export default function MainPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('council');
  const [announcements, setAnnouncements] = useState({ school: [], council: [] });
  const [countdownEvent, setCountdownEvent] = useState(null);
  const [countdownLoadError, setCountdownLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      setCountdownLoadError(false);

      try {
        const [schoolRes, councilRes] = await Promise.all([
          noticesApi.list({ category: 'school', sort: 'recent', page: 1, pageSize: 5 }),
          noticesApi.list({ category: 'council', sort: 'recent', page: 1, pageSize: 5 }),
        ]);

        if (cancelled) {
          return;
        }

        setAnnouncements({
          school: schoolRes.items || [],
          council: councilRes.items || [],
        });
        setCountdownEvent(schoolRes.countdownEvent || null);
        setCountdownLoadError(Boolean(schoolRes.fromMock));
      } catch {
        if (!cancelled) {
          setError('공지 불러오기에 실패했습니다.');
          setCountdownEvent(null);
          setCountdownLoadError(true);
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
  }, []);

  const activeList = useMemo(() => announcements[activeTab] || [], [announcements, activeTab]);
  const nextAcademicEvent = useMemo(() => getNextAcademicEvent(new Date()), []);
  const upcomingAcademicHref = nextAcademicEvent
    ? `/school-info/calendar?month=${nextAcademicEvent.startDate.slice(0, 7)}&event=${nextAcademicEvent.id}`
    : '/school-info/calendar';
  const authRedirectState = buildAuthRedirectState(location);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={`${styles.heroText} ${styles.fadeUp} ${styles.delay0}`}>
              <span className={styles.heroLabel}>{APP_NAME}</span>
              <h1 className={styles.heroTitle}>
                <span className={styles.heroHighlight}>지혜로운 눈</span>으로 꿈을 이루고
                <br />
                <span className={styles.heroHighlight}>따뜻한 가슴</span>으로 인류에 봉사하자
              </h1>
              <p className={styles.heroDescription}>
                지적 능력과 고운 인성이 조화로운 인간으로 성장시킨다
              </p>
              <div className={styles.heroActions}>
                <Link to="/notices/school" className={styles.heroPrimary}>
                  공지사항 보기
                  <ChevronRight size={18} />
                </Link>
                {!isAuthenticated && (
                  <Link to="/login" state={authRedirectState} className={styles.heroSecondary}>
                    로그인
                  </Link>
                )}
              </div>
            </div>

            <div className={`${styles.heroWidgetStack} ${styles.fadeUp} ${styles.delay1}`}>
              <div className={styles.heroWidget}>
                {countdownLoadError ? (
                  <div className={`${styles.countdownPlaceholder} ${styles.countdownError}`}>
                    카운트다운을 불러오지 못했습니다.
                  </div>
                ) : countdownEvent ? (
                  <CountdownWidget
                    targetDate={countdownEvent.eventAt}
                    eventName={countdownEvent.eventName}
                  />
                ) : (
                  <div className={styles.countdownPlaceholder}>예정된 행사가 없습니다.</div>
                )}
              </div>
              <AcademicUpcomingCard event={nextAcademicEvent} href={upcomingAcademicHref} />
            </div>
          </div>

          <div className={styles.heroBg}>
            <div className={styles.heroGradient1} />
            <div className={styles.heroGradient2} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.container}>
            <div className={`${styles.sectionHeader} ${styles.fadeUp}`}>
              <h2 className={styles.sectionTitle}>바로가기</h2>
              <p className={styles.sectionDescription}>자주 쓰는 메뉴로 한 번에 이동하세요.</p>
            </div>

            <div className={styles.quickLinks}>
              <div className={`${styles.quickLinkLarge} ${styles.fadeUp} ${styles.delay0}`}>
                <QuickLinkCard
                  to="/notices/school"
                  icon={Bell}
                  title="공지사항"
                  description="학교·학생회 공지 한눈에 확인"
                  variant="default"
                  size="large"
                />
              </div>
              <div className={`${styles.fadeUp} ${styles.delay1}`}>
                <QuickLinkCard
                  to="/school-info/meal"
                  icon={Utensils}
                  title="오늘의 급식"
                  description="오늘 메뉴와 이달 급식 달력 확인"
                  variant="success"
                />
              </div>
              <div className={`${styles.fadeUp} ${styles.delay2}`}>
                <QuickLinkCard
                  to="/school-info/timetable"
                  icon={Download}
                  title="시간표 다운로드"
                  description="반별·개인 시간표를 빠르게 저장"
                  variant="info"
                />
              </div>
              <div className={`${styles.fadeUp} ${styles.delay3}`}>
                <QuickLinkCard
                  to="/school-info/calendar"
                  icon={Calendar}
                  title="학교 일정"
                  description="행사와 학사일정 빠르게 확인"
                  variant="warning"
                />
              </div>
              <div className={`${styles.fadeUp} ${styles.delay4}`}>
                <QuickLinkCard
                  to="/community/free"
                  icon={MessageCircle}
                  title="자유게시판"
                  description="범서고의 커뮤니티 공간"
                  variant="accent"
                />
              </div>
              <div className={`${styles.fadeUp} ${styles.delay5}`}>
                <QuickLinkCard
                  to="/school-info/sports-league/2026-spring-grade3-boys-soccer"
                  icon={Radio}
                  title="스포츠리그"
                  description="실시간 문자중계와 경기 정보"
                  variant="info"
                />
              </div>
              {CLUB_RECRUIT_BOARD_ENABLED ? (
                <div className={`${styles.fadeUp} ${styles.delay5}`}>
                  <QuickLinkCard
                    to="/community/club-recruit"
                    icon={Users}
                    title="동아리"
                    description="동아리 모집 정보와 활동 안내"
                    variant="default"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={styles.container}>
            <div className={styles.twoColumn}>
              <div className={`${styles.announcementsCard} ${styles.fadeUp}`}>
                <div className={styles.announcementsHeader}>
                  <h3 className={styles.cardTitle}>최근 공지</h3>

                  <div className={styles.tabs}>
                    <button
                      className={`${styles.tab} ${activeTab === 'school' ? styles.active : ''}`}
                      onClick={() => setActiveTab('school')}
                    >
                      학교 공지
                    </button>
                    <button
                      className={`${styles.tab} ${activeTab === 'council' ? styles.active : ''}`}
                      onClick={() => setActiveTab('council')}
                    >
                      학생회 공지
                    </button>
                  </div>
                </div>

                <div className={styles.announcementsList}>
                  {loading ? (
                    <p className={styles.metaMuted}>불러오는 중...</p>
                  ) : error ? (
                    <p className={styles.metaMuted}>{error}</p>
                  ) : activeList.length === 0 ? (
                    <p className={styles.metaMuted}>표시할 공지가 없습니다.</p>
                  ) : (
                    activeList.map((item) => (
                      <AnnouncementCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        date={(item.createdAt || item.updatedAt || '').slice(0, 10)}
                        isPinned={item.pinned}
                        linkBase={activeTab === 'school' ? '/notices/school' : '/notices/council'}
                      />
                    ))
                  )}
                </div>

                <Link
                  to={activeTab === 'school' ? '/notices/school' : '/notices/council'}
                  className={styles.viewMore}
                >
                  더 보기
                  <ChevronRight size={16} />
                </Link>
              </div>

              <div className={`${styles.fadeUp} ${styles.delay2}`}>
                <MealCard />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
