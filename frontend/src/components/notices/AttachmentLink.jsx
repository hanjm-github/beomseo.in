import { Paperclip, Image as ImageIcon } from 'lucide-react';
import styles from './notices.module.css';
import { toAbsoluteApiUrl } from '../../api/normalizers';
import { toSafeAssetUrl } from '../../security/urlPolicy';

function buildUrl(url) {
  const safeUrl = toSafeAssetUrl(url);
  if (!safeUrl) return null;
  return toAbsoluteApiUrl(safeUrl);
}

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
