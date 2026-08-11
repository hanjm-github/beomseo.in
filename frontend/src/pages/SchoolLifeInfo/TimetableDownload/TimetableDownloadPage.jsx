import { useEffect, useRef, useState } from 'react';
import { GraduationCap, Layers3 } from 'lucide-react';
import SEO from '../../../components/SEO';
import TimetableControls from '../../../components/SchoolLifeInfo/TimetableDownload/TimetableControls';
import TimetablePreview from '../../../components/SchoolLifeInfo/TimetableDownload/TimetablePreview';
import { exportTimetablePng } from '../../../components/SchoolLifeInfo/TimetableDownload/exportTimetablePng';
import {
  createDraftForGrade,
  ensureTimetableFontReady,
  getClassOptions,
  getDownloadFileName,
  getRequiredTokens,
  getTemplateBySelection,
  mountTimetableFontStylesheet,
  normalizeDraftValue,
  validateDraft,
  getRoomCandidates,
} from '../../../components/SchoolLifeInfo/TimetableDownload/timetableUtils';
import '../../page-shell.css';
import styles from './TimetableDownloadPage.module.css';

const sessionCache = {
  selectedGrade: '',
  selectedClass: '',
  drafts: {},
};

export default function TimetableDownloadPage() {
  const [selectedGrade, setSelectedGrade] = useState(sessionCache.selectedGrade);
  const [selectedClass, setSelectedClass] = useState(sessionCache.selectedClass);
  const [sessionDrafts, setSessionDrafts] = useState(sessionCache.drafts);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [isCatMode, setIsCatMode] = useState(false);
  const [catUrl, setCatUrl] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [bgOpacity, setBgOpacity] = useState(1);
  const [colorTheme, setColorTheme] = useState('light');
  const [fontReady, setFontReady] = useState(false);

  const svgRef = useRef(null);

  useEffect(() => {
    const cleanupFontLink = mountTimetableFontStylesheet();
    ensureTimetableFontReady().then(() => setFontReady(true));
    return cleanupFontLink;
  }, []);

  useEffect(() => {
    sessionCache.selectedGrade = selectedGrade;
    sessionCache.selectedClass = selectedClass;
  }, [selectedGrade, selectedClass]);

  const classOptions = getClassOptions(selectedGrade);

  useEffect(() => {
    if (!selectedGrade) {
      setSelectedClass('');
      return;
    }

    if (!classOptions.some((option) => option.value === selectedClass)) {
      setSelectedClass(classOptions[0]?.value ?? '');
    }
  }, [selectedGrade, selectedClass, classOptions]);

  const activeTemplate = getTemplateBySelection(selectedGrade, selectedClass);
  const activeClassId = activeTemplate?.classId ?? '';
  const requiredTokens = getRequiredTokens(selectedGrade);
  const draftValues = activeClassId
    ? createDraftForGrade(selectedGrade, sessionDrafts[activeClassId] ?? {})
    : {};
  const tokenSwatches = activeTemplate
    ? activeTemplate.cells.flat().reduce((accumulator, cell) => {
        if (!requiredTokens.includes(cell.text) || accumulator[cell.text]) return accumulator;
        accumulator[cell.text] = cell.fill;
        return accumulator;
      }, {})
    : {};

  const validation = validateDraft({
    grade: selectedGrade,
    draftValues,
    template: activeTemplate,
  });

  function handleGradeChange(event) {
    setSelectedGrade(event.target.value);
    setDownloadError('');
  }

  function handleClassChange(event) {
    setSelectedClass(event.target.value);
    setDownloadError('');
  }

  async function handleCatToggle() {
    const nextMode = !isCatMode;
    setIsCatMode(nextMode);

    if (nextMode) {
      try {
        const response = await fetch('https://cataas.com/cat');
        if (response.ok) {
          const blob = await response.blob();
          if (catUrl && catUrl.startsWith('blob:')) {
            URL.revokeObjectURL(catUrl);
          }
          setCatUrl(URL.createObjectURL(blob));
        } else {
          setCatUrl(`https://cataas.com/cat?t=${Date.now()}`);
        }
      } catch (err) {
        console.error('고양이 사진을 불러오는데 실패했습니다:', err);
        setCatUrl(`https://cataas.com/cat?t=${Date.now()}`);
      }
    }
  }

  function handleCustomImageChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (customImageUrl) URL.revokeObjectURL(customImageUrl);
      setCustomImageUrl(URL.createObjectURL(file));
    }
  }

  function handleBgOpacityChange(e) {
    const transparency = Number(e.target.value);
    setBgOpacity(1 - transparency);
  }

  const activeBackgroundUrl = isCatMode ? catUrl : customImageUrl;

  function handleDraftChange(token, field, nextValue) {
    if (!activeClassId) return;
    const normalizedValue =
      token === '음/미' && field === 'subject' ? nextValue : normalizeDraftValue(nextValue);

    setSessionDrafts((current) => {
      const currentClassDraft = current[activeClassId] ?? {};
      const currentTokenDraft = createDraftForGrade(selectedGrade, currentClassDraft)[token] ?? {
        subject: '',
        room: '',
      };

      const updatedTokenDraft = {
        ...currentTokenDraft,
        [field]: normalizedValue,
      };

      if (field === 'subject') {
        const roomCandidates = getRoomCandidates(selectedGrade, token, normalizedValue);
        if (roomCandidates) {
          if (roomCandidates.length === 1) {
            updatedTokenDraft.room = roomCandidates[0];
          } else if (
            currentTokenDraft.room &&
            !roomCandidates.includes(currentTokenDraft.room)
          ) {
            updatedTokenDraft.room = '';
          }
        }
      }

      const nextDraftForClass = {
        ...createDraftForGrade(selectedGrade, currentClassDraft),
        [token]: updatedTokenDraft,
      };
      const nextState = {
        ...current,
        [activeClassId]: nextDraftForClass,
      };
      sessionCache.drafts = nextState;
      return nextState;
    });
    setDownloadError('');
  }

  async function handleDownload() {
    if (!activeTemplate || !validation.canDownload) return;

    setIsDownloading(true);
    setDownloadError('');

    try {
      await exportTimetablePng(
        svgRef.current,
        getDownloadFileName(selectedGrade, selectedClass),
        { backgroundUrl: activeBackgroundUrl, bgOpacity, colorTheme }
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : '시간표를 저장하지 못했습니다.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="page-shell">
      <SEO path="/school-info/timetable" />
      <div className="page-header">
        <div>
          <p className="eyebrow">생활 정보</p>
          <h1>시간표 다운로드</h1>
        </div>
      </div>

      <div className={styles.workspace}>
        <TimetableControls
          selectedGrade={selectedGrade}
          selectedClass={selectedClass}
          classOptions={classOptions}
          activeTemplate={activeTemplate}
          requiredTokens={requiredTokens}
          draftValues={draftValues}
          tokenSwatches={tokenSwatches}
          validation={validation}
          isDownloading={isDownloading}
          downloadError={downloadError}
          onGradeChange={handleGradeChange}
          onClassChange={handleClassChange}
          onDraftChange={handleDraftChange}
          onDownload={handleDownload}
          isCatMode={isCatMode}
          customImageUrl={customImageUrl}
          onCustomImageChange={handleCustomImageChange}
          bgOpacity={bgOpacity}
          onBgOpacityChange={handleBgOpacityChange}
          colorTheme={colorTheme}
          onColorThemeChange={setColorTheme}
        />

        <div className="flex flex-col gap-4">
          <TimetablePreview
            ref={svgRef}
            template={activeTemplate}
            draftValues={draftValues}
            grade={selectedGrade}
            fontReady={fontReady}
            backgroundUrl={activeBackgroundUrl}
            bgOpacity={bgOpacity}
            onCatToggle={handleCatToggle}
            colorTheme={colorTheme}
            onColorThemeChange={setColorTheme}
          />
        </div>
      </div>
    </div>
  );
}
