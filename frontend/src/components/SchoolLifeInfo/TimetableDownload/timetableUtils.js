import timetableTemplates from './timetableTemplates.json';

export const SUBJECT_FONT_FAMILY = '"Nanum Gothic", sans-serif';
export const TIMETABLE_FONT_STYLESHEET_ID = 'timetable-font-nanum-gothic';
export const TIMETABLE_FONT_STYLESHEET_HREF =
  'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap';
export const REQUIRED_TOKENS_BY_GRADE = {
  '1': [],
  '2': ['A', 'B', 'C'],
  '3': ['A', 'B', 'C', 'D', 'E', '음/미'],
};
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
    if (!roomValue) {
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

function ensureTimetableFontLink() {
  if (typeof document === 'undefined') return null;

  let link = document.getElementById(TIMETABLE_FONT_STYLESHEET_ID);
  let created = false;

  if (!link) {
    link = document.createElement('link');
    link.id = TIMETABLE_FONT_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = TIMETABLE_FONT_STYLESHEET_HREF;
    document.head.append(link);
    created = true;
  }

  return { link, created };
}

export function mountTimetableFontStylesheet() {
  const result = ensureTimetableFontLink();
  return () => {
    if (result?.created) {
      result.link.remove();
    }
  };
}

export async function ensureTimetableFontReady() {
  ensureTimetableFontLink();
  if (typeof document === 'undefined' || !document.fonts) return;
  await document.fonts.load('16px "Nanum Gothic"');
  await document.fonts.ready;
}
