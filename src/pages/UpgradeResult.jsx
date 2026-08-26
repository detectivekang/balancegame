import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// 토스 결제창이 successUrl로 돌려보내면 여기서 서버(confirm-payment 엣지함수)에
// 결제 승인을 요청해서 진짜 결제인지 검증한 뒤 프리미엄을 활성화함.
export function UpgradeSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("confirming"); // confirming | done | error

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = params.get("amount");

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      return;
    }

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("confirm-payment", {
        body: { paymentKey, orderId, amount: Number(amount) },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error || data?.error) {
        console.error(error || data.error);
        setStatus("error");
        return;
      }
      setStatus("done");
    })();
  }, [params]);

  return (
    <div className="page page--upgrade">
      <div className="upgrade-card">
        {status === "confirming" && <p>결제를 확인하고 있어요...</p>}
        {status === "done" && (
          <>
            <div className="upgrade-card__icon">🎉</div>
            <h2>무제한 이용권이 적용됐어요!</h2>
            <button className="upgrade-card__btn" onClick={() => navigate("/")}>
              홈으로 가기
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <div className="upgrade-card__icon">😢</div>
            <h2>결제 확인에 실패했어요</h2>
            <p>문제가 지속되면 문의해주세요.</p>
            <button className="upgrade-card__btn" onClick={() => navigate("/upgrade")}>
              다시 시도하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function UpgradeFail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (
    <div className="page page--upgrade">
      <div className="upgrade-card">
        <div className="upgrade-card__icon">😢</div>
        <h2>결제가 취소됐어요</h2>
        <p>{params.get("message") || "언제든 다시 시도할 수 있어요."}</p>
        <button className="upgrade-card__btn" onClick={() => navigate("/upgrade")}>
          다시 시도하기
        </button>
      </div>
    </div>
  );
}
