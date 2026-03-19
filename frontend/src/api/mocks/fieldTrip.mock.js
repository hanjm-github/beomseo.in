import {
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../../config/env';
import {
  FIELD_TRIP_CLASS_IDS,
  FIELD_TRIP_MAX_SCORE,
  FIELD_TRIP_PASSWORDS,
  FIELD_TRIP_SCORE_ROWS,
} from '../../features/fieldTrip/constants';
import {
  getDefaultFieldTripBoardDescription,
  getFieldTripClassLabel,
} from '../../features/fieldTrip/utils';

const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cloneValue = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const initialBoardDescriptions = Object.fromEntries(
  FIELD_TRIP_CLASS_IDS.map((classId) => {
    const label = getFieldTripClassLabel(classId);
    return [classId, getDefaultFieldTripBoardDescription(label)];
  })
);

const initialPostsByClass = {
  '1': [
    {
      id: 'field-trip-1-1',
      classId: '1',
      authorUserId: 0,
      authorRole: 'anonymous',
      nickname: '1반 운영진',
      title: '경주 미션 체크인 완료 사진',
      body: '대릉원 앞 단체 사진, 왕릉 퀴즈, 박물관 스탬프까지 모두 완료했습니다. 마지막 체크는 버스 탑승 직전에 성공했어요.',
      attachments: [
        {
          id: 'field-trip-1-1-a',
          name: 'gyeongju-mission-photo.jpg',
          size: 412000,
          url: 'https://example.com/assets/field-trip/gyeongju-mission-photo.jpg',
          mime: 'image/jpeg',
          kind: 'image',
        },
      ],
      createdAt: '2026-03-15T08:10:00Z',
      updatedAt: '2026-03-15T08:10:00Z',
    },
    {
      id: 'field-trip-1-2',
      classId: '1',
      authorUserId: 0,
      authorRole: 'anonymous',
      nickname: '민서',
      title: '야간 미션 인증 파일 업로드',
      body: '야간 체험 코스에서 받은 미션지를 스캔해서 올립니다. 1반지 모든 조가 같이 확인까지 완료했습니다.',
      attachments: [
        {
          id: 'field-trip-1-2-a',
          name: 'night-mission-sheet.pdf',
          size: 283000,
          url: 'https://example.com/assets/field-trip/night-mission-sheet.pdf',
          mime: 'application/pdf',
          kind: 'file',
        },
      ],
      createdAt: '2026-03-15T11:24:00Z',
      updatedAt: '2026-03-15T11:24:00Z',
    },
  ],
  '2': [],
  '3': [
    {
      id: 'field-trip-3-1',
      classId: '3',
      authorUserId: 0,
      authorRole: 'anonymous',
      nickname: '3반 기록팀',
      title: '조별 미션 답안 정리본',
      body: '오후 자유시간 구간에서 받은 퀴즈 답안과 사진 인증 순서를 정리해서 공유합니다. 빠진 조가 있으면 이 글 기준으로 다시 확인해 주세요.',
      attachments: [
        {
          id: 'field-trip-3-1-a',
          name: 'mission-answers.zip',
          size: 524000,
          url: 'https://example.com/assets/field-trip/mission-answers.zip',
          mime: 'application/zip',
          kind: 'file',
        },
      ],
      createdAt: '2026-03-15T10:45:00Z',
      updatedAt: '2026-03-15T10:45:00Z',
    },
  ],
  '4': [],
  '5': [],
  '6': [],
  '7': [
    {
      id: 'field-trip-7-1',
      classId: '7',
      authorUserId: 0,
      authorRole: 'anonymous',
      nickname: '인솔조',
      title: '최종 단체 미션 인증',
      body: '7반 전체가 참여한 단체 미션 인증 사진입니다. 대형 구호 영상도 같이 첨부했어요.',
      attachments: [
        {
          id: 'field-trip-7-1-a',
          name: 'class7-group-photo.jpg',
          size: 603000,
          url: 'https://example.com/assets/field-trip/class7-group-photo.jpg',
          mime: 'image/jpeg',
          kind: 'image',
        },
      ],
      createdAt: '2026-03-15T13:05:00Z',
      updatedAt: '2026-03-15T13:05:00Z',
    },
  ],
  '8': [],
  '9': [],
  '10': [],
};

let mockPostsByClass = cloneValue(initialPostsByClass);
let mockPasswords = { ...FIELD_TRIP_PASSWORDS };
let mockScoreRows = cloneValue(FIELD_TRIP_SCORE_ROWS);
let mockBoardDescriptions = { ...initialBoardDescriptions };

function getClassPosts(classId) {
  return [...(mockPostsByClass[classId] || [])].sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
  );
}

function buildClassRows() {
  return FIELD_TRIP_CLASS_IDS.map((classId) => {
    const label = getFieldTripClassLabel(classId);
    return {
      classId,
      label,
      postCount: mockPostsByClass[classId]?.length || 0,
      boardDescription:
        String(mockBoardDescriptions[classId] || '').trim() ||
        getDefaultFieldTripBoardDescription(label),
    };
  });
}

function getScoreRowOrThrow(classId) {
  const row = mockScoreRows.find((item) => item.classId === classId);
  if (!row) {
    throw new Error('존재하지 않는 반입니다.');
  }

  return row;
}

