import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES } from "../data/categories";
import { useSession } from "../hooks/useSession";

export default function Submit() {
  const { user } = useSession();
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    question: "",
    optionA: "",
    optionB: "",
  });
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.optionA.trim() || !form.optionB.trim()) return;

    setStatus("submitting");
    const { error } = await supabase.from("questions").insert({
      category: form.category,
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
    setForm({ category: CATEGORIES[0], question: "", optionA: "", optionB: "" });
  };

  return (
    <div className="page page--submit">
      <h2>내 밸런스게임 문제 등록하기</h2>
      <p className="page__desc">등록한 문제는 관리자 승인 후 게임에 노출되고, 승인되면 +5 XP를 받아요.</p>

      <form onSubmit={handleSubmit} className="submit-form">
        <label>
          카테고리
          <select value={form.category} onChange={update("category")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

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
