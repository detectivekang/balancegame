// 결과를 "링크 텍스트"가 아니라 실제 카드 이미지로 만들어서 공유하기 위한 유틸.
// 캔버스에 직접 그려서 PNG Blob을 만든다 (인스타 스토리/카톡 공유에 최적화된 9:16 비율).

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
