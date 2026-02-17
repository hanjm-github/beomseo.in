import { RotateCcw, Search } from 'lucide-react';
import { gomsolMarketApi } from '../../api/gomsolMarket';
import styles from './gomsolmarket.module.css';

const SORT_OPTIONS = [
  { key: 'recent', label: '최신순' },
  { key: 'price-asc', label: '가격 낮은순' },
  { key: 'price-desc', label: '가격 높은순' },
];

export default function GomsolMarketFilterBar({
  status,
  category,
  approval,
  sort,
  search,
  isAdmin,
  onStatusChange,
  onCategoryChange,
  onApprovalChange,
  onSortChange,
  onSearchChange,
  onReset,
}) {
  return (
    <section className={styles.filtersSection} aria-label="곰솔마켓 필터">
      <div className={styles.filterRow}>
        <div className={styles.chipRow} role="tablist" aria-label="판매 상태 필터">
          <button
            type="button"
            role="tab"
            aria-selected={status === 'all'}
            className={`${styles.chip} ${status === 'all' ? styles.chipActive : ''}`}
            onClick={() => onStatusChange('all')}
          >
            전체
          </button>
          {Object.entries(gomsolMarketApi.statusLabel).map(([key, label]) => (
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
          {Object.entries(gomsolMarketApi.categoryLabel).map(([key, label]) => (
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

      {isAdmin ? (
        <div className={styles.filterRow}>
          <div className={styles.chipRow} aria-label="승인 상태 필터">
            <button
              type="button"
              className={`${styles.chip} ${approval === 'all' ? styles.chipActive : ''}`}
              onClick={() => onApprovalChange('all')}
            >
              승인 전체
            </button>
            <button
              type="button"
              className={`${styles.chip} ${approval === 'approved' ? styles.chipActive : ''}`}
              onClick={() => onApprovalChange('approved')}
            >
              승인됨
            </button>
            <button
              type="button"
              className={`${styles.chip} ${approval === 'pending' ? styles.chipActive : ''}`}
              onClick={() => onApprovalChange('pending')}
            >
              미승인
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.filterRow}>
        <label className={styles.searchBox} htmlFor="gomsol-market-search">
          <Search size={16} />
          <input
            id="gomsol-market-search"
            type="search"
            value={search}
            placeholder="상품명, 설명 검색"
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
