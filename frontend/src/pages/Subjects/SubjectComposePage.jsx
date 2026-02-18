import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { subjectChangesApi } from "../../api/subjectChanges";
import "../page-shell.css";
import styles from "../ClubRecruit/ClubRecruitComposePage.module.css";

export default function SubjectComposePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    grade: 1,
    className: "",
    offeringSubject: "",
    requestingSubject: "",
    note: "",
    contactType: "none",
    contactValue: "",
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
      const contactLinks =
        form.contactType !== "none" && form.contactValue
          ? [{ type: form.contactType, url: form.contactValue }]
          : [];
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

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">선택과목 변경</p>
          <h1>글쓰기</h1>
          <p className="lede">제목 없이 받는/주는 과목을 필수로 입력해 주세요.</p>
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
          <span>연락 수단</span>
          <div className={styles.contactGrid}>
            <select
              value={form.contactType}
              onChange={(e) => handleChange("contactType", e.target.value)}
            >
              <option value="none">댓글로 협의</option>
              <option value="kakao">카카오 오픈채팅</option>
              <option value="email">이메일</option>
              <option value="url">기타 링크</option>
            </select>
            <input
              value={form.contactValue}
              onChange={(e) => handleChange("contactValue", e.target.value)}
              placeholder="https://open.kakao.com/..., mailto:you@example.com"
              disabled={form.contactType === "none"}
            />
          </div>
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
