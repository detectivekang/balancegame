import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES } from "../data/categories";
import { useSession } from "../hooks/useSession";
import { uploadCoverImage } from "../utils/image";

const NEW_SET_VALUE = "__new__";

export default function Submit() {
  const { user } = useSession();
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    setId: "",
    newSetTitle: "",
    question: "",
    optionA: "",
    optionB: "",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [sets, setSets] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("question_sets")
      .select("id, category, title")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // question_sets 테이블이 없는(마이그레이션 전) 프로젝트에서도 폼이 동작하도록 조용히 무시
          setSets([]);
          return;
        }
        setSets(data || []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setsForCategory = useMemo(
    () => sets.filter((s) => s.category === form.category),
    [sets, form.category]
  );

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const updateCategory = (e) => {
    setForm((f) => ({ ...f, category: e.target.value, setId: "" }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.optionA.trim() || !form.optionB.trim()) return;
    if (form.setId === NEW_SET_VALUE && !form.newSetTitle.trim()) return;

    setStatus("submitting");

    let setId = form.setId && form.setId !== NEW_SET_VALUE ? form.setId : null;

    // 새 문제집을 만들기로 했다면 먼저 문제집부터 생성
    if (form.setId === NEW_SET_VALUE) {
      let coverUrl = null;
      if (coverFile) {
        try {
          coverUrl = await uploadCoverImage(supabase, coverFile);
        } catch (err) {
          console.error("커버 사진 업로드 실패:", err);
          // 사진 업로드가 실패해도 문제집 생성 자체는 계속 진행
        }
      }

      const { data: newSet, error: setError } = await supabase
        .from("question_sets")
        .insert({
          category: form.category,
          title: form.newSetTitle.trim(),
          creator_id: user.id,
          cover_image_url: coverUrl,
        })
        .select()
        .single();

      if (setError) {
        console.error(setError);
        setStatus("error");
        return;
      }
      setId = newSet.id;
      setSets((prev) => [...prev, newSet]);
    }

    const { error } = await supabase.from("questions").insert({
      category: form.category,
      set_id: setId,
      question: form.question.trim(),
      option_a: form.optionA.trim(),
      option_b: form.optionB.trim(),
      votes_a: 0,
      votes_b: 0,
      source: "user",
      submitter_id: user.id,
      status: "pending", // 관리자 승인 대기
    });

    if (error) {
      console.error(error);
      setStatus("error");
      return;
    }

    setStatus("done");
    setCoverFile(null);
    setCoverPreview(null);
    setForm((f) => ({ ...f, setId: "", newSetTitle: "", question: "", optionA: "", optionB: "" }));
  };

  return (
    <div className="page page--submit">
      <h2>내 밸런스게임 문제 등록하기</h2>
      <p className="page__desc">등록한 문제는 관리자 승인 후 게임에 노출되고, 승인되면 +5 XP를 받아요.</p>

      <form onSubmit={handleSubmit} className="submit-form">
        <label>
          카테고리
          <select value={form.category} onChange={updateCategory}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          문제집
          <select value={form.setId} onChange={update("setId")}>
            <option value="">문제집 선택 안 함</option>
            {setsForCategory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            <option value={NEW_SET_VALUE}>➕ 새 문제집 만들기</option>
          </select>
        </label>

        {form.setId === NEW_SET_VALUE && (
          <>
            <label>
              새 문제집 이름
              <input
                type="text"
                placeholder="예: 편의점 vs 배달음식"
                value={form.newSetTitle}
                onChange={update("newSetTitle")}
                maxLength={40}
                required
              />
            </label>

            <label>
              커버 사진 (선택, 큰 사진도 자동으로 줄여서 저장돼요)
              <input type="file" accept="image/*" onChange={handleCoverChange} />
            </label>

            {coverPreview && (
              <div className="submit-form__cover-preview">
                <img src={coverPreview} alt="커버 사진 미리보기" />
              </div>
            )}
          </>
        )}

        <label>
          질문
          <input
            type="text"
            placeholder="예: 평생 여름만 있는 나라 vs 평생 겨울만 있는 나라"
            value={form.question}
            onChange={update("question")}
            required
          />
        </label>

        <label>
          선택지 A
          <input type="text" value={form.optionA} onChange={update("optionA")} required />
        </label>

        <label>
          선택지 B
          <input type="text" value={form.optionB} onChange={update("optionB")} required />
        </label>

        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "등록 중..." : "등록 요청하기"}
        </button>

        {status === "done" && <p className="submit-form__success">등록 요청이 접수되었습니다!</p>}
        {status === "error" && <p className="submit-form__error">등록에 실패했습니다. 다시 시도해주세요.</p>}
      </form>
    </div>
  );
}
