/**
 * @file src/pages/Subjects/SubjectComposePage.jsx
 * @description Implements route-level views and page orchestration logic.
 * Responsibilities:
 * - Coordinate route state, fetch lifecycles, and permission-driven page behavior.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - ../../api/subjectChanges
 * - ../../security/urlPolicy
 * Side effects:
 * - Influences client-side routing and navigation state.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Owns route-level user flows and composes feature components.
 */
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { subjectChangesApi } from "../../api/subjectChanges";
import { toSafeOpenChatHref } from "../../security/urlPolicy";
import { useAuth } from "../../context/AuthContext";
import "../page-shell.css";
import styles from "../ClubRecruit/ClubRecruitComposePage.module.css";

/**
 * SubjectComposePage module entry point.
 */
export default function SubjectComposePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    grade: 1,
    className: "",
    offeringSubject: "",
    requestingSubject: "",
    note: "",
    contactStudentId: "",
    contactOpenChatUrl: "",
    contactExtra: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.requestingSubject || !form.offeringSubject) {
      setError("받고 싶은 과목과 줄 수 있는 과목은 필수입니다.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const studentId = form.contactStudentId.trim();
      const openChatUrl = form.contactOpenChatUrl.trim();
      const extraContact = form.contactExtra.trim();

      if (!studentId && !openChatUrl && !extraContact) {
        setError("학번, 오픈채팅 링크, 기타 연락 방법 중 최소 1개를 입력해주세요.");
        setSubmitting(false);
        return;
      }

      const safeOpenChatUrl = openChatUrl ? toSafeOpenChatHref(openChatUrl) : "";
      if (openChatUrl && !safeOpenChatUrl) {
        setError("오픈채팅 링크는 open.kakao.com 형식의 안전한 URL만 사용할 수 있습니다.");
        setSubmitting(false);
        return;
      }

      const contactLinks = [];
      if (studentId) {
        contactLinks.push({ type: "student_id", value: studentId });
      }
      if (safeOpenChatUrl) {
        contactLinks.push({ type: "kakao", url: safeOpenChatUrl });
      }
      if (extraContact) {
        contactLinks.push({ type: "extra", value: extraContact });
      }

      await subjectChangesApi.create({
        grade: Number(form.grade),
        className: form.className,
        offeringSubject: form.offeringSubject,
        requestingSubject: form.requestingSubject,
        note: form.note,
        contactLinks,
      });
      navigate("/community/subjects");
    } catch (err) {
      setError(err?.message || "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="page-shell">
        <div className="placeholder">권한 정보를 확인하는 중입니다.</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-shell">
        <div className="card">
          <p className="eyebrow">선택과목 변경 작성 권한</p>
          <h1>로그인이 필요합니다.</h1>
          <p className="lede">선택과목 변경 글 작성은 로그인한 사용자만 가능합니다.</p>
          <div className="u-action-stack">
            <Link className="btn btn-secondary" to="/community/subjects">
              목록으로
            </Link>
            <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">선택과목 변경</p>
          <h1>글쓰기</h1>
          <p className="lede">등록한 글은 관리자 승인 후 일반 사용자에게 공개됩니다.</p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-secondary" to="/community/subjects">
            목록으로
          </Link>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>학년 *</span>
            <select
              value={form.grade}
              onChange={(e) => handleChange("grade", e.target.value)}
              required
            >
              <option value={1}>1학년</option>
              <option value={2}>2학년</option>
              <option value={3}>3학년</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>반 (선택)</span>
            <input
              value={form.className}
              onChange={(e) => handleChange("className", e.target.value)}
              placeholder="예) 1-3"
            />
          </label>
        </div>

        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>받고 싶은 과목 *</span>
            <input
              value={form.requestingSubject}
              onChange={(e) => handleChange("requestingSubject", e.target.value)}
              placeholder="예) 확률과 통계"
              required
            />
          </label>

          <label className={styles.field}>
            <span>줄 수 있는 과목 *</span>
            <input
              value={form.offeringSubject}
              onChange={(e) => handleChange("offeringSubject", e.target.value)}
              placeholder="예) 미적분"
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>학번 (연락 방법 중 1개 이상 필수)</span>
          <input
            value={form.contactStudentId}
            onChange={(e) => handleChange("contactStudentId", e.target.value)}
            placeholder="예: 23015"
          />
        </label>

        <label className={styles.field}>
          <span>오픈채팅 링크</span>
          <input
            value={form.contactOpenChatUrl}
            onChange={(e) => handleChange("contactOpenChatUrl", e.target.value)}
            placeholder="https://open.kakao.com/..."
          />
        </label>

        <label className={styles.field}>
          <span>기타 연락 방법</span>
          <input
            value={form.contactExtra}
            onChange={(e) => handleChange("contactExtra", e.target.value)}
            placeholder="예: 점심시간 2학년 복도에서 직거래 가능"
          />
        </label>

        <label className={styles.field}>
          <span>간단 메모</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(e) => handleChange("note", e.target.value)}
            placeholder="시간표 블록, 참고 사항 등을 2~3줄로 적어주세요."
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}