async function listClasses() {
  await delay(120);
  return buildClassRows();
}

async function unlockClass(classId, password) {
  await delay(80);

  if (mockPasswords[classId] !== password) {
    const error = new Error('비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
    error.code = 'INVALID_PASSWORD';
    throw error;
  }

  return {
    classId,
    isUnlocked: true,
  };
}

async function listPosts(classId) {
  await delay(120);
  return getClassPosts(classId);
}

async function getPost(classId, postId) {
  await delay(90);
  const post = (mockPostsByClass[classId] || []).find((item) => item.id === postId);

  if (!post) {
    throw new Error('게시글을 찾을 수 없습니다.');
  }

  return cloneValue(post);
}

async function createPost(classId, payload) {
  await delay(120);

  const now = new Date().toISOString();
  // Mirror the real API contract: payload.nickname only matters for anonymous
  // creation, while authenticated mock writes synthesize a user-backed author.
  const createdPost = {
    id: `field-trip-${classId}-${Date.now()}`,
    classId,
    authorUserId: payload.nickname ? 0 : 1,
    authorRole: payload.nickname ? 'anonymous' : 'student',
    nickname: payload.nickname || '로그인 사용자',
    title: payload.title,
    body: payload.body,
    attachments: cloneValue(payload.attachments || []),
    createdAt: now,
    updatedAt: now,
  };

  const existing = mockPostsByClass[classId] || [];
  mockPostsByClass = {
    ...mockPostsByClass,
    [classId]: [createdPost, ...existing],
  };

  return cloneValue(createdPost);
}

async function updatePost(classId, postId, payload) {
  await delay(120);
  const existingPosts = [...(mockPostsByClass[classId] || [])];
  const targetIndex = existingPosts.findIndex((post) => post.id === postId);

  if (targetIndex === -1) {
    throw new Error('게시글을 찾을 수 없습니다.');
  }

  const nextPost = {
    ...existingPosts[targetIndex],
    title: payload.title,
    body: payload.body,
    attachments: cloneValue(payload.attachments || []),
    updatedAt: new Date().toISOString(),
  };
  existingPosts[targetIndex] = nextPost;

  mockPostsByClass = {
    ...mockPostsByClass,
    [classId]: existingPosts,
  };

  return cloneValue(nextPost);
}

async function deletePost(classId, postId) {
  await delay(120);
  const existingPosts = [...(mockPostsByClass[classId] || [])];
  const nextPosts = existingPosts.filter((post) => post.id !== postId);

  if (nextPosts.length === existingPosts.length) {
    throw new Error('게시글을 찾을 수 없습니다.');
  }

  mockPostsByClass = {
    ...mockPostsByClass,
    [classId]: nextPosts,
  };

  return {
    postId,
    deleted: true,
  };
}

async function upload(file) {
  if (!file.type?.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
  }

  await delay(100);

  return {
    id: `field-trip-upload-${Date.now()}`,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
    mime: file.type || 'application/octet-stream',
    kind: file.type?.startsWith('image/') ? 'image' : 'file',
  };
}

async function getScoreboard() {
  await delay(100);
  return cloneValue(mockScoreRows);
}

async function adjustScore(classId, delta) {
  await delay(90);

  const row = getScoreRowOrThrow(classId);
  const nextScore = Number(row.totalScore || 0) + Number(delta || 0);

  if (nextScore < 0) {
    throw new Error('점수를 0점 미만으로 내릴 수 없습니다.');
  }

  if (nextScore > FIELD_TRIP_MAX_SCORE) {
    throw new Error(`점수는 ${FIELD_TRIP_MAX_SCORE}점을 초과할 수 없습니다.`);
  }

  row.totalScore = nextScore;
  return cloneValue(row);
}

async function updateClassPassword(classId, password) {
  await delay(90);

  const normalizedPassword = String(password || '').trim();

  if (!normalizedPassword) {
    throw new Error('비밀번호를 입력해 주세요.');
  }

  if (normalizedPassword.length < 4) {
    throw new Error('비밀번호는 4자 이상 입력해 주세요.');
  }

  if (!FIELD_TRIP_CLASS_IDS.includes(classId)) {
    throw new Error('존재하지 않는 반입니다.');
  }

  mockPasswords = {
    ...mockPasswords,
    [classId]: normalizedPassword,
  };

  return {
    classId,
    label: getFieldTripClassLabel(classId),
    passwordUpdated: true,
  };
}

async function updateBoardDescription(classId, boardDescription) {
  await delay(90);

  const normalizedDescription = String(boardDescription || '').trim();
  if (!FIELD_TRIP_CLASS_IDS.includes(classId)) {
    throw new Error('존재하지 않는 반입니다.');
  }

  mockBoardDescriptions = {
    ...mockBoardDescriptions,
    [classId]:
      normalizedDescription || getDefaultFieldTripBoardDescription(getFieldTripClassLabel(classId)),
  };

  return {
    classId,
    label: getFieldTripClassLabel(classId),
    boardDescription: mockBoardDescriptions[classId],
  };
}

export const fieldTripMockApi = {
  listClasses,
  unlockClass,
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  upload,
  getScoreboard,
  adjustScore,
  updateClassPassword,
  updateBoardDescription,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};
