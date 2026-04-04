import { SPORTS_LEAGUE_CATEGORY_ID } from '../features/sportsLeague/data.js';
import {
  buildBudgetListPath,
  getCurrentBudgetRouteParams,
} from '../pages/Notices/BudgetBoard/budgetUtils.js';
import {
  buildCanonicalUrl,
  buildDocumentTitle,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_URL,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  normalizePathname,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
} from './site.js';

export const HOME_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: buildCanonicalUrl('/'),
    description: DEFAULT_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: buildCanonicalUrl('/'),
    logo: buildCanonicalUrl('/mit_logo.png'),
    description: DEFAULT_DESCRIPTION,
  },
];

function createStaticRouteEntries(date = new Date()) {
  const { budgetYear, budgetMonth } = getCurrentBudgetRouteParams(date);
  const currentBudgetPath = buildBudgetListPath(budgetYear, budgetMonth);

  return [
    {
      path: '/',
      title: '홈',
      description:
        '범서고 학생을 위한 학교 생활 정보와 커뮤니티를 빠르게 확인할 수 있는 beomseo.in — 공지사항, 급식, 시간표, 학사 캘린더, 스포츠리그까지 한 곳에서.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [{ name: '홈', url: '/' }],
      jsonLd: HOME_JSON_LD,
    },
    {
      path: '/notices/school',
      title: '학교 공지',
      description:
        '범서고 학교 공지사항을 확인하세요. 시험 일정, 학사 안내, 학교 행사 정보를 한 곳에서 볼 수 있습니다.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '공지사항', url: '/notices/school' },
        { name: '학교 공지', url: '/notices/school' },
      ],
    },
    {
      path: '/notices/council',
      title: '학생회 공지',
      description:
        '범서고 학생회 공지사항을 확인하세요. 학생회 활동, 행사 안내, 예산 집행 결과를 빠르게 확인할 수 있습니다.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '공지사항', url: '/notices/school' },
        { name: '학생회 공지', url: '/notices/council' },
      ],
    },
    {
      path: '/notices/lost-found',
      title: '분실물 센터',
      description:
        '범서고 습득물 사진과 보관 정보를 빠르게 확인하고 주인을 찾아주세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '공지사항', url: '/notices/school' },
        { name: '분실물 센터', url: '/notices/lost-found' },
      ],
    },
    {
      path: currentBudgetPath,
      title: '예산 공개 게시판',
      description:
        '범서고 학생회 예산 집행과 지출 내역을 월별로 투명하게 확인하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '공지사항', url: '/notices/school' },
        { name: '예산 공개', url: currentBudgetPath },
      ],
    },
    {
      path: '/school-info',
      title: '학교 생활 정보',
      description:
        '범서고 학교 생활에 필요한 시간표, 급식, 학사 캘린더, 스포츠리그 정보를 한 곳에서 확인하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '학교 생활 정보', url: '/school-info' },
      ],
    },
    {
      path: '/school-info/timetable',
      title: '시간표 다운로드',
      description:
        '범서고 반별 시간표를 확인하고 2, 3학년 선택과목을 반영한 개인 시간표 PNG를 저장할 수 있습니다.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '학교 생활 정보', url: '/school-info' },
        { name: '시간표 다운로드', url: '/school-info/timetable' },
      ],
    },
    {
      path: '/school-info/meal',
      title: '오늘의 급식',
      description:
        '범서고 오늘 전후의 점심 메뉴와 이달 급식 달력을 함께 확인할 수 있어요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '학교 생활 정보', url: '/school-info' },
        { name: '오늘의 급식', url: '/school-info/meal' },
      ],
    },
    {
      path: '/school-info/calendar',
      title: '2026학년도 학사 캘린더',
      description:
        '범서고 2026학년도 학사 일정, 시험, 방학, 진학 일정을 월간 캘린더와 리스트로 확인할 수 있습니다.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '학교 생활 정보', url: '/school-info' },
        { name: '학사 캘린더', url: '/school-info/calendar' },
      ],
    },
    {
      path: `/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`,
      title: '스포츠리그 실시간 중계',
      description:
        '범서고 스포츠리그 실시간 중계, 예선 순위판, 주차별 대진표, 경기 규칙을 한 곳에서 확인하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '학교 생활 정보', url: '/school-info' },
        {
          name: '스포츠리그',
          url: `/school-info/sports-league/${SPORTS_LEAGUE_CATEGORY_ID}`,
        },
      ],
    },
    {
      path: '/community/free',
      title: '자유 게시판',
      description:
        '범서고 자유 게시판에서 잡담, 정보, QnA 글을 자유롭게 공유하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/free' },
        { name: '자유 게시판', url: '/community/free' },
      ],
    },
    {
      path: '/community/club-recruit',
      title: '동아리 모집 게시판',
      description:
        '범서고 동아리 모집 글과 포스터를 학년별로 빠르게 확인하세요.',
      indexable: false,
      prerender: false,
      sitemap: false,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/club-recruit' },
        { name: '동아리 모집', url: '/community/club-recruit' },
      ],
    },
    {
      path: '/community/subjects',
      title: '선택과목 변경 게시판',
      description:
        '범서고 선택과목 변경 게시판에서 주는 과목과 받고 싶은 과목 정보를 확인하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/subjects' },
        { name: '선택과목 변경', url: '/community/subjects' },
      ],
    },
    {
      path: '/community/petition',
      title: '학생 청원 게시판',
      description:
        '범서고 학생 청원 게시판에서 추천 현황과 학생회 답변 진행 상태를 확인하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/petition' },
        { name: '학생 청원', url: '/community/petition' },
      ],
    },
    {
      path: '/community/survey',
      title: '설문조사 품앗이',
      description:
        '범서고 설문조사 품앗이에서 설문을 올리고 서로 응답을 주고받으세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/survey' },
        { name: '설문조사 품앗이', url: '/community/survey' },
      ],
    },
    {
      path: '/community/vote',
      title: '실시간 투표 게시판',
      description:
        '범서고 실시간 투표 게시판에서 현재 진행 중인 투표와 결과를 확인하세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/vote' },
        { name: '실시간 투표', url: '/community/vote' },
      ],
    },
    {
      path: '/community/gomsol-market',
      title: '곰솔마켓',
      description:
        '범서고 교내 중고거래 장터 곰솔마켓에서 필요한 물건을 쉽게 찾아보세요.',
      indexable: true,
      prerender: true,
      sitemap: true,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/gomsol-market' },
        { name: '곰솔마켓', url: '/community/gomsol-market' },
      ],
    },
    {
      path: '/community/field-trip',
      title: '수학여행 허브',
      description:
        '범서고 수학여행 허브에서 반별 현장 기록과 공지, 점수판을 확인하세요.',
      indexable: false,
      prerender: false,
      sitemap: false,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '커뮤니티', url: '/community/field-trip' },
        { name: '수학여행 허브', url: '/community/field-trip' },
      ],
    },
    {
      path: '/login',
      title: '로그인',
      description: 'beomseo.in 계정으로 로그인합니다.',
      indexable: false,
      prerender: false,
      sitemap: false,
    },
    {
      path: '/signup',
      title: '회원가입',
      description: 'beomseo.in 계정을 생성합니다.',
      indexable: false,
      prerender: false,
      sitemap: false,
    },
    {
      path: '/privacy',
      title: '개인정보처리방침',
      description: 'beomseo.in 개인정보처리방침 안내 페이지입니다.',
      indexable: false,
      prerender: false,
      sitemap: false,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '개인정보처리방침', url: '/privacy' },
      ],
    },
    {
      path: '/terms',
      title: '이용약관',
      description: 'beomseo.in 이용약관 안내 페이지입니다.',
      indexable: false,
      prerender: false,
      sitemap: false,
      breadcrumbs: [
        { name: '홈', url: '/' },
        { name: '이용약관', url: '/terms' },
      ],
    },
  ];
}

