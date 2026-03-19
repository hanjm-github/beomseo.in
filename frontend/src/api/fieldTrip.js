import { fastapiApi, FASTAPI_BASE_URL, readCookie } from './fastapiClient';
import { normalizeUploadResponse } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import {
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../config/env';
import {
  getDefaultFieldTripBoardDescription,
  getFieldTripClassLabel,
  hydrateClassesWithUnlockState,
  persistUnlockedClass,
} from '../features/fieldTrip/utils';

const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;
const FIELD_TRIP_CSRF_COOKIE = 'field_trip_csrf_token';

function buildFieldTripWriteConfig() {
  const csrf = readCookie(FIELD_TRIP_CSRF_COOKIE);
  return csrf
    ? {
        headers: {
          'X-Field-Trip-CSRF': csrf,
        },
      }
    : {};
}

const loadFieldTripMockApi = ENABLE_API_MOCKS
  ? (() => {
      let fieldTripMockApiPromise;

      return () => {
        if (!fieldTripMockApiPromise) {
          fieldTripMockApiPromise = import('./mocks/fieldTrip.mock').then(
            (module) => module.fieldTripMockApi
          );
        }

        return fieldTripMockApiPromise;
      };
    })()
  : null;

function unwrapCollection(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function normalizeClassRows(data) {
  const rows = unwrapCollection(data).map((row) => {
    const classId = String(row.classId || '');
    const label = row.label || getFieldTripClassLabel(classId);
    return {
      classId,
      label,
      postCount: Number(row.postCount || 0),
      isUnlocked: Boolean(row.isUnlocked),
      boardDescription:
        String(row.boardDescription || '').trim() || getDefaultFieldTripBoardDescription(label),
    };
  });

  return hydrateClassesWithUnlockState(rows);
}

function normalizePost(post) {
  if (!post || typeof post !== 'object') {
    return null;
  }

  // Anonymous authors are serialized with authorUserId=0 so list/detail/edit
  // code can reason about one sentinel value instead of null-or-missing cases.
  const normalizedAuthorRole = String(
    post.authorRole ||
      (
        post.authorUserId == null ||
        post.authorUserId === '' ||
        Number(post.authorUserId) === 0
          ? 'anonymous'
          : 'student'
      )
  ).trim() || 'student';
  const isAnonymousAuthor = normalizedAuthorRole === 'anonymous';

  return {
    id: String(post.id || ''),
    classId: String(post.classId || ''),
    authorUserId: isAnonymousAuthor
      ? 0
      : post.authorUserId == null || post.authorUserId === ''
        ? null
        : Number(post.authorUserId),
    authorRole: normalizedAuthorRole,
    nickname: String(post.nickname || ''),
    title: String(post.title || ''),
    body: String(post.body || ''),
    // Field-trip attachments are served by FastAPI, so every URL is normalized
    // against the FastAPI base even when the main API base points elsewhere.
    attachments: Array.isArray(post.attachments)
      ? post.attachments
          .map((attachment) => normalizeUploadResponse(attachment, FASTAPI_BASE_URL))
          .filter(Boolean)
      : [],
    createdAt: post.createdAt || '',
    updatedAt: post.updatedAt || post.createdAt || '',
  };
}

function normalizePosts(data) {
  return unwrapCollection(data).map(normalizePost).filter(Boolean);
}

function normalizeScoreRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    classId: String(row.classId || ''),
    label: row.label || getFieldTripClassLabel(String(row.classId || '')),
    totalScore: Number(row.totalScore || 0),
  };
}

function normalizeScoreRows(data) {
  return unwrapCollection(data).map(normalizeScoreRow).filter(Boolean);
}

export function getFieldTripErrorMessage(error, fallbackMessage) {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.trim();
  }

  const directMessage = error?.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  return fallbackMessage;
}

function throwFieldTripError(error, fallbackMessage) {
  throw new Error(getFieldTripErrorMessage(error, fallbackMessage));
}

