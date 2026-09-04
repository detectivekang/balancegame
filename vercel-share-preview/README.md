# 밸런스게임 - 카톡 링크 미리보기 프록시 (Vercel)

기존 Supabase Edge Function(`supabase/functions/share-preview`)을 그대로 옮긴
버전. 카카오톡 링크 미리보기 봇이 `*.supabase.co` 도메인을 차단해서 생기던
문제를 Vercel 도메인으로 우회함.

## 배포하기

```bash
cd vercel-share-preview
npm install
vercel --prod
```

처음 배포하면 Vercel이 프로젝트를 새로 만들지, 기존 것에 연결할지 물어봄.
새로 만들면 됨 (예: `balancegame-share`).

## 환경변수 설정 (필수)

Vercel 대시보드 > 프로젝트 > Settings > Environment Variables 에서:

| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | `https://<프로젝트ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 대시보드 > Settings > API 의 anon/public 키 |

환경변수를 추가한 뒤에는 재배포해야 반영됨 (`vercel --prod` 다시 실행,
또는 대시보드에서 Redeploy).

## 배포 후 할 일

1. 배포 완료되면 나오는 주소 확인 (예: `https://balancegame-share.vercel.app`)
2. `src/utils/sharePreview.js` 파일의 `SHARE_PREVIEW_BASE` 값을
   그 주소로 바꾸기 (지금은 `https://balancegame-share.vercel.app`로
   임시 설정해둠 - 실제 배포 주소와 다르면 반드시 수정할 것)
3. 프론트엔드 다시 빌드/배포 (`npm run build` → GitHub Pages 배포)
4. 카카오 링크 디버거로 확인:
   https://developers.kakao.com/tool/debugger/sharing
   → 실제 결과 링크(`.../api/share-preview?type=worldcup&id=...`)를 넣고
   "초기화 후 확인"으로 캐시 지우면서 og:image/title이 제대로 뜨는지 체크
5. 실제로 카톡방에 결과 공유 버튼으로 링크를 보내서 미리보기 확인

## 테스트

배포 도메인 + 쿼리스트링으로 브라우저에서 직접 열어보면 됨:

```
https://<배포주소>/api/share-preview?type=worldcup&id=<실제 worldcup_results.id>
https://<배포주소>/api/share-preview?type=balance&id=<실제 balance_results.id>
```

정상이면 잠깐 "이동 중입니다..." 텍스트가 보였다가 바로 결과 페이지로
리다이렉트됨. (뷰 소스로 열면 og:title/description/image가 한글 깨짐 없이
그대로 보여야 함)