export function getStaticSeoEntries(date = new Date()) {
  return createStaticRouteEntries(date);
}

export function getStaticRouteSeo(pathname, date = new Date()) {
  const normalized = normalizePathname(pathname);
  return getStaticSeoEntries(date).find((entry) => entry.path === normalized) || null;
}

export function getPrerenderRoutes(date = new Date()) {
  return getStaticSeoEntries(date)
    .filter((entry) => entry.prerender)
    .map((entry) => entry.path);
}

export function getSitemapEntries(date = new Date()) {
  return getStaticSeoEntries(date).filter((entry) => entry.sitemap);
}

export function isNoindexRoute(pathname) {
  const normalized = normalizePathname(pathname);

  if (getStaticRouteSeo(normalized)?.indexable === false) {
    return true;
  }

  return [
    /^\/notices\/[^/]+\/new$/u,
    /^\/notices\/[^/]+\/\d+\/edit$/u,
    /^\/notices\/budget\/\d{4}\/\d{2}\/new$/u,
    /^\/notices\/budget\/\d{4}\/\d{2}\/\d+\/edit$/u,
    /^\/notices\/lost-found\/new$/u,
    /^\/community\/[^/]+\/new$/u,
    /^\/community\/free\/\d+\/edit$/u,
    /^\/community\/survey\/\d+\/edit$/u,
    /^\/community\/survey\/\d+\/results$/u,
    /^\/community\/subjects\/\d+$/u,
    /^\/community\/gomsol-market\/\d+$/u,
    /^\/community\/field-trip\/classes\/[^/]+$/u,
    /^\/community\/field-trip\/classes\/[^/]+\/new$/u,
    /^\/community\/field-trip\/classes\/[^/]+\/posts\/[^/]+$/u,
    /^\/community\/field-trip\/classes\/[^/]+\/posts\/[^/]+\/edit$/u,
  ].some((pattern) => pattern.test(normalized));
}

