/**
 * @file src/components/survey/SurveyResponseModal.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - react-form-builder2
 * - ./survey.module.css
 * - ./survey-form-builder.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { ReactFormGenerator } from 'react-form-builder2';
import styles from './survey.module.css';
import './survey-form-builder.css';
import { sanitizeSurveyFormSchema } from '../../security/surveySchemaSanitizer';
import { toSafeExternalHref } from '../../security/urlPolicy';

/**
 * SurveyResponseModal module entry point.
 */
export default function SurveyResponseModal({ survey, open, onClose, onSubmit, submitting }) {
  const modalRef = useRef(null);
  const safeFormJson = useMemo(() => sanitizeSurveyFormSchema(survey?.formJson || []), [survey?.formJson]);

  useEffect(() => {
    if (!open) return undefined;
    const root = modalRef.current;
    if (!root) return undefined;

    const handleSafeLinkNavigation = (event) => {
      const targetElement = event.target;
      if (!(targetElement instanceof Element)) return;
      const anchor = targetElement.closest('a[href]');
      if (!anchor || !root.contains(anchor)) return;

      const safeHref = toSafeExternalHref(anchor.getAttribute('href'));
      if (!safeHref || safeHref === '#') {
        event.preventDefault();
        return;
      }

      const target = String(anchor.getAttribute('target') || '').toLowerCase();
      if (target === '_blank') {
        event.preventDefault();
        window.open(safeHref, '_blank', 'noopener,noreferrer');
        return;
      }

      if (anchor.getAttribute('href') !== safeHref) {
        event.preventDefault();
        window.location.assign(safeHref);
      }
    };

    root.addEventListener('click', handleSafeLinkNavigation);
    return () => {
      root.removeEventListener('click', handleSafeLinkNavigation);
    };
  }, [open]);

  if (!open) return null;

  const handleAnswerSubmit = (data) => {
    // ReactFormGenerator calls this with answer data
    onSubmit?.(data);
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-busy={submitting}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h3>{survey?.title} 응답하기</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalDescription}>{survey?.description}</p>

        <ReactFormGenerator
          data={safeFormJson}
          onSubmit={handleAnswerSubmit}
          action_name="응답 제출"
          back_name="취소"
          back_action={onClose}
        />

      </div>
    </div>
  );
}


