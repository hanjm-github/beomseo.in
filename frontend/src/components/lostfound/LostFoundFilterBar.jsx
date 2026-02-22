/**
 * @file src/components/lostfound/LostFoundFilterBar.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ../../api/lostFound
 * - ./lostfound.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Search, RotateCcw } from 'lucide-react';
import { lostFoundApi } from '../../api/lostFound';
import styles from './lostfound.module.css';

const SORT_OPTIONS = [
  { key: 'recent', label: '등록 최신순' },
  { key: 'foundAt-desc', label: '습득일 최신순' },
  { key: 'foundAt-asc', label: '습득일 오래된순' },
];

/**
 * LostFoundFilterBar module entry point.
 */
export default function LostFoundFilterBar({
  status,
  category,
  sort,
  search,
  onStatusChange,
  onCategoryChange,
  onSortChange,
  onSearchChange,
  onReset,
}) {
  return (
    <section className={styles.filtersSection} aria-label="분실물 필터">
      <div className={styles.filterRow}>
        <div className={styles.chipRow} role="tablist" aria-label="상태 필터">
          <button
            type="button"
            role="tab"
            aria-selected={status === 'all'}
            className={`${styles.chip} ${status === 'all' ? styles.chipActive : ''}`}
            onClick={() => onStatusChange('all')}
          >
            전체
          </button>
          {Object.entries(lostFoundApi.statusLabel).map(([key, label]) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={status === key}
              className={`${styles.chip} ${status === key ? styles.chipActive : ''}`}
              onClick={() => onStatusChange(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className={styles.select}
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          aria-label="정렬 기준"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.chipRow} aria-label="카테고리 필터">
          <button
            type="button"
            className={`${styles.chip} ${category === 'all' ? styles.chipActive : ''}`}
            onClick={() => onCategoryChange('all')}
          >
            전체 카테고리
          </button>
          {Object.entries(lostFoundApi.categoryLabel).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={`${styles.chip} ${category === key ? styles.chipActive : ''}`}
              onClick={() => onCategoryChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <label className={styles.searchBox} htmlFor="lost-found-search">
          <Search size={16} />
          <input
            id="lost-found-search"
            type="search"
            value={search}
            placeholder="물품명, 습득장소, 보관장소 검색"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <button type="button" className={styles.chip} onClick={onReset}>
          <RotateCcw size={14} />
          필터 초기화
        </button>
      </div>
    </section>
  );
}


