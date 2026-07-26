// 카테고리별로 최소 1000개씩의 밸런스게임 문제를 만들어서
// scripts/output/generated-questions.json 에 저장하는 스크립트입니다.
// 실행: node scripts/generate-questions.cjs

const fs = require("fs");
const path = require("path");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// subgroup의 아이템들을 서로 짝지어 "A vs B" 문제로 만듦 (같은 그룹끼리만 짝지어서 자연스럽게)
function pairsWithinGroup(items, wrap) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push(wrap(items[i], items[j]));
    }
  }
  return out;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const q of list) {
    if (!seen.has(q.question)) {
      seen.add(q.question);
      out.push(q);
    }
  }
  return out;
}

function buildCategory(category, generators, target) {
  let all = [];
  generators.forEach((gen) => {
    all = all.concat(gen());
  });
  all = dedupe(all).map((q) => ({ category, ...q }));
  all = shuffle(all);
  if (all.length < target) {
    console.warn(`⚠ ${category}: ${all.length}개 밖에 생성되지 않음 (목표 ${target})`);
  }
  return all.slice(0, target);
}

/* ------------------------------------------------------------------ */
/* 1. 연애/심리                                                        */
/* ------------------------------------------------------------------ */

const LOVE_TRAITS = [
  "매일 아침 모닝콜 해주지만 무뚝뚝한 애인",
  "연락은 뜸하지만 만나면 세상 다정한 애인",
  "기념일을 완벽히 챙기는 애인",
  "기념일은 자주 까먹지만 매일 사랑한다고 말해주는 애인",
  "내 친구들과 잘 어울리는 애인",
  "나랑만 시간 보내고 싶어하는 애인",
  "표현은 서투르지만 속마음은 깊은 애인",
  "표현은 화려하지만 마음은 가벼운 애인",
  "나를 하루 종일 웃게 해주는 애인",
  "나를 진지하게 성장시켜주는 애인",
  "돈은 잘 못 벌지만 다정한 애인",
  "돈은 잘 벌지만 무뚝뚝한 애인",
  "질투가 많은 애인",
  "질투가 전혀 없는 애인",
  "계획적인 데이트를 좋아하는 애인",
  "즉흥적인 데이트를 좋아하는 애인",
  "SNS에 나를 자주 자랑하는 애인",
  "SNS에 우리 관계를 절대 안 올리는 애인",
  "잔소리가 많지만 챙겨주는 애인",
  "잔소리는 없지만 무관심한 애인",
  "매일 연락하는 애인",
  "일주일에 한 번 만나도 진하게 만나는 애인",
  "요리를 잘하는 애인",
  "설거지를 잘하는 애인",
  "나보다 친구를 더 챙기는 애인",
  "나만 챙기고 친구는 뒷전인 애인",
  "울 때 꼭 안아주는 애인",
  "울 때 조용히 옆에 있어주는 애인",
  "다툴 때 바로 화해하자는 애인",
  "다툴 때 시간을 두고 정리하는 애인",
  "취향을 존중해주는 애인",
  "내 취향을 적극적으로 바꾸려는 애인",
  "가족같이 편한 애인",
  "설렘이 늘 유지되는 애인",
  "돈 계산이 확실한 애인",
  "돈 계산 없이 화끈하게 쓰는 애인",
  "여행 계획을 완벽히 짜오는 애인",
  "여행지에서 즉흥으로 다니는 애인",
  "매일 사진 찍자는 애인",
  "사진보다 순간을 즐기자는 애인",
  "선물을 비싼 걸로 주는 애인",
  "선물을 정성으로 주는 애인",
  "말로 사랑을 표현하는 애인",
  "행동으로 사랑을 표현하는 애인",
  "매일 데이트하자는 애인",
  "주말에만 만나자는 애인",
  "장거리 연애도 괜찮다는 애인",
  "근거리 연애만 고집하는 애인",
  "손편지를 써주는 애인",
  "이벤트 영상을 찍어주는 애인",
  "다이어트를 응원해주는 애인",
  "있는 그대로가 좋다는 애인",
  "친구들에게 자랑하고 다니는 애인",
  "조용히 연애하는 애인",
  "미래 계획을 자주 얘기하는 애인",
  "지금 이 순간에 집중하는 애인",
  "싸우면 먼저 연락하는 애인",
  "싸우면 시간을 갖자는 애인",
  "내 편을 무조건 들어주는 애인",
  "옳고 그름을 정확히 짚어주는 애인",
];

