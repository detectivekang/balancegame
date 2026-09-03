// 결과를 "링크 텍스트"가 아니라 실제 카드 이미지로 만들어서 공유하기 위한 유틸.
// 캔버스에 직접 그려서 PNG Blob을 만든다 (인스타 스토리/카톡 공유에 최적화된 9:16 비율).
import { isKakaoShareConfigured, shareToKakaoTalk } from "./kakaoShare";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const FONT = "Pretendard, -apple-system, sans-serif";

async function ensureFontsReady() {
  try {
    await document.fonts.ready;
  } catch (err) {
    // 폰트 로딩 실패해도 시스템 폰트로 계속 진행
  }
}

function drawGradientBackground(ctx, colors) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

// 긴 텍스트를 maxWidth 안에서 줄바꿈해서 그려주고, 실제로 차지한 높이를 반환
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length * lineHeight;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // 캔버스로 그리려면 CORS 허용 필요 (Supabase public storage는 허용됨)
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("이미지 생성 실패"));
    }, "image/png");
  });
}

function drawFooter(ctx, siteUrl) {
  ctx.textAlign = "center";
  ctx.font = `700 36px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("나도 해보러 가기 👉", CARD_WIDTH / 2, CARD_HEIGHT - 150);
  ctx.font = `500 28px ${FONT}`;
  ctx.fillStyle = "#e4defc";
  ctx.fillText(siteUrl, CARD_WIDTH / 2, CARD_HEIGHT - 96);
}

/**
 * 밸런스게임 결과 공유 카드 이미지 생성
 */
export async function generateBalanceShareCard({ deckTitle, personaLabel, personaDesc, minorityText, xpEarned }) {
  await ensureFontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, ["#2b1a52", "#6c5ce7", "#a06cff"]);
  ctx.textAlign = "center";

  ctx.font = `700 44px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("⚖️ 밸런스게임", CARD_WIDTH / 2, 180);

  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = "#e4defc";
  wrapText(ctx, deckTitle, CARD_WIDTH / 2, 300, 880, 46);

  ctx.font = `800 84px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  wrapText(ctx, personaLabel, CARD_WIDTH / 2, 640, 920, 98);

  ctx.font = `500 38px ${FONT}`;
  ctx.fillStyle = "#e4defc";
  wrapText(ctx, personaDesc, CARD_WIDTH / 2, 820, 880, 50);

  if (minorityText) {
    ctx.font = `600 32px ${FONT}`;
    ctx.fillStyle = "#ffc93c";
    wrapText(ctx, minorityText, CARD_WIDTH / 2, 940, 880, 42);
  }

  roundedRectPath(ctx, CARD_WIDTH / 2 - 150, 1040, 300, 74, 37);
  ctx.fillStyle = "#3ecf9e";
  ctx.fill();
  ctx.font = `800 32px ${FONT}`;
  ctx.fillStyle = "#06301f";
  ctx.fillText(`+${xpEarned} XP`, CARD_WIDTH / 2, 1088);

  drawFooter(ctx, window.location.origin + window.location.pathname);

  return canvasToBlob(canvas);
}

/**
 * 이상형 월드컵 우승 결과 공유 카드 이미지 생성
 */
export async function generateWorldcupShareCard({ worldcupTitle, roundSize, championLabel, championImageUrl }) {
  await ensureFontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, ["#191932", "#2b1a52", "#6c5ce7"]);
  ctx.textAlign = "center";

  ctx.font = `700 42px ${FONT}`;
  ctx.fillStyle = "#ffc93c";
  ctx.fillText("🏆 우승!", CARD_WIDTH / 2, 170);

  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = "#e4defc";
  wrapText(ctx, `${worldcupTitle} · ${roundSize}강`, CARD_WIDTH / 2, 250, 880, 44);

  // 우승 이미지를 둥근 사각형으로 크롭해서 그림. 이미지 로딩/CORS 실패해도 텍스트만으로 계속 진행.
  try {
    const img = await loadImage(championImageUrl);
    const size = 640;
    const x = (CARD_WIDTH - size) / 2;
    const y = 340;
    ctx.save();
    roundedRectPath(ctx, x, y, size, size, 48);
    ctx.clip();
    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
    ctx.restore();
  } catch (err) {
    console.error("우승 이미지 로딩 실패, 텍스트만으로 카드 생성:", err);
  }

  ctx.font = `800 68px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  wrapText(ctx, championLabel, CARD_WIDTH / 2, 1090, 920, 80);

  drawFooter(ctx, window.location.origin + window.location.pathname);

  return canvasToBlob(canvas);
}

/**
 * 궁합 테스트 초대장 공유 카드 이미지 생성.
 * (밸런스게임 결과 화면 / 궁합 테스트 결과 화면에서 "친구에게 보내기" 할 때 공통으로 씀)
 */
