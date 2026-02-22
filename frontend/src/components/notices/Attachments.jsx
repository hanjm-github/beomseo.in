/**
 * @file src/components/notices/Attachments.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ./notices.module.css
 * - ./AttachmentLink
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { X } from 'lucide-react';
import styles from './notices.module.css';
import AttachmentLink from './AttachmentLink';

/**
 * Attachments module entry point.
 */
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


