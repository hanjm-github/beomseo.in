import { PETITION_THRESHOLD_DEFAULT } from '../../config/env';

export const THRESHOLD_DEFAULT = PETITION_THRESHOLD_DEFAULT;

const PAGE_SIZE_DEFAULT = 12;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CATEGORY_OPTIONS = [
  '기타',
  '회장단',
  '3학년부',
  '2학년부',
  '정보기술부',
  '방송부',
  '학예부',
  '체육부',
  '진로부',
  '홍보부',
  '기후환경부',
  '학생지원부',
  '생활안전부',
  '융합인재부',
];

const deriveStatus = (item) => {
  if (item?.answer) return 'answered';
  if ((item?.votes || 0) >= (item?.threshold || THRESHOLD_DEFAULT)) return 'waiting-answer';
  return 'needs-support';
};

const summarize = (text = '') => {
  const clean = text.replace(/<[^>]+>/g, '');
  return clean.length > 200 ? `${clean.slice(0, 200)}...` : clean;
};

let mockPetitions = [
  {
    id: 'pet-1',
    title: '급식실 냉난방 온도 조절 개선 요청',
    summary: '점심시간에 너무 더워서 식사하기 힘들어요. 센서 재조정과 선풍기 추가 요청합니다.',
    category: '학생지원부',
    votes: 32,
    threshold: THRESHOLD_DEFAULT,
    status: 'approved',
    createdAt: '2026-03-04T01:00:00Z',
    author: { nickname: '별빛', role: 'student' },
  },
  {
    id: 'pet-2',
    title: '3학년 자습실 콘센트 추가 설치',
    summary: '노트북 사용 인원이 늘어났습니다. 벽면 4구 콘센트 3세트 추가 설치 부탁드립니다.',
    category: '생활안전부',
    votes: 54,
    threshold: THRESHOLD_DEFAULT,
    status: 'approved',
    createdAt: '2026-03-05T03:30:00Z',
    author: { nickname: '공대꿈나무', role: 'student' },
    answer: {
      responder: '학생회장',
      role: 'student-council',
      content: '행정실과 협의하여 3월 둘째 주에 설치 완료 예정입니다. 진행 상황을 공지로 안내하겠습니다.',
      updatedAt: '2026-03-06T06:00:00Z',
    },
  },
  {
    id: 'pet-3',
    title: '체육대회 종목에 배드민턴 추가',
    summary: '비인기 종목 다양화를 위해 배드민턴 단식/복식 예선을 도입하면 좋겠습니다.',
    category: '체육부',
    votes: 12,
    threshold: THRESHOLD_DEFAULT,
    status: 'pending',
    createdAt: '2026-03-06T09:10:00Z',
    author: { nickname: '체육부', role: 'student-council' },
  },
];

async function list(params = {}) {
  await delay(100);
  const {
    status,
    approval,
    statusDerived,
    category,
    q,
    sort = 'recent',
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
  } = params;
  let data = mockPetitions.map((p) => ({ ...p, statusDerived: deriveStatus(p) }));

  if (approval === 'approved') {
    data = data.filter((p) => p.status === 'approved');
  } else if (approval === 'unapproved') {
    data = data.filter((p) => p.status !== 'approved');
  } else if (status && status !== 'all') {
    data = data.filter((p) => p.status === status);
  }
  if (statusDerived && statusDerived !== 'all') {
    data = data.filter((p) => deriveStatus(p) === statusDerived);
  }
  if (category && CATEGORY_OPTIONS.includes(category)) data = data.filter((p) => p.category === category);
  if (q) {
    const keyword = q.toLowerCase();
    data = data.filter(
      (p) =>
        p.title.toLowerCase().includes(keyword) ||
        p.summary.toLowerCase().includes(keyword) ||
        (p.body || '').toLowerCase().includes(keyword)
    );
  }

  if (sort === 'votes') {
    data.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  } else {
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const start = (page - 1) * pageSize;
  return {
    items: data.slice(start, start + pageSize),
    total: data.length,
    page,
    pageSize,
  };
}

async function detail(id) {
  await delay(80);
  const found = mockPetitions.find((p) => p.id === id);
  if (!found) throw new Error('Not found');
  return { ...found, statusDerived: deriveStatus(found) };
}

async function create(payload) {
  await delay(120);
  const now = new Date().toISOString();
  const item = {
    id: `pet-${Date.now()}`,
    title: payload.title,
    summary: payload.summary || summarize(payload.body),
    body: payload.body || '',
    category: payload.category || '기타',
    votes: 0,
    threshold: payload.threshold || THRESHOLD_DEFAULT,
    status: 'pending',
    createdAt: now,
    author: payload.author || { nickname: '익명', role: 'student' },
    isVotedByMe: false,
  };
  mockPetitions = [item, ...mockPetitions];
  return { ...item, statusDerived: deriveStatus(item) };
}

async function vote(id, action) {
  await delay(60);
  mockPetitions = mockPetitions.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p };
    const already = !!next.isVotedByMe;
    if (action === 'up' && !already) {
      next.votes = (next.votes || 0) + 1;
      next.isVotedByMe = true;
    } else if (action === 'cancel' && already) {
      next.votes = Math.max(0, (next.votes || 0) - 1);
      next.isVotedByMe = false;
    }
    return next;
  });
  const updated = mockPetitions.find((p) => p.id === id);
  return { votes: updated.votes, isVotedByMe: updated.isVotedByMe, status: deriveStatus(updated) };
}

async function answer(id, payload) {
  await delay(80);
  mockPetitions = mockPetitions.map((p) =>
    p.id === id
      ? {
          ...p,
          answer: {
            responder: payload.responder || '학생회장',
            role: payload.role || 'student-council',
            content: payload.content || '',
            updatedAt: new Date().toISOString(),
          },
        }
      : p
  );
  return detail(id);
}

async function approve(id) {
  const found = mockPetitions.find((p) => p.id === id);
  if (found) found.status = 'approved';
  return detail(id);
}

async function unapprove(id) {
  const found = mockPetitions.find((p) => p.id === id);
  if (found) found.status = 'rejected';
  return detail(id);
}

export const petitionMockApi = {
  list,
  detail,
  create,
  vote,
  answer,
  approve,
  unapprove,
  deriveStatus,
  CATEGORY_OPTIONS,
};