export async function generateChemistryInviteCard({ nickname, deckTitle, questionCount }) {
  await ensureFontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, ["#3a1650", "#a3266b", "#ff5470"]);
  ctx.textAlign = "center";

  // 은은한 하트 장식
  ctx.font = "120px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillText("💌", CARD_WIDTH / 2 - 300, 260);
  ctx.fillText("💘", CARD_WIDTH / 2 + 300, 1500);

  ctx.font = `800 90px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("💌", CARD_WIDTH / 2, 340);

  ctx.font = `700 44px ${FONT}`;
  ctx.fillStyle = "#ffe1ec";
  wrapText(ctx, `${nickname}님이 보낸`, CARD_WIDTH / 2, 460, 880, 56);

  ctx.font = `800 66px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  wrapText(ctx, "취향 궁합 테스트", CARD_WIDTH / 2, 560, 920, 78);

  ctx.font = `600 36px ${FONT}`;
  ctx.fillStyle = "#ffd6e4";
  wrapText(ctx, `"${deckTitle}"`, CARD_WIDTH / 2, 700, 880, 48);

  if (questionCount) {
    roundedRectPath(ctx, CARD_WIDTH / 2 - 220, 800, 440, 84, 42);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`📝 ${questionCount}문제 · 회원가입 없이 시작`, CARD_WIDTH / 2, 852);
  }

  ctx.font = `600 40px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  wrapText(ctx, "얼마나 취향이 통하는지", CARD_WIDTH / 2, 1040, 880, 52);
  wrapText(ctx, "지금 바로 확인해보세요 👇", CARD_WIDTH / 2, 1096, 880, 52);

  drawFooter(ctx, window.location.origin + window.location.pathname);

  return canvasToBlob(canvas);
}

/**
 * 카카오톡 "바로 공유"(Kakao.Share)용으로 카드 이미지를 Storage에 올리고
 * 공개 URL을 돌려줌. (카카오 공유는 blob이 아니라 실제 접근 가능한 URL이 필요함)
 */
export async function uploadShareCard(supabase, blob) {
  const path = `cards/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from("share-cards")
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("share-cards").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * 궁합 초대장 공유의 "최선" 경로.
 * 1) 카카오 JS 키가 설정돼있으면: 카드 이미지를 올리고 카카오톡 공유 시트를 바로 띄움
 *    (다운로드 없이 링크+이미지가 통째로 카톡으로 감).
 * 2) 카카오 공유가 안 되는 환경(키 미설정/실패)이면: 기존 방식(이미지 공유/다운로드 +
 *    링크 클립보드 복사)으로 자동 대체함.
 *
 * 반환값: 'kakao' | 'shared' | 'downloaded' | 'cancelled' | 'link-copied'
 */
/**
 * 결과 카드(밸런스게임 페르소나 / 월드컵 우승 등) 공유의 "최선" 경로.
 *
 * 처음엔 이미지가 핵심이라고 보고 항상 이미지를 같이 보내려 했는데, 실제로
 * 이미지+텍스트를 함께 navigator.share로 보내면 일부 공유 대상(메일/페이스북 등)이
 * 이미지만 받고 텍스트(=결과 페이지로 가는 링크)는 버려버리는 문제가 있었음.
 * 그러면 받는 사람은 사진만 보고 실제 결과 페이지로 가는 길이 없어짐 -
 * "결과 공유하기 했더니 그냥 홈/소개 화면만 나온다"는 혼란으로 이어짐.
 *
 * 그래서 궁합 초대장과 동일한 원칙으로 통일함:
 * 1) 카카오 JS 키가 설정돼있으면: 카드 이미지를 올리고 카카오톡 공유 시트를
 *    바로 띄움 (다운로드 없이 링크+이미지가 통째로 카톡으로 감. 카카오 피드
 *    템플릿은 이미지와 링크를 분리해서 안전하게 같이 보냄).
 * 2) 아니면: 이미지 없이 "링크만" 확실하게 공유함 (네이티브 공유 시트 또는
 *    클립보드 복사). 사진이 보고 싶으면 별도의 "이미지로 저장" 버튼을 씀.
 *
 * 반환값: 'kakao' | 'shared' | 'link-copied' | 'cancelled' | 'error'
 */
