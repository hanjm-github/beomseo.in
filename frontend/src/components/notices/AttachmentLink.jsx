/**
 * @file src/components/notices/AttachmentLink.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ./notices.module.css
 * - ../../api/normalizers
 * - ../../security/urlPolicy
 * Side effects:
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Paperclip, Image as ImageIcon } from 'lucide-react';
import styles from './notices.module.css';
import { toAbsoluteApiUrl } from '../../api/normalizers';
import { toSafeAssetUrl } from '../../security/urlPolicy';

function buildUrl(url) {
  const safeUrl = toSafeAssetUrl(url);
  if (!safeUrl) return null;
  return toAbsoluteApiUrl(safeUrl);
}

/**
 * AttachmentLink module entry point.
 */
export default function AttachmentLink({ file }) {
  const isImage = file.kind === 'image' || file.mime?.startsWith('image/');
  const href = buildUrl(file.url);
  if (!href) {
    return (
      <span className={styles.attachmentLink}>
        <span className={styles.attachmentIcon}>
          {isImage ? <ImageIcon size={14} /> : <Paperclip size={14} />}
        </span>
        {file.name}
      </span>
    );
  }

  return (
    <a
      href={href}
      download={file.name}
      target="_blank"
      rel="noreferrer"
      className={styles.attachmentLink}
    >
      <span className={styles.attachmentIcon}>
        {isImage ? <ImageIcon size={14} /> : <Paperclip size={14} />}
      </span>
      {file.name}
    </a>
  );
}


