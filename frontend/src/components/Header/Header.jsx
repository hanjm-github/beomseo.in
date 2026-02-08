import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Sun, Moon, User, ChevronDown, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import styles from './Header.module.css';

const navigationItems = [
    {
        label: '공지사항',
        path: '/notices',
        children: [
            { label: '학교 공지사항', path: '/notices/school' },
            { label: '학생회 공지사항', path: '/notices/council' },
        ]
    },
    {
        label: '소통하는 범서고',
        path: '/community',
        children: [
            { label: '익명 게시판', path: '/community/anonymous' },
            { label: '동아리원 모집', path: '/community/clubs' },
            { label: '선택과목 변경', path: '/community/subjects' },
            { label: '학생 청원', path: '/community/petition' },
            { label: '신청곡', path: '/community/radio' },
            { label: '분실물 센터', path: '/community/lost-found' },
        ]
    },
    {
        label: '학교 생활 정보',
        path: '/school-info',
        children: [
            { label: '교무실 찾기', path: '/school-info/teachers' },
            { label: '점공 계산기', path: '/school-info/calculator' },
            { label: '오늘의 급식', path: '/school-info/meal' },
            { label: '학사 일정', path: '/school-info/calendar' },
        ]
    },
    { label: '갤러리', path: '/gallery' },
];

export default function Header() {
    const { isDark, toggleTheme } = useTheme();
    const { user, isAuthenticated, logout, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = async () => {
        await logout();
        setShowUserMenu(false);
        navigate('/');
    };

    // Handle scroll for floating header effect
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setActiveDropdown(null);
    }, [location.pathname]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest(`.${styles.navItem}`)) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleDropdownToggle = (index) => {
        setActiveDropdown(activeDropdown === index ? null : index);
    };

    return (
        <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
            <div className={styles.container}>
                {/* Logo */}
                <Link to="/" className={styles.logo}>
                    <div className={styles.logoIcon}>
                        <span className={styles.logoText}>범</span>
                    </div>
                    <span className={styles.logoName}>범서고등학교</span>
                </Link>

                {/* Desktop Navigation */}
                <nav className={styles.desktopNav}>
                    {navigationItems.map((item, index) => (
                        <div key={item.path} className={styles.navItem}>
                            {item.children ? (
                                <>
                                    <button
                                        className={`${styles.navLink} ${location.pathname.startsWith(item.path) ? styles.active : ''}`}
                                        onClick={() => handleDropdownToggle(index)}
                                        aria-expanded={activeDropdown === index}
                                        aria-haspopup="true"
                                    >
                                        {item.label}
                                        <ChevronDown
                                            size={16}
                                            className={`${styles.chevron} ${activeDropdown === index ? styles.rotated : ''}`}
                                        />
                                    </button>
                                    {activeDropdown === index && (
                                        <div className={styles.dropdown}>
                                            {item.children.map((child) => (
                                                <Link
                                                    key={child.path}
                                                    to={child.path}
                                                    className={`${styles.dropdownItem} ${location.pathname === child.path ? styles.active : ''}`}
                                                >
                                                    {child.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
                                    to={item.path}
                                    className={`${styles.navLink} ${location.pathname === item.path ? styles.active : ''}`}
                                >
                                    {item.label}
                                </Link>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Right Actions */}
                <div className={styles.actions}>
                    <button
                        onClick={toggleTheme}
                        className={styles.iconButton}
                        aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {!loading && (
                        isAuthenticated && user ? (
                            <div className={styles.userMenu}>
                                <button
                                    className={styles.userButton}
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    aria-expanded={showUserMenu}
                                >
                                    <User size={18} />
                                    <span className={user.is_teacher ? styles.teacherName : ''}>
                                        {user.nickname}
                                    </span>
                                    <ChevronDown size={14} className={showUserMenu ? styles.rotated : ''} />
                                </button>
                                {showUserMenu && (
                                    <div className={styles.userDropdown}>
                                        <div className={styles.userInfo}>
                                            <span className={styles.userRole}>
                                                {user.role === 'admin' ? '관리자' :
                                                    user.role === 'student_council' ? '학생회' :
                                                        user.role === 'teacher' ? '교사' : '학생'}
                                            </span>
                                        </div>
                                        <button onClick={handleLogout} className={styles.logoutButton}>
                                            <LogOut size={16} />
                                            <span>로그아웃</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link to="/login" className={styles.loginButton}>
                                <User size={18} />
                                <span>로그인</span>
                            </Link>
                        )
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        className={styles.mobileMenuButton}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label={isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
                        aria-expanded={isMobileMenuOpen}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isMobileMenuOpen && (
                <nav className={styles.mobileNav}>
                    {navigationItems.map((item, index) => (
                        <div key={item.path} className={styles.mobileNavItem}>
                            {item.children ? (
                                <>
                                    <button
                                        className={styles.mobileNavLink}
                                        onClick={() => handleDropdownToggle(index)}
                                    >
                                        {item.label}
                                        <ChevronDown
                                            size={16}
                                            className={activeDropdown === index ? styles.rotated : ''}
                                        />
                                    </button>
                                    {activeDropdown === index && (
                                        <div className={styles.mobileDropdown}>
                                            {item.children.map((child) => (
                                                <Link
                                                    key={child.path}
                                                    to={child.path}
                                                    className={styles.mobileDropdownItem}
                                                >
                                                    {child.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link to={item.path} className={styles.mobileNavLink}>
                                    {item.label}
                                </Link>
                            )}
                        </div>
                    ))}
                </nav>
            )}
        </header>
    );
}
