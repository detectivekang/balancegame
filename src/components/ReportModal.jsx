import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";

const REASONS = ["부적절한 이미지/음란물", "저작권 침해", "폭력적/혐오 콘텐츠", "스팸/광고", "기타"];

// target: { type: 'question'|'question_set'|'worldcup'|'worldcup_item', id, label, imageUrl? }
export default function ReportModal({ target, onClose }) {
  const { user } = useSession();
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");

    const { error } = await supabase.from("reports").insert({
      target_type: target.type,
      target_id: target.id,
      target_label: target.label || null,
      target_image_url: target.imageUrl || null,
      reporter_id: user.id,
      reason,
      detail: detail.trim() || null,
    });

    if (error) {
      console.error("신고 접수 실패:", error);
      setStatus("error");
      return;
    }
    setStatus("done");
  };

  return (
    <div className="report-modal__backdrop" onClick={onClose}>
      <div className="report-modal__card" onClick={(e) => e.stopPropagation()}>
        {status === "done" ? (
          <>
            <div className="report-modal__icon">✅</div>
            <h3>신고가 접수됐어요</h3>
            <p>확인 후 조치할게요. 신고해주셔서 감사해요.</p>
            <button className="report-modal__submit" onClick={onClose}>
              닫기
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3>🚩 신고하기</h3>
            {target.label && <p className="report-modal__target">"{target.label}"</p>}

            <label className="report-modal__label">사유</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="report-modal__select">
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label className="report-modal__label">자세한 설명 (선택)</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="상황을 알려주시면 검토에 도움이 돼요"
              rows={3}
            />

            {status === "error" && <p className="balance-card__error">⚠️ 신고 접수에 실패했어요. 다시 시도해주세요.</p>}

            <div className="report-modal__actions">
              <button type="button" className="report-modal__cancel" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="report-modal__submit" disabled={status === "submitting"}>
                {status === "submitting" ? "접수 중..." : "신고 접수"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
