/**
 * @file src/components/Footer/Footer.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react-router-dom
 * - lucide-react
 * - ../../config/env
 * - ./Footer.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { MapPin, User, ExternalLink, Download, Share2, X } from 'lucide-react';
import { APP_NAME } from '../../config/env';
import { usePwaInstall } from '../../context/PwaInstallContext';
import styles from './Footer.module.css';

/**
 * Footer module entry point.
 */
export default function Footer() {
    const currentYear = new Date().getFullYear();
    const { canInstall, isInstalled, isIosManualInstall, promptInstall, dismissed, helpOpen, closeHelp } =
        usePwaInstall();
    const [installing, setInstalling] = useState(false);

    let installLabel = `홈화면에 ${APP_NAME} 추가`;
    let installDescription = `${APP_NAME}을 앱처럼 빠르게 열고 전체 화면으로 사용할 수 있어요.`;
    let installDisabled = false;

    if (isInstalled) {
        installLabel = '이미 홈화면에 추가됨';
        installDescription = '이 기기에서는 범서인이 앱처럼 실행되고 있습니다.';
        installDisabled = true;
    } else if (isIosManualInstall) {
        installDescription = 'iPhone/iPad에서는 Safari 공유 메뉴에서 홈 화면에 추가할 수 있어요.';
    } else if (canInstall) {
        installDescription = '브라우저 설치 팝업을 통해 바로 홈화면에 추가할 수 있어요.';
    } else if (dismissed) {
        installDescription = '설치 팝업을 닫았다면 브라우저 메뉴에서 다시 설치할 수 있어요.';
        installDisabled = true;
    } else {
        installDescription = '현재 브라우저에서는 설치 준비가 되면 여기서 바로 홈화면에 추가할 수 있어요.';
        installDisabled = true;
    }

    const handleInstallClick = async () => {
        if (installDisabled || installing) return;

        setInstalling(true);
        try {
            await promptInstall();
        } finally {
            setInstalling(false);
        }
    };

    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.grid}>
                    {/* School Info */}
                    <div className={styles.section}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon}>
                                <img src="/mit_logo.png" alt="" className={styles.logoImage} />
                            </div>
                            <div>
                                <h3 className={styles.schoolName}>{APP_NAME}</h3>
                                <p className={styles.motto}>범서인</p>
                            </div>
                        </div>
                        <p className={styles.description}>
                            {APP_NAME}은 학교의 공식 입장을 대변하지 않습니다.
                        </p>
                    </div>

                    {/* Contact Info */}
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>개발 & 운영</h4>
                        <ul className={styles.contactList}>
                            <li>
                                <MapPin size={16} />
                                <span>범서고등학교 정보기술부</span>
                            </li>
                            <li>
                                <User size={16} />
                                <span>한종명</span>
                            </li>
                            <li>
                                <User size={16} />
                                <span>김보민</span>
                            </li>
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>바로가기</h4>
                        <ul className={styles.linkList}>
                            <li><Link to="/notices/school">학교 공지사항</Link></li>
                            <li><Link to="/school-info/meal">오늘의 급식</Link></li>
                            <li><Link to="/school-info/calendar">학사 일정</Link></li>
                            <li><Link to="/school-info/calculator">점공 계산기</Link></li>
                        </ul>
                    </div>

                    {/* External Links */}
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>외부 링크</h4>
                        <ul className={styles.linkList}>
                            <li>
                                <a href="https://school.use.go.kr/beomseo-h" target="_blank" rel="noopener noreferrer">
                                    범서고등학교 공식 홈페이지 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://beomseo.riroschool.kr/" target="_blank" rel="noopener noreferrer">
                                    범서고등학교 리로스쿨 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.instagram.com/beomseo_mit/" target="_blank" rel="noopener noreferrer">
                                    범서고등학교 정보기술부 인스타그램 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://github.com/hanjm-github/beomseo.in" target="_blank" rel="noopener noreferrer">
                                    beomseo.in GitHub 레포지토리 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.instagram.com/beomseo_hs/" target="_blank" rel="noopener noreferrer">
                                    범서고등학교 학생회 인스타그램 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="http://pf.kakao.com/_KZxmIX" target="_blank" rel="noopener noreferrer">
                                    범서고등학교 17대 학생회 카카오톡 채널 <ExternalLink size={12} />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className={styles.installCard}>
                    <div className={styles.installCopy}>
                        <p className={styles.installEyebrow}>PWA 설치</p>
                        <h4 className={styles.installTitle}>{installLabel}</h4>
                        <p className={styles.installDescription}>{installDescription}</p>
                    </div>
                    <button
                        type="button"
                        className={`btn btn-primary ${styles.installButton}`}
                        onClick={handleInstallClick}
                        disabled={installDisabled || installing}
                    >
                        {isIosManualInstall ? <Share2 size={18} /> : <Download size={18} />}
                        {installing ? '설치 준비 중...' : `홈화면에 ${APP_NAME} 추가`}
                    </button>
                </div>

                {helpOpen && isIosManualInstall ? (
                    <div className={styles.installHelp} role="status" aria-live="polite">
                        <div className={styles.installHelpHeader}>
                            <div>
                                <p className={styles.installHelpEyebrow}>iPhone / iPad 설치 안내</p>
                                <h5 className={styles.installHelpTitle}>Safari에서 홈 화면에 추가해 주세요</h5>
                            </div>
                            <button
                                type="button"
                                className={styles.installHelpClose}
                                onClick={closeHelp}
                                aria-label="설치 안내 닫기"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <ol className={styles.installHelpList}>
                            <li>하단 또는 상단의 공유 버튼을 누릅니다.</li>
                            <li>&quot;홈 화면에 추가&quot; 메뉴를 선택합니다.</li>
                            <li>이름을 확인한 뒤 추가를 누르면 앱처럼 실행됩니다.</li>
                        </ol>
                    </div>
                ) : null}

                {/* Bottom Bar */}
                <div className={styles.bottom}>
                    <p className={styles.copyright}>
                        © {currentYear} {APP_NAME}. All rights reserved.
                    </p>
                    <div className={styles.bottomLinks}>
                        <Link to="/privacy">개인정보처리방침</Link>
                        <span className={styles.divider}>|</span>
                        <Link to="/terms">이용약관</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}