export function createPrerenderHead(pathname, date = new Date()) {
  const entry = getStaticRouteSeo(pathname, date);
  const canonicalPath = entry?.canonicalPath || normalizePathname(pathname);
  const title = buildDocumentTitle(entry?.title);
  const description = entry?.description || DEFAULT_DESCRIPTION;
  const robots = entry?.indexable === false ? NOINDEX_ROBOTS : INDEX_ROBOTS;
  const url = buildCanonicalUrl(canonicalPath);
  const ogType = entry?.type || 'website';
  const breadcrumbJsonLd =
    entry?.breadcrumbs?.length > 0
      ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: entry.breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: crumb.url.startsWith('http') ? crumb.url : buildCanonicalUrl(crumb.url),
        })),
      }
      : null;
  const jsonLdSchemas = [...(entry?.jsonLd || []), breadcrumbJsonLd].filter(Boolean);

  return {
    lang: SITE_LANGUAGE,
    title,
    elements: new Set([
      { type: 'meta', props: { name: 'description', content: description } },
      { type: 'meta', props: { name: 'robots', content: robots } },
      { type: 'link', props: { rel: 'canonical', href: url } },
      { type: 'meta', props: { property: 'og:type', content: ogType } },
      { type: 'meta', props: { property: 'og:title', content: title } },
      { type: 'meta', props: { property: 'og:description', content: description } },
      { type: 'meta', props: { property: 'og:url', content: url } },
      { type: 'meta', props: { property: 'og:image', content: DEFAULT_OG_IMAGE_URL } },
      { type: 'meta', props: { property: 'og:site_name', content: SITE_NAME } },
      { type: 'meta', props: { property: 'og:locale', content: SITE_LOCALE } },
      { type: 'meta', props: { name: 'twitter:card', content: 'summary_large_image' } },
      { type: 'meta', props: { name: 'twitter:title', content: title } },
      { type: 'meta', props: { name: 'twitter:description', content: description } },
      { type: 'meta', props: { name: 'twitter:image', content: DEFAULT_OG_IMAGE_URL } },
      ...jsonLdSchemas.map((schema) => ({
        type: 'script',
        props: { type: 'application/ld+json' },
        children: JSON.stringify(schema),
      })),
    ]),
  };
}
