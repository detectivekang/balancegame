import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminWorldcups() {
  const [pending, setPending] = useState([]);
  const [itemsByWc, setItemsByWc] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: wcs, error } = await supabase
      .from("worldcups")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) console.error(error);

    const ids = (wcs || []).map((w) => w.id);
    let items = [];
    if (ids.length > 0) {
      const { data } = await supabase.from("worldcup_items").select("*").in("worldcup_id", ids);
      items = data || [];
    }
    const grouped = {};
    items.forEach((it) => {
      (grouped[it.worldcup_id] = grouped[it.worldcup_id] || []).push(it);
    });

    setPending(wcs || []);
    setItemsByWc(grouped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (wc) => {
    const { error } = await supabase.rpc("approve_worldcup", { p_worldcup_id: wc.id });
    if (error) {
      console.error("승인 실패:", error);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== wc.id));
  };

  const reject = async (id) => {
    const { error } = await supabase.from("worldcups").delete().eq("id", id);
    if (error) {
      console.error("반려 실패:", error);
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) return <p>불러오는 중...</p>;
  if (pending.length === 0) return <p>승인 대기 중인 월드컵이 없습니다.</p>;

  return (
    <div className="admin-approvals">
      {pending.map((wc) => (
        <div key={wc.id} className="admin-approvals__item">
          <div className="admin-approvals__category">{wc.category}</div>
          <div className="admin-approvals__question">{wc.title}</div>
          <div className="admin-wc__thumbs">
            {(itemsByWc[wc.id] || []).slice(0, 8).map((it) => (
              <img key={it.id} src={it.image_url} alt={it.label} title={it.label} />
            ))}
            {(itemsByWc[wc.id] || []).length > 8 && (
              <span className="admin-wc__more">+{itemsByWc[wc.id].length - 8}</span>
            )}
          </div>
          <div className="admin-approvals__actions">
            <button onClick={() => approve(wc)}>승인 (+10 XP)</button>
            <button onClick={() => reject(wc.id)} className="is-danger">
              반려
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
