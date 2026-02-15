import { Paperclip, Image as ImageIcon } from 'lucide-react';
import styles from './notices.module.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function buildUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const prefix = url.startsWith('/') ? '' : '/';
  return `${API_BASE.replace(/\/$/, '')}${prefix}${url}`;
}

export default function AttachmentLink({ file }) {
  const isImage = file.kind === 'image' || file.mime?.startsWith('image/');
  const href = buildUrl(file.url);
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
