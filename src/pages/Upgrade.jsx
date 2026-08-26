import React, { useEffect, useRef, useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../hooks/useSession";

// ⚠️ 테스트용 공개 클라이언트 키 (토스페이먼츠 공식 문서에 배포된 샌드박스 키).
// 실서비스 전환 시 토스페이먼츠 가맹점 심사를 받고 발급받은 "라이브 클라이언트 키"로 교체하세요.
// (토스 개발자센터 > 내 개발정보 > API 키)
const TOSS_CLIENT_KEY = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";
const PLAN_AMOUNT = 4900;
const PLAN_LABEL = "무제한 이용권 (30일)";

export default function Upgrade() {
  const { user, player } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (player?.isPremium) return;
    loadTossPayments(TOSS_CLIENT_KEY).then((tossPayments) => {
      widgetRef.current = tossPayments;
    });
  }, [player?.isPremium]);

  const handlePay = async () => {
    if (!widgetRef.current || loading) return;
    setLoading(true);
    setError(null);

    const orderId = `order_${user.id.slice(0, 8)}_${Date.now()}`;

    // 결제 시작 전에 "결제 대기중" 주문을 우리 DB에 먼저 남겨서
    // 나중에 confirm-payment 함수가 위변조 없이 검증할 수 있게 함.
    const { error: insertError } = await supabase.from("payments").insert({
      user_id: user.id,
      order_id: orderId,
      amount: PLAN_AMOUNT,
      plan: "unlimited_monthly",
      status: "pending",
    });

    if (insertError) {
      console.error(insertError);
      setError("결제 준비 중 오류가 발생했습니다.");
      setLoading(false);
      return;
    }

    try {
      await widgetRef.current.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: PLAN_AMOUNT },
        orderId,
        orderName: PLAN_LABEL,
        successUrl: `${window.location.origin}${window.location.pathname}#/upgrade/success`,
        failUrl: `${window.location.origin}${window.location.pathname}#/upgrade/fail`,
        customerEmail: user.email,
      });
      // 성공/실패는 successUrl/failUrl로 리다이렉트되면서 처리되므로 여기 이후 코드는 보통 실행 안 됨
    } catch (err) {
      console.error(err);
      if (err?.code !== "USER_CANCEL") {
        setError("결제 진행 중 오류가 발생했습니다.");
      }
      setLoading(false);
    }
  };

  if (player?.isPremium) {
    return (
      <div className="page page--upgrade">
        <div className="upgrade-card">
          <div className="upgrade-card__icon">👑</div>
          <h2>이미 무제한 이용권을 이용 중이에요!</h2>
          <p>에너지 걱정 없이 마음껏 즐겨주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--upgrade">
      <div className="upgrade-card">
        <div className="upgrade-card__icon">👑</div>
        <h2>무제한 이용권</h2>
        <p className="upgrade-card__price">
          월 <b>{PLAN_AMOUNT.toLocaleString()}원</b>
        </p>
        <ul className="upgrade-card__benefits">
          <li>⚡ 에너지 걱정 없이 무제한 플레이</li>
          <li>🚫 광고 시청 없이 바로 충전</li>
          <li>👑 프로필에 프리미엄 뱃지 표시</li>
        </ul>
        {error && <p className="upgrade-card__error">⚠️ {error}</p>}
        <button className="upgrade-card__btn" onClick={handlePay} disabled={loading}>
          {loading ? "결제 준비 중..." : `${PLAN_AMOUNT.toLocaleString()}원 결제하기`}
        </button>
        <p className="upgrade-card__note">
          결제는 토스페이먼츠를 통해 안전하게 처리돼요. (현재 테스트 결제 모드)
        </p>
      </div>
    </div>
  );
}
