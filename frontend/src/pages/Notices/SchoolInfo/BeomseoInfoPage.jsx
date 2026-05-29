/**
 * @file src/pages/Notices/SchoolInfo/BeomseoInfoPage.jsx
 * @description Static school profile page for Beomseo High School.
 */
import {
  BadgeCheck,
  BookOpen,
  Compass,
  ExternalLink,
  Eye,
  Flower2,
  GraduationCap,
  HeartHandshake,
  MapPin,
  School,
  Sparkles,
  TreePine,
  Trophy,
  UsersRound,
} from 'lucide-react';

import SEO from '../../../components/SEO';
import '../../page-shell.css';
import SchoolInfoTabs from './SchoolInfoTabs';
import styles from './BeomseoInfoPage.module.css';

// Static content mirrors official school profile pages, so source URLs stay beside the data they validate.
const OFFICIAL_URLS = {
  educationDirection: 'https://school.use.go.kr/beomseo-h/M010202/',
  history: 'https://school.use.go.kr/beomseo-h/M010204/',
  symbols: 'https://school.use.go.kr/beomseo-h/M010205/',
  status: 'https://school.use.go.kr/beomseo-h/M010206/',
  location: 'https://school.use.go.kr/beomseo-h/M010212/',
  homepage: 'https://school.use.go.kr/beomseo-h',
};

const HERO_TAGS = ['지혜로운 눈', '따뜻한 가슴', '조화로운 성장'];

const EDUCATION_GROUPS = [
  {
    title: '교육목표',
    description: '지적 능력과 고운 인성이 조화로운 인간으로 성장시킨다.',
    icon: Eye,
  },
  {
    title: '경영목표',
    items: [
      '학습에 대한 열정이 있는 학교',
      '원칙과 정의를 존중하는 학교',
      '자아실현의 기틀을 다져가는 학교',
    ],
    icon: HeartHandshake,
  },
  {
    title: '교육중점',
    items: [
      '수준 높은 교수-학습',
      '적성과 능력에 맞는 진로 지도',
      '가치와 정의를 존중하는 따뜻한 인성 교육',
    ],
    icon: Sparkles,
  },
];

const SYMBOLS = [
  {
    title: '교표',
    subtitle: 'BS, 책과 세계로 뻗어가는 길',
    description:
      'BS는 범서의 머리글자입니다. B는 지혜를 탐구하기 위해 펼친 책을, S는 세계로 뻗어가는 길을 형상화했습니다.',
    icon: BadgeCheck,
  },
  {
    title: '교목',
    subtitle: '곰솔',
    description:
      '곰솔은 해송 또는 흑송이라고도 불리는 소나무과 상록수입니다. 끈기와 장수, 장대함을 상징합니다.',
    icon: TreePine,
  },
  {
    title: '교화',
    subtitle: '모란',
    description:
      '모란은 화중지왕으로 불립니다. 풍성한 꽃과 잎처럼 범서고의 행복과 번영을 기원합니다.',
    icon: Flower2,
  },
];

const STATS = [
  { label: '학생 수', value: '966명', detail: '2026년 공식 현황', icon: UsersRound },
  { label: '학급 구성', value: '31학급', detail: '일반 30 + 특수 1', icon: School },
  { label: '교원', value: '62명', detail: '교과·전문 지원', icon: GraduationCap },
  { label: '교직원 총계', value: '91명', detail: '학교 운영 전체 인원', icon: BookOpen },
];

const HISTORY = [
  { date: '2007.12.27', title: '범서고등학교 설립 인가' },
  { date: '2008.03.01', title: '범서고등학교 개교' },
  { date: '2011.02.11', title: '제1회 졸업식, 485명 졸업' },
  { date: '2023.09.01', title: '제7대 안병태 교장 취임' },
  { date: '2025.02.25', title: '제15회 졸업식, 총 졸업생 5,590명' },
  { date: '2025.03.04', title: '제18회 입학식, 신입생 314명 입학' },
];

const CONTACT_ITEMS = [
  { label: '주소', value: '(우:44920) 울산광역시 울주군 범서읍 대리로 69', icon: MapPin },
];

const MAP_LINKS = [
  {
    label: '큰지도보기',
    href: 'https://map.kakao.com/link/map/범서고등학교,35.5699278,129.2492496',
  },
  {
    label: '길찾기',
    href: 'https://map.kakao.com/link/to/범서고등학교,35.5699278,129.2492496',
  },
];

const SOURCE_LINKS = [
  { label: '교육의 기본방향', href: OFFICIAL_URLS.educationDirection },
  { label: '학교연혁', href: OFFICIAL_URLS.history },
  { label: '학교상징', href: OFFICIAL_URLS.symbols },
  { label: '학교현황', href: OFFICIAL_URLS.status },
  { label: '오시는 길', href: OFFICIAL_URLS.location },
];

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className={styles.sectionHeader}>
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <span>{description}</span> : null}
    </div>
  );
}

