import { Link } from 'react-router-dom';
import { MapPin, User, ExternalLink } from 'lucide-react';
import { APP_NAME } from '../../config/env';
import styles from './Footer.module.css';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.grid}>
                    {/* School Info */}
                    <div className={styles.section}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon}>
                                <span>in</span>
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
                                <a href="https://github.com/hanjm-github/2026-beomseo" target="_blank" rel="noopener noreferrer">
                                    {APP_NAME} GitHub 레포지토리 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.instagram.com/beomseo_hs/" target="_blank" rel="noopener noreferrer">
                                    범서고등학교 학생회 인스타그램 <ExternalLink size={12} />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

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
