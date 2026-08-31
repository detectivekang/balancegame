// Supabase Edge Function: share-preview
//
// 카카오톡/문자 등에 링크를 공유했을 때 "실제 결과 이미지"가 미리보기로 뜨게 하는 함수.
//
// 왜 필요한가: 이 앱은 GitHub Pages에 올라간 순수 프론트엔드(SPA)라서, 카카오톡의
// 링크 미리보기 봇이 어떤 결과 링크를 방문하든 항상 똑같은 index.html(정적 스크린샷)만
// 보게 됨. 봇은 자바스크립트를 실행하지 않아서, React가 나중에 그려주는 진짜 결과
// 이미지를 볼 방법이 없음.
//
// 이 함수가 하는 일: 카카오봇이 이 링크를 열면 -> DB에서 그 결과(우승 이미지, 문제집명
// 등)를 조회해서 <meta property="og:image">에 실제 이미지를 박은 HTML을 즉시 응답함.
// 반면 실제 사람이 클릭하면 -> 스크립트/메타리프레시로 원래 앱의 결과 카드 페이지로
// 자동 이동시킴.
//
// 배포 방법 (Supabase CLI 설치 후):
//   supabase functions deploy share-preview --no-verify-jwt
//   (--no-verify-jwt 필수: 카카오봇은 로그인 토큰 없이 접속하므로)
//
// 프론트에서 쓸 URL 형식:
//   https://<프로젝트ref>.supabase.co/functions/v1/share-preview?type=worldcup&id=<resultId>
//   https://<프로젝트ref>.supabase.co/functions/v1/share-preview?type=balance&id=<resultId>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
// 배포된 GitHub Pages 주소. 저장소/도메인이 바뀌면 이 값도 바꿔주세요.
const SITE_URL = "https://detectivekang.github.io/balancegame";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`; // 없으면 카카오 기본 스크린샷으로 대체됨

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderHtml({ title, description, image, redirectUrl }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeRedirect = escapeHtml(redirectUrl);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:image" content="${safeImage}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0;url=${safeRedirect}" />
</head>
<body>
<p>이동 중입니다... <a href="${safeRedirect}">여기를 눌러주세요</a></p>
<script>location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

function fallbackResponse(redirectUrl = SITE_URL) {
  return new Response(
    renderHtml({
      title: "밸런스게임",
      description: "친구랑 궁합도 재고, 이상형 월드컵도 열어보세요. 회원가입 없이 바로 시작!",
      image: DEFAULT_IMAGE,
      redirectUrl,
    }),
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type"); // "worldcup" | "balance"

  if (!id || !type) return fallbackResponse();

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  if (type === "worldcup") {
    const { data, error } = await supabase
      .from("worldcup_results")
      .select("round_size, sharer_nickname_snapshot, worldcup:worldcups(title), item:worldcup_items(label, image_url)")
      .eq("id", id)
      .maybeSingle();

    const redirectUrl = `${SITE_URL}/#/worldcup/result/${id}`;
    if (error || !data || !data.worldcup || !data.item) return fallbackResponse(redirectUrl);

    const nickname = data.sharer_nickname_snapshot || "친구";
    return new Response(
      renderHtml({
        title: `${nickname}님의 최종 선택: ${data.item.label}`,
        description: `"${data.worldcup.title}" ${data.round_size}강 이상형 월드컵 결과 - 너도 도전해보세요!`,
        image: data.item.image_url,
        redirectUrl,
      }),
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  if (type === "balance") {
    const { data, error } = await supabase
      .from("balance_results")
      .select("deck_title, sharer_nickname_snapshot, persona_label, persona_desc")
      .eq("id", id)
      .maybeSingle();

    const redirectUrl = `${SITE_URL}/#/result/${id}`;
    if (error || !data) return fallbackResponse(redirectUrl);

    const nickname = data.sharer_nickname_snapshot || "친구";
    return new Response(
      renderHtml({
        title: `${nickname}님은 "${data.persona_label}"!`,
        description: `"${data.deck_title}" 결과 확인하고 너도 해봐 - ${data.persona_desc || ""}`,
        image: DEFAULT_IMAGE, // 밸런스게임은 문제별 사진이 없어서 기본 이미지 사용
        redirectUrl,
      }),
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  return fallbackResponse();
});