export default function BeomseoInfoPage() {
  return (
    <div className="page-shell">
      <SEO path="/notices/school-info/bshs-info" />
      <SchoolInfoTabs />

      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="beomseo-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Beomseo High School</p>
            <h1 id="beomseo-title">범서고등학교</h1>
            <p className={styles.heroStatement}>
              <strong>지혜로운 눈</strong>으로 꿈을 이루고
              <br />
              <strong>따뜻한 가슴</strong>으로 인류에 봉사하자
            </p>
            <p className={styles.heroDescription}>
              범서고는 지적 능력과 고운 인성이 조화로운 사람으로 성장하는 배움의 장입니다.
              곰솔의 끈기와 모란의 풍성함을 담아, 학생의 오늘과 내일을 함께 키웁니다.
            </p>
            <div className={styles.heroTags} aria-label="범서고 핵심 문장">
              {HERO_TAGS.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className={styles.heroActions}>
              <a
                href={OFFICIAL_URLS.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.secondaryLink}
              >
                공식 홈페이지
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className={styles.heroVisual} aria-label="범서고 핵심 현황">
            <div className={styles.heroWordmark}>
              <School size={34} aria-hidden="true" />
              <span>BSHS</span>
              <strong>Beomseo High School</strong>
            </div>
            <div className={styles.heroFactGrid}>
              <div>
                <span>개교</span>
                <strong>2008</strong>
              </div>
              <div>
                <span>재학생</span>
                <strong>966</strong>
              </div>
              <div>
                <span>교목</span>
                <strong>곰솔</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="education-direction" className={styles.section}>
          <SectionHeader
            eyebrow="Education Direction"
            title="교육의 기본방향"
            description="공식 홈페이지의 이미지 내용을 텍스트로 옮겨 핵심 방향만 읽기 쉽게 정리했습니다."
          />
          <div className={styles.directionCards}>
            {EDUCATION_GROUPS.map((group) => {
              const Icon = group.icon;

              return (
                <article key={group.title} className={styles.directionCard}>
                  <div className={styles.iconBadge}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <h3>{group.title}</h3>
                  {group.description ? <p>{group.description}</p> : null}
                  {group.items ? (
                    <ul>
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHeader
            eyebrow="School Symbols"
            title="곰솔과 모란, 그리고 세계로 향하는 길"
            description="범서고의 상징은 학교의 태도와 방향을 압축합니다."
          />
          <div className={styles.symbolGrid}>
            {SYMBOLS.map((symbol) => {
              const Icon = symbol.icon;

              return (
                <article key={symbol.title} className={styles.symbolCard}>
                  <div className={styles.symbolCopy}>
                    <div className={styles.symbolLabel}>
                      <Icon size={18} aria-hidden="true" />
                      <span>{symbol.title}</span>
                    </div>
                    <h3>{symbol.subtitle}</h3>
                    <p>{symbol.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHeader
            eyebrow="At A Glance"
            title="숫자로 보는 범서고"
            description="2026년 공식 학교현황을 학생이 보기 쉬운 단위로 재구성했습니다."
          />
          <div className={styles.statGrid}>
            {STATS.map((stat) => {
              const Icon = stat.icon;

              return (
                <article key={stat.label} className={styles.statCard}>
                  <Icon size={22} aria-hidden="true" />
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <p>{stat.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.storySection}>
          <div className={styles.storyIntro}>
            <p>History</p>
            <h2>2007년 설립 인가에서 2025년 현재까지</h2>
            <span>
              범서고의 연혁은 입학과 졸업, 교육 성과, 학교 운영의 흐름이 차곡차곡 쌓인 기록입니다.
            </span>
          </div>
          <ol className={styles.timeline}>
            {HISTORY.map((item) => (
              <li key={`${item.date}-${item.title}`}>
                <time>{item.date}</time>
                <strong>{item.title}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.contactSection}>
          <div className={styles.contactIntro}>
            <div className={styles.iconBadge}>
              <Compass size={20} aria-hidden="true" />
            </div>
            <p>Location</p>
            <h2>오시는 길</h2>
            <span>범서읍 대리로 69, 곰솔이 자라는 학교로 오세요.</span>
          </div>

          <div className={styles.contactList}>
            {CONTACT_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className={styles.contactItem}>
                  <Icon size={18} aria-hidden="true" />
                  <div>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.mapActions}>
            {MAP_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <section className={styles.sourceSection} aria-labelledby="source-title">
          <div>
            <Trophy size={20} aria-hidden="true" />
            <h2 id="source-title">공식 자료 출처</h2>
          </div>
          <div className={styles.sourceLinks}>
            {SOURCE_LINKS.map((source) => (
              <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
