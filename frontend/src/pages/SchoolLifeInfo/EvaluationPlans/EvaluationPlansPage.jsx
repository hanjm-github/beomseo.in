import {
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

import SEO from '../../../components/SEO';
import '../../page-shell.css';
import styles from './EvaluationPlansPage.module.css';

const SCHOOLINFO_URL = 'https://www.schoolinfo.go.kr/';
const KOGL_LICENSE_URL = 'https://www.kogl.or.kr/info/license.do#03-tab';
const KOGL_MARK_URL = '/kogl/img_opentype03.jpg';

const SOURCE_NOTICE =
  "이 저작물은 범서고등학교에서 2026년 작성하여 공공누리 제3유형으로 개방한 '2026학년도 범서고 1학년 1학기 평가계획서.hwp', '2026학년도 범서고 2학년 1학기 평가계획서.hwp', '2026학년도 범서고 3학년 1학기 평가계획서.hwp', '2026학년도 2학기 1학년 평가계획서.hwp', '2026학년도 범서고 2학년 2학기 평가계획서.hwp', '2026학년도 2학기 3학년  평가계획서.hwp'(작성자:김선예)를 이용하였으며, 해당 저작물은 학교알리미(https://www.schoolinfo.go.kr/)에서 무료로 다운받으실 수 있습니다.";

const currentSemesterFiles = [
  {
    grade: '1학년',
    semester: '2학기',
    fileName: '2026학년도 2학기 1학년 평가계획서.hwp',
    href: '/evaluation-plans/2026학년도 2학기 1학년 평가계획서.hwp',
  },
  {
    grade: '2학년',
    semester: '2학기',
    fileName: '2026학년도 범서고 2학년 2학기 평가계획서.hwp',
    href: '/evaluation-plans/2026학년도 범서고 2학년 2학기 평가계획서.hwp',
  },
  {
    grade: '3학년',
    semester: '2학기',
    fileName: '2026학년도 2학기 3학년  평가계획서.hwp',
    href: '/evaluation-plans/2026학년도 2학기 3학년  평가계획서.hwp',
  },
];

const previousSemesterFiles = [
  {
    fileName: '2026학년도 범서고 1학년 1학기 평가계획서.hwp',
    href: '/evaluation-plans/2026학년도 범서고 1학년 1학기 평가계획서.hwp',
  },
  {
    fileName: '2026학년도 범서고 2학년 1학기 평가계획서.hwp',
    href: '/evaluation-plans/2026학년도 범서고 2학년 1학기 평가계획서.hwp',
  },
  {
    fileName: '2026학년도 범서고 3학년 1학기 평가계획서.hwp',
    href: '/evaluation-plans/2026학년도 범서고 3학년 1학기 평가계획서.hwp',
  },
];

export default function EvaluationPlansPage() {
  return (
    <div className="page-shell">
      <SEO path="/school-info/evaluation-plans" />

      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>평가계획서 다운로드</h1>
          <p className="lede">
            2026학년도 범서고 학년별 평가계획서 원본 HWP 파일을 바로 내려받을 수 있습니다.
          </p>
        </div>
      </div>

      <section className={styles.heroPanel} aria-labelledby="evaluation-plans-summary">
        <div className={styles.heroIcon} aria-hidden="true">
          <FileText size={28} />
        </div>
        <div>
          <h2 id="evaluation-plans-summary">학년별 평가계획서</h2>
          <p>
            파일은 공공누리 제3유형 조건에 맞춰 원본 형태로 제공되며, 최신 학기 파일은 카드에서,
            이전 학기 파일은 아래 목록에서 선택할 수 있습니다.
          </p>
        </div>
      </section>

      <section aria-labelledby="current-evaluation-plans-title">
        <div className={styles.sectionHeading}>
          <h2 id="current-evaluation-plans-title">최신 학기 평가계획서</h2>
        </div>

        <div className={styles.documentGrid} aria-label="최신 학기 평가계획서 파일 목록">
          {currentSemesterFiles.map((file) => (
            <article className={styles.documentCard} key={file.fileName}>
              <div className={styles.documentHeader}>
                <span className={styles.gradeBadge}>
                  <GraduationCap size={16} />
                  {file.grade}
                </span>
              </div>
              <div className={styles.documentBody}>
                <h3>{file.grade} {file.semester} 평가계획서</h3>
                <p className={styles.fileName}>{file.fileName}</p>
              </div>
              <a
                className={styles.downloadButton}
                href={file.href}
                download={file.fileName}
                aria-label={`${file.grade} ${file.semester} 평가계획서 다운로드`}
              >
                <Download size={18} />
                다운로드
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.previousSection} aria-labelledby="previous-evaluation-plans-title">
        <div className={styles.sectionHeading}>
          <h2 id="previous-evaluation-plans-title">이전 학기 평가계획서</h2>
        </div>

        <div className={styles.previousFileTableWrapper}>
          <table className={styles.previousFileTable} aria-label="이전 학기 평가계획서 다운로드 목록">
            <tbody>
              {previousSemesterFiles.map((file) => (
                <tr key={file.fileName}>
                  <td className={styles.previousFileName}>{file.fileName}</td>
                  <td className={styles.previousDownloadCell}>
                    <a
                      className={styles.previousDownloadButton}
                      href={file.href}
                      download={file.fileName}
                      aria-label={`이전 학기 ${file.fileName} 다운로드`}
                    >
                      다운로드
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.licensePanel} aria-labelledby="kogl-license-title">
        <div className={styles.licenseMark}>
          <img
            src={KOGL_MARK_URL}
            alt="공공누리 제3유형 출처표시 변경금지"
            loading="lazy"
          />
        </div>
        <div className={styles.licenseCopy}>
          <div className={styles.licenseTitleRow}>
            <span className={styles.licenseIcon} aria-hidden="true">
              <ShieldCheck size={18} />
            </span>
            <h2 id="kogl-license-title">공공누리 제3유형</h2>
          </div>
          <p className={styles.licenseSummary}>
            출처를 표시해야 하며, 저작물을 변경하거나 2차적 저작물을 작성할 수 없습니다.
          </p>
          <p className={styles.sourceNotice}>{SOURCE_NOTICE}</p>
          <div className={styles.licenseActions}>
            <a href={KOGL_LICENSE_URL} target="_blank" rel="noopener noreferrer">
              공공누리 제3유형 안내
              <ExternalLink size={15} />
            </a>
            <a href={SCHOOLINFO_URL} target="_blank" rel="noopener noreferrer">
              학교알리미
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
