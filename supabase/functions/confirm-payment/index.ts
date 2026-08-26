// Supabase Edge Function: confirm-payment
//
// 토스페이먼츠 결제창에서 결제가 끝나면 프론트가 이 함수를 호출합니다.
// 여기서 "결제 승인(confirm)"을 토스 서버에 직접 요청해서 진짜 결제가 됐는지
// 서버 대 서버로 검증한 다음에만 profiles.is_premium을 true로 바꿉니다.
// (클라이언트에서 바로 is_premium을 업데이트하게 하면 누구나 조작할 수 있어서 절대 안 됨)
//
// 배포 방법 (Supabase CLI 설치 후):
//   1) supabase functions deploy confirm-payment
//   2) supabase secrets set TOSS_SECRET_KEY=발급받은_시크릿키
//      (테스트 키: test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R - 실 서비스 전엔 반드시 실키로 교체)
//   3) SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입해줌
//
// 프론트에서 호출 예시:
//   const { data, error } = await supabase.functions.invoke('confirm-payment', {
//     body: { paymentKey, orderId, amount }
//   });

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY") ?? "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";
const PLAN_AMOUNT = 4900; // 무제한 이용권 월 구독가 - 실제 가격 정책에 맞게 조정
const PLAN_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 요청자 신원 확인 (프론트에서 로그인 세션의 access token을 Authorization 헤더로 보내야 함)
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401 });
    }
    const userId = userData.user.id;

    const { paymentKey, orderId, amount } = await req.json();
    if (!paymentKey || !orderId || !amount) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
    }

    // 금액 위변조 방지: 서버가 알고 있는 실제 상품 가격과 다르면 거절
    if (Number(amount) !== PLAN_AMOUNT) {
      return new Response(JSON.stringify({ error: "amount mismatch" }), { status: 400 });
    }

    // 주문 row가 이 유저 소유인지 확인
    const { data: order } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ error: "order not found" }), { status: 404 });
    }
    if (order.status === "paid") {
      return new Response(JSON.stringify({ ok: true, alreadyPaid: true }), { status: 200 });
    }

    // 토스페이먼츠 결제 승인 API 호출 (서버-서버, 시크릿 키는 절대 프론트에 노출 금지)
    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(TOSS_SECRET_KEY + ":")}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      await supabase.from("payments").update({ status: "failed" }).eq("order_id", orderId);
      return new Response(JSON.stringify({ error: tossData.message || "toss confirm failed" }), {
        status: 400,
      });
    }

    const premiumUntil = new Date(Date.now() + PLAN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("payments")
      .update({ status: "paid", toss_payment_key: paymentKey, paid_at: new Date().toISOString() })
      .eq("order_id", orderId);

    await supabase
      .from("profiles")
      .update({ is_premium: true, premium_until: premiumUntil })
      .eq("id", userId);

    return new Response(JSON.stringify({ ok: true, premiumUntil }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
