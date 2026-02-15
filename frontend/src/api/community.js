/**
 * Community (free/anonymous) board API with mock fallback.
 * Reuses the shared axios instance from auth.js for authenticated calls.
 */
import api from './auth';

const PAGE_SIZE_DEFAULT = 20;
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const CATEGORIES = ['chat', 'info', 'qna'];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const categoryLabel = {
  chat: '잡담',
  info: '정보',
  qna: 'QnA',
};

let mockPosts = [
  {
    id: 'p-1',
    title: '오늘 급식 미쳤다 ㅋㅋ',
    body: '<p>치킨마요덮밥에 탕수육이라니... 이런 날 또 오나요?</p>',
    category: 'chat',
    createdAt: '2026-03-03T02:00:00Z',
    updatedAt: '2026-03-03T02:00:00Z',
    views: 320,
    commentsCount: 14,
    likes: 21,
    dislikes: 1,
    myReaction: null,
    attachments: [],
    bookmarked: false,
    author: { id: 'u-11', name: '채민', role: 'student' },
  },
  {
    id: 'p-2',
    title: '수학 내신 3-1 미적분 미리보기 요약',
    body: '<p>교과서 72~95쪽, 삼각함수 그래프 파트. <strong>로그 유도</strong> 꼭 보세요.</p>',
    category: 'info',
    createdAt: '2026-03-04T07:30:00Z',
    updatedAt: '2026-03-04T07:30:00Z',
    views: 210,
    commentsCount: 6,
    likes: 15,
    dislikes: 0,
    myReaction: 'like',
    attachments: [],
    bookmarked: true,
    author: { id: 'u-22', name: '하린', role: 'student' },
  },
  {
    id: 'p-3',
    title: '물리 수행평가 실험 질문',
    body: '<p>수조에 물 채워서 파동 속도 측정할 때, 센서 위치 어떻게 잡나요?</p>',
    category: 'qna',
    createdAt: '2026-03-06T10:15:00Z',
    updatedAt: '2026-03-06T10:15:00Z',
    views: 88,
    commentsCount: 3,
    likes: 4,
    dislikes: 0,
    myReaction: null,
    attachments: [],
    bookmarked: false,
    author: { id: 'u-33', name: '도윤', role: 'student' },
  },
];

const mockComments = {
  'p-1': [
    {
      id: 'c-1',
      postId: 'p-1',
      body: '오늘은 급식실이 미쳤다 진짜',
      createdAt: '2026-03-03T03:00:00Z',
      updatedAt: '2026-03-03T03:00:00Z',
      author: { id: 'u-1', name: '세린', role: 'student' },
    },
  ],
  'p-2': [],
  'p-3': [],
};

const summarize = (html) => {
  const text = (html || '').replace(/<[^>]+>/g, '');
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
};

function applyFilters(params) {
  const {
    category,
    query,
    sort = 'recent',
    mine = false,
    bookmarked = false,
  } = params;

  let data = [...mockPosts];
  if (category && CATEGORIES.includes(category)) {
    data = data.filter((p) => p.category === category);
  }
  if (query) {
    const q = query.toLowerCase();
    data = data.filter(
      (p) => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)
    );
  }
  if (mine) {
    data = data.filter((p) => p.author?.id === 'me');
  }
  if (bookmarked) {
    data = data.filter((p) => p.bookmarked);
  }

  switch (sort) {
    case 'comments':
      data.sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0));
      break;
    case 'likes':
      data.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      break;
    default:
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return data;
}

