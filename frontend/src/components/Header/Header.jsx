/**
 * @file src/components/Header/Header.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../context/ThemeContext
 * Side effects:
 * - Influences client-side routing and navigation state.
 * - Interacts with browser runtime APIs.
 * - Schedules deferred work using timer-based execution.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Sun,
  Moon,
  User,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../config/env';
import { buildAuthRedirectState, resolveAuthRedirectTarget } from '../../utils/authRedirect';
import { SPORTS_LEAGUE_CATEGORY_ID } from '../../features/sportsLeague/data';
import styles from './Header.module.css';
import RoleName from '../RoleName/RoleName';

const navigationItems = [
  {
    label: '공지사항',
    path: '/notices',
    children: [
      { label: '학교 공지', path: '/notices/school' },
      { label: '학생회 공지', path: '/notices/council' },
    ],
  },
  {
    label: '소통하는 범서고',
    path: '/community',
    children: [
      { label: '자유 게시판', path: '/community/free' },
      { label: '동아리 모집', path: '/community/club-recruit' },
      { label: '선택과목 변경', path: '/community/subjects' },
      { label: '학생 청원', path: '/community/petition' },
      { label: '설문 품앗이', path: '/community/survey' },
      { label: '실시간 투표', path: '/community/vote' },
      { label: '분실물 센터', path: '/community/lost-found' },
      { label: '곰솔마켓', path: '/community/gomsol-market' },
    ],
  },
  {
    label: '학교 생활 정보',
    path: '/school-info',
    children: [
      { label: '시간표 다운로드', path: '/school-info/timetable' },
      { label: '교무실 찾기', path: '/school-info/teachers' },
      { label: '점공 계산기', path: '/school-info/calculator' },
      { label: '오늘의 급식', path: '/school-info/meal' },
      { label: '학사 캘린더', path: '/school-info/calendar' },
      {
        label: '스포츠리그',
        path: `/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`,
      },
    ],
  },
  { label: '범서고 갤러리', path: '/gallery' },
];

/**
 * Header module entry point.
 */
export default function Header() {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authRedirectState = buildAuthRedirectState(location);
  const logoutRedirectTarget = resolveAuthRedirectTarget(location);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMobileMenuOpen(false);
      setActiveDropdown(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    navigate(logoutRedirectTarget, { replace: true });
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  const handleMobileLogout = async () => {
    closeMobileMenu();
    await handleLogout();
  };

  const handleDropdownToggle = (index) => {
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src="/mit_logo.png" alt="" className={styles.logoImage} />
          </div>
          <div className={styles.logoLabels}>
            <span className={styles.logoName}>{APP_NAME}</span>
            <span className={styles.logoMeta}>범서고 공식 커뮤니티</span>
          </div>
        </Link>

        <nav className={styles.desktopNav}>
          {navigationItems.map((item, index) => (
            <div key={item.path} className={styles.navItem}>
              {item.children ? (
                <>
                  <button
                    className={`${styles.navLink} ${location.pathname.startsWith(item.path) ? styles.active : ''
                      }`}
                    onClick={() => handleDropdownToggle(index)}
                    aria-expanded={activeDropdown === index}
                    aria-haspopup="true"
                  >
                    {item.label}
                    <ChevronDown
                      size={16}
                      className={`${styles.chevron} ${activeDropdown === index ? styles.rotated : ''
                        }`}
                    />
                  </button>
                  {activeDropdown === index && (
                    <div className={styles.dropdown}>
                      <div className={styles.dropdownGrid}>
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`${styles.dropdownItem} ${location.pathname.startsWith(child.path) ? styles.active : ''
                              }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.path}
                  className={`${styles.navLink} ${location.pathname.startsWith(item.path) ? styles.active : ''
                    }`}
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.actions}>
          <button
            onClick={toggleTheme}
            className={styles.iconButton}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {!loading &&
            (isAuthenticated && user ? (
              <div className={styles.userMenu}>
                <button
                  className={styles.userButton}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-expanded={showUserMenu}
                >
                  <User size={18} />
                  <RoleName nickname={user.nickname} role={user.role} size="sm" />
                  <ChevronDown size={14} className={showUserMenu ? styles.rotated : ''} />
                </button>
                {showUserMenu && (
                  <div className={styles.userDropdown}>
                    <div className={styles.userInfo}>
                      <RoleName nickname={user.nickname} role={user.role} size="sm" />
                    </div>
                    <button onClick={handleLogout} className={styles.logoutButton}>
                      <LogOut size={16} />
                      <span>로그아웃</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" state={authRedirectState} className={styles.loginButton}>
                <User size={18} />
                <span>로그인</span>
              </Link>
            ))}

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

      {isMobileMenuOpen && (
        <nav className={styles.mobileNav}>
          {navigationItems.map((item, index) => (
            <div key={item.path} className={styles.mobileNavItem}>
              {item.children ? (
                <>
                  <button
                    className={styles.mobileNavLink}
                    onClick={() => handleDropdownToggle(index)}
                    aria-expanded={activeDropdown === index}
                    aria-haspopup="true"
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
                          onClick={closeMobileMenu}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link to={item.path} className={styles.mobileNavLink} onClick={closeMobileMenu}>
                  {item.label}
                </Link>
              )}
            </div>
          ))}

          {!loading && (
            <div className={styles.mobileNavAuth}>
              {isAuthenticated && user ? (
                <>
                  <div className={styles.mobileUserSummary}>
                    <span>로그인됨:</span>
                    <RoleName nickname={user.nickname} role={user.role} size="sm" />
                  </div>
                  <button type="button" className={styles.mobileAuthButton} onClick={handleMobileLogout}>
                    <LogOut size={16} />
                    <span>로그아웃</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  state={authRedirectState}
                  className={styles.mobileAuthButton}
                  onClick={closeMobileMenu}
                >
                  <User size={16} />
                  <span>로그인 / 회원가입</span>
                </Link>
              )}
            </div>
          )}
        </nav>
      )}
    </header>
  );
}


