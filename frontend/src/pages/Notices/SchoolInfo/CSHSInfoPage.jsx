/**
 * @file src/pages/Notices/SchoolInfo/CSHSInfoPage.jsx
 * @description 천상고등학교 소개 페이지
 */

// icon
import {
  Eye,
  TextAlignJustify,
  BadgeCheck,
  TreePine,
  Flower2,
  UserRound,
  School,
  Presentation,
} from 'lucide-react';

// SEO
import SEO from '../../../components/SEO';
// styles
import '../../page-shell.css';
// components
import SchoolInfoTabs from './SchoolInfoTabs';
// css module
import styles from './CSHSInfoPage.module.css';


// 학교 정보
const HERO_TAGS = ['바른 인성', '창의적 지성', '글로벌 인재'];

// 학교 소개
const INTRO_CARDS = [
  {
    title: '교육 목표',
    description: '바른 인성과 창의적 지성을 겸비한 글로벌 인재 양성',
    icon: Eye
  },
  {
    title: '경영 철학',
    items: [
      '더불어 행복한 천, 상, 인',
      '천: 실천; 학업을 성실히 실천함',
      '상: 상선; 가장 뛰어난 선을 행함',
      '인: 인화; 여러 사람이 서로 화합함'
    ],
    icon: TextAlignJustify
  },
];

const SYMBOLS = [
  {
    title: '교표',
    subtitle: '高, 역사의 터전에서 높고 훌륭한 인재를 배출하는 요람',
    items: [
      '천상의 "ㅊ"자와 한자의 "大"자와 동일한 형상으로 대(大)자는 크다, 높다, 훌륭하다, 뛰어나다 등으로 "ㅊ"은 높은 창의력을 가진 천상고를 뜻합니다.',
      '천상의 "ㅅ"자와 한자의 "人"자와 동일한 형상으로 인(人)자는 사람, 인격, 명예, 품격 등으로 "ㅅ"은 명예와 품격을 가진 사람, "천상인"을 뜻합니다.',
      '고등학교"고"자와 한자의 "口"자와 동일한 형상으로 구(口)자 는 입, 관문 등의 의미를 지닙니다.',
    ],
    icon: BadgeCheck,    
  },
  {
    title: '교목',
    subtitle: '소나무',
    description:
      '소나무는 사철 푸르름을 유지하는 나무로, 기상, 지조와 절개, 청렴과 인내를 의미합니다.',
    icon: TreePine,
  },
  {
    title: '교화',
    subtitle: '목련화',
    description:
      '목련은 봄에 가장 먼저 피는 꽃으로, 인고의 사랑, 순수와 순결, 숭고한 정신을 상징합니다.',
    icon: Flower2,
  }
];

const STATS = [
  {
    label: '학생 수',
    value: '984명',
    icon: UserRound,
  },
  {
    label: '학급 수',
    value: '34학급',
    icon: School,
  },
  {
    label: '교직원 수',
    value: '94명',
    icon: Presentation,
  }
]

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
  8: [
    [16, '개학식'],
  ],
  9: [
    [2, '9월 모의고사'],
  ],
  10: [
    [12, '중간고사'],
    [20, '10월 모의고사'],
    [23, '창의체험행사(1,2학년)'],
    [30, '합동소방훈련']
  ],
  11: [
    [6, '동아리학술제'],
    [19, '대학수학능력시험'],
    [23, '3학년 현장체험'],
  ],
  12: [
    [10, '기말고사'],
    [24, '축제'],
    [30, '방학식'],
  ]
};

const HISTORY = [
  {
    date: '2017.03.01',
    title: '천상고등학교 개교',
  },
  {
    date: '2017.03.01',
    title: '초대 강해숙 교장 취임',
  },
  {
    date: '2020.02.13',
    title: '제1회 졸업식, 269명 졸업',
  },
  {
    date: '2023.09.01',
    title: '제3대 배미희 교장 취임',
  },
  {
    date: '2026.02.05',
    title: '제7회 졸업식, 350명 졸업 / 총 졸업생 2,076명'
  }, {
    date: '2026.03.03',
    title: '제10회 입학식, 신입생 347명 입학'
  },
];


// 섹션 헤더 컴포넌트
function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className={styles.sectionHeader}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </div>
  );
}

