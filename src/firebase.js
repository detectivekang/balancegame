import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱 에서 발급받은 값을 넣어주세요.
// GitHub Pages는 정적 호스팅이라 .env 파일이 빌드에 포함되지 않으므로,
// 값을 아래에 직접 입력하거나(공개 키라 안전함) 빌드 시 Vite 환경변수로 주입하세요.
const firebaseConfig = {
  apiKey: "AIzaSyDwzaqS6PB2ff2sk4q2jpDk4YJI0M-8O-k",
  authDomain: "balance-game-app.firebaseapp.com",
  projectId: "balance-game-app",
  storageBucket: "balance-game-app.firebasestorage.app",
  messagingSenderId: "665688487287",
  appId: "1:665688487287:web:c04b93af34de182dad9d72",
  measurementId: "G-4VWND96QW3",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 관리자 계정으로 지정된 이메일. 관리자 페이지 접근 제어와
// Firestore 보안 규칙(firestore.rules) 양쪽에서 동일하게 사용됩니다.
export const ADMIN_EMAIL = "kangseabich@naver.com";
