import timetableTemplates from './timetableTemplates.json';

export const SUBJECT_FONT_FAMILY = '"S-CoreDream", sans-serif';
export const LABEL_FONT_FAMILY = '"Cafe24Surround", sans-serif';
export const TIMETABLE_FONT_STYLESHEET_ID = 'timetable-font-custom';
export const REQUIRED_TOKENS_BY_GRADE = {
  '1': [],
  '2': ['D', 'E', 'F'],
  '3': ['A', 'B', 'C', 'D', '음/미'],
};

const GRADE2_DEF_CANDIDATES = [
  { label: '언어 생활 탐구', abbrev: '언생탐' },
  { label: '확률과 통계', abbrev: '확통' },
  { label: '정치', abbrev: '정치' },
  { label: '경제', abbrev: '경제' },
  { label: '윤리와 사상', abbrev: '윤사' },
  { label: '역학과 에너지', abbrev: '물리' },
  { label: '화학 반응의 세계', abbrev: '화학' },
  { label: '세포와 물질대사', abbrev: '생명' },
];

const GRADE3_ABC_CANDIDATES = [
  { label: '고전읽기', abbrev: '고전읽기' },
  { label: '현대문학감상', abbrev: '현문감' },
  { label: '수학적 사고와 통계', abbrev: '수사통' },
  { label: '수학적 사고와 적분', abbrev: '수사적' },
  { label: '진로영어', abbrev: '진로영어' },
  { label: '사회문화', abbrev: '사회문화' },
  { label: '현대 사회의 윤리적 쟁점', abbrev: '현사윤쟁' },
  { label: '여행지리', abbrev: '여행지리' },
  { label: '생활과 과학', abbrev: '생과' },
];

const GRADE3_D_CANDIDATES = [
  { label: '심화수학 I', abbrev: '심수' },
  { label: '도덕 윤리 과제연구', abbrev: '도윤과' },
  { label: '현대세계의 변화', abbrev: '현세변' },
  { label: '사회과제연구', abbrev: '사과연' },
  { label: '융합과학', abbrev: '융과' },
  { label: '융합과학탐구', abbrev: '융과탐' },
];

export const SUBJECT_CANDIDATES = {
  '2': { D: GRADE2_DEF_CANDIDATES, E: GRADE2_DEF_CANDIDATES, F: GRADE2_DEF_CANDIDATES },
  '3': { A: GRADE3_ABC_CANDIDATES, B: GRADE3_ABC_CANDIDATES, C: GRADE3_ABC_CANDIDATES, D: GRADE3_D_CANDIDATES },
};

export function getSubjectCandidates(grade, token) {
  return SUBJECT_CANDIDATES[grade]?.[token] ?? null;
}

export const GRADE2_ROOM_CANDIDATES = {
  D: {
    '생명': ['2-3'],
    '언생탐': ['2-9'],
    '물리': ['2-6'],
    '윤사': ['2-8'],
    '정치': ['2-10'],
    '화학': ['2-2', '2-5'],
    '확통': ['2-1', '2-4', '2-7', '5층중강'],
  },
  E: {
    '생명': ['2-4'],
    '언생탐': ['2-1'],
    '물리': ['2-7', '2-10'],
    '윤사': ['2-9'],
    '화학': ['2-3', '2-6'],
    '확통': ['2-2', '2-5', '2-8'],
  },
  F: {
    '경제': ['2-2'],
    '생명': ['2-5'],
    '물리': ['2-8'],
    '윤사': ['2-10'],
    '정치': ['2-1'],
    '화학': ['2-4', '2-7'],
    '확통': ['2-3', '2-6', '2-9'],
  },
};

