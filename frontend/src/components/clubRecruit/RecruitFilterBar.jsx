import { Search } from 'lucide-react';
import styles from './clubRecruit.module.css';

const sortOptions = [
  { value: 'recent', label: '최신 업데이트' },
  { value: 'deadline', label: '마감 임박 순' },
];

export default function RecruitFilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  isAdmin = false,
  approval = 'all',
  onApprovalChange,
}) {
  return (
    <div className={styles.filterBar} role="search">
      <div className={styles.searchWrap}>
        <Search size={16} />
        <input
          type="search"
          placeholder="동아리 이름, 분야로 검색"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>
      <div className={styles.filterGroup} aria-label="필터">
        <div className={styles.selectWrap}>
          <select value={sort} onChange={(e) => onSortChange?.(e.target.value)}>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isAdmin ? (
          <div className={styles.selectWrap}>
            <select
              value={approval}
              onChange={(e) => onApprovalChange?.(e.target.value)}
              aria-label="승인 상태 필터"
            >
              <option value="all">승인 전체</option>
              <option value="approved">승인됨</option>
              <option value="pending">미승인</option>
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
