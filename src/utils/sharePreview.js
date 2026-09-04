// 링크 공유용 URL 헬퍼.
//
// 결과 페이지(#/... 해시 라우팅)를 그대로 카톡에 공유하면, 카카오 미리보기 봇은
// 자바스크립트를 실행하지 않기 때문에 SPA의 고정된 index.html의 og 태그만
// 보게 됨 → 항상 똑같은 기본 미리보기만 뜸.
//
// 그래서 카테고리별로 미리 만들어둔 "정적" 리다이렉트 페이지를 대신 공유한다.
//   /worldcup/?id=...   -> public/worldcup/index.html (og:title="이상형 월드컵")
//   /chemistry/?id=...  -> public/chemistry/index.html (og:title="밸런스 게임 궁합 테스트")
// 사람이 클릭하면 0초 만에 실제 결과 페이지(#/...)로 자동 이동한다.
//
// 결과별로 다른 이미지/제목까지는 못 보여주지만(그러려면 서버가 필요함),
// 완전히 정적 파일이라 서버 오류·인코딩 문제·캐시 문제가 생길 일이 없다.
const SITE_URL = "https://detectivekang.github.io/balancegame";

export function getWorldcupShareUrl(resultId) {
  return `${SITE_URL}/worldcup/?id=${encodeURIComponent(resultId)}`;
}

export function getBalanceShareUrl(resultId) {
  return `${SITE_URL}/chemistry/?id=${encodeURIComponent(resultId)}`;
}
