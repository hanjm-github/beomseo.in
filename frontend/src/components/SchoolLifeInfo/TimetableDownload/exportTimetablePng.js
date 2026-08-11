import { ensureTimetableFontReady, TIMETABLE_FONT_STYLESHEET_ID, timetableMeta } from './timetableUtils';
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
  const urlRegex = /url\(['"]?(https:\/\/[^'"]+)['"]?\)/g;
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
 * SVG 내 <image> 태그를 처리하고 폰트를 인라인한다.
 *
 * 배경 합성 전략:
 * - Canvas에 배경 이미지를 먼저 그린다.
 * - SVG의 초기 흰 전체배경 <rect>를 투명하게 만들어 Canvas 배경이 보이도록 한다.
 * - 각 셀의 fill-opacity는 SVG 원본 그대로 유지 (bgOpacity를 이미 반영 중).
 * - 배경 <image> 태그(blob:/http:/https:)는 Canvas에서 처리하므로 제거.
 */
async function prepareSvgForExport(svgElement) {
  const clonedSvg = svgElement.cloneNode(true);

  // 폰트 CSS 인라인 (Blob 컨텍스트에서 외부 URL 차단 우회)
  await inlineFontsIntoSvg(clonedSvg);

  // 초기 전체배경 <rect>를 투명하게 변경
  // Canvas에서 이미 배경색 + 배경 이미지를 그리므로 SVG의 배경 rect가 가리면 안 됨
  const allRects = Array.from(clonedSvg.querySelectorAll('rect'));
  for (const rect of allRects) {
    const x = rect.getAttribute('x') ?? '0';
    const y = rect.getAttribute('y') ?? '0';
    const w = rect.getAttribute('width') ?? '';
    const h = rect.getAttribute('height') ?? '';
    // 전체를 덮는 배경 rect 판별: x=0, y=0, 크기가 viewBox와 동일
    if (
      (x === '0' || x === '') &&
      (y === '0' || y === '') &&
      String(Math.round(Number(w))) === String(Math.round(timetableMeta.viewBoxWidth)) &&
      String(Math.round(Number(h))) === String(Math.round(timetableMeta.viewBoxHeight))
    ) {
      rect.setAttribute('fill-opacity', '0');
      break; // 첫 번째 전체배경 rect만 투명화
    }
  }

  // 배경 이미지 <image> 태그 처리
  const imageNodes = Array.from(clonedSvg.querySelectorAll('image'));

  await Promise.all(
    imageNodes.map(async (imageNode) => {
      const href =
        imageNode.getAttribute('href') ||
        imageNode.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

      if (!href) return;

      // Canvas에서 직접 합성할 배경 이미지 — SVG에서 제거
      if (
        href.startsWith('blob:') ||
        href.startsWith('http://') ||
        href.startsWith('https://')
      ) {
        imageNode.remove();
        return;
      }

      // 이미 data URL이면 유지
      if (href.startsWith('data:')) return;

      // 상대/절대 경로는 fetch 후 인라인화
      try {
        const response = await fetch(new URL(href, window.location.href));
        if (!response.ok) throw new Error('이미지를 불러오지 못했습니다.');
        const dataUrl = await blobToDataUrl(await response.blob());
        imageNode.setAttribute('href', dataUrl);
        imageNode.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
      } catch {
        imageNode.remove();
      }
    })
  );

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

/**
 * 배경 이미지를 로드한다.
 * - blob URL: 직접 사용 (same-origin, canvas 오염 없음)
 * - 외부 URL: fetch → data URL 변환으로 CORS & canvas 오염 우회
 */
async function loadBackgroundImage(url) {
  let src = url;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();
      src = await blobToDataUrl(blob);
    } catch {
      // fetch 실패 시 data URL 변환 포기 — 직접 로드 시도 (canvas 오염 위험 있음)
      src = url;
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('배경 이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

/**
 * Canvas에 "xMidYMid slice" (object-fit: cover) 방식으로 이미지를 그린다.
 */
function drawBackgroundCover(context, img, canvasWidth, canvasHeight, opacity) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let sx, sy, sw, sh;

  if (imgAspect > canvasAspect) {
    sh = img.naturalHeight;
    sw = sh * canvasAspect;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / canvasAspect;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  const prevAlpha = context.globalAlpha;
  context.globalAlpha = opacity;
  context.drawImage(img, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
  context.globalAlpha = prevAlpha;
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
 * @param {{ backgroundUrl?: string, bgOpacity?: number }} options
 */
export async function exportTimetablePng(svgElement, fileName, options = {}) {
  if (!svgElement) {
    throw new Error('다운로드할 시간표를 찾지 못했습니다.');
  }

  const { backgroundUrl, bgOpacity = 1, colorTheme = 'light' } = options;
  const theme = applyTheme(colorTheme === 'dark');

  // 1) 폰트 로드 대기
  await ensureTimetableFontReady();

  // 2) SVG 준비: 폰트 인라인, 배경 이미지 제거, rect fill-opacity 복원
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

  // 4) 배경색 (테마에 따라)
  context.fillStyle = theme.slideBg;
  context.fillRect(0, 0, width, height);

  // 5) 배경 이미지를 Canvas에서 직접 합성 (xMidYMid slice)
  if (backgroundUrl) {
    try {
      const bgImg = await loadBackgroundImage(backgroundUrl);
      // 배경 이미지는 항상 100% 선명하게 합성
      drawBackgroundCover(context, bgImg, width, height, 1);
    } catch {
      // 배경 이미지 실패 시 흰 배경으로 유지
    }
  }

  // 6) 시간표 SVG를 배경 위에 합성
  const svgImage = await svgToImage(svgMarkup);
  context.drawImage(svgImage, 0, 0, width, height);

  // 7) PNG 다운로드
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, fileName);
}
