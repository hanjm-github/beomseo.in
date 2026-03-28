import { fastapiApi, FASTAPI_BASE_URL, readCookie } from './fastapiClient';
import { normalizeUploadResponse } from './normalizers';
import {
  FIELD_TRIP_VIDEO_MAX_SIZE_BYTES,
  FIELD_TRIP_VIDEO_MAX_SIZE_MB,
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../config/env';
import {
  getDefaultFieldTripBoardDescription,
  getFieldTripClassLabel,
  hydrateClassesWithUnlockState,
  normalizeFieldTripAccessMode,
  persistUnlockedClass,
} from '../features/fieldTrip/utils';

const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;
const MAX_VIDEO_FILE_SIZE = FIELD_TRIP_VIDEO_MAX_SIZE_BYTES;
const FIELD_TRIP_CSRF_COOKIE = 'field_trip_csrf_token';
const FIELD_TRIP_VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;
const FIELD_TRIP_IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp)$/i;

function isVideoLikeFile(file) {
  return Boolean(file?.type?.startsWith('video/') || FIELD_TRIP_VIDEO_EXTENSIONS.test(file?.name || ''));
}

function isImageLikeFile(file) {
  return Boolean(file?.type?.startsWith('image/') || FIELD_TRIP_IMAGE_EXTENSIONS.test(file?.name || ''));
}

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

function unwrapCollection(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function normalizeAccessMode(data) {
  return normalizeFieldTripAccessMode(data?.accessMode);
}

function normalizeClassRows(data) {
  const accessMode = normalizeAccessMode(data);
  const rows = unwrapCollection(data).map((row) => {
    const classId = String(row.classId || '');
    const label = row.label || getFieldTripClassLabel(classId);
    return {
      accessMode,
      classId,
      label,
      postCount: Number(row.postCount || 0),
      isUnlocked: Boolean(row.isUnlocked),
      boardDescription: String(row.boardDescription || '').trim(),
    };
  });

  return hydrateClassesWithUnlockState(rows).map((row) => ({
    ...row,
    boardDescription:
      row.boardDescription ||
      (row.isUnlocked ? getDefaultFieldTripBoardDescription(row.label, accessMode) : ''),
  }));
}

function normalizeClassCollection(data) {
  return {
    accessMode: normalizeAccessMode(data),
    items: normalizeClassRows(data),
  };
}

function normalizePost(post) {
  if (!post || typeof post !== 'object') {
    return null;
  }

  const normalizedAttachments = Array.isArray(post.attachments)
    ? post.attachments
        .map((attachment) => normalizeUploadResponse(attachment, FASTAPI_BASE_URL))
        .filter(Boolean)
    : [];
  const videoAttachment =
    normalizedAttachments.find((attachment) => attachment?.kind === 'video') || null;

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
    attachments: normalizedAttachments.filter((attachment) => attachment?.kind !== 'video'),
    videoAttachment,
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

function normalizeScoreboard(data) {
  return {
    accessMode: normalizeAccessMode(data),
    items: normalizeScoreRows(data),
  };
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
      return normalizeClassCollection(response.data);
    } catch (error) {
      throwFieldTripError(error, '반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
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
        boardDescription:
          String(response.data?.boardDescription || '').trim() ||
          getDefaultFieldTripBoardDescription(getFieldTripClassLabel(classId)),
      };
    } catch (error) {
      throwFieldTripError(error, '비밀번호를 확인하지 못했습니다. 다시 시도해 주세요.');
    }
  },

  async listPosts(classId) {
    try {
      const response = await fastapiApi.get(`/api/community/field-trip/classes/${classId}/posts`);
      return normalizePosts(response.data);
    } catch (error) {
      throwFieldTripError(error, '게시글 목록을 불러오지 못했습니다.');
    }
  },

  async getPost(classId, postId) {
    try {
      const response = await fastapiApi.get(
        `/api/community/field-trip/classes/${classId}/posts/${postId}`
      );
      return normalizePost(response.data);
    } catch (error) {
      throwFieldTripError(error, '게시글 상세를 불러오지 못했습니다.');
    }
  },

  async createPost(classId, payload) {
    try {
      const response = await fastapiApi.post(
        `/api/community/field-trip/classes/${classId}/posts`,
        payload,
        buildFieldTripWriteConfig()
      );
      return normalizePost(response.data);
    } catch (error) {
      throwFieldTripError(error, '게시글을 저장하지 못했습니다.');
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
      throwFieldTripError(error, '게시글을 수정하지 못했습니다.');
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
      throwFieldTripError(error, '게시글을 삭제하지 못했습니다.');
    }
  },

  async upload(file) {
    const isVideo = isVideoLikeFile(file);
    const isImage = isImageLikeFile(file);
    const sizeLimit = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
    const sizeLimitMb = isVideo ? FIELD_TRIP_VIDEO_MAX_SIZE_MB : UPLOAD_MAX_FILE_SIZE_MB;

    if (!isImage && !isVideo) {
      throw new Error('이미지 또는 동영상 파일만 업로드할 수 있습니다.');
    }

    if (file.size > sizeLimit) {
      throw new Error(
        isVideo
          ? `동영상은 ${sizeLimitMb}MB 이하만 업로드할 수 있습니다.`
          : `첨부 용량은 ${sizeLimitMb}MB 이하만 가능합니다.`
      );
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
      throwFieldTripError(error, '첨부 파일을 업로드하지 못했습니다.');
    }
  },

  async getScoreboard() {
    try {
      const response = await fastapiApi.get('/api/community/field-trip/scoreboard');
      return normalizeScoreboard(response.data);
    } catch (error) {
      throwFieldTripError(error, '점수판을 불러오지 못했습니다.');
    }
  },

  async adjustScore(classId, delta) {
    try {
      const response = await fastapiApi.patch(`/api/community/field-trip/classes/${classId}/score`, {
        delta,
      });
      return normalizeScoreRow(response.data);
    } catch (error) {
      throwFieldTripError(error, '점수를 변경하지 못했습니다.');
    }
  },

  async updateAccessMode(accessMode) {
    try {
      const response = await fastapiApi.put('/api/community/field-trip/settings/access-mode', {
        accessMode,
      });
      return {
        accessMode: normalizeAccessMode(response.data),
      };
    } catch (error) {
      throwFieldTripError(error, '공개 모드를 변경하지 못했습니다.');
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
      throwFieldTripError(error, '비밀번호를 변경하지 못했습니다.');
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
      throwFieldTripError(error, '게시판 설명을 수정하지 못했습니다.');
    }
  },

  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default fieldTripApi;
