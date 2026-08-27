import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { WORLDCUP_CATEGORIES } from "../data/worldcupCategories";
import { uploadImage } from "../utils/image";
import { useSession } from "../hooks/useSession";

const MIN_ITEMS = 4;
let nextRowId = 0;

function emptyRow() {
  return { id: `row-${nextRowId++}`, file: null, preview: null, label: "" };
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

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleFileChange = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateRow(id, { file, preview: URL.createObjectURL(file) });
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id) => setRows((prev) => (prev.length <= MIN_ITEMS ? prev : prev.filter((r) => r.id !== id)));

  const validRows = rows.filter((r) => r.file && r.label.trim());

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
    setProgress({ done: 0, total: validRows.length });

    try {
      const { data: worldcup, error: wcError } = await supabase
        .from("worldcups")
        .insert({ category, title: title.trim(), creator_id: user.id })
        .select()
        .single();
      if (wcError) throw wcError;

      for (const row of validRows) {
        const imageUrl = await uploadImage(supabase, row.file, "worldcup-images", "items");
        const { error: itemError } = await supabase.from("worldcup_items").insert({
          worldcup_id: worldcup.id,
          label: row.label.trim(),
          image_url: imageUrl,
        });
        if (itemError) throw itemError;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("업로드 중 오류가 발생했어요. 다시 시도해주세요.");
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

        <button type="submit" disabled={status === "uploading"}>
          {status === "uploading"
            ? `업로드 중... (${progress.done}/${progress.total})`
            : "월드컵 등록 요청하기"}
        </button>
      </form>
    </div>
  );
}