async function mockList(params = {}) {
  await delay(120);
  const pageSize = params.pageSize || PAGE_SIZE_DEFAULT;
  const page = params.page || 1;
  const filtered = applyFilters(params);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

async function mockGet(id) {
  await delay(90);
  const post = mockPosts.find((p) => p.id === id);
  if (!post) throw new Error('Not found');
  return post;
}

async function mockCreate(payload) {
  await delay(120);
  const now = new Date().toISOString();
  const post = {
    ...payload,
    id: `p-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    views: 0,
    likes: 0,
    dislikes: 0,
    commentsCount: 0,
    myReaction: null,
    bookmarked: false,
    author: payload.author || { id: 'me', name: '나', role: 'student' },
    summary: payload.summary || summarize(payload.body || ''),
  };
  mockPosts = [post, ...mockPosts];
  return post;
}

async function mockUpdate(id, payload) {
  await delay(120);
  mockPosts = mockPosts.map((p) =>
    p.id === id ? { ...p, ...payload, updatedAt: new Date().toISOString() } : p
  );
  return mockPosts.find((p) => p.id === id);
}

async function mockRemove(id) {
  await delay(80);
  mockPosts = mockPosts.filter((p) => p.id !== id);
  return { success: true };
}

async function mockReact(id, type) {
  await delay(60);
  const post = mockPosts.find((p) => p.id === id);
  if (!post) throw new Error('Not found');
  if (post.myReaction === type) {
    // undo
    if (type === 'like' && post.likes > 0) post.likes -= 1;
    if (type === 'dislike' && post.dislikes > 0) post.dislikes -= 1;
    post.myReaction = null;
  } else {
    if (post.myReaction === 'like' && post.likes > 0) post.likes -= 1;
    if (post.myReaction === 'dislike' && post.dislikes > 0) post.dislikes -= 1;
    if (type === 'like') post.likes += 1;
    if (type === 'dislike') post.dislikes += 1;
    post.myReaction = type;
  }
  return { likes: post.likes, dislikes: post.dislikes, myReaction: post.myReaction };
}

async function mockToggleBookmark(id) {
  await delay(40);
  mockPosts = mockPosts.map((p) => (p.id === id ? { ...p, bookmarked: !p.bookmarked } : p));
  return mockPosts.find((p) => p.id === id);
}

async function mockListComments(postId, params = {}) {
  await delay(60);
  const list = mockComments[postId] || [];
  const pageSize = params.pageSize || 50;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total: list.length,
    page,
    pageSize,
  };
}

async function mockCreateComment(postId, body) {
  await delay(60);
  const now = new Date().toISOString();
  const comment = {
    id: `c-${Date.now()}`,
    postId,
    body,
    createdAt: now,
    updatedAt: now,
    author: { id: 'me', name: '나', role: 'student' },
  };
  mockComments[postId] = [comment, ...(mockComments[postId] || [])];
  const post = mockPosts.find((p) => p.id === postId);
  if (post) post.commentsCount = (post.commentsCount || 0) + 1;
  return comment;
}

async function mockDeleteComment(postId, commentId) {
  await delay(40);
  mockComments[postId] = (mockComments[postId] || []).filter((c) => c.id !== commentId);
  const post = mockPosts.find((p) => p.id === postId);
  if (post && post.commentsCount > 0) post.commentsCount -= 1;
  return { success: true };
}

async function mockUpload(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('첨부 용량은 10MB 이하만 가능합니다.');
  }
  await delay(100);
  const url = URL.createObjectURL(file);
  return {
    id: `a-${Date.now()}`,
    name: file.name,
    size: file.size,
    url,
    mime: file.type || 'application/octet-stream',
    kind: file.type?.startsWith('image/') ? 'image' : 'file',
  };
}

export const communityApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/community/free', { params });
      return res.data;
    } catch (err) {
      return mockList(params);
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/community/free/${id}`);
      return res.data;
    } catch (err) {
      return mockGet(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/free', payload);
      return res.data;
    } catch (err) {
      return mockCreate({ ...payload, summary: summarize(payload.body) });
    }
  },

  async update(id, payload) {
    try {
      const res = await api.put(`/api/community/free/${id}`, payload);
      return res.data;
    } catch (err) {
      return mockUpdate(id, { ...payload, summary: summarize(payload.body) });
    }
  },

  async remove(id) {
    try {
      const res = await api.delete(`/api/community/free/${id}`);
      return res.data;
    } catch (err) {
      return mockRemove(id);
    }
  },

  async react(id, type) {
    try {
      const res = await api.post(`/api/community/free/${id}/reactions`, { type });
      return res.data;
    } catch (err) {
      return mockReact(id, type);
    }
  },

  async toggleBookmark(id) {
    try {
      const res = await api.post(`/api/community/free/${id}/bookmark`);
      return res.data;
    } catch (err) {
      return mockToggleBookmark(id);
    }
  },

  async listComments(id, params = {}) {
    try {
      const res = await api.get(`/api/community/free/${id}/comments`, { params });
      return res.data;
    } catch (err) {
      return mockListComments(id, params);
    }
  },

  async createComment(id, body) {
    try {
      const res = await api.post(`/api/community/free/${id}/comments`, { body });
      return res.data;
    } catch (err) {
      return mockCreateComment(id, body);
    }
  },

  async deleteComment(postId, commentId) {
    try {
      const res = await api.delete(`/api/community/free/${postId}/comments/${commentId}`);
      return res.data;
    } catch (err) {
      return mockDeleteComment(postId, commentId);
    }
  },

  async upload(file) {
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('첨부 용량은 10MB 이하만 가능합니다.');
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/community/free/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch (err) {
      return mockUpload(file);
    }
  },

  categoryLabel,
  CATEGORIES,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default communityApi;
