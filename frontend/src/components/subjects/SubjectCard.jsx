/**
 * @file src/components/subjects/SubjectCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react-router-dom
 * - lucide-react
 * - ../../security/urlPolicy
 * - ../RoleName/RoleName
 * Side effects:
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Link } from "react-router-dom";
import { MessageCircle, ExternalLink } from "lucide-react";
import { toSafeExternalHref } from "../../security/urlPolicy";
import RoleName from "../RoleName/RoleName";
import styles from "./subjects.module.css";

const statusMap = {
  open: { label: "모집중", className: styles.statusOpen },
  negotiating: { label: "조율중", className: styles.statusNegotiating },
  matched: { label: "매칭완료", className: styles.statusMatched },
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

/**
 * SubjectCard module entry point.
 */
export default function SubjectCard({
  item,
  basePath = "/community/subjects",
  showApproval = false,
  canViewDetail = true,
}) {
  const status = statusMap[item.status] || statusMap.open;
  const contactLinks = Array.isArray(item.contactLinks) ? item.contactLinks : [];
  const studentIdContact = contactLinks.find((contact) => contact?.type === "student_id");
  const extraContact = contactLinks.find((contact) => contact?.type === "extra");
  const externalContacts = contactLinks
    .filter((contact) => ["kakao", "email", "url"].includes(contact?.type))
    .map((contact) => ({
      ...contact,
      safeHref: toSafeExternalHref(contact?.url),
    }))
    .filter((contact) => contact.safeHref);
  const authorName = item.author?.name || item.authorNickname || "익명";
  const authorRole = item.author?.role || item.authorRole || "student";

  const content = (
    <>
      <div className={styles.cardHeader}>
        <div className={styles.metaLeft}>
          <RoleName nickname={authorName} role={authorRole} size="sm" className={styles.author} />
          <span>{item.className || `${item.grade}학년`}</span>
          <span aria-label="업데이트">{formatDate(item.updatedAt || item.createdAt)}</span>
        </div>
        <span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span>
        {showApproval ? (
          <span
            className={`${styles.statusBadge} ${
              item.approvalStatus === "approved" ? styles.statusApproved : styles.statusPending
            }`}
          >
            {item.approvalStatus === "approved" ? "승인됨" : "승인 대기"}
          </span>
        ) : null}
      </div>

      <div className={styles.subjectRow}>
        <span className={`${styles.subjectChip} ${styles.requestChip}`}>
          받고 싶은 과목 · {item.requestingSubject}
        </span>
        <span className={`${styles.subjectChip} ${styles.offerChip}`}>
          줄 수 있는 과목 · {item.offeringSubject}
        </span>
      </div>

      <p className={styles.note}>{item.note || "간단 메모가 없습니다."}</p>

      <div className={styles.bottomRow}>
        <div className={styles.contactRow}>
          <span className={styles.contactBadge}>
            <MessageCircle size={16} /> 댓글로 협의
          </span>
          {studentIdContact?.value ? (
            <span className={styles.contactBadge}>학번 연락 · {studentIdContact.value}</span>
          ) : null}
          {extraContact?.value ? (
            <span className={styles.contactBadge}>기타 연락 · {extraContact.value}</span>
          ) : null}
          {externalContacts.map((contact) => (
            <a
              key={`${contact.type}-${contact.url}`}
              className={styles.contactBtn}
              href={contact.safeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {contact.type === "kakao" ? "오픈채팅" : contact.type === "email" ? "이메일" : "링크"}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>
    </>
  );

  if (!canViewDetail) {
    return (
      <article className={`${styles.card} ${styles.cardStatic}`} aria-label="선택과목 변경 글 요약">
        {content}
      </article>
    );
  }

  return (
    <Link to={`${basePath}/${item.id}`} className={styles.card} aria-label="선택과목 변경 상세 보기">
      {content}
    </Link>
  );
}

