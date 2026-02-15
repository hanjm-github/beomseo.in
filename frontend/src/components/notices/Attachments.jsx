import { X } from 'lucide-react';
import styles from './notices.module.css';
import AttachmentLink from './AttachmentLink';

export default function Attachments({ items, onRemove, compact = false }) {
  if (!items?.length) return null;

  return (
    <div className={styles.attachments}>
      {items.map((file) => {
        return (
          <div key={file.id} className={styles.attachmentItem}>
            <div className={styles.attachmentBody}>
              <AttachmentLink file={file} />
              {!compact && (
                <p className={styles.metaMuted}>{Math.round(file.size / 1024)} KB</p>
              )}
            </div>
            {onRemove ? (
              <button type="button" className={styles.iconButton} onClick={() => onRemove(file.id)}>
                <X size={14} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
