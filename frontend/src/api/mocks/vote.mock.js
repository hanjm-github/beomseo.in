import { earnMockSurveyCredits } from '../mockSurveyCreditStore';

const PAGE_SIZE_DEFAULT = 12;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

const toSafeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const sortByRecent = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

const sortByParticipation = (a, b) => {
  const diff = (b.totalVotes || 0) - (a.totalVotes || 0);
  if (diff !== 0) return diff;
  return sortByRecent(a, b);
};

const sortByDeadline = (a, b) => {
  const getTime = (value) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };
  const diff = getTime(a.closesAt) - getTime(b.closesAt);
  if (diff !== 0) return diff;
  return sortByRecent(a, b);
};

function deriveStatus(post) {
  if (post?.status === 'closed') return 'closed';
  if (post?.closesAt) {
    const closeTime = new Date(post.closesAt).getTime();
    if (Number.isFinite(closeTime) && closeTime <= Date.now()) return 'closed';
  }
  return 'open';
}

function normalizeOptions(options = [], totalVotesInput = null) {
  const normalized = (Array.isArray(options) ? options : []).map((option, index) => ({
    id: String(option?.id ?? option?.optionId ?? option?.key ?? `opt-${index + 1}`),
    text: String(option?.text ?? option?.label ?? option?.title ?? `선택지 ${index + 1}`),
    votes: Math.max(0, toSafeNumber(option?.votes ?? option?.count ?? 0)),
    pct: toSafeNumber(option?.pct, null),
  }));

  const sumVotes = normalized.reduce((acc, option) => acc + option.votes, 0);
  const totalVotes = Math.max(0, toSafeNumber(totalVotesInput, sumVotes));
  const divisor = totalVotes > 0 ? totalVotes : sumVotes;

  return {
    totalVotes: totalVotes || sumVotes,
    options: normalized.map((option) => ({
      ...option,
      pct: option.pct != null ? option.pct : divisor > 0 ? Math.round((option.votes / divisor) * 100) : 0,
    })),
  };
}

function normalizeVotePost(post = {}) {
  const author = post.author || post.owner || {};
  const optionsPayload = post.options || post.choices || post.items || [];
  const totalVotesInput = post.totalVotes ?? post.total_votes ?? post.voteCount ?? post.vote_count ?? null;
  const normalizedOptions = normalizeOptions(optionsPayload, totalVotesInput);

  const normalized = {
    id: String(post.id ?? ''),
    title: String(post.title ?? ''),
    description: post.description ?? post.body ?? '',
    status: deriveStatus(post),
    closesAt: post.closesAt ?? post.closes_at ?? null,
    createdAt: post.createdAt ?? post.created_at ?? nowIso(),
    author: {
      id: author.id ?? null,
      name: author.name ?? author.nickname ?? '작성자',
      role: author.role ?? 'student',
    },
    totalVotes: normalizedOptions.totalVotes,
    options: normalizedOptions.options,
    myVoteOptionId:
      post.myVoteOptionId ??
      post.my_vote_option_id ??
      post.selectedOptionId ??
      post.selected_option_id ??
      null,
  };

  normalized.status = deriveStatus(normalized);
  return normalized;
}

let mockVotePosts = [
  {
    id: 'vote-1',
    title: '현재 학생회 운영 만족도',
    description: '현재 학생회는 일을 잘하고 있다고 생각하나요?',
    createdAt: '2026-02-16T08:20:00Z',
    closesAt: '2026-02-20T15:00:00Z',
    author: { id: 'u-1', name: '학생회', role: 'student_council' },
    options: [
      { id: 'yes', text: '예', votes: 64 },
      { id: 'no', text: '아니오', votes: 21 },
    ],
    myVoteOptionId: null,
  },
  {
    id: 'vote-2',
    title: '체육대회 선호 종목',
    description: '가장 기대되는 종목 하나를 선택해 주세요.',
    createdAt: '2026-02-15T03:00:00Z',
    closesAt: '2026-02-18T09:00:00Z',
    author: { id: 'u-2', name: '학생회 체육부', role: 'student_council' },
    options: [
      { id: 'soccer', text: '축구', votes: 48 },
      { id: 'basketball', text: '농구', votes: 32 },
      { id: 'badminton', text: '배드민턴', votes: 19 },
    ],
    myVoteOptionId: null,
  },
  {
    id: 'vote-3',
    title: '축제 푸드트럭 메뉴',
    description: '다음 축제에서 가장 보고 싶은 메뉴를 골라 주세요.',
    createdAt: '2026-02-10T00:10:00Z',
    closesAt: '2026-02-12T17:00:00Z',
    author: { id: 'u-3', name: '관리자', role: 'admin' },
    options: [
      { id: 'tteokbokki', text: '떡볶이', votes: 23 },
      { id: 'chicken', text: '치킨', votes: 35 },
      { id: 'waffle', text: '와플', votes: 14 },
    ],
    myVoteOptionId: 'chicken',
  },
];

