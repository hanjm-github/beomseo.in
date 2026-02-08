import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ExternalLink } from 'lucide-react';
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
                                <span>범</span>
                            </div>
                            <div>
                                <h3 className={styles.schoolName}>범서고등학교</h3>
                                <p className={styles.motto}>지혜로운 눈으로 꿈을 이루고</p>
                            </div>
                        </div>
                        <p className={styles.description}>
                            지적 능력과 고운 인성이 조화로운 인간으로 성장시킨다
                        </p>
                    </div>

                    {/* Contact Info */}
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>연락처</h4>
                        <ul className={styles.contactList}>
                            <li>
                                <MapPin size={16} />
                                <span>울산광역시 울주군 범서읍</span>
                            </li>
                            <li>
                                <Phone size={16} />
                                <span>052-204-2926</span>
                            </li>
                            <li>
                                <Mail size={16} />
                                <span>beomseogo@korea.kr</span>
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
                                <a href="https://school.use.go.kr/beomseogo-h" target="_blank" rel="noopener noreferrer">
                                    리로스쿨 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.use.go.kr" target="_blank" rel="noopener noreferrer">
                                    울산광역시교육청 <ExternalLink size={12} />
                                </a>
                            </li>
                            <li>
                                <a href="https://www.neis.go.kr" target="_blank" rel="noopener noreferrer">
                                    나이스 <ExternalLink size={12} />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className={styles.bottom}>
                    <p className={styles.copyright}>
                        © {currentYear} 범서고등학교. All rights reserved.
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
