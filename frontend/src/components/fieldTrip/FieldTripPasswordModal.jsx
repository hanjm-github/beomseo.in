import { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, LockKeyhole, X } from 'lucide-react';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';

export default function FieldTripPasswordModal({
  classSummary,
  error,
  submitting,
  onClose,
  onSubmit,
}) {
  const [password, setPassword] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!classSummary) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [classSummary]);

  useEffect(() => {
    if (!classSummary) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [classSummary, onClose]);

  if (!classSummary) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.(password);
  };

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={() => onClose?.()}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-trip-password-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalIcon}>
              <LockKeyhole size={18} />
            </span>
            <div>
              <p className={styles.modalEyebrow}>반 비밀번호</p>
              <h2 id="field-trip-password-title">{classSummary.label} 게시판 입장</h2>
            </div>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onClose?.()}
            aria-label="비밀번호 입력 모달 닫기"
          >
            <X size={16} />
          </button>
        </div>

        <p className={styles.modalDescription}>
          각 반 게시판은 고유 비밀번호를 입력해야만 열립니다. 잠금을 해제하면 현재 브라우저
          세션 동안 유지됩니다.
        </p>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <label className={styles.formGroup} htmlFor="field-trip-password">
            <span>비밀번호</span>
            <div className={styles.passwordInputWrap}>
              <KeyRound size={16} />
              <input
                ref={inputRef}
                id="field-trip-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={styles.textField}
                placeholder={`${classSummary.label} 비밀번호`}
                autoComplete="off"
              />
            </div>
          </label>

          {error ? <p className={styles.formError}>{error}</p> : null}

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => onClose?.()}>
              닫기
            </button>
            <button type="submit" className={styles.primaryButton} disabled={submitting}>
              {submitting ? <Loader2 size={16} className={styles.spinner} /> : null}
              잠금 해제
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
