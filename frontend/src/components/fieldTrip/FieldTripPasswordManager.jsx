import { useState } from 'react';
import { KeyRound, Loader2, Save } from 'lucide-react';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';

export default function FieldTripPasswordManager({
  classSummary,
  saving = false,
  error = '',
  successMessage = '',
  onSubmit,
}) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.(password);
  };

  return (
    <section className={`${styles.sectionCard} ${styles.managerPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.sectionEyebrow}>운영진 관리</p>
          <h2 className={styles.sectionTitle}>{classSummary.label} 게시판 비밀번호 설정/변경</h2>
          <p className={styles.sectionDescription}>
            관리자 계정만 반 게시판 비밀번호를 변경할 수 있습니다.
          </p>
        </div>
      </div>

      <form className={styles.inlineForm} onSubmit={handleSubmit}>
        <label className={styles.formGroup} htmlFor={`field-trip-manager-password-${classSummary.classId}`}>
          <span>새 비밀번호</span>
          <div className={styles.passwordInputWrap}>
            <KeyRound size={16} />
            <input
              id={`field-trip-manager-password-${classSummary.classId}`}
              className={styles.textField}
              type="text"
              value={password}
              // Admins often coordinate printed/offline board passwords during
              // the event, so the manager field keeps the value visible on entry.
              onChange={(event) => setPassword(event.target.value)}
              placeholder="새 비밀번호를 입력해 주세요"
              autoComplete="new-password"
            />
          </div>
          <p className={styles.formHint}>비밀번호는 대소문자를 구분합니다.</p>
        </label>

        <div className={styles.inlineActions}>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? <Loader2 size={16} className={styles.spinner} /> : <Save size={16} />}
            {saving ? '저장 중…' : '비밀번호 저장'}
          </button>
        </div>
      </form>

      {error ? <p className={styles.formError}>{error}</p> : null}
      {!error && successMessage ? <p className={styles.formSuccess}>{successMessage}</p> : null}
    </section>
  );
}
