import { Search, ListFilter, Pin, AlertTriangle, GraduationCap } from 'lucide-react';
import styles from './notices.module.css';

export default function NoticeToolbar({
  search,
  onSearchChange,
  pinned,
  important,
  exam,
  sort,
  onTogglePinned,
  onToggleImportant,
  onToggleExam,
  onSortChange,
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <button
          className={`${styles.chip} ${pinned ? styles.chipActive : ''}`}
          type="button"
          onClick={onTogglePinned}
        >
          <Pin size={14} />
          상단 고정
        </button>
        <button
          className={`${styles.chip} ${important ? styles.chipActive : ''}`}
          type="button"
          onClick={onToggleImportant}
        >
          <AlertTriangle size={14} />
          중요
        </button>
        <button
          className={`${styles.chip} ${exam ? styles.chipActive : ''}`}
          type="button"
          onClick={onToggleExam}
        >
          <GraduationCap size={14} />
          시험
        </button>
      </div>

      <div className={styles.toolbarRight}>
        <div className={styles.searchBox}>
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="검색 (제목, 본문)"
          />
        </div>
        <div className={styles.sortBox}>
          <ListFilter size={14} />
          <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
            <option value="recent">최신순</option>
            <option value="views">조회순</option>
            <option value="important">중요 우선</option>
          </select>
        </div>
      </div>
    </div>
  );
}

