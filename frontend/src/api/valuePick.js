/**
 * @file src/api/valuePick.js
 * @description Value Pick board API wrapper and response normalization.
 */
import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse } from './normalizers';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';
import {
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../config/env';

const PAGE_SIZE_DEFAULT = 20;
const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

const HTML_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

function summarizeRichHtml(html, maxLength = 180) {
  if (!html) return '';
  const plain = String(html)
    .replace(HTML_TAG_RE, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(WHITESPACE_RE, ' ')
    .trim();

  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}...`;
}

function normalizeAuthor(author) {
  if (!author || typeof author !== 'object') {
    return {
      id: null,
      name: '작성자',
      role: 'student',
    };
  }

  return {
    id: author.id ?? null,
    name: author.name ?? author.nickname ?? '작성자',
    role: author.role ?? 'student',
  };
}

function normalizeBasePost(raw) {
  const body = raw?.body ?? '';
  const summary = raw?.bodyPreview ?? raw?.summary ?? summarizeRichHtml(body);

  return {
    id: raw?.id,
    competency: raw?.competency ?? raw?.value ?? raw?.title ?? '',
    pledge: raw?.pledge ?? raw?.headline ?? raw?.summaryTitle ?? raw?.summary ?? '',
    body,
    bodyPreview: summary,
    status: raw?.status ?? raw?.approvalStatus ?? 'approved',
    author: normalizeAuthor(raw?.author),
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
    views: Number(raw?.views ?? 0),
    likes: Number(raw?.likes ?? raw?.likeCount ?? raw?.like_count ?? 0),
    dislikes: Number(raw?.dislikes ?? raw?.dislikeCount ?? raw?.dislike_count ?? 0),
    commentsCount: Number(raw?.commentsCount ?? raw?.comments_count ?? 0),
    myReaction: raw?.myReaction ?? raw?.my_reaction ?? null,
  };
}

function normalizeListPost(raw) {
  const normalized = normalizeBasePost(raw);
  return {
    id: normalized.id,
    competency: normalized.competency,
    pledge: normalized.pledge,
    bodyPreview: normalized.bodyPreview,
    status: normalized.status,
    author: normalized.author,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    views: normalized.views,
    likes: normalized.likes,
    dislikes: normalized.dislikes,
    commentsCount: normalized.commentsCount,
    myReaction: normalized.myReaction,
  };
}

function normalizeDetailPost(raw) {
  const normalized = normalizeBasePost(raw);
  return {
    ...normalized,
    body: normalized.body || '',
    attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
    approvedAt: raw?.approvedAt ?? raw?.approved_at ?? null,
    approvedBy: raw?.approvedBy ?? raw?.approved_by ?? null,
  };
}

export const valuePickApi = {
  async list(params = {}) {
    const res = await api.get('/api/community/value-pick', {
      params: { ...params, view: 'list' },
    });
    const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    return {
      ...normalized,
      items: Array.isArray(normalized.items) ? normalized.items.map(normalizeListPost) : [],
    };
  },

  async get(id) {
    const res = await api.get(`/api/community/value-pick/${id}`);
    return normalizeDetailPost(res.data);
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/value-pick', payload);
      const created = normalizeDetailPost(res.data);
      trackPostCreated({
        boardType: 'value_pick_board',
        userRole: created?.author?.role,
        approvalStatus: created?.status,
      });
      return created;
    } catch (error) {
      trackPostCreateFailed({
        boardType: 'value_pick_board',
        userRole: payload?.author?.role,
        errorType: error,
      });
      throw error;
    }
  },

  async update(id, payload) {
    const res = await api.put(`/api/community/value-pick/${id}`, payload);
    return normalizeDetailPost(res.data);
  },

  async approve(id) {
    const res = await api.post(`/api/community/value-pick/${id}/approve`);
    return normalizeDetailPost(res.data);
  },

  async unapprove(id) {
    const res = await api.post(`/api/community/value-pick/${id}/unapprove`);
    return normalizeDetailPost(res.data);
  },

  async remove(id) {
    const res = await api.delete(`/api/community/value-pick/${id}`);
    return res.data;
  },

  async react(id, type) {
    const res = await api.post(`/api/community/value-pick/${id}/reactions`, { type });
    return res.data;
  },

  async listComments(id, params = {}) {
    const res = await api.get(`/api/community/value-pick/${id}/comments`, { params });
    return normalizePaginatedResponse(res.data, 50);
  },

  async createComment(id, body) {
    const res = await api.post(`/api/community/value-pick/${id}/comments`, { body });
    return res.data;
  },

  async deleteComment(postId, commentId) {
    const res = await api.delete(`/api/community/value-pick/${postId}/comments/${commentId}`);
    return res.data;
  },

  async upload(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/api/community/value-pick/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return normalizeUploadResponse(res.data);
  },

  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default valuePickApi;
