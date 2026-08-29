// Supabase Edge Function: notify-worldcup-approved
//
// 관리자가 월드컵을 승인(approve_worldcup RPC)한 직후, AdminWorldcups.jsx가
// 이 함수를 호출해서 "월드컵 만든 사람"에게 푸시 알림을 보냄.
// 요청자가 진짜 관리자인지 매번 다시 확인함 (approve_worldcup과 동일한 검증) -
// 그래야 아무나 이 함수를 호출해서 남한테 알림을 스팸으로 못 보냄.
//
// 배포: supabase functions deploy notify-worldcup-approved
// 프론트 호출 예시:
//   supabase.functions.invoke('notify-worldcup-approved', { body: { worldcup_id } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendPushToUsers } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401 });
    }

    // 호출자가 관리자인지 확인 (SQL의 is_admin()과 완전히 동일한 판정 로직을
    // 그대로 RPC로 호출 - 관리자 이메일을 이 함수 안에 새로 하드코딩하지 않기 위함)
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403 });
    }

    const { worldcup_id } = await req.json();
    if (!worldcup_id) {
      return new Response(JSON.stringify({ error: "missing worldcup_id" }), { status: 400 });
    }

    const { data: wc } = await admin
      .from("worldcups")
      .select("id, title, creator_id, status")
      .eq("id", worldcup_id)
      .maybeSingle();

    if (!wc || wc.status !== "approved" || !wc.creator_id) {
      // 승인 상태가 아니거나(레이스 컨디션) 만든 사람이 없으면 조용히 종료
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const result = await sendPushToUsers(admin, [wc.creator_id], {
      title: "🏆 월드컵이 승인됐어요!",
      body: `"${wc.title}"이(가) 이제 모두에게 보여요. (+10 XP)`,
      url: "/#/mypage",
    });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
