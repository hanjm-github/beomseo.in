import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse, toAbsoluteApiUrl } from './normalizers';

const PAGE_SIZE_DEFAULT = 12;
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const WRITER_ROLES = ['admin', 'student_council', 'council'];

export const LOST_FOUND_STATUS = {
  searching: '주인 찾는 중',
  found: '주인 찾음',
};

export const LOST_FOUND_CATEGORIES = {
  electronics: '전자기기',
  clothing: '의류',
  bag: '가방',
  wallet_card: '지갑·카드',
  stationery: '문구',
  etc: '기타',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeImageSvg(label, hue) {
  const text = encodeURIComponent(label);
  const bg = `%23${hue}`;
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${bg}'/><stop offset='1' stop-color='%23111f2f'/></linearGradient></defs><rect width='640' height='480' fill='url(%23g)'/><rect x='40' y='40' width='560' height='400' rx='28' fill='rgba(255,255,255,0.08)'/><text x='48' y='412' fill='white' font-size='42' font-family='Pretendard, sans-serif'>${text}</text></svg>`;
}

const mockItems = [
  {
    id: 'lf-1',
    title: '검은색 무선 이어폰 케이스',
    description: '2학년 복도 자습실 근처에서 발견했습니다.',
    status: 'searching',
    category: 'electronics',
    images: [
      { id: 'img-1', url: makeImageSvg('무선 이어폰', '2E7D5C'), name: 'earbuds.jpg' },
      { id: 'img-2', url: makeImageSvg('케이스 측면', '1B4D3E'), name: 'earbuds-side.jpg' },
    ],
    foundAt: '2026-02-17T08:10:00Z',
    foundLocation: '본관 2층 복도',
    storageLocation: '학생회실 분실물 보관함 A',
    createdAt: '2026-02-17T09:00:00Z',
    updatedAt: '2026-02-17T09:00:00Z',
    views: 31,
    commentsCount: 2,
    author: { id: 1, name: '학생회', role: 'student_council' },
  },
  {
    id: 'lf-2',
    title: '체육복 상의 (3학년 체육복)',
    description: '체육관 출입구 벤치에 놓여 있었습니다.',
    status: 'searching',
    category: 'clothing',
    images: [{ id: 'img-3', url: makeImageSvg('체육복 상의', '246750'), name: 'uniform.jpg' }],
    foundAt: '2026-02-16T05:30:00Z',
    foundLocation: '체육관 출입구',
    storageLocation: '교무실 옆 분실물 캐비닛',
    createdAt: '2026-02-16T06:00:00Z',
    updatedAt: '2026-02-16T06:00:00Z',
    views: 19,
    commentsCount: 0,
    author: { id: 2, name: '관리자', role: 'admin' },
  },
  {
    id: 'lf-3',
    title: '파란색 카드지갑',
    description: '본관 1층 자판기 옆에서 습득, 소유자 확인 완료.',
    status: 'found',
    category: 'wallet_card',
    images: [{ id: 'img-4', url: makeImageSvg('카드지갑', '123D2C'), name: 'wallet.jpg' }],
    foundAt: '2026-02-15T03:20:00Z',
    foundLocation: '본관 1층 자판기 앞',
    storageLocation: '소유자 인계 완료',
    createdAt: '2026-02-15T04:00:00Z',
    updatedAt: '2026-02-16T12:00:00Z',
    views: 54,
    commentsCount: 3,
    author: { id: 1, name: '학생회', role: 'student_council' },
  },
];

const mockComments = {
  'lf-1': [
    {
      id: 'lf-c-1',
      itemId: 'lf-1',
      body: '이어팁이 흰색인가요?',
      createdAt: '2026-02-17T09:20:00Z',
      author: { id: 42, name: '김OO', role: 'student' },
    },
    {
      id: 'lf-c-2',
      itemId: 'lf-1',
      body: '맞습니다. 학생회실로 확인 부탁드립니다.',
      createdAt: '2026-02-17T09:40:00Z',
      author: { id: 1, name: '학생회', role: 'student_council' },
    },
  ],
  'lf-2': [],
  'lf-3': [
    {
      id: 'lf-c-3',
      itemId: 'lf-3',
      body: '찾았습니다! 감사합니다.',
      createdAt: '2026-02-16T12:10:00Z',
      author: { id: 52, name: '박OO', role: 'student' },
    },
  ],
};

const asLower = (value) => String(value || '').toLowerCase();

const asIso = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const normalizeImages = (images = []) =>
  (Array.isArray(images) ? images : [])
    .slice(0, MAX_IMAGES)
    .map((image, index) => ({
      id: image?.id || `lf-img-${index + 1}`,
      name: image?.name || `image-${index + 1}.jpg`,
      url: toAbsoluteApiUrl(image?.url),
    }))
    .filter((image) => Boolean(image.url));

const normalizeItem = (item = {}) => ({
  id: String(item.id ?? ''),
  title: String(item.title ?? ''),
  description: String(item.description ?? ''),
  status: item.status === 'found' ? 'found' : 'searching',
  category: Object.prototype.hasOwnProperty.call(LOST_FOUND_CATEGORIES, item.category) ? item.category : 'etc',
  images: normalizeImages(item.images),
  foundAt: asIso(item.foundAt || item.found_at) || new Date().toISOString(),
  foundLocation: String(item.foundLocation || item.found_location || ''),
  storageLocation: String(item.storageLocation || item.storage_location || ''),
  createdAt: asIso(item.createdAt || item.created_at) || new Date().toISOString(),
  updatedAt: asIso(item.updatedAt || item.updated_at) || new Date().toISOString(),
  views: Number(item.views ?? 0),
  commentsCount: Number(item.commentsCount ?? item.comments_count ?? 0),
  approvalStatus: item.approvalStatus ?? item.approval_status,
  author: {
    id: item.author?.id ?? null,
    name: item.author?.name ?? item.author?.nickname ?? '운영진',
    role: item.author?.role ?? 'student_council',
  },
});

function applyFilters(items, params = {}) {
  const status = params.status;
  const category = params.category;
  const query = asLower(params.q || params.query);
  const sort = params.sort || 'recent';

  let next = items.map(normalizeItem);

  if (status === 'searching' || status === 'found') {
    next = next.filter((item) => item.status === status);
  }
  if (category && category !== 'all' && Object.prototype.hasOwnProperty.call(LOST_FOUND_CATEGORIES, category)) {
    next = next.filter((item) => item.category === category);
  }
  if (query) {
    next = next.filter((item) =>
      [item.title, item.description, item.foundLocation, item.storageLocation]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }

  if (sort === 'foundAt-desc') {
    next.sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime());
  } else if (sort === 'foundAt-asc') {
    next.sort((a, b) => new Date(a.foundAt).getTime() - new Date(b.foundAt).getTime());
  } else {
    next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return next;
}

async function mockList(params = {}) {
  await delay(90);
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.max(1, Number(params.pageSize || PAGE_SIZE_DEFAULT));
  const filtered = applyFilters(mockItems, params);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

async function mockDetail(id) {
  await delay(70);
  const index = mockItems.findIndex((item) => String(item.id) === String(id));
  if (index < 0) throw new Error('Not found');
  const current = normalizeItem(mockItems[index]);
  mockItems[index] = { ...mockItems[index], views: (current.views || 0) + 1 };
  return normalizeItem(mockItems[index]);
}

async function mockCreate(payload = {}) {
  await delay(100);
  const now = new Date().toISOString();
  const created = normalizeItem({
    id: `lf-${Date.now()}`,
    title: payload.title,
    description: payload.description,
    status: payload.status || 'searching',
    category: payload.category,
    images: payload.images || [],
    foundAt: payload.foundAt,
    foundLocation: payload.foundLocation,
    storageLocation: payload.storageLocation,
    createdAt: now,
    updatedAt: now,
    views: 0,
    commentsCount: 0,
    author: payload.author || { id: 'me', name: '학생회', role: 'student_council' },
  });
  mockItems.unshift(created);
  mockComments[created.id] = [];
  return created;
}

async function mockUpdateStatus(id, status) {
  await delay(60);
  const index = mockItems.findIndex((item) => String(item.id) === String(id));
  if (index < 0) throw new Error('Not found');
  mockItems[index] = {
    ...mockItems[index],
    status: status === 'found' ? 'found' : 'searching',
    updatedAt: new Date().toISOString(),
  };
  return normalizeItem(mockItems[index]);
}

async function mockUpload(file) {
  if (!file) throw new Error('파일이 없습니다.');
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('이미지는 10MB 이하만 업로드할 수 있습니다.');
  }
  await delay(60);
  const url = URL.createObjectURL(file);
  return {
    id: `lf-upload-${Date.now()}`,
    name: file.name,
    size: file.size,
    url,
  };
}

async function mockListComments(itemId, params = {}) {
  await delay(50);
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.max(1, Number(params.pageSize || 50));
  const items = (mockComments[itemId] || []).slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

async function mockCreateComment(itemId, body) {
  await delay(60);
  const created = {
    id: `lf-c-${Date.now()}`,
    itemId,
    body,
    createdAt: new Date().toISOString(),
    author: { id: 'me', name: '나', role: 'student' },
  };
  mockComments[itemId] = [...(mockComments[itemId] || []), created];
  const index = mockItems.findIndex((item) => String(item.id) === String(itemId));
  if (index >= 0) {
    mockItems[index] = {
      ...mockItems[index],
      commentsCount: Number(mockItems[index].commentsCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
  }
  return created;
}

async function mockDeleteComment(itemId, commentId) {
  await delay(50);
  const before = mockComments[itemId] || [];
  const next = before.filter((comment) => String(comment.id) !== String(commentId));
  const removed = before.length - next.length;
  mockComments[itemId] = next;
  if (removed > 0) {
    const index = mockItems.findIndex((item) => String(item.id) === String(itemId));
    if (index >= 0) {
      mockItems[index] = {
        ...mockItems[index],
        commentsCount: Math.max(0, Number(mockItems[index].commentsCount || 0) - removed),
        updatedAt: new Date().toISOString(),
      };
    }
  }
  return { success: true };
}

export const lostFoundApi = {
  writerRoles: WRITER_ROLES,
  statusLabel: LOST_FOUND_STATUS,
  categoryLabel: LOST_FOUND_CATEGORIES,
  MAX_IMAGES,
  MAX_FILE_SIZE,

  canWrite(user) {
    return WRITER_ROLES.includes(user?.role);
  },

  async list(params = {}) {
    try {
      const res = await api.get('/api/community/lost-found', { params });
      const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
      return {
        ...normalized,
        items: (normalized.items || []).map(normalizeItem),
      };
    } catch {
      const mock = await mockList(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/community/lost-found/${id}`);
      return normalizeItem(res.data);
    } catch {
      return mockDetail(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/lost-found', payload);
      return normalizeItem(res.data);
    } catch {
      return mockCreate(payload);
    }
  },

  async updateStatus(id, status) {
    try {
      const res = await api.post(`/api/community/lost-found/${id}/status`, { status });
      return normalizeItem(res.data);
    } catch {
      return mockUpdateStatus(id, status);
    }
  },

  async upload(file) {
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('이미지는 10MB 이하만 업로드할 수 있습니다.');
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/community/lost-found/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(res.data);
    } catch {
      return mockUpload(file);
    }
  },

  async listComments(id, params = {}) {
    try {
      const res = await api.get(`/api/community/lost-found/${id}/comments`, { params });
      return normalizePaginatedResponse(res.data, 50);
    } catch {
      const mock = await mockListComments(id, params);
      return normalizePaginatedResponse(mock, 50);
    }
  },

  async createComment(id, body) {
    try {
      const res = await api.post(`/api/community/lost-found/${id}/comments`, { body });
      return res.data;
    } catch {
      return mockCreateComment(id, body);
    }
  },

  async deleteComment(id, commentId) {
    try {
      const res = await api.delete(`/api/community/lost-found/${id}/comments/${commentId}`);
      return res.data;
    } catch {
      return mockDeleteComment(id, commentId);
    }
  },
};

export default lostFoundApi;