// 다음 학교 행사 D-day 계산 함수
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

  // 일정이 없을 경우에 대한 방어 처리
  if (!events || events.length === 0) {
    return {
      title: '일정 없음',
      month: today.getMonth() + 1,
      day: today.getDate(),
      date: todayDate,
      year: todayDate.getFullYear(),
      diffDays: 0,
      label: '일정 없음',
    };
  }

  const nextEvent = events[0];
  const diffDays = Math.ceil((nextEvent.date.getTime() - todayDate.getTime()) / 86400000);

  return {
    ...nextEvent,
    year: nextEvent.date.getFullYear(),
    diffDays,
    label: diffDays === 0 ? 'D-DAY' : `D-${diffDays}`,
  };
}

// 학교 소개 페이지
export default function CSHSInfoPage() {
  const nextSchoolEvent = getNextSchoolEventDday();

  return (
    <div className="page-shell">
      <SEO path="/notices/school-info/cshs-info" />
      <SchoolInfoTabs />

      {/* 메인 카드 */}
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="cshs-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Cheonsang High School</p>
            <h1 id="cshs-title">천상고등학교</h1>
            <p className={styles.heroStatement}>
              <strong>배움</strong>을 실천하고
              <br />
              <strong>선</strong>을 행하여 더불어 행복한 사람이 되자
            </p>
            <div className={styles.heroTags} aria-label="cshs-core-words">
              {HERO_TAGS.map((tag) => (
              <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>

          <div className={styles.heroVisual} aria-label="천상고 핵심 현황">
            <div className={styles.heroWidget}>
              <p className={styles.heroKicker}>Upcoming School Event</p>
              <h2 className={styles.ddayTitle}>{nextSchoolEvent.title}</h2>
              <p className={styles.ddayDate}>
                {nextSchoolEvent.year}년 {nextSchoolEvent.month}월 {nextSchoolEvent.day}일
              </p>
              <strong className={styles.ddayBadge}>{nextSchoolEvent.label}</strong>
            </div>

            <div className={styles.heroFactGrid}>
              <div>
                <span>개교</span>
                <strong>2017</strong>
              </div>
              <div>
                <span>재학생</span>
                <strong>984</strong>
              </div>
              <div>
                <span>학급</span>
                <strong>34</strong>
              </div>
            </div>
          </div>
        </section>


        {/* 교육 목표와 경영 철학 섹션 */}
        <section id="education-target" className={styles.section}>
          <SectionHeader
            eyebrow="Education Target"
            title="교육 목표와 경영 철학"
            description="천상고등학교는 바른 인성과 창의적 지성을 겸비한 글로벌 인재 양성을 교육 목표로 삼고 있습니다."
          />
          <div className={styles.descriptionCards}>
            {INTRO_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <article key={card.title} className={styles.descriptionCard}>
                  <div className={styles.iconBadge}>
                    <Icon size={24} aria-hidden="true" />
                  </div>
                  <h3>{card.title}</h3>
                  {card.description ? <p>{card.description}</p> : null}
                  {card.items ? (
                    <ul>
                      {card.items.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        
        {/* 학교 상징 섹션 */}
        <section className={styles.section}>
          <SectionHeader
            eyebrow="Symbols"
            title="우솔과 목련"
          />
          <div className={styles.symbolGrid}>
            {SYMBOLS.map((symbol) => {
              const Icon = symbol.icon;
              return (
                <article key={symbol.title} className={styles.symbolCard}>
                  <div className={styles.symbolLabel}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{symbol.title}</span>
                  </div>
                  <h3>{symbol.subtitle}</h3>
                  <p>{symbol.description}</p>
                </article>
              )
            })}
          </div>
        </section>


        {/* 학교 통계 섹션 */}
        <section className={styles.section}>
          <SectionHeader
            eyebrow="Statistics"
            title="학교 통계"
          />
          <div className={styles.statsGrid}>
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={styles.statCard}>
                  <Icon size={24} aria-hidden="true" />
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              );
            })}
          </div>
        </section>


        {/* 학교 역사 타임라인 섹션 */}
        <section className={styles.section}>
          <SectionHeader
            eyebrow="History"
            title="학교 역사"
          />
          <ol className={styles.timeline}>
            {HISTORY.map((item) => (
              <li key={`${item.date}-${item.title}`}>
                <time>{item.date}</time>
                <h3>{item.title}</h3>
              </li>
            ))}
          </ol>
        </section>

      </div>
    </div>
  );
}