export const fieldTripApi = {
  async listClasses() {
    try {
      const response = await fastapiApi.get('/api/community/field-trip/classes');
      return normalizeClassRows(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizeClassRows(await mockApi.listClasses());
    }
  },

  async unlockClass(classId, password) {
    try {
      const response = await fastapiApi.post(`/api/community/field-trip/classes/${classId}/unlock`, {
        password,
      });
      persistUnlockedClass(classId);
      return {
        classId: String(response.data?.classId || classId),
        isUnlocked: true,
      };
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '비밀번호를 확인하지 못했습니다. 다시 시도해 주세요.');
      }

      const mockApi = await loadFieldTripMockApi();
      const result = await mockApi.unlockClass(classId, password);
      persistUnlockedClass(classId);
      return result;
    }
  },

  async listPosts(classId) {
    try {
      const response = await fastapiApi.get(`/api/community/field-trip/classes/${classId}/posts`);
      return normalizePosts(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '게시글 목록을 불러오지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizePosts(await mockApi.listPosts(classId));
    }
  },

  async getPost(classId, postId) {
    try {
      const response = await fastapiApi.get(
        `/api/community/field-trip/classes/${classId}/posts/${postId}`
      );
      return normalizePost(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '게시글 상세를 불러오지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizePost(await mockApi.getPost(classId, postId));
    }
  },

  async createPost(classId, payload) {
    try {
      const response = await fastapiApi.post(
        `/api/community/field-trip/classes/${classId}/posts`,
        payload,
        // Anonymous writers rely on the field-trip scoped CSRF token issued at
        // unlock time, so create/update/delete all share this config helper.
        buildFieldTripWriteConfig()
      );
      return normalizePost(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '게시글을 저장하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizePost(await mockApi.createPost(classId, payload));
    }
  },

  async updatePost(classId, postId, payload) {
    try {
      const response = await fastapiApi.put(
        `/api/community/field-trip/classes/${classId}/posts/${postId}`,
        payload,
        buildFieldTripWriteConfig()
      );
      return normalizePost(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '게시글을 저장하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizePost(await mockApi.updatePost(classId, postId, payload));
    }
  },

  async deletePost(classId, postId) {
    try {
      const response = await fastapiApi.delete(
        `/api/community/field-trip/classes/${classId}/posts/${postId}`,
        buildFieldTripWriteConfig()
      );
      return {
        postId: String(response.data?.postId || postId),
        deleted: Boolean(response.data?.deleted),
      };
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '게시글을 삭제하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return mockApi.deletePost(classId, postId);
    }
  },

  async upload(file) {
    if (!file.type?.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드할 수 있습니다.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const fieldTripWriteConfig = buildFieldTripWriteConfig();

      const response = await fastapiApi.post('/api/community/field-trip/uploads', formData, {
        ...fieldTripWriteConfig,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(fieldTripWriteConfig.headers || {}),
        },
      });

      return normalizeUploadResponse(response.data, FASTAPI_BASE_URL);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '첨부 파일을 업로드하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizeUploadResponse(await mockApi.upload(file), FASTAPI_BASE_URL);
    }
  },

  async getScoreboard() {
    try {
      const response = await fastapiApi.get('/api/community/field-trip/scoreboard');
      return normalizeScoreRows(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '점수판을 불러오지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizeScoreRows(await mockApi.getScoreboard());
    }
  },

  async adjustScore(classId, delta) {
    try {
      const response = await fastapiApi.patch(`/api/community/field-trip/classes/${classId}/score`, {
        delta,
      });
      return normalizeScoreRow(response.data);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '점수를 저장하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return normalizeScoreRow(await mockApi.adjustScore(classId, delta));
    }
  },

  async updateClassPassword(classId, password) {
    try {
      const response = await fastapiApi.put(
        `/api/community/field-trip/classes/${classId}/password`,
        { password }
      );

      return {
        classId: String(response.data?.classId || classId),
        label: response.data?.label || getFieldTripClassLabel(classId),
        passwordUpdated: Boolean(response.data?.passwordUpdated),
      };
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '비밀번호를 저장하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return mockApi.updateClassPassword(classId, password);
    }
  },

  async updateBoardDescription(classId, boardDescription) {
    try {
      const response = await fastapiApi.put(
        `/api/community/field-trip/classes/${classId}/board-description`,
        { boardDescription },
        buildFieldTripWriteConfig()
      );

      return {
        classId: String(response.data?.classId || classId),
        label: response.data?.label || getFieldTripClassLabel(classId),
        boardDescription:
          String(response.data?.boardDescription || '').trim() ||
          getDefaultFieldTripBoardDescription(getFieldTripClassLabel(classId)),
      };
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throwFieldTripError(error, '게시판 설명을 저장하지 못했습니다.');
      }

      const mockApi = await loadFieldTripMockApi();
      return mockApi.updateBoardDescription(classId, boardDescription);
    }
  },

  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default fieldTripApi;
