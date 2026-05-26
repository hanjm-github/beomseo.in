/**
 * @file src/features/sportsLeague/data.js
 * @description Declares shared metadata for sports league live text pages.
 */

export const SPORTS_LEAGUE_CATEGORY_ID = '2026-spring-grade2-boys-soccer';
export const LEGACY_SPORTS_LEAGUE_CATEGORY_ID = '2026-spring-grade3-boys-soccer';
export const SPORTS_LEAGUE_STORAGE_VERSION = '2026.05.26';
export const SPORTS_LEAGUE_MANAGER_ROLES = ['admin', 'student_council'];

// Static options keep the switcher usable while the API category list is loading.
export const SPORTS_LEAGUE_CATEGORY_OPTIONS = [
  {
    id: SPORTS_LEAGUE_CATEGORY_ID,
    title: '2026 1학기 2학년 남자 축구',
    seasonLabel: '2026 1학기',
    gradeLabel: '2학년',
    sportLabel: '남자 축구',
    scheduleWindowLabel: '2026.05.26 ~ 2026.06.08',
    storageVersion: SPORTS_LEAGUE_STORAGE_VERSION,
  },
  {
    id: LEGACY_SPORTS_LEAGUE_CATEGORY_ID,
    title: '2026 1학기 3학년 남자 축구',
    seasonLabel: '2026 1학기',
    gradeLabel: '3학년',
    sportLabel: '남자 축구',
    scheduleWindowLabel: '2026.03.16 ~ 2026.04.08',
    storageVersion: '2026.03.15',
  },
];

export const SPORTS_EVENT_TEMPLATES = [
  {
    id: 'note',
    label: '일반',
    helper: '일반 운영 문구를 입력합니다.',
    placeholder: '예: 킥오프 직전 선수들이 입장했습니다.',
    defaultStatus: null,
  },
  {
    id: 'kickoff',
    label: '경기 시작',
    helper: '킥오프 직후 경기 시작 안내를 올립니다.',
    placeholder: '예: 휘슬과 함께 경기가 시작됐습니다.',
    defaultStatus: 'kickoff',
  },
  {
    id: 'goal',
    label: '득점',
    helper: '득점 직후 점수를 함께 기록합니다.',
    placeholder: '예: 2-6.2-9의 중거리 슛이 그대로 골문으로 들어갑니다!',
    defaultStatus: 'live',
  },
  {
    id: 'yellow',
    label: '경고',
    helper: '옐로카드 상황을 기록합니다.',
    placeholder: '예: 거친 태클로 경고가 선언됐습니다.',
    defaultStatus: 'live',
  },
  {
    id: 'red',
    label: '퇴장',
    helper: '레드카드 상황을 기록합니다.',
    placeholder: '예: 누적 경고로 퇴장이 선언됐습니다.',
    defaultStatus: 'live',
  },
  {
    id: 'halftime',
    label: '전반 종료',
    helper: '전반 종료 시점 안내',
    placeholder: '예: 전반이 종료됐습니다. 잠시 후 후반이 시작됩니다.',
    defaultStatus: 'halftime',
  },
  {
    id: 'second_half',
    label: '후반 시작',
    helper: '후반 시작 안내',
    placeholder: '예: 후반전이 시작됐습니다.',
    defaultStatus: 'live',
  },
  {
    id: 'fulltime',
    label: '경기 종료',
    helper: '최종 스코어를 함께 확정합니다.',
    placeholder: '예: 경기 종료! 결승행 팀이 결정됐습니다.',
    defaultStatus: 'completed',
  },
];
