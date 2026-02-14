import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Bell,
    MessageCircle,
    Calculator,
    Utensils,
    Calendar,
    ImageIcon,
    Radio,
    Search,
    Users,
    ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

import CountdownWidget from '../../components/CountdownWidget';
import QuickLinkCard from '../../components/QuickLinkCard';
import AnnouncementCard from '../../components/AnnouncementCard';
import MealCard from '../../components/MealCard';

import styles from './MainPage.module.css';

// Mock data - will be replaced with API calls
const mockAnnouncements = {
    school: [
        { id: 1, title: '2026학년도 1학기 중간고사 시간표 안내', date: '2026-02-08', isPinned: true },
        { id: 2, title: '3월 학교 행사 일정 안내', date: '2026-02-07', isPinned: true },
        { id: 3, title: '신학기 교복 주문 안내', date: '2026-02-06', isPinned: false },
        { id: 4, title: '2학년 수학여행 일정 공지', date: '2026-02-05', isPinned: false },
        { id: 5, title: '급식실 이용 안내사항 변경', date: '2026-02-04', isPinned: false },
    ],
    council: [
        { id: 101, title: '[학생회] 제35대 학생회 활동 계획 안내', date: '2026-02-08', isPinned: true },
        { id: 102, title: '[학생회] 축제 공연팀 모집 (~2/28)', date: '2026-02-07', isPinned: false },
        { id: 103, title: '[학생회] 교내 건의사항 접수 안내', date: '2026-02-06', isPinned: false },
        { id: 104, title: '[학생회] 점심시간 운동장 사용 규칙', date: '2026-02-05', isPinned: false },
    ],
};

// Next exam date - mock data
const nextExamDate = '2026-03-15T09:00:00';

export default function MainPage() {
    const [activeTab, setActiveTab] = useState('school');

    const announcements = mockAnnouncements[activeTab];

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
            },
        },
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* Hero Section */}
                <section className={styles.hero}>
                    <motion.div
                        className={styles.heroContent}
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                    >
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
                                <Link to="/login" className={styles.heroSecondary}>
                                    로그인
                                </Link>
                            </div>
                        </motion.div>

                        <motion.div className={styles.heroWidget} variants={itemVariants}>
                            <CountdownWidget
                                targetDate={nextExamDate}
                                eventName="1학기 중간고사"
                            />
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
                            <p className={styles.sectionDescription}>자주 사용하는 메뉴에 빠르게 접근하세요</p>
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
                                    description="학교 및 학생회 공지사항을 확인하세요"
                                    variant="default"
                                    size="large"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/community/anonymous"
                                    icon={MessageCircle}
                                    title="익명 게시판"
                                    description="범서고 대신 전해드립니다"
                                    variant="accent"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/school-info/calculator"
                                    icon={Calculator}
                                    title="점공 계산기"
                                    description="내신 등급 예상 계산"
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
                                    title="학사 일정"
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
                                    to="/community/radio"
                                    icon={Radio}
                                    title="신청곡"
                                    variant="accent"
                                />
                            </motion.div>
                            <motion.div variants={itemVariants}>
                                <QuickLinkCard
                                    to="/community/clubs"
                                    icon={Users}
                                    title="동아리 모집"
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
                                    <h3 className={styles.cardTitle}>공지사항</h3>

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
                                    {announcements.map((item) => (
                                        <AnnouncementCard
                                            key={item.id}
                                            id={item.id}
                                            title={item.title}
                                            date={item.date}
                                            isPinned={item.isPinned}
                                            linkBase={activeTab === 'school' ? '/notices/school' : '/notices/council'}
                                        />
                                    ))}
                                </div>

                                <Link
                                    to={activeTab === 'school' ? '/notices/school' : '/notices/council'}
                                    className={styles.viewMore}
                                >
                                    더보기
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
                                <h3 className={styles.searchTitle}>무엇을 찾고 계신가요?</h3>
                                <p className={styles.searchDescription}>
                                    게시판, 급식, 선생님 정보 등을 한 번에 검색하세요
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
