import {
  addDays,
  addMonths,
  endOfMonth,
  formatDateKey,
  getMealStatus,
  getReferenceDate,
  getMonthOptions,
  startOfMonth,
} from './utils';

const LUNCH_TEMPLATES = [
  ['흑미밥', '쇠고기미역국', '간장불고기', '감자채볶음', '배추김치', '오렌지'],
  ['차조밥', '된장찌개', '치즈닭갈비', '양배추샐러드', '깍두기', '사과주스'],
  ['현미밥', '어묵국', '고추장제육볶음', '계란말이', '열무김치', '요거트'],
  ['기장밥', '콩나물국', '순살치킨강정', '단호박샐러드', '배추김치', '청포도'],
  ['보리밥', '순두부찌개', '돈까스', '콘샐러드', '깍두기', '망고푸딩'],
  ['혼합잡곡밥', '유부우동국물', '숯불오리불고기', '부추겉절이', '배추김치', '파인애플'],
  ['백미밥', '설렁탕', '고기산적구이', '오이무침', '깍두기', '한라봉주스'],
  ['강황밥', '김치콩나물국', '치킨마요소스볶음', '브로콜리참깨무침', '총각김치', '바나나'],
  ['귀리밥', '맑은감자국', '떡갈비구이', '실곤약야채무침', '배추김치', '딸기우유'],
  ['수수밥', '북엇국', '마파두부', '새우볼튀김', '깍두기', '배'],
  ['찰옥수수밥', '들깨무채국', '언양식불고기', '참나물무침', '배추김치', '자두'],
  ['율무밥', '부대찌개', '미니함박스테이크', '양상추사과무침', '깍두기', '키위'],
];

const LUNCH_NOTES = [
  '국물과 메인 반찬의 온도 차가 잘 살아나는 조합이에요.',
  '학생 선호도가 높은 메뉴를 중심으로 묶은 날이에요.',
  '오후 수업 전까지 든든하게 버틸 수 있는 메뉴 흐름이에요.',
  '한 입에 맛이 겹치지 않도록 담백한 반찬을 같이 배치했어요.',
  '금방 비워지는 인기 반찬 조합이라 서둘러 확인해두면 좋아요.',
];
const RATING_SCORES = [1, 2, 3, 4, 5];

function buildEmptyRatingSummary() {
  return {
    averageScore: null,
    totalCount: 0,
    myScore: null,
    distribution: RATING_SCORES.map((score) => ({
      score,
      count: 0,
      ratio: 0,
    })),
  };
}

function buildMockRatingSummary(seed) {
  const distribution = RATING_SCORES.map((score) => ({
    score,
    count: 2 + ((seed + score * 3) % 9),
  }));
  const totalCount = distribution.reduce((sum, bucket) => sum + bucket.count, 0);
  const weightedTotal = distribution.reduce((sum, bucket) => sum + (bucket.score * bucket.count), 0);

  return {
    averageScore: Number((weightedTotal / totalCount).toFixed(1)),
    totalCount,
    myScore: RATING_SCORES[seed % RATING_SCORES.length],
    distribution: distribution.map((bucket) => ({
      ...bucket,
      ratio: Math.round((bucket.count / totalCount) * 100),
    })),
  };
}

function buildMockRatings(seed) {
  return {
    taste: buildMockRatingSummary(seed),
    anticipation: buildMockRatingSummary(seed + 11),
  };
}

export function getMealEntries(baseDate = new Date()) {
  const referenceDate = getReferenceDate(baseDate);
  const previousMonth = startOfMonth(addMonths(referenceDate, -1));
  const nextMonth = endOfMonth(addMonths(referenceDate, 1));
  const entries = [];

  let cursor = previousMonth;
  let weekdayIndex = 0;

  while (cursor.getTime() <= nextMonth.getTime()) {
    const dateKey = formatDateKey(cursor);
    const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
    const templateIndex = (cursor.getDate() + cursor.getMonth() * 3 + weekdayIndex) % LUNCH_TEMPLATES.length;
    const noteIndex = (cursor.getDate() + cursor.getMonth()) % LUNCH_NOTES.length;
    const dateSeed = Number(dateKey.replaceAll('-', ''));

    if (isWeekend) {
      entries.push({
        id: `meal-${dateKey}`,
        date: dateKey,
        status: 'empty',
        service: 'lunch',
        serviceLabel: '중식',
        menuItems: [],
        previewText: '주말에는 점심 급식을 운영하지 않아요.',
        note: '학교 운영 일정상 주말은 급식이 없습니다.',
        isNoMeal: true,
        calorieText: null,
        caloriesKcal: null,
        originItems: [],
        nutritionItems: [],
        ratings: {
          taste: buildEmptyRatingSummary(),
          anticipation: buildEmptyRatingSummary(),
        },
      });
    } else {
      const menuItems = LUNCH_TEMPLATES[templateIndex];
      const caloriesKcal = 720 + ((templateIndex * 23 + cursor.getDate()) % 140);
      const calorieText = `${caloriesKcal.toFixed(1)} Kcal`;
      const nutritionItems = [
        `탄수화물 ${String(95 + ((templateIndex * 7) % 28)).padStart(2, '0')}g`,
        `단백질 ${String(24 + ((templateIndex * 5) % 14)).padStart(2, '0')}g`,
        `지방 ${String(18 + ((templateIndex * 3) % 12)).padStart(2, '0')}g`,
        `나트륨 ${780 + ((templateIndex * 61) % 420)}mg`,
      ];
      const originItems = [
        '쌀(국내산)',
        templateIndex % 2 === 0 ? '돼지고기(국내산)' : '닭고기(국내산)',
        '배추김치(배추/고춧가루 국내산)',
      ];

      entries.push({
        id: `meal-${dateKey}`,
        date: dateKey,
        status: getMealStatus({ date: dateKey, isNoMeal: false }, referenceDate),
        service: 'lunch',
        serviceLabel: '중식',
        menuItems,
        previewText: menuItems.slice(0, 3).join(' · '),
        note: LUNCH_NOTES[noteIndex],
        isNoMeal: false,
        calorieText,
        caloriesKcal,
        originItems,
        nutritionItems,
        ratings: buildMockRatings(dateSeed),
      });
    }

    weekdayIndex += 1;
    cursor = addDays(cursor, 1);
  }

  return entries;
}

export function getMealEntriesByDate(baseDate = new Date()) {
  return Object.fromEntries(getMealEntries(baseDate).map((entry) => [entry.date, entry]));
}

export function getMealEntryForDate(dateKey, baseDate = new Date()) {
  return getMealEntriesByDate(baseDate)[dateKey] || null;
}

export function getTodayMealEntry(baseDate = new Date()) {
  const referenceDate = getReferenceDate(baseDate);
  return getMealEntryForDate(formatDateKey(referenceDate), baseDate);
}

export function getMealMonthOptions(baseDate = new Date()) {
  return getMonthOptions(getReferenceDate(baseDate));
}
