import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES } from "../data/categories";
import { uploadCoverImage } from "../utils/image";

export default function AdminSets() {
  const [sets, setSets] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    title: "",
    emoji: "🎯",
    minLevel: 1,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [replacingId, setReplacingId] = useState(null);
  const replaceInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const { data: setData, error: setErr } = await supabase
      .from("question_sets")
      .select("*")
      .order("created_at", { ascending: false });
    if (setErr) {
      console.error(setErr);
      setSets([]);
      setLoading(false);
      return;
    }
    setSets(setData || []);

    const { data: qData } = await supabase.from("questions").select("set_id");
    const map = {};
    (qData || []).forEach((q) => {
      if (q.set_id) map[q.set_id] = (map[q.set_id] || 0) + 1;
    });
    setCounts(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCoverFile(null);
      setCoverPreview(null);
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const createSet = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);

    let coverUrl = null;
    if (coverFile) {
      try {
        coverUrl = await uploadCoverImage(supabase, coverFile);
      } catch (err) {
        console.error("커버 사진 업로드 실패:", err);
      }
    }

    const { error } = await supabase.from("question_sets").insert({
      category: form.category,
      title: form.title.trim(),
      emoji: form.emoji || "🎯",
      cover_image_url: coverUrl,
      min_level: Number(form.minLevel) || 1,
    });
    setCreating(false);
    if (error) {
      console.error(error);
      return;
    }
    setForm((f) => ({ ...f, title: "", minLevel: 1 }));
    setCoverFile(null);
    setCoverPreview(null);
    load();
  };

  const removeSet = async (id) => {
    const { error } = await supabase
      .from("question_sets")
      .delete()
      .eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    setSets((prev) => prev.filter((s) => s.id !== id));
  };

  const startReplaceCover = (id) => {
    setReplacingId(id);
    // state 반영 후 같은 틱에 클릭하면 ref가 아직 안 잡혀있을 수 있어 다음 프레임에 실행
    requestAnimationFrame(() => replaceInputRef.current?.click());
  };

  const handleReplaceCover = async (e) => {
    const file = e.target.files?.[0];
    const id = replacingId;
    e.target.value = "";
    if (!file || !id) return;

    try {
      const coverUrl = await uploadCoverImage(supabase, file);
      const { error } = await supabase
        .from("question_sets")
        .update({ cover_image_url: coverUrl })
        .eq("id", id);
      if (error) throw error;
      setSets((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, cover_image_url: coverUrl } : s,
        ),
      );
    } catch (err) {
      console.error("커버 사진 교체 실패:", err);
    } finally {
      setReplacingId(null);
    }
  };

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div className="admin-sets">
      <input
        type="file"
        accept="image/*"
        ref={replaceInputRef}
        style={{ display: "none" }}
        onChange={handleReplaceCover}
      />

      <form onSubmit={createSet} className="admin-sets__form">
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="이모지"
          value={form.emoji}
          maxLength={4}
          onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
          style={{ width: 56 }}
        />
        <input
          type="text"
          placeholder="새 문제집 이름"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <label className="admin-sets__cover-label">
          최소 레벨
          <input
            type="number"
            min={1}
            max={30}
            value={form.minLevel}
            onChange={(e) =>
              setForm((f) => ({ ...f, minLevel: e.target.value }))
            }
            style={{ width: 64 }}
          />
        </label>
        <label className="admin-sets__cover-label">
          커버 사진
          <input type="file" accept="image/*" onChange={handleCoverChange} />
        </label>
        <button type="submit" disabled={creating}>
          {creating ? "추가 중..." : "추가"}
        </button>
      </form>

      {coverPreview && (
        <div className="admin-sets__cover-preview">
          <img src={coverPreview} alt="커버 사진 미리보기" />
        </div>
      )}

      {sets.length === 0 && (
        <p>
          등록된 문제집이 없습니다. (question_sets 마이그레이션을 먼저
          실행하세요)
        </p>
      )}

      <div className="admin-sets__list">
        {sets.map((s) => (
          <div key={s.id} className="admin-sets__item">
            {s.cover_image_url ? (
              <img
                className="admin-sets__thumb"
                src={s.cover_image_url}
                alt=""
              />
            ) : (
              <span className="admin-sets__emoji">{s.emoji}</span>
            )}
            <div className="admin-sets__info">
              <div className="admin-sets__title">{s.title}</div>
              <div className="admin-sets__meta">
                {s.category} · 문제 {counts[s.id] || 0}개
                {s.min_level > 1 ? ` · Lv.${s.min_level} 이상` : ""}
              </div>
            </div>
            <button
              onClick={() => startReplaceCover(s.id)}
              className="admin-sets__replace-btn"
            >
              사진 변경
            </button>
            <button onClick={() => removeSet(s.id)} className="is-danger">
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
