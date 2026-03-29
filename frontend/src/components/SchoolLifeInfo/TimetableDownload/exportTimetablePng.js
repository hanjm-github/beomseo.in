import { ensureTimetableFontReady } from './timetableUtils';

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
    reader.onerror = () => reject(new Error('이미지 데이터를 읽지 못했습니다.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function inlineSvgImages(svgElement) {
  const clonedSvg = svgElement.cloneNode(true);
  const imageNodes = clonedSvg.querySelectorAll('image');

  await Promise.all(
    Array.from(imageNodes).map(async (imageNode) => {
      const href =
        imageNode.getAttribute('href') ||
        imageNode.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

      if (!href || href.startsWith('data:')) return;

      const response = await fetch(new URL(href, window.location.href));
      if (!response.ok) {
        throw new Error('시간표 로고 이미지를 불러오지 못했습니다.');
      }
      const dataUrl = await blobToDataUrl(await response.blob());
      imageNode.setAttribute('href', dataUrl);
      imageNode.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
    })
  );

  return clonedSvg;
}

function svgToImage(svgMarkup) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('시간표 이미지를 렌더링하지 못했습니다.'));
    };
    image.src = objectUrl;
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

export async function exportTimetablePng(svgElement, fileName) {
  if (!svgElement) {
    throw new Error('다운로드할 시간표를 찾지 못했습니다.');
  }

  await ensureTimetableFontReady();
  const inlinedSvg = await inlineSvgImages(svgElement);
  const viewBox = svgElement.viewBox.baseVal;
  const width = Math.round(viewBox?.width || Number(svgElement.getAttribute('width')) || 1080);
  const height = Math.round(viewBox?.height || Number(svgElement.getAttribute('height')) || 2280);

  inlinedSvg.setAttribute('width', String(width));
  inlinedSvg.setAttribute('height', String(height));

  const serialized = new XMLSerializer().serializeToString(inlinedSvg);
  const svgMarkup = ensureSvgNamespaces(serialized);
  const image = await svgToImage(svgMarkup);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('PNG 변환용 캔버스를 준비하지 못했습니다.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, fileName);
}
