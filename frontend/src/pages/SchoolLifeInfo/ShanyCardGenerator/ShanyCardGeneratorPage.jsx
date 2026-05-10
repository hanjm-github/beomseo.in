/**
 * @file ShanyCardGeneratorPage.jsx
 * @description Frontend-only Shany Colors style card-name generator.
 * It exposes the README preview/export options from react-shany-card-generator
 * and downloads generated images in the browser without backend work.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  Settings2,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react';
import {
  downloadBlob,
  ensureShanyCardFontElements,
  renderCardNameBlob,
  renderShanyCardBlob,
  ShanyCardNameLayer,
  ShanyCardPreview,
} from 'react-shany-card-generator';

import SEO from '../../../components/SEO';
import '../../page-shell.css';
import styles from './ShanyCardGeneratorPage.module.css';

const DEFAULT_STATE = {
  mode: 'name-only',
  rarity: 'ssr',
  idolName: 'Generator Tool',
  cardName: 'Shinycolors Card Name',
  cardImage: null,
  namePosition: {
    x: 0,
    y: 0,
    scale: 1,
  },
  format: 'png',
  scale: 1,
  captureScale: 4,
  backgroundColor: '#ffffff',
};

const FIXED_EXPORT_QUALITY = 1;
const MAX_SCALE_PERCENT = 500;
const MIN_RENDER_SCALE = 0.01;

const RARITY_OPTIONS = [
  { value: 'n', label: 'N' },
  { value: 'r', label: 'R' },
  { value: 'sr', label: 'SR' },
  { value: 'ssr', label: 'SSR' },
  { value: 'ur', label: 'UR' },
];

const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
];

const PRESETS = [
  {
    key: 'ssr-clean',
    label: 'SSR 기본',
    state: {
      rarity: 'ssr',
      idolName: 'Generator Tool',
      cardName: 'Shinycolors Card Name',
      namePosition: { x: 0, y: 0, scale: 1 },
      format: 'png',
      scale: 1,
      captureScale: 4,
      backgroundColor: '#ffffff',
    },
  },
  {
    key: 'ur-large',
    label: 'UR 선명',
    state: {
      rarity: 'ur',
      idolName: 'Beomseo Lab',
      cardName: 'After School Creative',
      namePosition: { x: 20, y: 420, scale: 1.2 },
      format: 'webp',
      scale: 1.5,
      captureScale: 5,
      backgroundColor: '#ffffff',
    },
  },
  {
    key: 'r-classic',
    label: 'R 클래식',
    state: {
      rarity: 'r',
      idolName: 'School Life',
      cardName: 'Everyday Memory',
      namePosition: { x: 12, y: 320, scale: 1 },
      format: 'jpg',
      scale: 1,
      captureScale: 3,
      backgroundColor: '#f8f4ed',
    },
  },
];

const modeLabel = {
  'name-only': '이름 레이어',
  composite: '카드 합성',
};

const sanitizeFileStem = (value) =>
  String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildFilename(cardName, format) {
  const stem = sanitizeFileStem(cardName) || 'shany-card';
  return `${stem}.${format}`;
}

function scaleToPercent(value, fallback = 1) {
  return Math.round(clampNumber(toNumber(value, fallback), 0, MAX_SCALE_PERCENT / 100) * 100);
}

function percentToScale(value, fallback = 100) {
  return clampNumber(toNumber(value, fallback), 0, MAX_SCALE_PERCENT) / 100;
}

function normalizeRenderScale(value, fallback = 1) {
  const normalized = clampNumber(toNumber(value, fallback), 0, MAX_SCALE_PERCENT / 100);
  // The renderer cannot export a zero-sized image, even though the UI slider starts at 0%.
  return normalized <= 0 ? MIN_RENDER_SCALE : normalized;
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function formatPixels(value) {
  return `${Math.round(value)}px`;
}

function Field({ label, htmlFor, icon, children, hint }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {icon}
        <span>{label}</span>
      </label>
      {children}
      {hint ? <p className={styles.fieldHint}>{hint}</p> : null}
    </div>
  );
}

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <fieldset className={styles.segmentGroup}>
      <legend>{label}</legend>
      <div className={styles.segmentTrack}>
        {options.map((option) => (
          <label key={option.value} className={styles.segmentOption}>
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RangeField({
  label,
  htmlFor,
  min,
  max,
  step = 1,
  value,
  onChange,
  output,
  disabled = false,
  hint,
}) {
  return (
    <Field label={label} htmlFor={htmlFor} hint={hint}>
      <div className={styles.sliderRow}>
        <input
          id={htmlFor}
          className={styles.rangeInput}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
        />
        <output className={styles.rangeValue} htmlFor={htmlFor}>
          {output ?? value}
        </output>
      </div>
    </Field>
  );
}

export default function ShanyCardGeneratorPage() {
  const [mode, setMode] = useState(DEFAULT_STATE.mode);
  const [rarity, setRarity] = useState(DEFAULT_STATE.rarity);
  const [idolName, setIdolName] = useState(DEFAULT_STATE.idolName);
  const [cardName, setCardName] = useState(DEFAULT_STATE.cardName);
  const [cardImage, setCardImage] = useState(DEFAULT_STATE.cardImage);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [imageDimensions, setImageDimensions] = useState(null);
  const [namePosition, setNamePosition] = useState(DEFAULT_STATE.namePosition);
  const [format, setFormat] = useState(DEFAULT_STATE.format);
  const [scale, setScale] = useState(DEFAULT_STATE.scale);
  const [captureScale, setCaptureScale] = useState(DEFAULT_STATE.captureScale);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_STATE.backgroundColor);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Inject the library font faces once so preview and exported images use the same typography.
    ensureShanyCardFontElements();
  }, []);

  useEffect(() => {
    if (!cardImage) {
      setImageDimensions(null);
      return undefined;
    }

    let isActive = true;
    // File inputs provide blobs, so measure dimensions through a temporary object URL.
    const objectUrl = URL.createObjectURL(cardImage);
    const image = new Image();

    image.onload = () => {
      if (!isActive) return;
      setImageDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      if (!isActive) return;
      setImageDimensions(null);
      setErrorMessage('업로드한 이미지 크기를 읽을 수 없습니다. 다른 이미지 파일을 선택해 주세요.');
    };
    image.src = objectUrl;

    return () => {
      isActive = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [cardImage]);

  useEffect(() => {
    if (!imageDimensions) return;

    setNamePosition((current) => ({
      ...current,
      x: clampNumber(toNumber(current.x, 0), 0, imageDimensions.width),
      y: clampNumber(toNumber(current.y, 0), 0, imageDimensions.height),
      scale: clampNumber(toNumber(current.scale, 1), 0, MAX_SCALE_PERCENT / 100),
    }));
  }, [imageDimensions]);

  const previewImage = cardImage;
  const hasCompositeImage = mode === 'composite' && Boolean(previewImage);
  const imageWidth = imageDimensions?.width ?? 0;
  const imageHeight = imageDimensions?.height ?? 0;
  const normalizedScale = normalizeRenderScale(scale, DEFAULT_STATE.scale);
  const normalizedCaptureScale = normalizeRenderScale(captureScale, DEFAULT_STATE.captureScale);
  const scalePercent = scaleToPercent(scale, DEFAULT_STATE.scale);
  const captureScalePercent = scaleToPercent(captureScale, DEFAULT_STATE.captureScale);
  const nameScalePercent = scaleToPercent(namePosition.scale ?? 1);
  const clampedNamePosition = useMemo(
    // Keep preview controls and export payload inside the uploaded image bounds.
    () => ({
      x: clampNumber(toNumber(namePosition.x, 0), 0, imageWidth),
      y: clampNumber(toNumber(namePosition.y, 0), 0, imageHeight),
      scale: clampNumber(toNumber(namePosition.scale, 1), 0, MAX_SCALE_PERCENT / 100),
    }),
    [imageHeight, imageWidth, namePosition]
  );
  const resolvedFilename = useMemo(
    () => buildFilename(cardName, format),
    [cardName, format]
  );
  const exportNamePosition = useMemo(
    () => ({
      ...clampedNamePosition,
      scale: normalizeRenderScale(clampedNamePosition.scale),
    }),
    [clampedNamePosition]
  );

  const exportOptions = useMemo(() => {
    return {
      format,
      quality: FIXED_EXPORT_QUALITY,
      scale: normalizedScale,
      captureScale: normalizedCaptureScale,
      backgroundColor,
    };
  }, [backgroundColor, format, normalizedCaptureScale, normalizedScale]);

  const previewProps = {
    mode,
    rarity,
    idolName: idolName || DEFAULT_STATE.idolName,
    cardName: cardName || DEFAULT_STATE.cardName,
    cardImage: previewImage,
    namePosition: clampedNamePosition,
    className: styles.shanyPreview,
  };

  const updateNamePosition = useCallback((key, value) => {
    setNamePosition((current) => ({
      ...current,
      [key]:
        key === 'scale'
          ? percentToScale(value, scaleToPercent(current.scale ?? 1))
          : clampNumber(
            Math.round(toNumber(value, current[key] ?? 0)),
            0,
            key === 'x' ? imageWidth : imageHeight
          ),
    }));
  }, [imageHeight, imageWidth]);

  const handleImageUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCardImage(file);
    setUploadedFileName(file.name);
    setImageDimensions(null);
    setErrorMessage('');
  }, []);

  const applyPreset = useCallback((preset) => {
    setRarity(preset.state.rarity);
    setIdolName(preset.state.idolName);
    setCardName(preset.state.cardName);
    setNamePosition(preset.state.namePosition);
    setFormat(preset.state.format);
    setScale(preset.state.scale);
    setCaptureScale(preset.state.captureScale);
    setBackgroundColor(preset.state.backgroundColor);
  }, []);

  const resetOptions = useCallback(() => {
    setMode(DEFAULT_STATE.mode);
    setRarity(DEFAULT_STATE.rarity);
    setIdolName(DEFAULT_STATE.idolName);
    setCardName(DEFAULT_STATE.cardName);
    setCardImage(DEFAULT_STATE.cardImage);
    setUploadedFileName('');
    setImageDimensions(null);
    setNamePosition(DEFAULT_STATE.namePosition);
    setFormat(DEFAULT_STATE.format);
    setScale(DEFAULT_STATE.scale);
    setCaptureScale(DEFAULT_STATE.captureScale);
    setBackgroundColor(DEFAULT_STATE.backgroundColor);
    setStatusMessage('');
    setErrorMessage('');
  }, []);

  const handleDownload = useCallback(async () => {
    setStatusMessage('');
    setErrorMessage('');

    if (mode === 'composite' && !previewImage) {
      setErrorMessage('카드 합성 모드에서는 업로드한 카드 이미지가 필요합니다.');
      return;
    }

    setIsDownloading(true);
    try {
      // Name-only export skips the uploaded-card pipeline; composite export passes the image blob through.
      const result =
        mode === 'composite'
          ? await renderShanyCardBlob(
            {
              rarity,
              idolName: idolName || DEFAULT_STATE.idolName,
              cardName: cardName || DEFAULT_STATE.cardName,
              cardImage: previewImage,
            },
            {
              ...exportOptions,
              namePosition: exportNamePosition,
            }
          )
          : await renderCardNameBlob(
            {
              rarity,
              idolName: idolName || DEFAULT_STATE.idolName,
              cardName: cardName || DEFAULT_STATE.cardName,
            },
            exportOptions
          );

      downloadBlob(result.blob, resolvedFilename);
      setStatusMessage(`${result.width}x${result.height}px ${format.toUpperCase()} 파일을 브라우저에서 저장했습니다.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '이미지 생성 중 오류가 발생했습니다. 업로드한 이미지 파일을 확인해 주세요.'
      );
    } finally {
      setIsDownloading(false);
    }
  }, [
    cardName,
    exportOptions,
    exportNamePosition,
    format,
    idolName,
    mode,
    previewImage,
    rarity,
    resolvedFilename,
  ]);

  return (
    <div className="page-shell">
      <SEO
        path="/school-info/shany-card-generator"
        title="샤니마스 카드 생성기"
        description="샤니마스 스타일 카드 이름 레이어와 합성 이미지를 브라우저에서 만들고 PNG, JPG, WebP로 바로 다운로드하세요."
      />

      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>샤니마스 카드 생성기</h1>
          <p className="lede">
            이름 레이어부터 카드 이미지 합성까지, 모든 렌더링과 다운로드가 현재 브라우저에서 끝납니다.
          </p>
        </div>
        <div className={styles.heroPlate} aria-hidden="true">
          <span className={styles.heroRarity}>SSR</span>
          <span className={styles.heroPlateLine}>Shinycolors</span>
          <span className={styles.heroPlateText}>Card Name Lab</span>
        </div>
      </div>

      <div className={styles.presetBar} aria-label="빠른 프리셋">
        <span className={styles.presetLabel}>
          <Sparkles size={16} />
          프리셋
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={styles.presetButton}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" className={styles.resetButton} onClick={resetOptions}>
          <RotateCcw size={16} />
          초기화
        </button>
      </div>

      <div className={styles.workspace}>
        <div className={styles.controlsPanel}>
          <section className={styles.controlSection} aria-labelledby="shany-basic-options">
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}>
                <Type size={18} />
              </div>
              <div>
                <h2 id="shany-basic-options">기본 옵션</h2>
              </div>
            </div>

            <SegmentedControl
              label="생성 모드"
              options={[
                { value: 'name-only', label: 'Name only' },
                { value: 'composite', label: 'Composite' },
              ]}
              value={mode}
              onChange={setMode}
            />

            <SegmentedControl
              label="레어리티"
              options={RARITY_OPTIONS}
              value={rarity}
              onChange={setRarity}
            />

            <div className={styles.fieldGrid}>
              <Field label="아이돌 이름" htmlFor="idol-name">
                <input
                  id="idol-name"
                  className={styles.textInput}
                  value={idolName}
                  onChange={(event) => setIdolName(event.target.value)}
                  placeholder="Generator Tool"
                />
              </Field>
              <Field label="카드 이름" htmlFor="card-name">
                <input
                  id="card-name"
                  className={styles.textInput}
                  value={cardName}
                  onChange={(event) => setCardName(event.target.value)}
                  placeholder="Shinycolors Card Name"
                />
              </Field>
            </div>
          </section>

          <section className={styles.controlSection} aria-labelledby="shany-image-options">
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}>
                <ImageIcon size={18} />
              </div>
              <div>
                <h2 id="shany-image-options">카드 이미지</h2>
              </div>
            </div>

            <div className={styles.uploadBox}>
              <label className={styles.uploadLabel}>
                <Upload size={18} />
                <span>이미지 선택</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>
              <span className={styles.fileName}>{uploadedFileName || '선택된 파일 없음'}</span>
            </div>
          </section>

          {mode === 'composite' ? (
            <section className={styles.controlSection} aria-labelledby="shany-position-options">
              <div className={styles.sectionHeading}>
                <div className={styles.sectionIcon}>
                  <Layers size={18} />
                </div>
                <div>
                  <h2 id="shany-position-options">합성 위치</h2>
                </div>
              </div>

              <div className={styles.fieldGridThree}>
                <RangeField
                  label="X"
                  htmlFor="name-x"
                  min="0"
                  max={imageWidth}
                  value={clampedNamePosition.x}
                  onChange={(value) => updateNamePosition('x', value)}
                  output={formatPixels(clampedNamePosition.x)}
                  disabled={!imageDimensions}
                  hint={imageDimensions ? `0px부터 ${imageWidth}px까지` : '이미지를 업로드하면 범위가 설정됩니다.'}
                />
                <RangeField
                  label="Y"
                  htmlFor="name-y"
                  min="0"
                  max={imageHeight}
                  value={clampedNamePosition.y}
                  onChange={(value) => updateNamePosition('y', value)}
                  output={formatPixels(clampedNamePosition.y)}
                  disabled={!imageDimensions}
                  hint={imageDimensions ? `0px부터 ${imageHeight}px까지` : '이미지를 업로드하면 범위가 설정됩니다.'}
                />
                <RangeField
                  label="이름 배율"
                  htmlFor="name-scale"
                  min="0"
                  max={MAX_SCALE_PERCENT}
                  value={nameScalePercent}
                  onChange={(value) => updateNamePosition('scale', value)}
                  output={formatPercent(nameScalePercent)}
                />
              </div>
            </section>
          ) : null}

          <section className={styles.controlSection} aria-labelledby="shany-export-options">
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}>
                <Settings2 size={18} />
              </div>
              <div>
                <h2 id="shany-export-options">내보내기 옵션</h2>
              </div>
            </div>

            <SegmentedControl
              label="파일 형식"
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
            />

            <div className={styles.fieldGridThree}>
              <RangeField
                label="출력 배율"
                htmlFor="output-scale"
                min="0"
                max={MAX_SCALE_PERCENT}
                value={scalePercent}
                onChange={(value) => setScale(percentToScale(value, scalePercent))}
                output={formatPercent(scalePercent)}
              />
              <RangeField
                label="캡처 배율"
                htmlFor="capture-scale"
                min="0"
                max={MAX_SCALE_PERCENT}
                value={captureScalePercent}
                onChange={(value) => setCaptureScale(percentToScale(value, captureScalePercent))}
                output={formatPercent(captureScalePercent)}
              />
              <Field label="배경색" htmlFor="background-color">
                <div className={styles.colorRow}>
                  <input
                    id="background-color"
                    className={styles.colorInput}
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    aria-label="배경색 선택"
                  />
                  <input
                    className={styles.colorHex}
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    aria-label="배경색 HEX"
                  />
                </div>
              </Field>
            </div>
          </section>
        </div>

        <aside className={styles.previewPanel} aria-label="샤니마스 카드 미리보기와 다운로드">
          <div className={styles.previewHeader}>
            <div>
              <span className={styles.previewMode}>{modeLabel[mode]}</span>
              <h2>Live Preview</h2>
            </div>
            <span className={styles.rarityBadge}>{rarity.toUpperCase()}</span>
          </div>

          <div className={styles.previewStage}>
            {mode === 'name-only' ? (
              <ShanyCardNameLayer
                rarity={rarity}
                idolName={idolName || DEFAULT_STATE.idolName}
                cardName={cardName || DEFAULT_STATE.cardName}
                className={styles.shanyPreview}
              />
            ) : (
              <ShanyCardPreview {...previewProps} />
            )}
          </div>

          <button
            type="button"
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={isDownloading || (mode === 'composite' && !hasCompositeImage)}
          >
            <Download size={18} />
            {isDownloading ? '생성 중...' : `${format.toUpperCase()} 다운로드`}
          </button>

          {mode === 'composite' && !hasCompositeImage ? (
            <p className={styles.notice}>합성 다운로드는 카드 이미지를 선택하면 활성화됩니다.</p>
          ) : null}
          {statusMessage ? <p className={styles.successMessage}>{statusMessage}</p> : null}
          {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        </aside>
      </div>
    </div>
  );
}
