import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminApprovals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setPending(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (q) => {
    const { error } = await supabase.rpc("approve_question", { p_question_id: q.id });
    if (error) {
      console.error("승인 실패:", error);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== q.id));
  };

  const reject = async (id) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      console.error("반려 실패:", error);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) return <p>불러오는 중...</p>;
  if (pending.length === 0) return <p>승인 대기 중인 문제가 없습니다.</p>;

  return (
    <div className="admin-approvals">
      {pending.map((q) => (
        <div key={q.id} className="admin-approvals__item">
          <div className="admin-approvals__category">{q.category}</div>
          <div className="admin-approvals__question">{q.question}</div>
          <div className="admin-approvals__options">
            <span>{q.option_a}</span>
            <span>vs</span>
            <span>{q.option_b}</span>
          </div>
          <div className="admin-approvals__actions">
            <button onClick={() => approve(q)}>승인 (+5 XP)</button>
            <button onClick={() => reject(q.id)} className="is-danger">
              반려
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
