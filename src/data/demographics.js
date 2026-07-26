export const GENDERS = ["남성", "여성"];

// 회원가입 때는 실제 나이(숫자)를 받고, 관리자 통계에서는 아래 구간으로 묶어서 보여줍니다.
export const AGE_BUCKETS = [
  { label: "10대", min: 10, max: 20 },
  { label: "20대", min: 20, max: 30 },
  { label: "30대", min: 30, max: 40 },
  { label: "40대", min: 40, max: 50 },
  { label: "50대 이상", min: 50, max: 200 },
];
