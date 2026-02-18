import { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
    Bell,
    MessageCircle,
    Calculator,
    Utensils,
    Calendar,
    ImageIcon,
    Users,
    ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import CountdownWidget from '../../components/CountdownWidget';
import QuickLinkCard from '../../components/QuickLinkCard';
import AnnouncementCard from '../../components/AnnouncementCard';
import MealCard from '../../components/MealCard';
import { noticesApi } from '../../api/notices';
import { useAuth } from '../../context/AuthContext';

import styles from './MainPage.module.css';

export default function MainPage() {
    const [activeTab, setActiveTab] = useState('school');
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
                if (cancelled) return;
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
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => {
            cancelled = true;
        };
    }, []);

    const activeList = useMemo(() => announcements[activeTab] || [], [announcements, activeTab]);

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        },
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* Hero Section */}
                <section className={styles.hero}>
                    <Motion.div className={styles.heroContent} initial="hidden" animate="visible" variants={containerVariants}>
                        <Motion.div className={styles.heroText} variants={itemVariants}>
                            <span className={styles.heroLabel}>범서고등학교 학교 홈페이지</span>
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
                                    <Link to="/login" className={styles.heroSecondary}>
                                        로그인
                                    </Link>
                                )}
                            </div>
                        </Motion.div>

                        <Motion.div className={styles.heroWidget} variants={itemVariants}>
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
                        </Motion.div>
                    </Motion.div>

                    {/* Decorative elements */}
                    <div className={styles.heroBg}>
                        <div className={styles.heroGradient1} />
                        <div className={styles.heroGradient2} />
                    </div>
                </section>

                {/* Quick Links Bento Grid */}
                <section className={styles.section}>
                    <div className={styles.container}>
                        <Motion.div
                            className={styles.sectionHeader}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <h2 className={styles.sectionTitle}>바로가기</h2>
                            <p className={styles.sectionDescription}>자주 쓰는 메뉴로 한 번에 이동하세요.</p>
                        </Motion.div>

                        <Motion.div
                            className={styles.quickLinks}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={containerVariants}
                        >
                            <Motion.div variants={itemVariants} className={styles.quickLinkLarge}>
                                <QuickLinkCard
                                    to="/notices/school"
                                    icon={Bell}
                                    title="공지사항"
                                    description="학교·학생회 공지 한눈에 확인"
                                    variant="default"
                                    size="large"
                                />
                            </Motion.div>
                            <Motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/community/free"
                                    icon={MessageCircle}
                                    title="자유게시판"
                                    description="범서고의 커뮤니티 공간"
                                    variant="accent"
                                />
                            </Motion.div>
                            <Motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/calculator"
                                    icon={Calculator}
                                    title="내신 계산기"
                                    description="학기별 성적 계산"
                                    variant="info"
                                />
                            </Motion.div>
                            <Motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/meal"
                                    icon={Utensils}
                                    title="오늘의 급식"
                                    description="오늘 메뉴와 영양정보 확인"
                                    variant="success"
                                />
                            </Motion.div>
                            <Motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/calendar"
                                    icon={Calendar}
                                    title="학교 일정"
                                    description="행사와 학사일정 빠르게 확인"
                                    variant="warning"
                                />
                            </Motion.div>
                            <Motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/gallery"
                                    icon={ImageIcon}
                                    title="갤러리"
                                    description="학교 활동 사진과 소식 보기"
                                    variant="default"
                                />
                            </Motion.div>
                            <Motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/community/club-recruit"
                                    icon={Users}
                                    title="동아리"
                                    description="동아리 모집 정보와 활동 안내"
                                    variant="default"
                                />
                            </Motion.div>
                        </Motion.div>
                    </div>
                </section>

                {/* Announcements & Meal Section */}
                <section className={`${styles.section} ${styles.sectionAlt}`}>
                    <div className={styles.container}>
                        <div className={styles.twoColumn}>
                            {/* Announcements */}
                            <Motion.div
                                className={styles.announcementsCard}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                            >
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
                            </Motion.div>

                            {/* Meal Card */}
                            <Motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                            >
                                <MealCard />
                            </Motion.div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

