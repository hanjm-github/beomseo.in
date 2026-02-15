import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Bell,
    MessageCircle,
    Calculator,
    Utensils,
    Calendar,
    ImageIcon,
    Search,
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

// Next exam date - mock data
const nextExamDate = '2026-03-15T09:00:00';

export default function MainPage() {
    const [activeTab, setActiveTab] = useState('school');
    const [announcements, setAnnouncements] = useState({ school: [], council: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setLoading(true);
            setError('');
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
            } catch (err) {
                if (!cancelled) setError('공지 불러오기에 실패했습니다.');
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
                    <motion.div className={styles.heroContent} initial="hidden" animate="visible" variants={containerVariants}>
                        <motion.div className={styles.heroText} variants={itemVariants}>
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
                        </motion.div>

                        <motion.div className={styles.heroWidget} variants={itemVariants}>
                            <CountdownWidget targetDate={nextExamDate} eventName="1학기 중간고사" />
                        </motion.div>
                    </motion.div>

                    {/* Decorative elements */}
                    <div className={styles.heroBg}>
                        <div className={styles.heroGradient1} />
                        <div className={styles.heroGradient2} />
                    </div>
                </section>

                {/* Quick Links Bento Grid */}
                <section className={styles.section}>
                    <div className={styles.container}>
                        <motion.div
                            className={styles.sectionHeader}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <h2 className={styles.sectionTitle}>바로가기</h2>
                            <p className={styles.sectionDescription}>자주 쓰는 메뉴로 한 번에 이동하세요.</p>
                        </motion.div>

                        <motion.div
                            className={styles.quickLinks}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={containerVariants}
                        >
                            <motion.div variants={itemVariants} className={styles.quickLinkLarge}>
                                <QuickLinkCard
                                    to="/notices/school"
                                    icon={Bell}
                                    title="공지사항"
                                    description="학교·학생회 공지 한눈에 확인"
                                    variant="default"
                                    size="large"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/community/free"
                                    icon={MessageCircle}
                                    title="자유게시판"
                                    description="범서고의 커뮤니티 공간"
                                    variant="accent"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/calculator"
                                    icon={Calculator}
                                    title="내신 계산기"
                                    description="학기별 성적 계산"
                                    variant="info"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/meal"
                                    icon={Utensils}
                                    title="오늘의 급식"
                                    variant="success"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/calendar"
                                    icon={Calendar}
                                    title="학교 일정"
                                    variant="warning"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/gallery"
                                    icon={ImageIcon}
                                    title="갤러리"
                                    variant="default"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/community/club-recruit"
                                    icon={Users}
                                    title="동아리"
                                    variant="default"
                                />
                            </motion.div>
                        </motion.div>
                    </div>
                </section>

                {/* Announcements & Meal Section */}
                <section className={`${styles.section} ${styles.sectionAlt}`}>
                    <div className={styles.container}>
                        <div className={styles.twoColumn}>
                            {/* Announcements */}
                            <motion.div
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
                            </motion.div>

                            {/* Meal Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                            >
                                <MealCard />
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Search Section */}
                <section className={styles.section}>
                    <div className={styles.container}>
                        <motion.div
                            className={styles.searchSection}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                        >
                            <div className={styles.searchContent}>
                                <h3 className={styles.searchTitle}>원하는 정보를 바로 찾아보세요</h3>
                                <p className={styles.searchDescription}>
                                    게시판, 식단, 일정 등 키워드로 검색해 보세요.
                                </p>
                            </div>
                            <div className={styles.searchInputWrapper}>
                                <Search size={20} className={styles.searchIcon} />
                                <input
                                    type="text"
                                    className={styles.searchInput}
                                    placeholder="검색어를 입력하세요..."
                                />
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>
        </div>
    );
}
