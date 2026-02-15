import styles from './freeboard.module.css';

export default function FreeBoardToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  mine,
  bookmarked,
  onToggleMine,
  onToggleBookmarked,
}) {
  return (
    <div className={styles.toolbar}>
      <input
        className={styles.searchInput}
        placeholder="검색 (제목, 내용)"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select className={styles.select} value={sort} onChange={(e) => onSortChange(e.target.value)}>
        <option value="recent">최신순</option>
        <option value="comments">댓글 많은 순</option>
        <option value="likes">공감 많은 순</option>
      </select>

      <button type="button" className={styles.toggleBtn} aria-pressed={mine} onClick={onToggleMine}>
        내 글만
      </button>
      <button
        type="button"
        className={styles.toggleBtn}
        aria-pressed={bookmarked}
        onClick={onToggleBookmarked}
      >
        북마크만
      </button>
    </div>
  );
}
