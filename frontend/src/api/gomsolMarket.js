import api from './auth';
import {
  normalizePaginatedResponse,
  normalizeUploadResponse,
  toAbsoluteApiUrl,
} from './normalizers';
import { shouldUseMockFallback } from './mockPolicy';

const PAGE_SIZE_DEFAULT = 12;
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MARKET_STATUS = {
  selling: '판매 중',
  sold: '판매 완료',
};

const MARKET_APPROVAL = {
  pending: '미승인',
  approved: '승인됨',
};

const MARKET_CATEGORIES = {
  books: '도서',
  electronics: '전자기기',
  fashion: '의류/잡화',
  hobby: '취미/굿즈',
  ticket: '티켓/교환권',
  etc: '기타',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeImages = (images = []) =>
  (Array.isArray(images) ? images : [])
    .slice(0, MAX_IMAGES)
    .map((image, index) => ({
      id: image?.id || `gm-img-${index + 1}`,
      name: image?.name || `image-${index + 1}.jpg`,
      url: toAbsoluteApiUrl(image?.url),
      size: image?.size != null ? toSafeNumber(image.size, undefined) : undefined,
      mime: image?.mime || undefined,
    }))
    .filter((image) => Boolean(image.url));

const normalizeContact = (input = {}) => ({
  studentId: String(input?.studentId || input?.student_id || '').trim(),
  openChatUrl: String(input?.openChatUrl || input?.open_chat_url || '').trim(),
  extra: String(input?.extra || '').trim(),
});

const normalizePost = (post = {}) => {
  const category = Object.prototype.hasOwnProperty.call(MARKET_CATEGORIES, post.category)
    ? post.category
    : 'etc';
  const status = post.status === 'sold' ? 'sold' : 'selling';
  const approvalStatus = post.approvalStatus === 'approved' ? 'approved' : 'pending';

  return {
    id: String(post.id ?? ''),
    title: String(post.title ?? ''),
    description: String(post.description ?? ''),
    price: Math.max(0, Math.floor(toSafeNumber(post.price ?? 0, 0))),
    category,
    status,
    approvalStatus,
    images: normalizeImages(post.images),
    contact: normalizeContact(post.contact),
    author: {
      id: post.author?.id ?? null,
      name: post.author?.name ?? post.author?.nickname ?? '익명',
      role: post.author?.role ?? 'student',
    },
    createdAt: post.createdAt || post.created_at || nowIso(),
    updatedAt: post.updatedAt || post.updated_at || nowIso(),
    views: Math.max(0, toSafeNumber(post.views ?? 0, 0)),
  };
};

const mockPostsSeed = [
  {
    id: 'gm-1',
    title: '미적분 자이스토리 2026',
    description: '필기 조금 있고 상태 양호합니다.',
    price: 7000,
    category: 'books',
    status: 'selling',
    approvalStatus: 'approved',
    images: [
      {
        id: 'gm-1-1',
        name: 'book.jpg',
        url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: { studentId: '23015', openChatUrl: '', extra: '점심시간 본관 2층' },
    author: { id: 11, name: '푸른곰솔', role: 'student' },
    createdAt: '2026-02-16T03:30:00Z',
    updatedAt: '2026-02-16T03:30:00Z',
    views: 18,
  },
  {
    id: 'gm-2',
    title: '유선 이어폰',
    description: '하자 없고 3.5mm 타입입니다.',
    price: 3000,
    category: 'electronics',
    status: 'sold',
    approvalStatus: 'approved',
    images: [
      {
        id: 'gm-2-1',
        name: 'earphone.jpg',
        url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: { studentId: '', openChatUrl: 'https://open.kakao.com/o/example', extra: '' },
    author: { id: 12, name: '별헤는밤', role: 'student' },
    createdAt: '2026-02-15T07:20:00Z',
    updatedAt: '2026-02-15T10:20:00Z',
    views: 33,
  },
  {
    id: 'gm-3',
    title: '교복 마이 100',
    description: '1학기만 착용했습니다.',
    price: 0,
    category: 'fashion',
    status: 'selling',
    approvalStatus: 'pending',
    images: [
      {
        id: 'gm-3-1',
        name: 'uniform.jpg',
        url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: { studentId: '22021', openChatUrl: '', extra: '댓글 대신 오픈채팅 요청 시 전달' },
    author: { id: 13, name: '모란', role: 'student' },
    createdAt: '2026-02-17T02:10:00Z',
    updatedAt: '2026-02-17T02:10:00Z',
    views: 4,
  },
];

let mockPosts = mockPostsSeed.map(normalizePost);

function applyFilters(items, params = {}) {
  const q = String(params.q || '').trim().toLowerCase();
  const sort = params.sort || 'recent';
  const status = params.status;
  const category = params.category;
  const approval = params.approval;

  let next = [...items];

  if (status === 'selling' || status === 'sold') {
    next = next.filter((item) => item.status === status);
  }

  if (category && category !== 'all' && Object.prototype.hasOwnProperty.call(MARKET_CATEGORIES, category)) {
    next = next.filter((item) => item.category === category);
  }

  if (approval === 'approved' || approval === 'pending') {
    next = next.filter((item) => item.approvalStatus === approval);
  }

  if (q) {
    next = next.filter((item) =>
      [item.title, item.description, item.category]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  if (sort === 'price-asc') {
    next.sort((a, b) => a.price - b.price || new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'price-desc') {
    next.sort((a, b) => b.price - a.price || new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    next.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return next;
}

async function mockList(params = {}) {
  await delay(80);
  const page = Math.max(1, toSafeNumber(params.page, 1));
  const pageSize = Math.max(1, toSafeNumber(params.pageSize, PAGE_SIZE_DEFAULT));
  const filtered = applyFilters(mockPosts, params);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

async function mockDetail(id) {
  await delay(60);
  const foundIndex = mockPosts.findIndex((post) => String(post.id) === String(id));
  if (foundIndex < 0) throw new Error('게시글을 찾을 수 없습니다.');
  const next = {
    ...mockPosts[foundIndex],
    views: Math.max(0, toSafeNumber(mockPosts[foundIndex].views)) + 1,
    updatedAt: nowIso(),
  };
  mockPosts[foundIndex] = next;
  return normalizePost(next);
}

async function mockCreate(payload = {}) {
  await delay(100);
  const created = normalizePost({
    id: `gm-${Date.now()}`,
    title: payload.title,
    description: payload.description,
    price: payload.price,
    category: payload.category,
    status: payload.status || 'selling',
    approvalStatus: 'pending',
    images: payload.images || [],
    contact: payload.contact || {},
    author: payload.author || { id: 'me', name: '나', role: 'student' },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    views: 0,
  });
  mockPosts = [created, ...mockPosts];
  return created;
}

async function mockApprove(id) {
  await delay(70);
  const found = mockPosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('게시글을 찾을 수 없습니다.');
  found.approvalStatus = 'approved';
  found.updatedAt = nowIso();
  return normalizePost(found);
}

async function mockUnapprove(id) {
  await delay(70);
  const found = mockPosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('게시글을 찾을 수 없습니다.');
  found.approvalStatus = 'pending';
  found.updatedAt = nowIso();
  return normalizePost(found);
}

async function mockUpdateStatus(id, status) {
  await delay(70);
  const found = mockPosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('게시글을 찾을 수 없습니다.');
  found.status = status === 'sold' ? 'sold' : 'selling';
  found.updatedAt = nowIso();
  return normalizePost(found);
}

async function mockUpload(file) {
  if (!file) throw new Error('파일이 없습니다.');
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('이미지는 10MB 이하만 업로드할 수 있습니다.');
  }
  await delay(50);
  return {
    id: `gm-upload-${Date.now()}`,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
    mime: file.type,
  };
}

export const gomsolMarketApi = {
  MAX_IMAGES,
  MAX_FILE_SIZE,
  statusLabel: MARKET_STATUS,
  approvalLabel: MARKET_APPROVAL,
  categoryLabel: MARKET_CATEGORIES,

  canWrite(user) {
    return Boolean(user?.id);
  },

  canManageApproval(user) {
    return user?.role === 'admin';
  },

  canManageSaleStatus(user, post) {
    if (!user || !post) return false;
    if (user.role === 'admin') return true;
    return String(user.id) === String(post.author?.id);
  },

  async list(params = {}) {
    try {
      const serverParams = {
        status: params.status,
        category: params.category,
        approval: params.approval,
        sort: params.sort,
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      };
      const res = await api.get('/api/community/gomsol-market', { params: serverParams });
      const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
      return {
        ...normalized,
        items: (normalized.items || []).map(normalizePost),
      };
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mock = await mockList(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id, params = {}) {
    try {
      const res = await api.get(`/api/community/gomsol-market/${id}`, { params });
      return normalizePost(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockDetail(id);
    }
  },

  async create(payload = {}) {
    try {
      const res = await api.post('/api/community/gomsol-market', payload);
      return normalizePost(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockCreate(payload);
    }
  },

  async approve(id) {
    try {
      const res = await api.post(`/api/community/gomsol-market/${id}/approve`);
      return normalizePost(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockApprove(id);
    }
  },

  async unapprove(id) {
    try {
      const res = await api.post(`/api/community/gomsol-market/${id}/unapprove`);
      return normalizePost(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockUnapprove(id);
    }
  },

  async updateStatus(id, status) {
    try {
      const res = await api.post(`/api/community/gomsol-market/${id}/status`, { status });
      return normalizePost(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockUpdateStatus(id, status);
    }
  },

  async upload(file) {
    try {
      if (!file) throw new Error('파일이 없습니다.');
      if (file.size > MAX_FILE_SIZE) throw new Error('이미지는 10MB 이하만 업로드할 수 있습니다.');
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/community/gomsol-market/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockUpload(file);
    }
  },
};

export default gomsolMarketApi;