export async function shareResultCard(supabase, cardFactory, filename, { title, description, linkUrl, buttonLabel }) {
  if (isKakaoShareConfigured()) {
    try {
      const blob = await cardFactory();
      const imageUrl = await uploadShareCard(supabase, blob);
      const result = await shareToKakaoTalk({ title, description, imageUrl, linkUrl, buttonLabel });
      if (result === "shared") return "kakao";
    } catch (err) {
      console.error("카카오톡 공유 실패, 링크 공유로 대체:", err);
    }
  }

  // 카카오 공유가 준비 안 됐으면 이미지 없이 링크만 공유 (텍스트가 씹히는 문제 방지)
  const text = `${description} ${linkUrl}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "link-copied";
  } catch (err) {
    console.error("링크 복사 실패:", err);
    return "error";
  }
}

/**
 * 궁합 초대장처럼 "링크 클릭이 핵심"인 공유에 씀 (이미지는 부가 요소).
 * 1) 카카오 JS 키가 설정돼있으면: 카드 이미지를 만들어서 올리고 카카오톡 공유
 *    시트를 바로 띄움 (다운로드 없이 링크+이미지가 통째로 카톡으로 감).
 * 2) 카카오 공유가 설정 안 돼있으면: 그냥 링크(텍스트)만 공유함. 이미지 카드를
 *    아예 만들지 않음 - 사진을 억지로 갤러리에 저장시키는 건 오히려 불편하고
 *    (안드로이드/일부 인앱 브라우저는 파일 공유가 안 되면 자동으로 사진을
 *    "다운로드"해버림), "그냥 링크만 보내면 되는데 왜 사진이 저장되냐"는
 *    혼란을 줌. 카카오 공유가 준비되기 전까지는 심플하게 링크만 보내는 게 낫다고
 *    판단함.
 *
 * cardFactory는 실제로 카카오 공유를 타게 될 때만 호출되는 이미지 생성 함수
 * (blob을 반환하는 async 함수) - 안 쓰일 땐 아예 실행 안 해서 불필요한 캔버스
 * 렌더링도 생략됨.
 *
 * 반환값: 'kakao' | 'shared' | 'link-copied' | 'cancelled' | 'error'
 */
export async function shareChemistryInvite(supabase, cardFactory, filename, { title, description, linkUrl, buttonLabel }) {
  if (isKakaoShareConfigured()) {
    try {
      const blob = await cardFactory();
      const imageUrl = await uploadShareCard(supabase, blob);
      const result = await shareToKakaoTalk({ title, description, imageUrl, linkUrl, buttonLabel });
      if (result === "shared") return "kakao";
    } catch (err) {
      console.error("카카오톡 공유 실패, 링크 공유로 대체:", err);
    }
  }

  // 카카오 공유가 준비 안 됐으면 이미지 없이 링크만 공유
  const text = `${description} ${linkUrl}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "link-copied";
  } catch (err) {
    console.error("링크 복사 실패:", err);
    return "error";
  }
}

/**
 * 무조건 로컬에 파일로 다운로드시킴 (공유 시트 없이). "이미지로 저장" 버튼처럼
 * 사용자가 명시적으로 "저장"을 눌렀을 때 쓰는 함수 - 브라우저가 파일 공유를
 * 지원한다고 해서 OS 공유창부터 띄우면 "저장 버튼 눌렀는데 왜 공유창이 뜨냐"는
 * 혼란을 주므로, 이 버튼만큼은 항상 결정적으로(deterministic) 동작하게 함.
 */
export function downloadImage(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 생성된 이미지 Blob을 공유(가능하면 네이티브 공유 시트, 아니면 다운로드)한다.
 * 반환값: 'shared' | 'downloaded' | 'cancelled'
 */
export async function shareOrDownloadImage(blob, filename, shareText) {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return "shared";
    } catch (err) {
      return "cancelled"; // 사용자가 공유를 취소한 경우 등
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

/**
 * 궁합 초대장처럼 "이미지 + 반드시 전달돼야 하는 링크"를 함께 보낼 때 씀.
 *
 * 문제: navigator.share({ files, text })로 이미지랑 텍스트를 같이 보내면,
 * 카카오톡 등 일부 공유 대상 앱이 이미지만 받고 text는 그냥 버림 - 그래서
 * "이미지만 가고 링크(글자)는 안 간다"는 문제가 생김. 이건 OS/브라우저
 * 공유 시트의 알려진 동작이라 프론트에서 완전히 막을 방법이 없음.
 *
 * 그래서 안전하게: 링크가 포함된 텍스트를 항상 먼저 클립보드에 복사해두고
 * (공유 성공/실패/취소와 무관하게), 그 다음에 이미지 공유를 시도함.
 * 이러면 공유 앱이 텍스트를 버려도 사용자가 "붙여넣기"만 하면 링크를 보낼 수 있음.
 *
 * 반환값: 'shared' | 'downloaded' | 'cancelled' (링크는 이 호출 전에 이미 복사 시도됨)
 */
export async function shareImageWithLink(blob, filename, shareText) {
  try {
    await navigator.clipboard.writeText(shareText);
  } catch (err) {
    console.error("링크 클립보드 복사 실패:", err);
  }
  return shareOrDownloadImage(blob, filename, shareText);
}
