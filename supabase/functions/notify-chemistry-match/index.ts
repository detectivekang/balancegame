// Supabase Edge Function: notify-chemistry-match
//
// 친구가 궁합 테스트에 참여해서 "상세 결과 보기"까지 열람하면(=chemistry_matches
// row가 생기면), ChemistryPage.jsx가 이 함수를 호출해서 "초대한 사람"에게
// 푸시 알림을 보냄.
//
// 악용 방지: 아무 user_id에나 알림을 보낼 수 없도록, 호출자 본인이 실제로
// 해당 chemistry_result_id에 대한 chemistry_matches 응답을 남긴 게 맞는지
// (respondent_user_id = 호출자) 먼저 확인한 다음에만 초대자에게 알림을 보냄.
//
// 배포: supabase functions deploy notify-chemistry-match
// 프론트 호출 예시:
//   supabase.functions.invoke('notify-chemistry-match', { body: { chemistry_result_id } })

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
    const respondentId = userData.user.id;

    const { chemistry_result_id } = await req.json();
    if (!chemistry_result_id) {
      return new Response(JSON.stringify({ error: "missing chemistry_result_id" }), { status: 400 });
    }

    // 호출자 본인이 실제로 이 궁합 테스트에 응답을 남겼는지 확인 (RLS로 본인 것만 보임)
    const { data: match } = await caller
      .from("chemistry_matches")
      .select("id, percent, respondent_nickname")
      .eq("chemistry_result_id", chemistry_result_id)
      .eq("respondent_user_id", respondentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!match) {
      return new Response(JSON.stringify({ error: "no matching response found" }), { status: 403 });
    }

    // 초대장을 만든 사람(알림 받을 대상)을 조회 - 이 테이블은 링크만 있으면 누구나 조회 가능하므로 admin/caller 둘 다 가능
    const { data: invite } = await admin
      .from("chemistry_results")
      .select("user_id, nickname_snapshot")
      .eq("id", chemistry_result_id)
      .maybeSingle();

    if (!invite?.user_id) {
      // 초대자가 비로그인 상태로 만든 링크였다면(user_id 없음) 알림 보낼 대상이 없음
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const result = await sendPushToUsers(admin, [invite.user_id], {
      title: "💘 궁합 테스트에 친구가 참여했어요!",
      body: `${match.respondent_nickname || "친구"}님과 궁합 ${match.percent}% - 마이페이지에서 확인해보세요.`,
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
