/**
 * @file src/components/notices/NoticeToolbar.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ./notices.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Search, ListFilter, Pin, AlertTriangle, GraduationCap } from 'lucide-react';
import styles from './notices.module.css';

/**
 * NoticeToolbar module entry point.
 */
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
  showAttributeFilters = true,
  searchPlaceholder = '검색 (제목, 본문, 태그)',
  sortOptions,
}) {
  // Budget board routes reuse the same toolbar but swap out board-specific
  // filters and sort labels through extension props.
  const resolvedSortOptions = sortOptions || [
    { value: 'recent', label: '최신순' },
    { value: 'views', label: '조회순' },
    { value: 'important', label: '중요 우선' },
  ];

  return (
    <div className={styles.toolbar}>
      {showAttributeFilters ? (
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
      ) : null}

      <div className={styles.toolbarRight}>
        <div className={styles.searchBox}>
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        <div className={styles.sortBox}>
          <ListFilter size={14} />
          <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
            {resolvedSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}


