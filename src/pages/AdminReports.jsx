import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TARGET_LABEL = {
  question: "문제",
  question_set: "문제집",
  worldcup: "월드컵",
  worldcup_item: "월드컵 후보",
};

// 신고된 콘텐츠를 실제로 지우는 테이블 매핑 (신고 종류에 따라 다른 테이블에서 삭제)
const DELETE_TABLE = {
  question: "questions",
  question_set: "question_sets",
  worldcup: "worldcups",
  worldcup_item: "worldcup_items",
};

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id, status) => {
    setBusyId(id);
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      console.error(error);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const removeContent = async (report) => {
    setBusyId(report.id);
    const table = DELETE_TABLE[report.target_type];
    const { error } = await supabase.from(table).delete().eq("id", report.target_id);
    if (error) {
      console.error("콘텐츠 삭제 실패:", error);
      setBusyId(null);
      return;
    }
    await updateStatus(report.id, "reviewed");
  };

  if (loading) return <p>불러오는 중...</p>;
  if (reports.length === 0) return <p>대기 중인 신고가 없습니다.</p>;

  return (
    <div className="admin-approvals">
      {reports.map((r) => (
        <div key={r.id} className="admin-approvals__item">
          <div className="admin-approvals__category">
            {TARGET_LABEL[r.target_type] || r.target_type} 신고 · {r.reason}
          </div>
          <div className="admin-approvals__question">{r.target_label || "(제목 없음)"}</div>
          {r.detail && <p className="admin-reports__detail">{r.detail}</p>}
          {r.target_image_url && (
            <img className="admin-reports__thumb" src={r.target_image_url} alt="" />
          )}
          <div className="admin-approvals__actions">
            <button onClick={() => removeContent(r)} disabled={busyId === r.id} className="is-danger">
              콘텐츠 삭제 + 처리완료
            </button>
            <button onClick={() => updateStatus(r.id, "dismissed")} disabled={busyId === r.id}>
              기각
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
