/**
 * 시간표 이미지 컬러 테마
 *
 * light: 기존 화이트 모드 (원본 색상 그대로)
 * dark:  다크 모드 — 배경 어둡게, 텍스트 밝게, 셀 색상 어둡게 변환
 */

export const THEME_OPTIONS = [
  { value: 'light', label: '화이트 모드' },
  { value: 'dark', label: '다크 모드' },
];

const DARK_THEME = {
  // 전체 슬라이드 배경 (배경 이미지 없을 때)
  slideBg: '#1A1A2E',
  // 테이블 영역 배경 (배경 이미지 있을 때 테이블 부분만)
  tableBg: '#1A1A2E',
  // 테이블 테두리 색상
  borderColor: '#3A3A5C',
  // 기본 셀 배경 (원래 흰 셀)
  defaultCellBg: '#22223B',
  // 헤더 행 배경 (원래 #595959)
  headerCellBg: '#16213E',
  // 교시 셀 배경 (원래 #EEEEEE)
  periodCellBg: '#2A2A4A',
  // 텍스트 색상
  primaryText: '#E0E0E0',
  // 흰 텍스트 (다크모드에서도 밝은 텍스트 유지)
  lightText: '#F0F0F0',
  // 교시 라벨 텍스트
  periodText: '#D4D4E8',
  // 클래스 라벨 & 학교명 텍스트
  labelText: '#E8E8F0',
  // 스트로크 색상 (밝은 텍스트에는 어두운 스트로크)
  darkStroke: '#111111',
  lightStroke: '#444466',
};

/**
 * 셀 채우기(fill) 색상을 다크 모드로 변환
 */
function transformCellFill(fill) {
  const upper = fill?.toUpperCase() ?? '';

  // 완전히 흰 셀 → 다크 기본 셀
  if (upper === '#FFFFFF' || upper === 'WHITE') {
    return DARK_THEME.defaultCellBg;
  }

  // 헤더 회색 (#595959) → 다크 헤더
  if (upper === '#595959') {
    return DARK_THEME.headerCellBg;
  }

  // 교시 칸 밝은 회색 (#EEEEEE) → 다크 교시
  if (upper === '#EEEEEE') {
    return DARK_THEME.periodCellBg;
  }

  // 선택과목 컬러 셀들 → 채도 유지하되 명도를 낮춤
  return darkenColor(fill, 0.45);
}

/**
 * 텍스트 색상을 다크 모드로 변환
 */
function transformTextColor(textColor) {
  const upper = textColor?.toUpperCase() ?? '';

  // 검은 텍스트 → 밝은 텍스트
  if (upper === '#000000' || upper === 'BLACK') {
    return DARK_THEME.primaryText;
  }

  // 이미 흰 텍스트는 그대로 유지
  if (upper === '#FFFFFF' || upper === 'WHITE') {
    return DARK_THEME.lightText;
  }

  // 어두운 색상 텍스트 → 밝게
  return lightenColor(textColor, 0.6);
}

/**
 * 스트로크 색상 (다크 모드)
 */
function getDarkStrokeColor(textColor) {
  const upper = textColor?.toUpperCase() ?? '';
  // 밝은 텍스트에는 어두운 스트로크
  if (upper === '#FFFFFF' || upper === 'WHITE' || upper === DARK_THEME.lightText || upper === DARK_THEME.primaryText.toUpperCase()) {
    return DARK_THEME.darkStroke;
  }
  return DARK_THEME.lightStroke;
}

/**
 * hex → RGB 파싱
 */
function hexToRgb(hex) {
  const cleaned = hex?.replace('#', '') ?? '000000';
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * RGB → hex
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

/**
 * 색상의 명도를 낮춤 (factor: 0~1, 작을수록 어두움)
 */
function darkenColor(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

/**
 * 어두운 색상을 밝게 (factor: 0~1, 클수록 밝음)
 */
function lightenColor(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * factor,
    g + (255 - g) * factor,
    b + (255 - b) * factor
  );
}

/**
 * 테마 적용 유틸리티
 *
 * isDark가 false이면 원본 값을 그대로 반환.
 */
export function applyTheme(isDark) {
  if (!isDark) {
    return {
      slideBg: '#FFFFFF',
      borderColor: '#000000',
      cellFill: (fill) => fill,
      textColor: (color) => color,
      strokeColor: (textColor) => {
        const n = textColor?.toUpperCase();
        return n === '#FFFFFF' || n === 'WHITE' ? '#111111' : '#FFFFFF';
      },
      periodTextColor: '#111111',
      periodStroke: '#FFFFFF',
      labelTextColor: '#000000',
      labelStroke: '#FFFFFF',
    };
  }

  return {
    slideBg: DARK_THEME.slideBg,
    borderColor: DARK_THEME.borderColor,
    cellFill: transformCellFill,
    textColor: transformTextColor,
    strokeColor: getDarkStrokeColor,
    periodTextColor: DARK_THEME.periodText,
    periodStroke: DARK_THEME.darkStroke,
    labelTextColor: DARK_THEME.labelText,
    labelStroke: DARK_THEME.darkStroke,
  };
}
