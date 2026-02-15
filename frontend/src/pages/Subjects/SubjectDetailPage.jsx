import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { subjectChangesApi } from "../../api/subjectChanges";
import SubjectCard from "../../components/subjects/SubjectCard";
import SubjectComments from "../../components/subjects/SubjectComments";
import ErrorState from "../../components/clubRecruit/ErrorState";
import InfiniteLoader from "../../components/clubRecruit/InfiniteLoader";
import { useAuth } from "../../context/AuthContext";
import "../page-shell.css";

export default function SubjectDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await subjectChangesApi.get(id);
        if (!cancelled) setItem(res);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleApprove = async () => {
    if (!item) return;
    setApproving(true);
    try {
      const res =
        item.approvalStatus === "approved"
          ? await subjectChangesApi.unapprove(id)
          : await subjectChangesApi.approve(id);
      setItem(res);
    } catch (err) {
      setError(err);
    } finally {
      setApproving(false);
    }
  };

  const toggleMatchStatus = async () => {
    if (!item) return;
    const next = item.status === "matched" ? "open" : "matched";
    setStatusChanging(true);
    try {
      const res = await subjectChangesApi.changeStatus(id, next);
      setItem(res);
    } catch (err) {
      setError(err);
    } finally {
      setStatusChanging(false);
    }
  };

  if (loading) return <InfiniteLoader />;
  if (error) return <ErrorState onRetry={() => window.location.reload()} />;
  if (!item) return null;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">선택과목 변경</p>
          <h1>상세 보기</h1>
          <p className="lede">목록에서 본 정보를 다시 확인하세요.</p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-secondary" to="/community/subjects">
            목록으로
          </Link>
          {user?.role === "admin" ? (
            <button className="btn btn-primary" onClick={toggleApprove} disabled={approving}>
              {item.approvalStatus === "approved" ? "승인 해제" : "승인 대기 → 승인"}
            </button>
          ) : null}
          {(user?.role === "admin" || user?.id === item?.author?.id) ? (
            <button
              className="btn btn-tertiary"
              onClick={toggleMatchStatus}
              disabled={statusChanging}
            >
              {item.status === "matched" ? "매칭 취소 (모집중으로 전환)" : "매칭 완료로 전환"}
            </button>
          ) : null}
        </div>
      </div>

      <SubjectCard item={item} showMeta={false} showApproval={user?.role === "admin"} />
      <SubjectComments postId={id} />
    </div>
  );
}
