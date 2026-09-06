import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { uploadImage } from "../utils/image";
import { WORLDCUP_CATEGORIES } from "../data/worldcupCategories";

const BUCKET = "worldcup-images";

// getPublicUrl로 만들어진 URL에서 스토리지 버킷 내부 경로만 추출.
// 예: https://xxx.supabase.co/storage/v1/object/public/worldcup-images/items/abc.jpg
//     -> items/abc.jpg
function storagePathFromUrl(url) {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export default function AdminWorldcupEdit() {
  const [worldcups, setWorldcups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [savingItemId, setSavingItemId] = useState(null);
  const [msg, setMsg] = useState("");

  // 새 후보 추가용 입력 상태
  const [newLabel, setNewLabel] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [newPreview, setNewPreview] = useState(null);
  const [adding, setAdding] = useState(false);

  const loadWorldcups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("worldcups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setWorldcups(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadWorldcups();
  }, []);

  const loadItems = async (worldcupId) => {
    setItemsLoading(true);
    const { data, error } = await supabase
      .from("worldcup_items")
      .select("*")
      .eq("worldcup_id", worldcupId)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    setItems(data || []);
    setItemsLoading(false);
  };

  const selectWorldcup = (wc) => {
    setSelectedId(wc.id);
    setMsg("");
    loadItems(wc.id);
  };

  const selected = worldcups.find((w) => w.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return worldcups;
    return worldcups.filter(
      (w) => w.title.toLowerCase().includes(q) || w.category.toLowerCase().includes(q)
    );
  }, [worldcups, search]);

  // --- 후보 이름 수정 ---
  const updateLabel = async (item, label) => {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, label } : it)));
  };

  const saveLabel = async (item) => {
    setSavingItemId(item.id);
    const { error } = await supabase
      .from("worldcup_items")
      .update({ label: item.label.trim() })
      .eq("id", item.id);
    setSavingItemId(null);
    if (error) {
      console.error(error);
      setMsg("이름 저장에 실패했어요.");
      return;
    }
    setMsg(`"${item.label}" 이름을 저장했어요.`);
  };

  // --- 후보 사진 교체 ---
  const replaceImage = async (item, file) => {
    if (!file) return;
    setSavingItemId(item.id);
    setMsg("");
    try {
      const newUrl = await uploadImage(supabase, file, BUCKET, "items");

      const { error } = await supabase
        .from("worldcup_items")
        .update({ image_url: newUrl })
        .eq("id", item.id);
      if (error) throw error;

      // 기존 이미지 파일 삭제는 실패해도 무시 (용량 정리 목적일 뿐, 핵심 기능 아님)
      const oldPath = storagePathFromUrl(item.image_url);
      if (oldPath) {
        supabase.storage
          .from(BUCKET)
          .remove([oldPath])
          .catch(() => {});
      }

      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, image_url: newUrl } : it)));
      setMsg(`"${item.label}" 사진을 교체했어요.`);
    } catch (err) {
      console.error(err);
      setMsg("사진 교체에 실패했어요.");
    } finally {
      setSavingItemId(null);
    }
  };

  // --- 후보 삭제 ---
  const deleteItem = async (item) => {
    if (!window.confirm(`"${item.label}" 후보를 삭제할까요?`)) return;
    setSavingItemId(item.id);
    const { error } = await supabase.from("worldcup_items").delete().eq("id", item.id);
    setSavingItemId(null);
    if (error) {
      console.error(error);
      setMsg("삭제에 실패했어요.");
      return;
    }
    const oldPath = storagePathFromUrl(item.image_url);
    if (oldPath) {
      supabase.storage
        .from(BUCKET)
        .remove([oldPath])
        .catch(() => {});
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setMsg("후보를 삭제했어요.");
  };

  // --- 새 후보 추가 ---
  const handleNewFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setNewPreview(URL.createObjectURL(file));
  };

  const addItem = async () => {
    if (!selected) return;
    if (!newFile || !newLabel.trim()) {
      setMsg("사진과 이름을 모두 입력해주세요.");
      return;
    }
    setAdding(true);
    setMsg("");
    try {
      const imageUrl = await uploadImage(supabase, newFile, BUCKET, "items");
      const { data, error } = await supabase
        .from("worldcup_items")
        .insert({ worldcup_id: selected.id, label: newLabel.trim(), image_url: imageUrl })
        .select()
        .single();
      if (error) throw error;

      setItems((prev) => [...prev, data]);
      setNewLabel("");
      setNewFile(null);
      setNewPreview(null);
      setMsg(`"${data.label}" 후보를 추가했어요.`);
    } catch (err) {
      console.error(err);
      setMsg("후보 추가에 실패했어요.");
    } finally {
      setAdding(false);
    }
  };

  // --- 월드컵 제목/카테고리 수정 ---
  const updateWorldcupField = (field, value) => {
    setWorldcups((prev) => prev.map((w) => (w.id === selectedId ? { ...w, [field]: value } : w)));
  };

  const saveWorldcupMeta = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("worldcups")
      .update({ title: selected.title.trim(), category: selected.category })
      .eq("id", selected.id);
    if (error) {
      console.error(error);
      setMsg("월드컵 정보 저장에 실패했어요.");
      return;
    }
    setMsg("월드컵 정보를 저장했어요.");
  };

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div className="admin-wc-edit" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      {/* 왼쪽: 월드컵 목록 */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <input
          type="text"
          placeholder="제목/카테고리 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: "6px 8px" }}
        />
        <div style={{ maxHeight: 560, overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
          {filtered.length === 0 && <p style={{ padding: 12, fontSize: 13, color: "#999" }}>월드컵이 없어요.</p>}
          {filtered.map((wc) => (
            <button
              key={wc.id}
              onClick={() => selectWorldcup(wc)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderBottom: "1px solid #f2f2f2",
                background: selectedId === wc.id ? "#f3f0ff" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{wc.title}</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {wc.category} · {wc.status === "approved" ? "승인됨" : "대기중"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽: 선택된 월드컵 상세 편집 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected && <p style={{ color: "#999" }}>왼쪽에서 수정할 월드컵을 선택해주세요.</p>}

        {selected && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input
                type="text"
                value={selected.title}
                onChange={(e) => updateWorldcupField("title", e.target.value)}
                maxLength={40}
                style={{ flex: 1, minWidth: 200, padding: "6px 8px", fontWeight: 700 }}
              />
              <select
                value={selected.category}
                onChange={(e) => updateWorldcupField("category", e.target.value)}
                style={{ padding: "6px 8px" }}
              >
                {WORLDCUP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button onClick={saveWorldcupMeta}>제목/카테고리 저장</button>
            </div>

            {msg && (
              <p style={{ fontSize: 13, color: "#6c5ce7", marginBottom: 12 }}>{msg}</p>
            )}

            {itemsLoading ? (
              <p>후보 불러오는 중...</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 14,
                }}
              >
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 10,
                      opacity: savingItemId === item.id ? 0.6 : 1,
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.label}
                      style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                    />
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateLabel(item, e.target.value)}
                      onBlur={() => saveLabel(item)}
                      maxLength={30}
                      style={{ width: "100%", marginBottom: 6, padding: "4px 6px", fontSize: 13 }}
                    />
                    <label
                      style={{
                        display: "block",
                        textAlign: "center",
                        fontSize: 12,
                        padding: "5px 0",
                        marginBottom: 6,
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      📷 사진 교체
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={savingItemId === item.id}
                        onChange={(e) => replaceImage(item, e.target.files?.[0])}
                      />
                    </label>
                    <button
                      onClick={() => deleteItem(item)}
                      disabled={savingItemId === item.id}
                      style={{ width: "100%", fontSize: 12, color: "#e74c3c" }}
                    >
                      삭제
                    </button>
                  </div>
                ))}

                {/* 새 후보 추가 카드 */}
                <div style={{ border: "1px dashed #ccc", borderRadius: 10, padding: 10 }}>
                  {newPreview ? (
                    <img
                      src={newPreview}
                      alt=""
                      style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 8,
                        marginBottom: 8,
                        background: "#fafafa",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#bbb",
                        fontSize: 12,
                      }}
                    >
                      새 후보 사진
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="이름"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    maxLength={30}
                    style={{ width: "100%", marginBottom: 6, padding: "4px 6px", fontSize: 13 }}
                  />
                  <label
                    style={{
                      display: "block",
                      textAlign: "center",
                      fontSize: 12,
                      padding: "5px 0",
                      marginBottom: 6,
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    📷 사진 선택
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleNewFileChange} />
                  </label>
                  <button onClick={addItem} disabled={adding} style={{ width: "100%", fontSize: 12 }}>
                    {adding ? "추가 중..." : "➕ 후보 추가"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
