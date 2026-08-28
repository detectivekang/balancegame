import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { WORLDCUP_CATEGORIES } from "../data/worldcupCategories";
import { uploadImage } from "../utils/image";
import { useSession } from "../hooks/useSession";

const MIN_ITEMS = 4;
let nextRowId = 0;

function emptyRow() {
  // itemId: 서버(worldcup_items)에 이미 저장된 후보면 그 id, 아직 임시저장 안 됐으면 null
  return { id: `row-${nextRowId++}`, file: null, preview: null, label: "", itemId: null };
}

export default function WorldCupSubmit() {
  const { user } = useSession();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(WORLDCUP_CATEGORIES[0]);
  const [rows, setRows] = useState(() => [emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState(null);

  // 임시저장 관련 상태
  const [worldcupId, setWorldcupId] = useState(null); // draft로 저장된 worldcups.id
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftResumed, setDraftResumed] = useState(false); // 기존 임시저장을 불러왔는지
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // 진입 시 이어서 쓸 임시저장이 있는지 확인해서 불러옴
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadDraft() {
      const { data: draft, error } = await supabase
        .from("worldcups")
        .select("*")
        .eq("creator_id", user.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("임시저장 불러오기 실패:", error);
        setDraftLoading(false);
        return;
      }
      if (!draft) {
        setDraftLoading(false);
        return;
      }

      const { data: items, error: itemErr } = await supabase
        .from("worldcup_items")
        .select("*")
        .eq("worldcup_id", draft.id)
        .order("created_at", { ascending: true });
      if (itemErr) console.error("임시저장 후보 불러오기 실패:", itemErr);

      if (cancelled) return;

      setWorldcupId(draft.id);
      setTitle(draft.title || "");
      setCategory(draft.category || WORLDCUP_CATEGORIES[0]);

      const loadedRows = (items || []).map((it) => ({
        id: `row-${nextRowId++}`,
        file: null,
        preview: it.image_url,
        label: it.label,
        itemId: it.id,
      }));
      while (loadedRows.length < MIN_ITEMS) loadedRows.push(emptyRow());

      setRows(loadedRows);
      setDraftResumed(true);
      setDraftLoading(false);
    }

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleFileChange = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateRow(id, { file, preview: URL.createObjectURL(file) });
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (id) => {
    setRows((prev) => {
      if (prev.length <= MIN_ITEMS) return prev;
      const target = prev.find((r) => r.id === id);
      // 이미 임시저장돼서 서버에 있는 후보면 서버에서도 지움 (실패해도 화면에서는 빼줌)
      if (target?.itemId) {
        supabase
          .from("worldcup_items")
          .delete()
          .eq("id", target.itemId)
          .then(({ error }) => {
            if (error) console.error("후보 삭제 실패:", error);
          });
      }
      return prev.filter((r) => r.id !== id);
    });
  };

  const validRows = rows.filter((r) => (r.file || r.itemId) && r.label.trim());

  // 지금까지 입력한 내용을 서버에 반영 (draft 없으면 새로 만들고, 있으면 갱신).
  // finalStatus가 'pending'이면 마지막에 상태를 pending으로 바꿔 제출 완료 처리.
  const persist = async (finalStatus) => {
    if (!title.trim()) {
      throw new Error("월드컵 이름을 입력해주세요.");
    }

    let wcId = worldcupId;
    if (!wcId) {
      const { data, error } = await supabase
        .from("worldcups")
        .insert({ category, title: title.trim(), creator_id: user.id, status: "draft" })
        .select()
        .single();
      if (error) throw error;
      wcId = data.id;
      setWorldcupId(wcId);
    } else {
      const { error } = await supabase
        .from("worldcups")
        .update({ category, title: title.trim() })
        .eq("id", wcId);
      if (error) throw error;
    }

    const rowsToSync = rows.filter((r) => r.label.trim() && (r.file || r.itemId));
    for (const row of rowsToSync) {
      if (row.file) {
        // 새로 고른 사진 - 업로드 후 후보로 추가
        const imageUrl = await uploadImage(supabase, row.file, "worldcup-images", "items");
        const { data, error } = await supabase
          .from("worldcup_items")
          .insert({ worldcup_id: wcId, label: row.label.trim(), image_url: imageUrl })
          .select()
          .single();
        if (error) throw error;
        updateRow(row.id, { file: null, preview: imageUrl, itemId: data.id });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } else if (row.itemId) {
        // 이미 저장된 후보 - 이름만 바뀌었을 수 있으니 갱신
        const { error } = await supabase
          .from("worldcup_items")
          .update({ label: row.label.trim() })
          .eq("id", row.itemId);
        if (error) throw error;
      }
    }

    if (finalStatus === "pending") {
      const finalCount = rows.filter((r) => r.label.trim() && (r.file || r.itemId)).length;
      if (finalCount < MIN_ITEMS) {
        throw new Error(`사진과 이름을 채운 후보가 최소 ${MIN_ITEMS}개는 필요해요. (현재 ${finalCount}개)`);
      }
      const { error } = await supabase.from("worldcups").update({ status: "pending" }).eq("id", wcId);
      if (error) throw error;
    }

    return wcId;
  };

  const handleSaveDraft = async () => {
    setErrorMsg(null);
    setSavingDraft(true);
    try {
      await persist("draft");
      setDraftSavedAt(Date.now());
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "임시저장 중 오류가 발생했어요.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!worldcupId) return;
    if (!window.confirm("임시저장된 내용을 지우고 새로 시작할까요?")) return;
    const { error } = await supabase.from("worldcups").delete().eq("id", worldcupId);
    if (error) {
      console.error("임시저장 삭제 실패:", error);
      setErrorMsg("임시저장 삭제 중 오류가 발생했어요.");
      return;
    }
    setWorldcupId(null);
    setDraftResumed(false);
    setDraftSavedAt(null);
    setTitle("");
    setCategory(WORLDCUP_CATEGORIES[0]);
    setRows([emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("월드컵 이름을 입력해주세요.");
      return;
    }
    if (validRows.length < MIN_ITEMS) {
      setErrorMsg(`사진과 이름을 채운 후보가 최소 ${MIN_ITEMS}개는 필요해요. (현재 ${validRows.length}개)`);
      return;
    }

    setStatus("uploading");
    setProgress({ done: 0, total: rows.filter((r) => r.file && r.label.trim()).length });

    try {
      await persist("pending");
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "업로드 중 오류가 발생했어요. 다시 시도해주세요.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="page page--submit">
        <div className="wc-submit__done">
          <div className="wc-submit__done-icon">🎉</div>
          <h2>월드컵 등록 요청 완료!</h2>
          <p>관리자 승인 후 게임 목록에 노출돼요. (승인되면 +10 XP)</p>
          <button className="deck-result__btn is-primary" onClick={() => navigate("/worldcup")}>
            월드컵 목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--submit">
      <h2>이상형 월드컵 만들기</h2>
      <p className="page__desc">
        사진 {MIN_ITEMS}장 이상 올려주세요. 큰 사진도 자동으로 줄여서 저장돼요. 등록 후 관리자 승인이
        필요해요.
      </p>

      {!draftLoading && draftResumed && (
        <div className="wc-draft-banner">
          <span>📝 이어서 작성 중인 임시저장이 있어요.</span>
          <button type="button" className="wc-draft-banner__reset" onClick={handleDiscardDraft}>
            지우고 새로 시작
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="submit-form">
        <label>
          월드컵 이름
          <input
            type="text"
            placeholder="예: 2026 이상형 애니 캐릭터 월드컵"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
          />
        </label>

        <label>
          카테고리
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {WORLDCUP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="wc-submit__rows">
          {rows.map((row, idx) => (
            <div className="wc-submit__row" key={row.id}>
              <div className="wc-submit__row-thumb">
                {row.preview ? <img src={row.preview} alt="" /> : <span>{idx + 1}</span>}
              </div>
              <div className="wc-submit__row-fields">
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(row.id, e)} />
                <input
                  type="text"
                  placeholder="이름 (예: 캐릭터 이름)"
                  value={row.label}
                  onChange={(e) => updateRow(row.id, { label: e.target.value })}
                  maxLength={30}
                />
              </div>
              {rows.length > MIN_ITEMS && (
                <button
                  type="button"
                  className="wc-submit__row-remove"
                  onClick={() => removeRow(row.id)}
                  aria-label="삭제"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="wc-submit__add-btn" onClick={addRow}>
          ➕ 후보 추가
        </button>

        {errorMsg && <p className="submit-form__error">{errorMsg}</p>}

        <div className="wc-submit__actions">
          <button
            type="button"
            className="wc-submit__draft-btn"
            onClick={handleSaveDraft}
            disabled={savingDraft || status === "uploading"}
          >
            {savingDraft ? "임시저장 중..." : "💾 임시저장"}
          </button>
          <button type="submit" disabled={status === "uploading"}>
            {status === "uploading"
              ? `업로드 중... (${progress.done}/${progress.total})`
              : "월드컵 등록 요청하기"}
          </button>
        </div>

        {draftSavedAt && (
          <p className="wc-submit__draft-saved">
            {new Date(draftSavedAt).toLocaleTimeString("ko-KR")} 기준으로 임시저장했어요.
          </p>
        )}
      </form>
    </div>
  );
}