async function list(params = {}) {
  await delay(80);
  const {
    sort = 'recent',
    q = '',
    includeClosed = false,
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
  } = params;

  let items = mockVotePosts.map(normalizeVotePost);
  if (!includeClosed) {
    items = items.filter((item) => item.status === 'open');
  }
  if (q) {
    const keyword = String(q).toLowerCase();
    items = items.filter((item) => {
      const searchable = [item.title, item.description, ...item.options.map((opt) => opt.text)].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }

  if (sort === 'participation') items.sort(sortByParticipation);
  else if (sort === 'deadline') items.sort(sortByDeadline);
  else items.sort(sortByRecent);

  const safePage = Math.max(1, toSafeNumber(page, 1));
  const safePageSize = Math.max(1, toSafeNumber(pageSize, PAGE_SIZE_DEFAULT));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function detail(id) {
  await delay(60);
  const found = mockVotePosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('Not found');
  return normalizeVotePost(found);
}

async function create(payload = {}) {
  await delay(90);
  const now = nowIso();
  const created = {
    id: `vote-${Date.now()}`,
    title: String(payload.title ?? '').trim(),
    description: String(payload.description ?? '').trim(),
    closesAt: payload.closesAt || null,
    createdAt: now,
    status: 'open',
    author: payload.author || { id: 'me', name: '학생회', role: 'student_council' },
    options: (payload.options || []).map((option, index) => ({
      id: String(option?.id ?? `opt-${Date.now()}-${index}`),
      text: String(option?.text ?? option).trim(),
      votes: 0,
    })),
    myVoteOptionId: null,
  };
  mockVotePosts = [created, ...mockVotePosts];
  return normalizeVotePost(created);
}

async function vote(id, optionId) {
  await delay(70);
  const index = mockVotePosts.findIndex((post) => String(post.id) === String(id));
  if (index < 0) throw new Error('Not found');

  const current = normalizeVotePost(mockVotePosts[index]);
  if (current.status !== 'open') {
    const error = new Error('이미 마감된 투표입니다.');
    error.code = 'vote_closed';
    throw error;
  }
  if (current.myVoteOptionId) {
    const error = new Error('이미 투표에 참여했습니다.');
    error.code = 'already_voted';
    throw error;
  }
  const target = current.options.find((option) => String(option.id) === String(optionId));
  if (!target) {
    const error = new Error('유효하지 않은 선택지입니다.');
    error.code = 'invalid_option';
    throw error;
  }

  const nextRaw = {
    ...mockVotePosts[index],
    options: mockVotePosts[index].options.map((option) =>
      String(option.id) === String(optionId)
        ? { ...option, votes: Math.max(0, toSafeNumber(option.votes)) + 1 }
        : option
    ),
    myVoteOptionId: optionId,
  };
  mockVotePosts = [
    ...mockVotePosts.slice(0, index),
    nextRaw,
    ...mockVotePosts.slice(index + 1),
  ];

  const credits = earnMockSurveyCredits(1);
  return {
    voteId: `vote-resp-${Date.now()}`,
    selectedOptionId: String(optionId),
    creditsEarned: 1,
    creditsAvailable: credits.available,
    poll: normalizeVotePost(nextRaw),
  };
}

export const voteMockApi = {
  list,
  detail,
  create,
  vote,
  normalizeVotePost,
};

