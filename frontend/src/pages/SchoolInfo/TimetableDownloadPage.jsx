import { useEffect, useRef, useState } from 'react';
import { GraduationCap, ImageDown, Layers3 } from 'lucide-react';
import TimetableControls from '../../components/timetable/TimetableControls';
import TimetablePreview from '../../components/timetable/TimetablePreview';
import { exportTimetablePng } from '../../components/timetable/exportTimetablePng';
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
} from '../../components/timetable/timetableUtils';
import '../page-shell.css';
import styles from './TimetableDownloadPage.module.css';

const sessionCache = {
  selectedGrade: '',
  selectedClass: '',
  drafts: {},
};

function cloneDraftState() {
  return JSON.parse(JSON.stringify(sessionCache.drafts));
}

export default function TimetableDownloadPage() {
  const svgRef = useRef(null);
  const [fontReady, setFontReady] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(sessionCache.selectedGrade);
  const [selectedClass, setSelectedClass] = useState(sessionCache.selectedClass);
  const [sessionDrafts, setSessionDrafts] = useState(() => cloneDraftState());
  const [downloadError, setDownloadError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const classOptions = getClassOptions(selectedGrade);
  const activeTemplate = getTemplateBySelection(selectedGrade, selectedClass);
  const requiredTokens = getRequiredTokens(selectedGrade);
  const activeClassId = activeTemplate?.classId ?? '';
  const draftValues = activeClassId
    ? createDraftForGrade(selectedGrade, sessionDrafts[activeClassId] ?? {})
    : createDraftForGrade(selectedGrade);
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

  useEffect(() => {
    let active = true;
    const cleanupFontLink = mountTimetableFontStylesheet();

    ensureTimetableFontReady()
      .then(() => {
        if (active) {
          setFontReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setFontReady(true);
        }
      });

    return () => {
      active = false;
      cleanupFontLink();
    };
  }, []);

  useEffect(() => {
    sessionCache.selectedGrade = selectedGrade;
  }, [selectedGrade]);

  useEffect(() => {
    sessionCache.selectedClass = selectedClass;
  }, [selectedClass]);

  function handleGradeChange(event) {
    const nextGrade = event.target.value;
    setSelectedGrade(nextGrade);
    setSelectedClass('');
    setDownloadError('');
  }

  function handleClassChange(event) {
    setSelectedClass(event.target.value);
    setDownloadError('');
  }

  function handleDraftChange(token, field, nextValue) {
    if (!activeClassId) return;
    const normalizedValue =
      token === '음/미' && field === 'subject' ? nextValue : normalizeDraftValue(nextValue);

    setSessionDrafts((current) => {
      const nextDraftForClass = {
        ...createDraftForGrade(selectedGrade, current[activeClassId] ?? {}),
        [token]: {
          ...createDraftForGrade(selectedGrade, current[activeClassId] ?? {})[token],
          [field]: normalizedValue,
        },
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
        getDownloadFileName(selectedGrade, selectedClass)
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : '시간표를 저장하지 못했습니다.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">생활 정보</p>
          <h1>시간표 다운로드</h1>
          <p className="lede">
            반별 시간표를 확인하고, 2·3학년은 선택과목과 교실을 입력한 뒤 PNG로 바로 저장할 수 있습니다.
          </p>
        </div>
      </div>

      <section className={styles.resourceCard} aria-label="관련 링크">
        <h2>관련 링크</h2>
        <ul className={styles.resourceList}>
          <li>
            <a
              href="https://drive.google.com/drive/folders/1_vojqWFU2f_Ztknjxw-HrewOpVVRSL78?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
            >
              2026 범서고 1학기 시간표 배경화면 다운로드
            </a>
          </li>
          <li>
            <span className={styles.resourceLabel}>원본 편집 가능 미리캔버스 템플릿</span>
            <div className={styles.resourceLinks}>
              <a
                href="https://www.miricanvas.com/v/15ecqwt?mode=templateshare"
                target="_blank"
                rel="noopener noreferrer"
              >
                1학년
              </a>
              <a
                href="https://www.miricanvas.com/v/15eclku?mode=templateshare"
                target="_blank"
                rel="noopener noreferrer"
              >
                2학년
              </a>
              <a
                href="https://www.miricanvas.com/v/15ecnv0?mode=templateshare"
                target="_blank"
                rel="noopener noreferrer"
              >
                3학년
              </a>
            </div>
          </li>
        </ul>
      </section>

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
        />

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="card-icon">
                  <Layers3 size={18} />
                </span>
                <div>
                  <h3>선택 가이드</h3>
                  <p className="muted">
                    1학년은 고정 시간표이고, 2·3학년은 선택과목별 과목명과 교실을 모두 입력하면 됩니다.
                  </p>
                </div>
              </div>

              <div className="chip-set">
                <span className="chip">
                  <GraduationCap size={14} />
                  {selectedGrade ? `${selectedGrade}학년` : '학년 미선택'}
                </span>
                <span className="chip">
                  <ImageDown size={14} />
                  {activeTemplate ? `${activeTemplate.classId} 준비 완료` : '반을 선택하면 미리보기가 열립니다'}
                </span>
              </div>
            </div>
          </div>

          <TimetablePreview
            ref={svgRef}
            template={activeTemplate}
            draftValues={draftValues}
            grade={selectedGrade}
            fontReady={fontReady}
          />
        </div>
      </div>
    </div>
  );
}
