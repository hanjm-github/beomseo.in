import { X } from 'lucide-react';
import { ReactFormGenerator } from 'react-form-builder2';
import styles from './survey.module.css';

export default function SurveyResponseModal({ survey, open, onClose, onSubmit, submitting }) {
  if (!open) return null;

  const handleAnswerSubmit = (data) => {
    // ReactFormGenerator calls this with answer data
    onSubmit?.(data);
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-busy={submitting}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>{survey?.title} 응답하기</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalDescription}>{survey?.description}</p>

        <ReactFormGenerator
          data={survey?.formJson || []}
          onSubmit={handleAnswerSubmit}
          action_name="응답 제출"
          back_name="취소"
          back_action={onClose}
        />

      </div>
    </div>
  );
}
