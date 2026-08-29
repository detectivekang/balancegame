// Supabase Edge Function: notify-full-energy
//
// 사람이 호출하는 함수가 아니라 "스케줄러(cron)"가 5~10분마다 자동으로
// 호출하는 함수. 에너지가 방금 꽉 찬 유저들을 찾아서 "놀러오세요" 푸시를 보냄.
//
// 배포:
//   supabase functions deploy notify-full-energy
//   supabase secrets set CRON_SECRET=아무_긴_랜덤문자열
//
// 스케줄 등록 (Supabase 대시보드 > Edge Functions > notify-full-energy > Cron 탭에서
// 아래처럼 5분마다 실행되게 등록하고, 요청 헤더에 x-cron-secret: 위에서 정한 값을 추가):
//   */5 * * * *
//
// (크론 UI가 헤더 설정을 지원 안 하는 플랜/버전이면, 대신 pg_cron + pg_net으로
//  DB에서 직접 이 함수 URL을 호출하도록 등록해도 됨 - 이 경우도 URL에
//  ?secret=... 형태로 CRON_SECRET을 실어 보내면 됨)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendPushToUsers } from "../_shared/push.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req) => {
  // 아무나 이 URL을 알아내서 무한 호출하면 안 되니, 정해진 비밀값이 있을 때만 실행
  const url = new URL(req.url);
  const provided = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret") ?? "";
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: candidates, error } = await admin.rpc("full_energy_candidates");
    if (error) throw error;
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), { status: 200 });
    }

    const userIds = candidates.map((c: { user_id: string }) => c.user_id);

    const result = await sendPushToUsers(admin, userIds, {
      title: "⚡ 에너지가 다 찼어요!",
      body: "지금 밸런스게임이나 이상형 월드컵 하러 가볼까요?",
      url: "/",
    });

    // 보냈든 못 보냈든(구독이 아예 없는 유저 포함) 다시 알림 대상에서 빼서
    // 매 5분마다 계속 재시도하지 않게 함
    await admin.rpc("mark_energy_notified", { p_user_ids: userIds });

    return new Response(JSON.stringify({ ok: true, candidates: userIds.length, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
