// Vercel Serverless Function: /api/share-preview
//
// 카카오톡/문자 등에 링크를 공유했을 때 "실제 결과 이미지"가 미리보기로 뜨게 하는 함수.
// (기존 Supabase Edge Function을 Vercel로 이전한 버전)
//
// 이전한 이유: 카카오톡 링크 미리보기 봇이 *.supabase.co 도메인을 차단해서,
// Supabase Edge Function으로는 아예 og 태그를 읽어가지 못하는 문제가 있었음.
// Vercel 도메인(*.vercel.app 또는 커스텀 도메인)은 차단 대상이 아니라서 정상 동작함.
//
// 이 함수가 하는 일: 카카오봇이 이 링크를 열면 -> DB에서 그 결과(우승 이미지, 문제집명
// 등)를 조회해서 <meta property="og:image">에 실제 이미지를 박은 HTML을 즉시 응답함.
// 반면 실제 사람이 클릭하면 -> 스크립트/메타리프레시로 원래 앱의 결과 카드 페이지로
// 자동 이동시킴.
//
// 배포 방법:
//   1) 이 vercel-share-preview 폴더를 별도 Vercel 프로젝트로 배포
//      (cd vercel-share-preview && vercel --prod)
//   2) Vercel 대시보드 > Settings > Environment Variables 에 아래 두 값을 등록:
//        SUPABASE_URL       = https://<프로젝트ref>.supabase.co
//        SUPABASE_ANON_KEY  = <anon/public key>
//   3) 배포 후 나오는 도메인(예: https://balancegame-share.vercel.app)을
//      아래 SITE_URL은 그대로 두고, 프론트엔드(src/utils/sharePreview.js)의
//      SHARE_PREVIEW_BASE 값을 이 배포 도메인으로 바꿔주면 끝.
//
// 사용 URL 형식:
//   https://<vercel배포주소>/api/share-preview?type=worldcup&id=<resultId>
//   https://<vercel배포주소>/api/share-preview?type=balance&id=<resultId>

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 배포된 GitHub Pages 주소. 저장소/도메인이 바뀌면 이 값도 바꿔주세요.
const SITE_URL = "https://detectivekang.github.io/balancegame";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`; // 없으면 카카오 기본 스크린샷으로 대체됨

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
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
<meta name="viewport" content="width=device-width, initial-scale=1" />
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

function sendHtml(res, html, status = 200) {
  // Node.js 런타임은 문자열 body를 항상 UTF-8로 인코딩해서 보내므로
  // 한글 깨짐 없이 안전함. charset을 헤더에 명시하는 것도 잊지 않기.
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.end(html);
}

function fallback(res, redirectUrl = SITE_URL) {
  sendHtml(
    res,
    renderHtml({
      title: "밸런스게임",
      description:
        "친구랑 궁합도 재고, 이상형 월드컵도 열어보세요. 회원가입 없이 바로 시작!",
      image: DEFAULT_IMAGE,
      redirectUrl,
    })
  );
}

module.exports = async (req, res) => {
  try {
    const { id, type } = req.query;

    if (!id || !type) return fallback(res);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.");
      return fallback(res);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (type === "worldcup") {
      const { data, error } = await supabase
        .from("worldcup_results")
        .select(
          "round_size, sharer_nickname_snapshot, worldcup:worldcups(title), item:worldcup_items(label, image_url)"
        )
        .eq("id", id)
        .maybeSingle();

      const redirectUrl = `${SITE_URL}/#/worldcup/result/${id}`;
      if (error || !data || !data.worldcup || !data.item) {
        return fallback(res, redirectUrl);
      }

      const nickname = data.sharer_nickname_snapshot || "친구";
      return sendHtml(
        res,
        renderHtml({
          title: `${nickname}님의 최종 선택: ${data.item.label}`,
          description: `"${data.worldcup.title}" ${data.round_size}강 이상형 월드컵 결과 - 너도 도전해보세요!`,
          image: data.item.image_url,
          redirectUrl,
        })
      );
    }

    if (type === "balance") {
      const { data, error } = await supabase
        .from("balance_results")
        .select(
          "deck_title, sharer_nickname_snapshot, persona_label, persona_desc"
        )
        .eq("id", id)
        .maybeSingle();

      const redirectUrl = `${SITE_URL}/#/result/${id}`;
      if (error || !data) return fallback(res, redirectUrl);

      const nickname = data.sharer_nickname_snapshot || "친구";
      return sendHtml(
        res,
        renderHtml({
          title: `${nickname}님은 "${data.persona_label}"!`,
          description: `"${data.deck_title}" 결과 확인하고 너도 해봐 - ${data.persona_desc || ""}`,
          image: DEFAULT_IMAGE, // 밸런스게임은 문제별 사진이 없어서 기본 이미지 사용
          redirectUrl,
        })
      );
    }

    return fallback(res);
  } catch (err) {
    console.error("share-preview 처리 중 오류:", err);
    return fallback(res);
  }
};
