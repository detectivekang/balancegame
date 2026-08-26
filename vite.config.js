import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ⚠️ GitHub Pages에 https://<username>.github.io/<repo-name>/ 형태로 올릴 경우
// base 값을 반드시 '/<repo-name>/' 으로 바꿔주세요.
// (예: 저장소 이름이 balance-game 이면 base: '/balance-game/')
export default defineConfig({
  plugins: [react()],
  base: '/balancegame/', // 이 부분을 추가해주세요!
});