const LOVE_ACTIONS = [
  "전 애인과 우연히 마주쳐도 자연스럽게 인사하기",
  "전 애인 얘기는 절대 꺼내지 않기",
  "내 험담을 들었을 때 바로 화내주기",
  "내 험담을 들었을 때 조용히 넘기기",
  "소개팅을 주선받아도 거절하지 않고 예의상 나가기",
  "소개팅 얘기만 나와도 정색하기",
  "친구들 앞에서 애정표현 많이 하기",
  "둘이 있을 때만 애정표현 하기",
  "매달 이벤트 해주기",
  "1년에 한 번 크게 이벤트 해주기",
  "내 SNS 좋아요 다 눌러주기",
  "SNS는 신경 안 쓰기",
  "매일 오늘 하루 어땠는지 물어보기",
  "필요할 때만 대화하기",
];

const LOVE_TIME = [
  "10분마다 연락하기",
  "하루에 딱 한 번 통화하기",
  "일어나자마자 연락하기",
  "자기 전에만 연락하기",
  "출근길에 영상통화하기",
  "주말에만 몰아서 연락하기",
];

function genLoveTraits() {
  return pairsWithinGroup(shuffle(LOVE_TRAITS), (a, b) => ({
    question: `${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genLoveActions() {
  return pairsWithinGroup(shuffle(LOVE_ACTIONS), (a, b) => ({
    question: `애인이 ${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genLoveTime() {
  return pairsWithinGroup(shuffle(LOVE_TIME), (a, b) => ({
    question: `애인이 ${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genLoveExOrFriend() {
  const situations = [
    "전 남친/전 여친과 1박 2일 여행 가기",
    "가장 친한 친구와 단둘이 밤새 술 마시기",
    "전 애인 결혼식에 축가 불러주러 가기",
    "이성 친구와 단둘이 해외 출장 가기",
    "이성 친구 자취방에서 밤새 게임하기",
    "전 애인과 같은 회사에 다니기",
    "전 애인과 같은 동네에서 마주치며 살기",
    "친한 이성 친구의 프러포즈 들러리 서주기",
  ];
  return pairsWithinGroup(shuffle(situations), (a, b) => ({
    question: `애인이 ${a} vs ${b}`,
    optionA: a.length > 10 ? a.slice(0, 14) : a,
    optionB: b.length > 10 ? b.slice(0, 14) : b,
  }));
}

/* ------------------------------------------------------------------ */
/* 2. 일상/개취                                                        */
/* ------------------------------------------------------------------ */

const FOOD_GROUP = [
  "탕수육 부먹",
  "탕수육 찍먹",
  "짜장면",
  "짬뽕",
  "물냉면",
  "비빔냉면",
  "떡볶이",
  "순대",
  "치킨 후라이드",
  "치킨 양념",
  "라면 꼬들면",
  "라면 퍼진면",
  "김치찌개",
  "된장찌개",
  "피자 파인애플O",
  "피자 파인애플X",
  "초코라떼",
  "아메리카노",
  "민트초코",
  "바닐라 아이스크림",
  "떡국",
  "만두",
  "삼겹살",
  "목살",
  "회 초장",
  "회 간장",
  "김밥 참치",
  "김밥 치즈",
  "라면에 계란 풀기",
  "라면에 계란 통으로",
  "핫도그 케찹",
  "핫도그 머스타드",
  "빵에 잼",
  "빵에 버터",
  "국밥 새우젓",
  "국밥 소금",
];

const LIFESTYLE_GROUP = [
  "아침형 인간",
  "저녁형 인간",
  "집순이/집돌이",
  "밖순이/밖돌이",
  "계획적인 삶",
  "즉흥적인 삶",
  "미니멀리스트",
  "맥시멀리스트",
  "정리정돈 습관",
  "적당히 어지러운 방",
  "혼밥 즐기기",
  "무조건 같이 밥먹기",
  "카공족",
  "집에서 공부",
  "이어폰으로 노래 듣기",
  "스피커로 노래 듣기",
  "일찍 자고 일찍 일어나기",
  "늦게 자고 늦게 일어나기",
  "여름을 좋아함",
  "겨울을 좋아함",
  "봄을 좋아함",
  "가을을 좋아함",
  "비 오는 날을 좋아함",
  "눈 오는 날을 좋아함",
  "산으로 여행",
  "바다로 여행",
  "국내여행",
  "해외여행",
  "액티비티 여행",
  "힐링 여행",
  "강아지파",
  "고양이파",
  "책 읽기",
  "영화 보기",
  "노래방 가기",
  "보드게임 하기",
];

const HABIT_GROUP = [
  "양치 먼저 하고 세수",
  "세수 먼저 하고 양치",
  "샤워할 때 머리 먼저",
  "샤워할 때 몸 먼저",
  "신발끈 리본 묶기",
  "신발끈 이중매듭",
  "치약 뚜껑 닫기",
  "치약 뚜껑 안 닫기",
  "휴지 위로 걸기",
  "휴지 아래로 걸기",
  "이불 발끝까지 덮기",
  "이불 안 덮고 자기",
  "알람 한 번에 일어나기",
  "알람 10분 간격 여러 개",
  "메시지 바로 답장",
  "메시지 나중에 몰아서 답장",
];

function genFoodPairs() {
  return pairsWithinGroup(shuffle(FOOD_GROUP), (a, b) => ({
    question: `평생 ${a}만 먹기 vs 평생 ${b}만 먹기`,
    optionA: a,
    optionB: b,
  }));
}

function genLifestylePairs() {
  return pairsWithinGroup(shuffle(LIFESTYLE_GROUP), (a, b) => ({
    question: `평생 ${a}으로 살기 vs 평생 ${b}으로 살기`,
    optionA: a,
    optionB: b,
  }));
}

function genHabitPairs() {
  return pairsWithinGroup(shuffle(HABIT_GROUP), (a, b) => ({
    question: `평생 ${a} vs 평생 ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genSimpleVs() {
  const combined = shuffle([...FOOD_GROUP, ...LIFESTYLE_GROUP]);
  const out = [];
  for (let i = 0; i + 1 < combined.length; i += 2) {
    out.push({
      question: `${combined[i]} vs ${combined[i + 1]}`,
      optionA: combined[i],
      optionB: combined[i + 1],
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. 커리어/현실                                                      */
/* ------------------------------------------------------------------ */

const SALARY_AMOUNTS = [
  ["200만 원", "500만 원"],
  ["250만 원", "450만 원"],
  ["300만 원", "600만 원"],
  ["180만 원", "350만 원"],
  ["220만 원", "400만 원"],
  ["260만 원", "480만 원"],
  ["150만 원", "700만 원"],
  ["320만 원", "550만 원"],
];

const SALARY_CONDITIONS = [
  ["칼퇴 보장", "야근 지옥"],
  ["재택근무", "매일 출근"],
  ["워라밸 최고", "승진 빠름"],
  ["지방 발령", "서울 본사"],
  ["주 4일제", "주 5일제"],
  ["스타트업 자유로움", "대기업 안정감"],
  ["적성에 안 맞는 일", "적성에 맞는 일"],
  ["상사 갈굼", "동료 텃세"],
  ["재미없지만 편한 일", "재밌지만 힘든 일"],
  ["매일 회식", "회식 전혀 없음"],
];

function genSalaryPairs() {
  const out = [];
  SALARY_AMOUNTS.forEach(([lowPay, highPay]) => {
    SALARY_CONDITIONS.forEach(([condA, condB]) => {
      out.push({
        question: `월급 ${lowPay} 받고 ${condA} vs 월급 ${highPay} 받고 ${condB}`,
        optionA: `${lowPay}, ${condA}`,
        optionB: `${highPay}, ${condB}`,
      });
    });
  });
  return out;
}

const LIFE_MOMENTS = [
  "수능 전날",
  "고3 첫날",
  "대학교 1학년 입학식날",
  "첫 회사 출근날",
  "첫 연애 시작한 날",
  "군대 입대 전날",
  "고등학교 졸업식날",
  "중학교 입학식날",
  "첫 알바 시작한 날",
  "성인이 된 날",
  "첫 자취 시작한 날",
  "취업 준비 시작한 날",
  "첫 월급 받은 날",
  "대학 졸업식날",
  "초등학교 졸업식날",
  "동아리 처음 들어간 날",
  "첫 팀플 하던 날",
  "면접 보러 가던 날",
  "퇴사를 결심한 날",
  "생애 첫 여행 가던 날",
];

function genLifeMoments() {
  return pairsWithinGroup(shuffle(LIFE_MOMENTS), (a, b) => ({
    question: `다시 돌아간다면? ${a}로 돌아가기 vs ${b}로 돌아가기`,
    optionA: a,
    optionB: b,
  }));
}

const WORK_GROUP = [
  "평생 재택근무",
  "주 4일 출근(금요일 휴무)",
  "정시 출퇴근",
  "자율 출퇴근",
  "칼같은 상사",
  "무능한 상사",
  "많이 배우지만 힘든 회사",
  "편하지만 배울 게 없는 회사",
  "연봉은 낮지만 좋은 동료들",
  "연봉은 높지만 밥맛 동료들",
  "성과급 있는 대신 압박 심함",
  "성과급 없는 대신 여유로움",
  "이름 있는 대기업",
  "작지만 성장하는 스타트업",
  "공무원 안정성",
  "프리랜서 자유",
  "전공 살린 일",
  "전공 무관 하고 싶은 일",
  "돈 많이 버는 지루한 일",
  "돈 적게 버는 재밌는 일",
  "해외 파견 근무",
  "국내 근무",
  "출장 잦은 일",
  "출장 전혀 없는 일",
  "사람 많이 만나는 영업직",
  "혼자 집중하는 개발/설계직",
  "칼같은 마감의 외주업",
  "느긋한 마감의 인하우스",
  "야근수당 확실한 곳",
  "야근 자체가 없는 곳",
  "복지 좋은 회사",
  "연봉 높은 회사",
  "사수가 잘 챙겨주는 곳",
  "혼자 알아서 크는 곳",
  "정년 보장되는 곳",
  "성과에 따라 승진 빠른 곳",
  "이직 자유로운 업계",
  "한 우물만 파는 업계",
  "재택/사무실 자유 선택",
  "무조건 사무실 출근",
  "야근 대신 유연근무",
  "칼퇴 대신 고정 스케줄",
  "상여금 많은 회사",
  "기본급 높은 회사",
];

function genWorkPairs() {
  return pairsWithinGroup(shuffle(WORK_GROUP), (a, b) => ({
    question: `${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

/* ------------------------------------------------------------------ */
/* 4. 상상/극단적 선택 (사망토록류 강한 문제 포함)                        */
/* ------------------------------------------------------------------ */

const POWER_GROUP = [
  "시간을 멈추는 능력",
  "미래를 1시간 앞서 보는 능력",
  "순간이동 능력",
  "투명인간 되는 능력",
  "하늘을 나는 능력",
  "생각을 읽는 능력",
  "무한 재생 능력",
  "모든 언어를 이해하는 능력",
  "동물과 대화하는 능력",
  "기억을 지우는 능력",
  "원하는 만큼 잠 안 자도 되는 능력",
  "무엇이든 한 번은 되돌리는 능력",
  "복제인간을 만드는 능력",
  "날씨를 조종하는 능력",
  "물속에서 숨쉬는 능력",
  "불사신이 되는 능력",
  "괴력을 갖는 능력",
  "변신하는 능력",
  "예지몽을 꾸는 능력",
  "물건을 순간이동시키는 능력",
  "불을 다루는 능력",
  "얼음을 다루는 능력",
  "중력을 조종하는 능력",
  "타인의 병을 대신 앓는 능력",
  "타인의 고통을 없애주는 능력",
  "누구든 설득하는 능력",
  "거짓말을 완벽히 간파하는 능력",
  "하루 24시간을 48시간처럼 쓰는 능력",
];

const IMAGINE_GROUP = [
  "닭이 되기",
  "공룡이 되기",
  "평생 스마트폰 없이 살기",
  "평생 인터넷 없이 살기",
  "평생 TV 없이 살기",
  "무인도에서 평생 혼자 살기",
  "우주에서 평생 혼자 살기",
  "평생 말 못하고 살기",
  "평생 듣지 못하고 살기",
  "10년간 시간을 건너뛰기",
  "과거로 10년 돌아가기",
  "매일 똑같은 하루 반복하기",
  "타임머신으로 미래만 갈 수 있기",
  "타임머신으로 과거만 갈 수 있기",
  "평생 거짓말을 못 하기",
  "평생 진실을 못 말하기",
  "모든 사람이 내 생각을 알기",
  "내가 모든 사람의 생각을 알기",
  "평생 돈 걱정 없이 유명하지 않게 살기",
  "평생 유명하지만 사생활 없이 살기",
  "평생 하루 3시간만 자도 되기",
  "평생 하루 12시간씩 자야 하기",
  "평생 나이를 먹지 않기",
  "평생 시간이 2배 빠르게 가기",
  "평생 겨울잠 자듯 1년에 3개월만 깨어있기",
  "매일 다른 사람으로 하루 살기",
  "평생 한 가지 음식 맛만 느끼기",
  "평생 색깔을 하나도 못 보기",
];

// "사망토록"류 - 극한/블랙 유머 톤의 가상 딜레마 (실제 자해/자살 방법이나
// 특정 인물을 겨냥하지 않는, 판타지적/과장된 설정의 밸런스게임 문항)
const EXTREME_GROUP = [
  "평생 지옥불에서 뜨겁게 살기",
  "평생 천국에서 심심하게 살기",
  "매일 좀비에게 쫓기며 살기",
  "매일 똑같이 반복되는 하루를 영원히 살기",
  "전 인류의 기억에서 완전히 잊혀지기",
  "전 세계 사람들이 나를 미워하기",
  "평생 감정을 하나도 못 느끼기",
  "평생 고통만 느끼며 살기",
  "죽을 때까지 배고픔을 못 느끼지만 음식 맛도 모르기",
  "죽을 때까지 잠을 안 자도 되지만 항상 피곤하기",
  "평생 홀로 무인도에서 살아남기",
  "평생 좀비 세상에서 도망다니며 살기",
  "매일 밤 같은 악몽을 꾸며 100년 살기",
  "고통 없이 이름 모를 병으로 요절하기",
  "고통스럽지만 120살까지 장수하기",
  "내가 가진 모든 기억을 잃는 대신 영생하기",
  "기억은 온전한 채 내일 삶이 끝나기",
  "사랑하는 사람 10명이 대신 큰 부자가 되는 대신 내가 불행해지기",
  "내가 행복해지는 대신 사랑하는 사람 10명이 불행해지기",
  "인류 전체가 100년 더 살지만 내가 당장 사라지기",
  "내가 100년 더 살지만 인류가 서서히 멸망하는 걸 지켜보기",
  "매일 저승사자가 하루씩 명을 깎아가는 걸 지켜보며 살기",
  "이번 생을 지금 끝내고 완전히 다른 사람으로 다시 태어나기",
  "지옥의 문지기로 영원히 일하기",
  "천국의 관리인으로 영원히 심심하게 일하기",
  "괴물로 변해서 아무도 몰라보게 살기",
  "유령이 되어 사람들 곁을 영원히 맴돌기",
  "저주에 걸려 사랑하는 사람을 알아보지 못하게 되기",
  "모든 저주를 대신 짊어지고 세상을 구하기",
  "세상 모든 사람의 수명을 하루씩 나눠 받아 평생 살기",
];

function genPowerPairs() {
  return pairsWithinGroup(shuffle(POWER_GROUP), (a, b) => ({
    question: `${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genImaginePairs() {
  return pairsWithinGroup(shuffle(IMAGINE_GROUP), (a, b) => ({
    question: `${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genExtremePairs() {
  return pairsWithinGroup(shuffle(EXTREME_GROUP), (a, b) => ({
    question: `${a} vs ${b}`,
    optionA: a,
    optionB: b,
  }));
}

function genMixedImagineExtreme() {
  // 판타지 능력/상상/극한 계열을 서로 섞어서 더 다양한 조합 생성 (여러 라운드 셔플)
  const out = [];
  const rounds = 4;
  for (let r = 0; r < rounds; r++) {
    const powers = shuffle(POWER_GROUP);
    const imagines = shuffle(IMAGINE_GROUP);
    const extremes = shuffle(EXTREME_GROUP);

    const len1 = Math.min(powers.length, extremes.length);
    for (let i = 0; i < len1; i++) {
      out.push({
        question: `${powers[i]} vs ${extremes[i]}`,
        optionA: powers[i],
        optionB: extremes[i],
      });
    }

    const len2 = Math.min(imagines.length, extremes.length);
    for (let i = 0; i < len2; i++) {
      out.push({
        question: `${imagines[i]} vs ${extremes[len2 - 1 - i]}`,
        optionA: imagines[i],
        optionB: extremes[len2 - 1 - i],
      });
    }

    const len3 = Math.min(powers.length, imagines.length);
    for (let i = 0; i < len3; i++) {
      out.push({
        question: `${powers[i]} vs ${imagines[len3 - 1 - i]}`,
        optionA: powers[i],
        optionB: imagines[len3 - 1 - i],
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 실행                                                                 */
/* ------------------------------------------------------------------ */

const TARGET = 1000;

const result = {
  "연애/심리": buildCategory(
    "연애/심리",
    [genLoveTraits, genLoveActions, genLoveTime, genLoveExOrFriend],
    TARGET
  ),
  "일상/개취": buildCategory(
    "일상/개취",
    [genFoodPairs, genLifestylePairs, genHabitPairs, genSimpleVs],
    TARGET
  ),
  "커리어/현실": buildCategory(
    "커리어/현실",
    [genSalaryPairs, genLifeMoments, genWorkPairs],
    TARGET
  ),
  "상상/극단적 선택": buildCategory(
    "상상/극단적 선택",
    [genPowerPairs, genImaginePairs, genExtremePairs, genMixedImagineExtreme],
    TARGET
  ),
};

let all = [];
Object.values(result).forEach((list) => {
  all = all.concat(list);
});

const outDir = path.join(__dirname, "output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const outPath = path.join(outDir, "generated-questions.json");
fs.writeFileSync(outPath, JSON.stringify(all, null, 2), "utf-8");

Object.entries(result).forEach(([cat, list]) => {
  console.log(`${cat}: ${list.length}개`);
});
console.log(`총 ${all.length}개 → ${outPath}`);
