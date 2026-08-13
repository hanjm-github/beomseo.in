import { ensureTimetableFontReady, TIMETABLE_FONT_STYLESHEET_ID } from './timetableUtils';
import { applyTheme } from './timetableTheme';

function ensureSvgNamespaces(svgMarkup) {
  let nextMarkup = svgMarkup;
  if (!nextMarkup.includes('xmlns="http://www.w3.org/2000/svg"')) {
    nextMarkup = nextMarkup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!nextMarkup.includes('xmlns:xlink=')) {
    nextMarkup = nextMarkup.replace(
      '<svg',
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
    );
  }
  return nextMarkup;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('데이터를 읽지 못했습니다.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

// 폰트 Data URL 캐시
const fontDataUrlCache = new Map();

/**
 * 주어진 CSS 내의 외부 폰트 URL(https://...)을 fetch하여 base64 Data URL로 변환한다.
 * SVG가 <img> 태그로 로드될 때 외부 리소스 요청이 차단되므로 필수적이다.
 */
async function getEmbeddedFontCss(css) {
  let embeddedCss = css;
  const urlRegex = /url\(['\"]?(https:\/\/[^'"]+)['\"]?\)/g;
  const matches = [...css.matchAll(urlRegex)];

  await Promise.all(
    matches.map(async (match) => {
      const originalUrl = match[1];
      if (fontDataUrlCache.has(originalUrl)) {
        embeddedCss = embeddedCss.replace(
          match[0],
          `url('${fontDataUrlCache.get(originalUrl)}')`
        );
        return;
      }
      try {
        const response = await fetch(originalUrl);
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          fontDataUrlCache.set(originalUrl, dataUrl);
          embeddedCss = embeddedCss.replace(match[0], `url('${dataUrl}')`);
        }
      } catch (err) {
        console.warn('Failed to embed font:', originalUrl, err);
      }
    })
  );

  return embeddedCss;
}

/**
 * 폰트 CSS를 SVG 내부 <defs><style>로 인라인한다.
 * SVG가 Blob으로 로드될 때는 외부 document 스타일 및 외부 URL 접근을 할 수 없으므로 base64로 변환하여 넣는다.
 */
async function inlineFontsIntoSvg(clonedSvg) {
  const fontStyle = document.getElementById(TIMETABLE_FONT_STYLESHEET_ID);
  if (!fontStyle) return;

  const css = fontStyle.textContent ?? '';
  if (!css) return;

  const embeddedCss = await getEmbeddedFontCss(css);

  // 기존 defs 또는 새 defs 생성
  let defs = clonedSvg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    clonedSvg.prepend(defs);
  }

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = embeddedCss;
  defs.prepend(style);
}

/**
 * URL(blob:, http:, https:, 상대경로)을 fetch하여 data URL로 변환한다.
 */
async function urlToDataUrl(url) {
  const fetchUrl = url.startsWith('http') || url.startsWith('blob:')
    ? url
    : new URL(url, window.location.href).toString();

  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다: ${url}`);
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

/**
 * SVG 내 모든 <image> 태그의 외부 URL(blob:/http:/https:/상대경로)을
 * data URL로 변환하여 SVG를 완전히 자급자족(self-contained)하게 만든다.
 *
 * 이 방식을 쓰면 미리보기 SVG와 동일한 렌더 경로를 사용하므로
 * 다운로드 결과가 미리보기와 항상 일치한다.
 */
async function inlineImagesIntoSvg(clonedSvg) {
  const imageNodes = Array.from(clonedSvg.querySelectorAll('image'));

  await Promise.all(
    imageNodes.map(async (imageNode) => {
      const href =
        imageNode.getAttribute('href') ||
        imageNode.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

      if (!href) return;

      // 이미 data URL이면 유지
      if (href.startsWith('data:')) return;

      // blob:, http:, https:, 상대경로 → data URL로 변환
      try {
        const dataUrl = await urlToDataUrl(href);
        imageNode.setAttribute('href', dataUrl);
        imageNode.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
      } catch (err) {
        console.warn('배경 이미지 인라인 실패, 제거합니다:', href, err);
        imageNode.remove();
      }
    })
  );
}

/**
 * SVG를 다운로드용으로 준비한다:
 * 1. 폰트 CSS를 data URL로 인라인
 * 2. <image> 태그의 외부 URL을 data URL로 인라인
 *
 * 최종 SVG는 외부 리소스 의존이 없는 완전한 자급자족 문서가 된다.
 */
async function prepareSvgForExport(svgElement) {
  const clonedSvg = svgElement.cloneNode(true);

  // 폰트 CSS 인라인 (Blob 컨텍스트에서 외부 URL 차단 우회)
  await inlineFontsIntoSvg(clonedSvg);

  // 배경 이미지 인라인 (blob:/http:/https: → data URL)
  await inlineImagesIntoSvg(clonedSvg);

  return clonedSvg;
}

function svgToImage(svgMarkup) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('시간표 이미지를 렌더링하지 못했습니다.'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG 파일을 생성하지 못했습니다.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}

/**
 * @param {SVGSVGElement} svgElement
 * @param {string} fileName
 * @param {{ backgroundUrl?: string, bgOpacity?: number, colorTheme?: string }} options
 */
export async function exportTimetablePng(svgElement, fileName, options = {}) {
  if (!svgElement) {
    throw new Error('다운로드할 시간표를 찾지 못했습니다.');
  }

  const { colorTheme = 'light' } = options;
  const theme = applyTheme(colorTheme === 'dark');

  // 1) 폰트 로드 대기
  await ensureTimetableFontReady();

  // 2) SVG 준비: 폰트 인라인 + 배경 이미지 data URL 인라인
  //    미리보기와 동일한 SVG 구조를 그대로 사용하므로 결과가 항상 일치한다.
  const preparedSvg = await prepareSvgForExport(svgElement);

  const viewBox = svgElement.viewBox.baseVal;
  const width = Math.round(viewBox?.width || Number(svgElement.getAttribute('width')) || 1080);
  const height = Math.round(viewBox?.height || Number(svgElement.getAttribute('height')) || 2280);

  preparedSvg.setAttribute('width', String(width));
  preparedSvg.setAttribute('height', String(height));

  const serialized = new XMLSerializer().serializeToString(preparedSvg);
  const svgMarkup = ensureSvgNamespaces(serialized);

  // 3) Canvas 준비
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('PNG 변환용 캔버스를 준비하지 못했습니다.');
  }

  // 4) 기본 배경색 (SVG가 투명 영역을 가질 경우 대비)
  context.fillStyle = theme.slideBg;
  context.fillRect(0, 0, width, height);

  // 5) SVG 합성 (배경 이미지가 SVG 내에 data URL로 인라인되어 있음)
  const svgImage = await svgToImage(svgMarkup);
  context.drawImage(svgImage, 0, 0, width, height);

  // 6) PNG 다운로드
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, fileName);
}
