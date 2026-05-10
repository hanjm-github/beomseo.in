/**
 * @file QrCodeGeneratorPage.jsx
 * @description Frontend-only QR Code generator using react-qrcode-logo.
 * All props from the library are exposed as configurable options.
 * Download is handled entirely on the client via the component ref's download method.
 */
import { useCallback, useRef, useState } from 'react';
import { QRCode } from 'react-qrcode-logo';
import {
  ChevronDown,
  Download,
  Eye,
  Image as ImageIcon,
  Palette,
  Settings2,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react';
import SEO from '../../../components/SEO';
import '../../page-shell.css';
import styles from './QrCodeGeneratorPage.module.css';

/* Constants */
/** Maps user-facing 1–4 levels to the library's L/M/Q/H values. */
const EC_LEVEL_MAP = { 1: 'L', 2: 'M', 3: 'Q', 4: 'H' };
const EC_LEVEL_OPTIONS = [1, 2, 3, 4];

const DEFAULTS = {
  value: 'https://beomseo.in',
  ecLevel: 2,
  size: 600,
  quietZone: 20,
  bgColor: '#FFFFFF',
  fgColor: '#000000',
  logoImage: '',
  logoWidth: 120,
  logoHeight: 120,
  logoOpacity: 1,
  logoPadding: 6,
  logoPaddingStyle: 'square',
  removeQrCodeBehindLogo: true,
  qrStyle: 'squares',
  eyeRadius: 0,
  eyeColor: '',
  id: 'qr-code-gen',
};

const MIT_LOGO_PATH = '/mit_logo.png';

const QR_STYLES = ['squares', 'dots', 'fluid'];
const LOGO_PADDING_STYLES = ['square', 'circle'];
const FILE_TYPES = ['png', 'jpg', 'webp'];

/* Quick presets */
const PRESETS = [
  {
    name: '기본',
    config: { fgColor: '#000000', bgColor: '#FFFFFF', qrStyle: 'squares', eyeRadius: 0, ecLevel: 2 },
  },
  {
    name: '범서인 그린',
    config: { fgColor: '#1B4D3E', bgColor: '#E8F5EE', qrStyle: 'dots', eyeRadius: 8, ecLevel: 4 },
  },
  {
    name: '모던 다크',
    config: { fgColor: '#F0F6FC', bgColor: '#0D1117', qrStyle: 'dots', eyeRadius: 12, ecLevel: 4 },
  },
  {
    name: '소프트 라운드',
    config: { fgColor: '#4A4A68', bgColor: '#FAFAFA', qrStyle: 'fluid', eyeRadius: 16, ecLevel: 3 },
  },
  {
    name: '악센트 핑크',
    config: { fgColor: '#8B2252', bgColor: '#FCE4EC', qrStyle: 'dots', eyeRadius: 10, ecLevel: 4 },
  },
];

/* Collapsible Section */
function CollapsibleSection({ title, icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
        className={styles.collapsibleHeader}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        type="button"
      >
        <span className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>{icon}</span>
          {title}
        </span>
        <ChevronDown
          size={18}
          className={`${styles.collapsibleArrow} ${isOpen ? styles.collapsibleArrowOpen : ''}`}
        />
      </button>
      {isOpen && <div className={styles.collapsibleBody}>{children}</div>}
    </div>
  );
}

/* Main Page */
export default function QrCodeGeneratorPage() {
  const qrRef = useRef(null);

  // Core
  const [value, setValue] = useState(DEFAULTS.value);
  const [ecLevel, setEcLevel] = useState(DEFAULTS.ecLevel);
  const [size, setSize] = useState(DEFAULTS.size);
  const [quietZone, setQuietZone] = useState(DEFAULTS.quietZone);

  // Colors
  const [bgColor, setBgColor] = useState(DEFAULTS.bgColor);
  const [fgColor, setFgColor] = useState(DEFAULTS.fgColor);

  // Logo
  const [logoSource, setLogoSource] = useState('none'); // 'none' | 'default' | 'custom'
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState('');
  const [logoWidth, setLogoWidth] = useState(DEFAULTS.logoWidth);
  const [logoHeight, setLogoHeight] = useState(DEFAULTS.logoHeight);
  const [logoOpacity, setLogoOpacity] = useState(DEFAULTS.logoOpacity);
  const [logoPadding, setLogoPadding] = useState(DEFAULTS.logoPadding);
  const [logoPaddingStyle, setLogoPaddingStyle] = useState(DEFAULTS.logoPaddingStyle);
  const [removeQrCodeBehindLogo, setRemoveQrCodeBehindLogo] = useState(DEFAULTS.removeQrCodeBehindLogo);

  // Style
  const [qrStyle, setQrStyle] = useState(DEFAULTS.qrStyle);
  const [eyeRadius, setEyeRadius] = useState(DEFAULTS.eyeRadius);
  const [eyeColor, setEyeColor] = useState(DEFAULTS.eyeColor);

  // Download state
  const [downloadFileType, setDownloadFileType] = useState('png');
  const [isDownloading, setIsDownloading] = useState(false);

  /* Derived state */
  // Resolve logo selection once so optional QR props are only set when a logo is active.
  const resolvedLogo =
    logoSource === 'default'
      ? MIT_LOGO_PATH
      : logoSource === 'custom'
        ? customLogoDataUrl
        : '';

  const hasLogo = resolvedLogo !== '';

  // A centered logo covers QR modules, so force the strongest correction level while it is present.
  const effectiveEcLevel = hasLogo ? 4 : ecLevel;
  const safeSize = Number.isFinite(size) ? size : DEFAULTS.size;
  const safeQuietZone = Number.isFinite(quietZone) ? quietZone : DEFAULTS.quietZone;
  const previewQrSize = Math.max(1, safeSize + safeQuietZone * 2);

  /* Handlers */
  const handleCustomLogoUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Store uploads as data URLs because the QR canvas needs an image source it can draw locally.
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomLogoDataUrl(ev.target.result);
      setLogoSource('custom');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearLogo = useCallback(() => {
    setLogoSource('none');
    setCustomLogoDataUrl('');
  }, []);

  const applyPreset = useCallback((preset) => {
    const c = preset.config;
    if (c.fgColor) setFgColor(c.fgColor);
    if (c.bgColor) setBgColor(c.bgColor);
    if (c.qrStyle) setQrStyle(c.qrStyle);
    if (c.eyeRadius !== undefined) setEyeRadius(c.eyeRadius);
    if (c.ecLevel) setEcLevel(c.ecLevel);
  }, []);

  const handleDownload = useCallback(async (fileType) => {
    if (!qrRef.current) return;
    setIsDownloading(true);
    try {
      const fileName = `qr-code-${Date.now()}`;
      qrRef.current.download(fileType, fileName);
    } catch {
      // Prefer the library API, then fall back to the underlying canvas for browser edge cases.
      try {
        const canvas = qrRef.current?.canvasRef?.current;
        if (canvas) {
          const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
          const dataUrl = canvas.toDataURL(mimeMap[fileType] || 'image/png');
          const link = document.createElement('a');
          link.download = `qr-code-${Date.now()}.${fileType}`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch {
        // Keep the UI stable if both download strategies are unavailable.
      }
    } finally {
      setIsDownloading(false);
    }
  }, []);

  /* Build QRCode props */
  // Omit inactive optional props so react-qrcode-logo can keep its own defaults intact.
  const qrProps = {
    value: value || 'https://beomseo.in',
    ecLevel: EC_LEVEL_MAP[effectiveEcLevel],
    size: safeSize,
    quietZone: safeQuietZone,
    bgColor,
    fgColor,
    qrStyle,
    id: DEFAULTS.id,
    style: {
      width: '100%',
      height: 'auto',
      aspectRatio: '1 / 1',
    },
  };

  if (hasLogo) {
    qrProps.logoImage = resolvedLogo;
    qrProps.logoWidth = logoWidth;
    qrProps.logoHeight = logoHeight;
    qrProps.logoOpacity = logoOpacity;
    qrProps.logoPadding = logoPadding;
    qrProps.logoPaddingStyle = logoPaddingStyle;
    qrProps.removeQrCodeBehindLogo = removeQrCodeBehindLogo;
  }

  if (eyeRadius > 0) {
    // The library accepts per-corner radii for each finder eye; this rounds only the outer corners.
    qrProps.eyeRadius = [
      [eyeRadius, eyeRadius, 0, eyeRadius],
      [eyeRadius, eyeRadius, eyeRadius, 0],
      [0, eyeRadius, eyeRadius, eyeRadius],
    ];
  }

  if (eyeColor) {
    qrProps.eyeColor = eyeColor;
  }

  return (
    <div className="page-shell">
      <SEO
        path="/school-info/qr-generator"
        title="QR 코드 생성기"
        description="텍스트, URL, 와이파이 등 원하는 내용으로 로고가 들어간 커스텀 QR 코드를 만들고 바로 다운로드하세요."
      />

      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>QR 코드 생성기</h1>
          <p className="lede">
            텍스트나 URL을 입력하고, 색상·스타일·로고를 자유롭게 설정한 뒤 PNG/JPG/WebP로 바로 다운로드하세요.
            백엔드 없이 브라우저에서 모든 작업이 완료됩니다.
          </p>
        </div>
      </div>

      {/* Quick Presets */}
      <div className={styles.presetRow}>
        <span className={styles.fieldLabel}>
          <Sparkles size={14} />
          빠른 프리셋
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className={styles.presetChip}
            onClick={() => applyPreset(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        {/* Controls column */}
        <div className={styles.controlsPanel}>

          {/* Section 1: Content */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionIcon}><Type size={16} /></span>
              콘텐츠
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="qr-value" className={styles.fieldLabel}>QR 코드 내용</label>
              <textarea
                id="qr-value"
                className={styles.textAreaInput}
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="URL, 텍스트, 와이파이 설정 등 자유롭게 입력"
              />
              <span className={styles.fieldHint}>URL, 텍스트, vCard, Wi-Fi 등 어떤 문자열이든 입력할 수 있습니다.</span>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="qr-ec" className={styles.fieldLabel}>오류 보정 단계</label>
                <div className={styles.radioGroup}>
                  {EC_LEVEL_OPTIONS.map((level) => (
                    <label key={level} className={styles.radioOption}>
                      <input
                        type="radio"
                        name="ecLevel"
                        value={level}
                        checked={effectiveEcLevel === level}
                        onChange={() => setEcLevel(level)}
                        disabled={hasLogo}
                      />
                      <span className={styles.radioLabel}>{level}</span>
                    </label>
                  ))}
                </div>
                <span className={styles.fieldHint}>
                  {hasLogo ? '로고 삽입 시 자동으로 4단계가 적용됩니다' : '숫자가 높을수록 오류 보정이 강력합니다'}
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qr-style" className={styles.fieldLabel}>패턴 스타일</label>
                <div className={styles.radioGroup}>
                  {QR_STYLES.map((s) => (
                    <label key={s} className={styles.radioOption}>
                      <input
                        type="radio"
                        name="qrStyle"
                        value={s}
                        checked={qrStyle === s}
                        onChange={() => setQrStyle(s)}
                      />
                      <span className={styles.radioLabel}>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Size & Colors */}
          <CollapsibleSection
            title="크기 & 색상"
            icon={<Palette size={16} />}
            defaultOpen={true}
          >
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="qr-size" className={styles.fieldLabel}>크기</label>
                <input
                  id="qr-size"
                  type="number"
                  className={styles.textInput}
                  value={size}
                  min={50}
                  max={600}
                  step={10}
                  onChange={(e) => setSize(Number(e.target.value))}
                />
                <span className={styles.fieldHint}>50 ~ 600px</span>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="qr-quiet" className={styles.fieldLabel}>여백</label>
                <input
                  id="qr-quiet"
                  type="number"
                  className={styles.textInput}
                  value={quietZone}
                  min={0}
                  max={100}
                  onChange={(e) => setQuietZone(Number(e.target.value))}
                />
                <span className={styles.fieldHint}>QR 코드 주변 여백</span>
              </div>
            </div>

            <hr className={styles.divider} />

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>전경색</label>
                <div className={styles.colorRow}>
                  <div className={styles.colorSwatch}>
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      aria-label="전경색 선택"
                    />
                  </div>
                  <input
                    type="text"
                    className={styles.colorHex}
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    maxLength={9}
                    aria-label="전경색 hex 코드"
                  />
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>배경색</label>
                <div className={styles.colorRow}>
                  <div className={styles.colorSwatch}>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      aria-label="배경색 선택"
                    />
                  </div>
                  <input
                    type="text"
                    className={styles.colorHex}
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    maxLength={9}
                    aria-label="배경색 hex 코드"
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 3: Logo */}
          <CollapsibleSection
            title="로고"
            icon={<ImageIcon size={16} />}
            defaultOpen={false}
          >
            <div className={styles.logoSourcePicker}>
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="logoSource"
                    value="none"
                    checked={logoSource === 'none'}
                    onChange={() => handleClearLogo()}
                  />
                  <span className={styles.radioLabel}>없음</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="logoSource"
                    value="default"
                    checked={logoSource === 'default'}
                    onChange={() => setLogoSource('default')}
                  />
                  <span className={styles.radioLabel}>☄️ 정보기술부 로고</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="logoSource"
                    value="custom"
                    checked={logoSource === 'custom'}
                    onChange={() => setLogoSource('custom')}
                  />
                  <span className={styles.radioLabel}>직접 업로드</span>
                </label>
              </div>

              {logoSource === 'custom' && (
                <div className={styles.logoPreviewRow}>
                  <div className={styles.fileInputWrapper}>
                    <label className={styles.fileInputLabel}>
                      <Upload size={14} />
                      이미지 선택
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomLogoUpload}
                      aria-label="로고 이미지 업로드"
                    />
                  </div>
                  {customLogoDataUrl && (
                    <>
                      <img src={customLogoDataUrl} alt="업로드된 로고" className={styles.logoThumbnail} />
                      <button type="button" className={styles.clearLogoBtn} onClick={handleClearLogo}>
                        삭제
                      </button>
                    </>
                  )}
                </div>
              )}

              {logoSource === 'default' && (
                <div className={styles.logoPreviewRow}>
                  <img src={MIT_LOGO_PATH} alt="정보기술부 로고" className={styles.logoThumbnail} />
                  <span className={styles.fieldHint}>정보기술부 로고</span>
                </div>
              )}
            </div>

            {hasLogo && (
              <>
                <hr className={styles.divider} />
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="logo-width" className={styles.fieldLabel}>로고 너비</label>
                    <input
                      id="logo-width"
                      type="number"
                      className={styles.textInput}
                      value={logoWidth}
                      min={10}
                      max={300}
                      onChange={(e) => setLogoWidth(Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="logo-height" className={styles.fieldLabel}>로고 높이</label>
                    <input
                      id="logo-height"
                      type="number"
                      className={styles.textInput}
                      value={logoHeight}
                      min={10}
                      max={300}
                      onChange={(e) => setLogoHeight(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="logo-opacity" className={styles.fieldLabel}>로고 투명도</label>
                    <input
                      id="logo-opacity"
                      type="number"
                      className={styles.textInput}
                      value={logoOpacity}
                      min={0}
                      max={1}
                      step={0.1}
                      onChange={(e) => setLogoOpacity(Number(e.target.value))}
                    />
                    <span className={styles.fieldHint}>0 (투명) ~ 1 (불투명)</span>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="logo-padding" className={styles.fieldLabel}>로고 패딩</label>
                    <input
                      id="logo-padding"
                      type="number"
                      className={styles.textInput}
                      value={logoPadding}
                      min={0}
                      max={50}
                      onChange={(e) => setLogoPadding(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>패딩 스타일</label>
                    <div className={styles.radioGroup}>
                      {LOGO_PADDING_STYLES.map((s) => (
                        <label key={s} className={styles.radioOption}>
                          <input
                            type="radio"
                            name="logoPaddingStyle"
                            value={s}
                            checked={logoPaddingStyle === s}
                            onChange={() => setLogoPaddingStyle(s)}
                          />
                          <span className={styles.radioLabel}>{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.toggleRow}>
                  <span className={styles.toggleLabel}>로고 뒤 QR 제거</span>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={removeQrCodeBehindLogo}
                      onChange={(e) => setRemoveQrCodeBehindLogo(e.target.checked)}
                    />
                    <span className={styles.toggleTrack} />
                  </label>
                </div>
              </>
            )}
          </CollapsibleSection>

          {/* Section 4: Advanced */}
          <CollapsibleSection
            title="고급 설정"
            icon={<Settings2 size={16} />}
            defaultOpen={false}
          >
            <div className={styles.fieldGroup}>
              <label htmlFor="eye-radius" className={styles.fieldLabel}>
                <Eye size={14} />
                눈 둥글기
              </label>
              <input
                id="eye-radius"
                type="number"
                className={styles.textInput}
                value={eyeRadius}
                min={0}
                max={50}
                onChange={(e) => setEyeRadius(Number(e.target.value))}
              />
              <span className={styles.fieldHint}>QR 코드 모서리 눈의 둥근 정도</span>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>눈 색상</label>
              <div className={styles.colorRow}>
                <div className={styles.colorSwatch}>
                  <input
                    type="color"
                    value={eyeColor || fgColor}
                    onChange={(e) => setEyeColor(e.target.value)}
                    aria-label="눈 색상 선택"
                  />
                </div>
                <input
                  type="text"
                  className={styles.colorHex}
                  value={eyeColor}
                  onChange={(e) => setEyeColor(e.target.value)}
                  placeholder="비우면 전경색 사용"
                  maxLength={9}
                  aria-label="눈 색상 hex 코드"
                />
              </div>
              <span className={styles.fieldHint}>비워두면 전경색이 자동 적용됩니다.</span>
            </div>
          </CollapsibleSection>
        </div>

        {/* Preview and download column */}
        <div className={styles.previewPanel}>
          <div className={styles.previewCard}>
            <span className={styles.previewLabel}>미리보기</span>

            <div
              className={styles.qrWrapper}
              style={{ '--qr-preview-size': `${previewQrSize}px` }}
            >
              <QRCode ref={qrRef} {...qrProps} />
            </div>

            <div className={styles.downloadActions}>
              {FILE_TYPES.map((ft) => (
                <button
                  key={ft}
                  type="button"
                  className={ft === downloadFileType ? styles.downloadBtn : styles.downloadBtnSecondary}
                  disabled={isDownloading}
                  onClick={() => {
                    setDownloadFileType(ft);
                    handleDownload(ft);
                  }}
                >
                  <Download size={16} />
                  {ft.toUpperCase()} 다운로드
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
