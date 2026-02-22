/**
 * @file src/api/mocks/gomsolMarket.mock.js
 * @description Implements deterministic mock API behavior for development fallback scenarios.
 * Responsibilities:
 * - Provide in-memory mock responses that mirror backend contracts and pagination semantics.
 * Key dependencies:
 * - ../normalizers
 * - ../../config/env
 * Side effects:
 * - Mutates in-memory mock state to emulate backend persistence semantics.
 * - Interacts with browser runtime APIs.
 * - Schedules deferred work using timer-based execution.
 * Role in app flow:
 * - Supports local and development flows when network-backed API calls are unavailable.
 */
import { toAbsoluteApiUrl } from '../normalizers';
import {
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
  UPLOAD_MAX_IMAGES,
} from '../../config/env';

const PAGE_SIZE_DEFAULT = 12;
const MAX_IMAGES = UPLOAD_MAX_IMAGES;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

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
  const category = post.category || 'etc';
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

  if (category && category !== 'all') {
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

async function list(params = {}) {
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

async function detail(id) {
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

async function create(payload = {}) {
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

async function approve(id) {
  await delay(70);
  const found = mockPosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('게시글을 찾을 수 없습니다.');
  found.approvalStatus = 'approved';
  found.updatedAt = nowIso();
  return normalizePost(found);
}

async function unapprove(id) {
  await delay(70);
  const found = mockPosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('게시글을 찾을 수 없습니다.');
  found.approvalStatus = 'pending';
  found.updatedAt = nowIso();
  return normalizePost(found);
}

async function updateStatus(id, status) {
  await delay(70);
  const found = mockPosts.find((post) => String(post.id) === String(id));
  if (!found) throw new Error('게시글을 찾을 수 없습니다.');
  found.status = status === 'sold' ? 'sold' : 'selling';
  found.updatedAt = nowIso();
  return normalizePost(found);
}

async function upload(file) {
  if (!file) throw new Error('파일이 없습니다.');
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`이미지는 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
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

export const gomsolMarketMockApi = {
  list,
  detail,
  create,
  approve,
  unapprove,
  updateStatus,
  upload,
};



