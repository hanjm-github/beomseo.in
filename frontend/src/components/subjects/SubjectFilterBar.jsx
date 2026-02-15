import { Search } from "lucide-react";
import styles from "./subjects.module.css";

const subjectTags = [
  { value: "all", label: "전체" },
  { value: "국", label: "국어" },
  { value: "수", label: "수학" },
  { value: "영", label: "영어" },
  { value: "사", label: "사회" },
  { value: "과", label: "과학" },
  { value: "예", label: "예체능" },
];

export default function SubjectFilterBar({
  search,
  onSearchChange,
  onlyMine,
  onToggleOnlyMine,
  hideClosed,
  onToggleHideClosed,
  subjectTag,
  onSubjectTagChange,
}) {
  return (
    <div className={styles.section}>
      <div className={styles.filterBar} role="search">
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input
            type="search"
            placeholder="과목명, 닉네임, 메모로 검색"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            aria-label="선택 과목 검색"
          />
        </div>

        <button
          type="button"
          className={styles.toggleBtn}
          aria-pressed={onlyMine}
          onClick={() => onToggleOnlyMine?.(!onlyMine)}
        >
          내 글만
        </button>

        <button
          type="button"
          className={styles.toggleBtn}
          aria-pressed={hideClosed}
          onClick={() => onToggleHideClosed?.(!hideClosed)}
        >
          매칭 완료 숨기기
        </button>
      </div>

      <div className={styles.chipRow} aria-label="과목군 필터">
        {subjectTags.map((tag) => (
          <button
            key={tag.value}
            type="button"
            className={`${styles.chip} ${subjectTag === tag.value ? styles.chipActive : ""}`}
            onClick={() => onSubjectTagChange?.(tag.value)}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
