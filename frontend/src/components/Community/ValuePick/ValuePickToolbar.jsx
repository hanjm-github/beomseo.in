/**
 * @file src/components/Community/ValuePick/ValuePickToolbar.jsx
 */
import styles from './valuepick.module.css';

export default function ValuePickToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  isAdmin = false,
  approval = 'all',
  onApprovalChange,
  mine,
  onToggleMine,
}) {
  return (
    <div className={styles.toolbar} aria-label="인성 가치 PICK 필터">
      <input
        className={styles.searchInput}
        placeholder="인성 역량, 다짐, 상세 기록 검색"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <select className={styles.select} value={sort} onChange={(event) => onSortChange(event.target.value)}>
        <option value="recent">최신순</option>
        <option value="likes">추천 많은 순</option>
        <option value="comments">댓글 많은 순</option>
      </select>

      {isAdmin ? (
        <select
          className={styles.select}
          value={approval}
          onChange={(event) => onApprovalChange?.(event.target.value)}
          aria-label="승인 상태 필터"
        >
          <option value="all">승인 전체</option>
          <option value="approved">승인됨</option>
          <option value="pending">미승인</option>
        </select>
      ) : null}

      <button type="button" className={styles.toggleBtn} aria-pressed={mine} onClick={onToggleMine}>
        내 다짐만
      </button>
    </div>
  );
}