export const GRADE3_ROOM_CANDIDATES = {
  A: {
    '고전읽기': ['3-8'],
    '생과': ['3-3', '3-6'],
    '수사적': ['3-10'],
    '수사통': ['3-1'],
    '여행지리': ['3-2', '3-5'],
    '현문감': ['3-9'],
    '현사윤쟁': ['3-4', '3-7'],
  },
  B: {
    '고전읽기': ['3-9'],
    '사회문화': ['3-2'],
    '생과': ['3-4', '3-7'],
    '수사통': ['3-1'],
    '여행지리': ['3-3', '3-6', '3-8'],
    '현문감': ['3-10'],
    '현사윤쟁': ['3-5'],
  },
  C: {
    '생과': ['3-5', '3-8', '3-10'],
    '수사통': ['3-1'],
    '여행지리': ['3-4', '3-7', '3-9'],
    '진로영어': ['2층중강'],
    '현사윤쟁': ['3-3', '3-6'],
  },
  D: {
    '도윤과': ['3-3', '3-4'],
    '사과연': ['3-5', '3-6'],
    '심수': ['3-1', '3-2'],
    '융과': ['3-8'],
    '융과탐': ['3-9', '3-10'],
    '현세변': ['3-7', '2층중강'],
  },
};

export const TOKEN_ROOM_CANDIDATES = {
  '2': {
    D: ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10', '5층중강'],
    E: ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10'],
    F: ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10'],
  },
  '3': {
    A: ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10'],
    B: ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10'],
    C: ['3-1', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10', '2층중강'],
    D: ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10', '2층중강'],
  },
};

export const DEFAULT_GRADE_ROOM_CANDIDATES = {
  '2': ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10', '5층중강'],
  '3': ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10', '2층중강'],
};

export function getRoomCandidates(grade, token, subject) {
  const gradeStr = String(grade);
  const subjectMap =
    gradeStr === '2'
      ? GRADE2_ROOM_CANDIDATES[token]
      : gradeStr === '3'
      ? GRADE3_ROOM_CANDIDATES[token]
      : null;

  if (subjectMap && subject && subjectMap[subject]) {
    return subjectMap[subject];
  }
  const tokenRooms = TOKEN_ROOM_CANDIDATES[gradeStr]?.[token];
  if (tokenRooms) {
    return tokenRooms;
  }
  return DEFAULT_GRADE_ROOM_CANDIDATES[gradeStr] ?? null;
}
export const GRADE_OPTIONS = [
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
];
export const MIN_SUBJECT_FONT_PX = 14;
export const RECOMMENDED_SUBJECT_LENGTH = 6;
export const RECOMMENDED_ROOM_LENGTH = 10;

const measurementCanvas =
  typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measurementContext = measurementCanvas?.getContext('2d') ?? null;

export const timetableMeta = timetableTemplates.meta;
export const timetableShared = timetableTemplates.shared;
export const timetableGradeMap = timetableTemplates.grades;
export const timetableTemplateMap = timetableTemplates.templates;

function createEmptyTokenDraft() {
  return { subject: '', room: '' };
}

export function getRequiredTokens(grade) {
  return REQUIRED_TOKENS_BY_GRADE[String(grade)] ?? [];
}

export function createDraftForGrade(grade, source = {}) {
  const tokens = getRequiredTokens(grade);
  return Object.fromEntries(
    tokens.map((token) => {
      const value = source[token];
      if (typeof value === 'string') {
        return [token, { subject: value, room: '' }];
      }

      return [
        token,
        {
          ...createEmptyTokenDraft(),
          ...(value && typeof value === 'object' ? value : {}),
        },
      ];
    })
  );
}

export function getClassOptions(grade) {
  if (!grade) return [];
  return (timetableGradeMap[String(grade)] ?? []).map((classId) => {
    const classNumber = classId.split('-')[1];
    return {
      value: classNumber,
      label: `${Number(classNumber)}반`,
      classId,
    };
  });
}

export function getTemplateBySelection(grade, classNumber) {
  if (!grade || !classNumber) return null;
  return timetableTemplateMap[`${grade}-${classNumber}`] ?? null;
}

export function getTokenSwatches(template, grade) {
  if (!template) return {};
  const tokens = new Set(getRequiredTokens(grade));
  return template.cells.flat().reduce((accumulator, cell) => {
    if (!tokens.has(cell.text) || accumulator[cell.text]) return accumulator;
    accumulator[cell.text] = cell.fill;
    return accumulator;
  }, {});
}

export function normalizeDraftValue(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function getDraftEntry(draftValues, token) {
  const entry = draftValues?.[token];
  if (!entry || typeof entry !== 'object') {
    return createEmptyTokenDraft();
  }
  return {
    ...createEmptyTokenDraft(),
    ...entry,
  };
}

export function isPlaceholderToken(text, grade) {
  return getRequiredTokens(grade).includes(text);
}

export function getRenderedCellContent(cellText, draftValues, grade) {
  if (!isPlaceholderToken(cellText, grade)) {
    return {
      text: cellText,
      lines: [cellText],
      isPlaceholder: false,
    };
  }

  const draftEntry = getDraftEntry(draftValues, cellText);
  const subject = String(draftEntry.subject ?? '').trim();
  const room = String(draftEntry.room ?? '').trim();

  if (!subject && !room) {
    return {
      text: cellText,
      lines: [cellText],
      isPlaceholder: true,
    };
  }

  return {
    text: [subject, room].filter(Boolean).join(' '),
    lines: [subject || cellText, room].filter(Boolean),
    isPlaceholder: true,
  };
}

export function halfPointsToPx(halfPoints) {
  return (Number(halfPoints) / 100) * (96 / 72);
}

export function emuToViewBoxX(value) {
  return (Number(value) * timetableMeta.viewBoxWidth) / timetableMeta.slideWidthEmu;
}

export function emuToViewBoxY(value) {
  return (Number(value) * timetableMeta.viewBoxHeight) / timetableMeta.slideHeightEmu;
}

export function getColumnWidthPx(columnIndex) {
  return emuToViewBoxX(timetableShared.table.columnsEmu[columnIndex] ?? 0);
}

export function fitTextToWidth({
  text,
  maxWidth,
  baseFontSize,
  minFontSize = MIN_SUBJECT_FONT_PX,
  maxFontSize = baseFontSize,
  fontFamily = SUBJECT_FONT_FAMILY,
}) {
  const safeText = String(text ?? '').trim();
  if (!safeText) {
    return { fontSize: maxFontSize, fits: true, measuredWidth: 0 };
  }

  if (!measurementContext) {
    return {
      fontSize: maxFontSize,
      fits: safeText.length <= RECOMMENDED_SUBJECT_LENGTH,
      measuredWidth: 0,
    };
  }

  const ceiling = Math.max(minFontSize, maxFontSize);
  let low = minFontSize;
  let high = ceiling;
  let best = minFontSize;
  let bestWidth = 0;

  while (high - low > 0.25) {
    const candidate = (low + high) / 2;
    measurementContext.font = `${candidate}px ${fontFamily}`;
    const width = measurementContext.measureText(safeText).width;
    if (width <= maxWidth) {
      best = candidate;
      bestWidth = width;
      low = candidate;
    } else {
      high = candidate;
    }
  }

  measurementContext.font = `${best}px ${fontFamily}`;
  const measuredWidth = measurementContext.measureText(safeText).width;
  return {
    fontSize: Number(best.toFixed(1)),
    fits: measuredWidth <= maxWidth,
    measuredWidth: bestWidth || measuredWidth,
  };
}

export function fitElectiveText({
  subject,
  room,
  maxWidth,
  baseFontSize,
  cellHeight,
}) {
  const subjectFit = fitTextToWidth({
    text: subject,
    maxWidth,
    baseFontSize: baseFontSize * 1.18,
    minFontSize: MIN_SUBJECT_FONT_PX,
    maxFontSize: Math.max(baseFontSize * 1.65, cellHeight * 0.38),
  });
  const roomFit = fitTextToWidth({
    text: room,
    maxWidth,
    baseFontSize: baseFontSize * 1.18,
    minFontSize: MIN_SUBJECT_FONT_PX,
    maxFontSize: Math.max(baseFontSize * 1.65, cellHeight * 0.38),
  });

  const sharedFontSize = Number(Math.min(subjectFit.fontSize, roomFit.fontSize).toFixed(1));

  return {
    subjectFontSize: sharedFontSize,
    roomFontSize: sharedFontSize,
    subjectFits: subjectFit.fits,
    roomFits: roomFit.fits,
  };
}

export function isRoomInputRequired(token, subject) {
  if (token === '음/미') return false;
  if (subject === '음악' || subject === '미술') return false;
  return true;
}

export function validateDraft({ grade, draftValues, template }) {
  const requiredTokens = getRequiredTokens(grade);
  const missingFields = [];
  if (!template) {
    return {
      missingFields,
      overflowFields: [],
      complete: false,
      canDownload: false,
      fittedFonts: {},
    };
  }

  if (requiredTokens.length === 0) {
    return {
      missingFields: [],
      overflowFields: [],
      complete: true,
      canDownload: true,
      fittedFonts: {},
    };
  }

  const availableWidth = getColumnWidthPx(1) - 16;
  const cellHeight = emuToViewBoxY(timetableShared.table.rowsEmu[1] ?? 0);
  const fittedFonts = {};
  const overflowFields = [];

  requiredTokens.forEach((token) => {
    const draftEntry = getDraftEntry(draftValues, token);
    const subjectValue = String(draftEntry.subject ?? '').trim();
    const roomValue = String(draftEntry.room ?? '').trim();
    const placeholderCell = template.cells.flat().find((cell) => cell.text === token);
    const baseFontSize = halfPointsToPx(placeholderCell?.fontSizeHalfPoints ?? 1900);

    if (!subjectValue) {
      missingFields.push({ token, field: 'subject' });
    }
    if (!roomValue && isRoomInputRequired(token, subjectValue)) {
      missingFields.push({ token, field: 'room' });
    }

    if (!subjectValue && !roomValue) {
      return;
    }

    const fitResult = fitElectiveText({
      subject: subjectValue,
      room: roomValue,
      maxWidth: availableWidth,
      baseFontSize,
      cellHeight,
    });
    fittedFonts[token] = fitResult;
    if (!fitResult.subjectFits) {
      overflowFields.push({ token, field: 'subject' });
    }
    if (!fitResult.roomFits) {
      overflowFields.push({ token, field: 'room' });
    }
  });

  return {
    missingFields,
    overflowFields,
    complete: missingFields.length === 0,
    canDownload: missingFields.length === 0 && overflowFields.length === 0,
    fittedFonts,
  };
}

export function formatPeriodText(text) {
  const match = String(text ?? '').match(/^(\d+교시)(.+)$/);
  if (!match) return [String(text ?? '')];
  return [match[1], match[2]];
}

export function getDownloadFileName(grade, classNumber) {
  return `범서고_${grade}학년_${classNumber}반_시간표.png`;
}

export function formatMissingFieldLabel(token, field) {
  return `${token} ${field === 'subject' ? '과목명' : '교실'}`;
}

const TIMETABLE_FONT_FACE_CSS = `
@font-face {
  font-family: 'S-CoreDream';
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-5Medium.woff') format('woff');
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: 'S-CoreDream';
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-6Bold.woff') format('woff');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Cafe24Surround';
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff') format('woff');
  font-weight: normal;
  font-display: swap;
}
`;

function ensureTimetableFontStyle() {
  if (typeof document === 'undefined') return null;

  let style = document.getElementById(TIMETABLE_FONT_STYLESHEET_ID);
  let created = false;

  if (!style) {
    style = document.createElement('style');
    style.id = TIMETABLE_FONT_STYLESHEET_ID;
    style.textContent = TIMETABLE_FONT_FACE_CSS;
    document.head.append(style);
    created = true;
  }

  return { style, created };
}

export function mountTimetableFontStylesheet() {
  const result = ensureTimetableFontStyle();
  return () => {
    if (result?.created) {
      result.style.remove();
    }
  };
}

export async function ensureTimetableFontReady() {
  ensureTimetableFontStyle();
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([
    document.fonts.load('500 16px "S-CoreDream"'),
    document.fonts.load('600 16px "S-CoreDream"'),
    document.fonts.load('16px "Cafe24Surround"'),
  ]);
  await document.fonts.ready;
}
