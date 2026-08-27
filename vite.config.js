import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// 배포할 때마다 값이 바뀌는 빌드 버전(현재 시각 기준).
// 1) 빌드된 JS 안에 __APP_VERSION__ 으로 그대로 박히고
// 2) public/version.json 에도 같은 값을 써둬서, 앱이 주기적으로 이 파일을 새로 받아
//    자기 안에 박힌 버전과 비교해서 "새 버전 있음"을 알 수 있게 함.
const appVersion = String(Date.now());

// public 폴더가 없는 프로젝트에서도 안전하게 동작하도록 미리 생성
const publicDir = path.resolve(__dirname, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
fs.writeFileSync(path.join(publicDir, "version.json"), JSON.stringify({ version: appVersion }));

// ⚠️ GitHub Pages에 https://<username>.github.io/<repo-name>/ 형태로 올릴 경우
// base 값을 반드시 '/<repo-name>/' 으로 바꿔주세요.
// (예: 저장소 이름이 balance-game 이면 base: '/balance-game/')
export default defineConfig({
  plugins: [react()],
  base: '/balancegame/', // 이 부분을 추가해주세요!
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
});
