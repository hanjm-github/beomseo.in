import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

const PAGE_SIZE_DEFAULT = 12;
const WRITER_ROLES = ['admin', 'student_council'];

const toSafeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
    createdAt: post.createdAt ?? post.created_at ?? new Date().toISOString(),
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

const loadVoteMockApi = ENABLE_API_MOCKS
  ? (() => {
      let voteMockApiPromise;
      return () => {
        if (!voteMockApiPromise) {
          voteMockApiPromise = import('./mocks/vote.mock').then((module) => module.voteMockApi);
        }
        return voteMockApiPromise;
      };
    })()
  : null;

export const voteApi = {
  writerRoles: WRITER_ROLES,

  canWrite(user) {
    return WRITER_ROLES.includes(user?.role);
  },

  async list(params = {}) {
    const normalizedParams = {
      sort: params.sort,
      q: params.q,
      includeClosed: params.includeClosed ? '1' : undefined,
      page: params.page,
      pageSize: params.pageSize,
      view: 'list',
    };
    try {
      const res = await api.get('/api/community/votes', { params: normalizedParams });
      const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
      return {
        ...normalized,
        items: (normalized.items || []).map(normalizeVotePost),
      };
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadVoteMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/community/votes/${id}`);
      return normalizeVotePost(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadVoteMockApi();
      return mockApi.detail(id);
    }
  },

  async create(payload) {
    const normalizedPayload = {
      title: payload?.title,
      description: payload?.description || '',
      closesAt: payload?.closesAt || null,
      options: (payload?.options || []).map((option, index) => ({
        id: option?.id || `opt-${index + 1}`,
        text: option?.text || '',
      })),
    };
    try {
      const res = await api.post('/api/community/votes', normalizedPayload);
      const created = normalizeVotePost(res.data);
      trackPostCreated({
        boardType: 'vote',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      if (!shouldUseMockFallback(err)) {
        trackPostCreateFailed({
          boardType: 'vote',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadVoteMockApi();
      return mockApi.create(normalizedPayload);
    }
  },

  async vote(id, optionId) {
    try {
      const res = await api.post(`/api/community/votes/${id}/vote`, { optionId });
      return {
        voteId: res.data?.voteId ?? res.data?.vote_id,
        selectedOptionId: res.data?.selectedOptionId ?? res.data?.selected_option_id ?? optionId,
        creditsEarned: toSafeNumber(res.data?.creditsEarned ?? res.data?.credits_earned ?? 0),
        creditsAvailable: toSafeNumber(res.data?.creditsAvailable ?? res.data?.credits_available ?? 0),
        poll: normalizeVotePost(res.data?.poll || {}),
      };
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadVoteMockApi();
      return mockApi.vote(id, optionId);
    }
  },
};

export default voteApi;
