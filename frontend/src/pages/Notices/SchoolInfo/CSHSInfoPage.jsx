/**
 * @file src/pages/Notices/SchoolInfo/CSHSInfoPage.jsx
 * @description 천상고등학교 소개 페이지
 */
import SEO from '../../../components/SEO';
import schoolEmblem from '../../../assets/images/cshs-emblem.png';
import '../../page-shell.css';
import styles from './CSHSInfoPage.module.css';

const SCHOOL_INFO = {
  name: '천상고등학교',
  motto: '배움을 실천하고 선을 행하여 더불어 행복한 사람이 되자',
  emblemAlt: '천상고등학교 교표',
  description: '천상고등학교는 실천, 상선, 인화의 교훈 아래 학생들이 학업에 성실히 임하고, 뛰어난 선을 행하며, 서로 화합하는 학교입니다. 우리 학교는 학생들이 배움을 통해 성장하고, 더불어 행복한 삶을 영위할 수 있도록 다양한 교육 프로그램과 활동을 제공하고 있습니다.',
};

const INTRO_CARDS = [
  {
    title: '실천',
    description: '학업을 성실히 실천함',
  },
  {
    title: '상선',
    description: '가장 뛰어난 선을 행함',
  },
  {
    title: '인화',
    description: '여러 사람이 서로 화합함',
  },
];

const SCHOOL_EVENTS = { // 1학기 일정
  5: [
    [15, '교내체육행사'],
    [22, '동아리활동'],
    [26, '개교기념일'],
    [29, '인성주간실천행사'],
  ],
  6: [
    [19, '동아리활동'],
  ],
  7: [
    [2, '기말고사'],
    [3, '기말고사'],
    [6, '기말고사'],
    [7, '기말고사'],
    [13, '수업량유연화주간'],
    [14, '수업량유연화주간'],
    [15, '수업량유연화주간'],
    [21, '방학식'],
  ],
};

function getNextSchoolEventDday() {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const events = Object.entries(SCHOOL_EVENTS)
    .flatMap(([month, items]) =>
      items.map(([day, title]) => {
        let date = new Date(today.getFullYear(), Number(month) - 1, day);

        if (date.getTime() < todayDate.getTime()) {
          date = new Date(today.getFullYear() + 1, Number(month) - 1, day);
        }

        return {
          title,
          month: Number(month),
          day,
          date,
        };
      }),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const nextEvent = events[0];
  const diffDays = Math.ceil((nextEvent.date.getTime() - todayDate.getTime()) / 86400000);

  return {
    ...nextEvent,
    year: nextEvent.date.getFullYear(),
    diffDays,
    label: diffDays === 0 ? 'D-DAY' : `D-${diffDays}`,
  };
}

export default function CSHSInfoPage() {
  const nextSchoolEvent = getNextSchoolEventDday();

  return (
    <div className="page-shell">
      <SEO path="/school-info/intro" />

      <div className="page-header">
        <div>
          <p className="eyebrow">학교 소개</p>
          <h1>{SCHOOL_INFO.name}</h1>
          <p className="lede">{SCHOOL_INFO.description}</p>
        </div>
      </div>

      <section className={styles.heroCard}>
        <div className={styles.emblemBox}>
          <img
            src={schoolEmblem}
            alt={SCHOOL_INFO.emblemAlt}
            className={styles.emblemImage}
          />
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>School Motto</p>
          <h2 className={styles.schoolName}>{SCHOOL_INFO.name}</h2>
          <p className={styles.motto}>“{SCHOOL_INFO.motto}”</p>
        </div>
      </section>

      <section className={styles.ddayCard}>
        <div>
          <p className={styles.heroKicker}>Upcoming School Event</p>
          <h2 className={styles.ddayTitle}>{nextSchoolEvent.title}</h2>
          <p className={styles.ddayDate}>
            {nextSchoolEvent.year}년 {nextSchoolEvent.month}월 {nextSchoolEvent.day}일
          </p>
        </div>

        <strong className={styles.ddayBadge}>
          {nextSchoolEvent.label}
        </strong>
      </section>

      <section className={styles.infoGrid}>
        {INTRO_CARDS.map((card) => (
          <article key={card.title} className={styles.infoCard}>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}