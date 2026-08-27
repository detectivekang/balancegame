export const CATEGORIES = [
  "연애/심리",
  "일상/개취",
  "커리어/현실",
  "상상/극단적 선택",
  "음식/식탐",
  "인간관계/친목",
  "덕질/문화",
  "여행/휴식",
  "학창시절/추억",
];

// 카테고리별 이모지/색상 클래스 - CategoryGrid, DeckCard 등에서 공용으로 사용
export const CATEGORY_META = {
  "연애/심리": { emoji: "💕", className: "is-love" },
  "일상/개취": { emoji: "🍗", className: "is-daily" },
  "커리어/현실": { emoji: "💼", className: "is-career" },
  "상상/극단적 선택": { emoji: "🚀", className: "is-imagine" },
  "음식/식탐": { emoji: "🍕", className: "is-food" },
  "인간관계/친목": { emoji: "🤝", className: "is-relationship" },
  "덕질/문화": { emoji: "🎬", className: "is-culture" },
  "여행/휴식": { emoji: "✈️", className: "is-travel" },
  "학창시절/추억": { emoji: "🎒", className: "is-nostalgia" },
};

export function categoryMeta(category) {
  return CATEGORY_META[category] || { emoji: "⚖️", className: "" };
}

// DB가 비어있을 때 앱이 바로 동작하도록 넣어두는 샘플 데이터.
// scripts/seed.js 로 Supabase에 한 번만 업로드하면 됩니다.
export const SAMPLE_QUESTIONS = [
  {
    category: "연애/심리",
    question: "애인이 전 남친/여친과 1박 2일 여행 가기 vs 절친과 단둘이 술 마시기",
    optionA: "여행 가기",
    optionB: "술 마시기",
  },
  {
    category: "연애/심리",
    question: "10분마다 연락해주는 애인 vs 하루에 딱 한 번 통화하는 애인",
    optionA: "10분마다 연락",
    optionB: "하루 한 번 통화",
  },
  {
    category: "일상/개취",
    question: "치킨 닭다리 양보하기 vs 내가 다 먹기",
    optionA: "양보하기",
    optionB: "내가 다 먹기",
  },
  {
    category: "일상/개취",
    question: "평생 탕수육 부먹 vs 평생 찍먹",
    optionA: "부먹",
    optionB: "찍먹",
  },
  {
    category: "커리어/현실",
    question: "월 500만 원 야근 지옥 회사 vs 월 300만 원 칼퇴 보장 회사",
    optionA: "500만 원, 야근",
    optionB: "300만 원, 칼퇴",
  },
  {
    category: "커리어/현실",
    question: "내일부터 평생 재택근무 vs 주 4일 출근(금요일 휴무)",
    optionA: "평생 재택",
    optionB: "주 4일 출근",
  },
  {
    category: "상상/극단적 선택",
    question: "시간을 멈추는 능력 vs 미래를 1시간 앞서 보는 능력",
    optionA: "시간 멈추기",
    optionB: "미래 보기",
  },
  {
    category: "상상/극단적 선택",
    question: "평생 스마트폰 없이 살기 vs 평생 인터넷 없이 살기",
    optionA: "스마트폰 없이",
    optionB: "인터넷 없이",
  },
  {
    category: "음식/식탐",
    question: "평생 고기 안 먹기 vs 평생 탄수화물 안 먹기",
    optionA: "고기 끊기",
    optionB: "탄수화물 끊기",
  },
  {
    category: "음식/식탐",
    question: "민초 찍먹 vs 탕수육 부먹",
    optionA: "민초 찍먹",
    optionB: "탕수육 부먹",
  },
  {
    category: "인간관계/친목",
    question: "매번 늦는 친구 vs 계산할 때 쏙 빠지는 친구, 손절 대상은?",
    optionA: "매번 늦는 친구",
    optionB: "계산 빠지는 친구",
  },
  {
    category: "인간관계/친목",
    question: "내 친구 깻잎 떼어주는 애인 vs 친구의 깻잎을 떼어주는 애인",
    optionA: "내 친구 깻잎 떼어줌",
    optionB: "친구가 내 깻잎 떼어줌",
  },
  {
    category: "덕질/문화",
    question: "평생 영화만 보기 vs 평생 음악만 듣기",
    optionA: "영화만",
    optionB: "음악만",
  },
  {
    category: "덕질/문화",
    question: "최애 아이돌 실물 한 번 보기 vs 평생 최애 전용 굿즈 받기",
    optionA: "실물 한 번 보기",
    optionB: "평생 굿즈 받기",
  },
  {
    category: "여행/휴식",
    question: "계획 100% 빡빡한 유럽 여행 vs 무계획 휴양지 힐링 여행",
    optionA: "빡빡한 유럽 여행",
    optionB: "무계획 휴양지",
  },
  {
    category: "여행/휴식",
    question: "비행기 이코노미 15시간 vs 야간버스 24시간",
    optionA: "이코노미 15시간",
    optionB: "야간버스 24시간",
  },
  {
    category: "학창시절/추억",
    question: "수능 날로 돌아가기 vs 군대 재입대하고 10억 받기",
    optionA: "수능 날로",
    optionB: "재입대+10억",
  },
  {
    category: "학창시절/추억",
    question: "학창 시절로 돌아가기 vs 지금 재산 그대로 유지하기",
    optionA: "학창 시절로",
    optionB: "재산 유지",
  },
];
