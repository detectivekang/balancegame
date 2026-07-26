# 밸런스게임 앱

실시간 밸런스게임 참여, 유저 문제 등록(UGC), 관리자 승인 시스템, 관리자 대시보드,
엑셀 일괄 업로드, 레벨/경험치/에너지 시스템, 명예의 전당(주간/월간 랭킹)까지 갖춘 웹앱입니다.
React + Vite + **Supabase**(DB/인증)로 만들어졌고, GitHub Pages에 무료로 배포할 수 있습니다.

로그인은 두 가지 방식입니다.
- **일반 플레이어**: 카카오 로그인
- **관리자**: 이메일/비밀번호 로그인 (`kangseabich@naver.com` 전용)

## 1. Supabase 프로젝트 설정

1. https://supabase.com 에서 새 프로젝트 생성
2. 왼쪽 메뉴 **SQL Editor** 로 들어가서 이 프로젝트의 `supabase/schema.sql` 파일 내용을
   전체 복사해서 붙여넣고 **Run** — 테이블/보안규칙(RLS)/함수가 한 번에 만들어집니다.
3. 왼쪽 메뉴 **Project Settings > API** 에서 `Project URL`과 `anon public` 키를 복사해서
   `src/lib/supabaseClient.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`에 붙여넣기
4. **관리자 계정 만들기**: Authentication > Users > "Add user" 에서
   이메일을 `kangseabich@naver.com` 으로, 비밀번호를 원하는 값으로 설정
   (이메일 확인은 꺼도 됩니다 - "Auto Confirm User" 체크)

## 2. 카카오 로그인 연동

1. https://developers.kakao.com 에서 애플리케이션 생성
2. **카카오 로그인** 활성화 (제품 설정 > 카카오 로그인 > 활성화 설정 ON)
3. **Redirect URI**에 아래 주소를 등록 (Supabase 콜백 주소):
   ```
   https://<프로젝트-ref>.supabase.co/auth/v1/callback
   ```
   (`<프로젝트-ref>`는 Supabase 프로젝트 URL의 앞부분입니다)
4. 앱 키 중 **REST API 키**와, 카카오 로그인 > 보안 탭에서 발급받은 **Client Secret**을 준비
5. Supabase 콘솔 > Authentication > Providers > **Kakao**를 열고 활성화한 뒤
   REST API 키 → `Client ID`, Client Secret → `Client Secret` 칸에 각각 입력 후 저장
6. 카카오 개발자 콘솔 > 동의항목에서 닉네임 정도만 선택해도 충분합니다
   (나이/성별은 앱 자체에서 별도로 입력받습니다)

이제 앱에서 "카카오로 시작하기" 버튼을 누르면 카카오 로그인 → 앱으로 복귀 →
(최초 1회) 닉네임/나이/성별 입력 화면 → 바로 게임 시작, 순서로 동작합니다.

## 3. 로컬에서 실행

```bash
npm install
npm run dev
```

`http://localhost:5173` 에서 확인. `/admin` 경로로 관리자 로그인 화면 진입.

> 로컬 개발 중 카카오 로그인을 테스트하려면 Supabase 콘솔 > Authentication >
> URL Configuration > **Redirect URLs**에 `http://localhost:5173`도 추가해두세요.
> (카카오 개발자 콘솔의 Redirect URI는 Supabase 콜백 주소 하나만 등록하면 되고,
> 로컬/배포 주소를 따로 등록할 필요는 없습니다)

## 4. 문제 4000개 자동 생성하고 업로드하기

카테고리별 1000개씩(연애/심리, 일상/개취, 커리어/현실, 상상/극단적 선택 — "사망토록"류 강한 문제 포함),
총 4000개의 문제를 템플릿 조합으로 자동 생성하는 스크립트가 포함되어 있습니다.

```bash
node scripts/generate-questions.cjs
```

`scripts/output/generated-questions.json`에 4000개가 저장됩니다. Supabase에 업로드하려면:

1. Supabase 콘솔 > Project Settings > API 에서 **service_role** 키 복사
   (⚠️ RLS를 우회하는 매우 강력한 키입니다. 커밋/유출 금지)
2. 아래처럼 실행:
   ```bash
   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seed.js
   ```

내용이 마음에 안 들면 `scripts/generate-questions.cjs` 안의 단어 목록만 수정하고 다시 실행하면 됩니다.
관리자 페이지 > 승인 관리에서 마음에 안 드는 문제는 반려/삭제할 수 있습니다.

## 5. GitHub Pages 배포

### 저장소 이름과 base 경로 맞추기 (중요)

`vite.config.js`의 `base` 값이 실제 GitHub 저장소 이름과 일치해야 합니다.
저장소 이름이 `balance-game` 이면:

```js
base: "/balance-game/",
```

배포 주소가 바뀌면 Supabase 콘솔 > Authentication > URL Configuration >
**Redirect URLs**에도 그 주소(`https://<username>.github.io/<repo>/`)를 추가해야 카카오 로그인 후
정상적으로 앱으로 돌아옵니다.

### 방법 A — GitHub Actions로 자동 배포 (추천)

1. 이 프로젝트를 GitHub 저장소에 push
2. 저장소 **Settings > Pages > Build and deployment > Source**를 **GitHub Actions**로 설정
3. `main` 브랜치에 push할 때마다 `.github/workflows/deploy.yml`이 자동으로 빌드/배포합니다.

### 방법 B — gh-pages 패키지로 수동 배포

```bash
npm run build
npm run deploy
```

## 6. 구조 설명

```
supabase/schema.sql        DB 테이블 + RLS 보안규칙 + 함수(cast_vote, approve_question 등)
src/lib/supabaseClient.js  Supabase 클라이언트 초기화 + 관리자 이메일 상수
src/hooks/useSession.jsx    로그인 세션 + 프로필 + 레벨/XP/에너지 상태를 함께 관리하는 컨텍스트
src/utils/levels.js         레벨/XP/티어 계산 로직 (SQL의 level_for_xp()와 동일한 공식)
src/components/LoginScreen.jsx        카카오 로그인 전 화면
src/components/ProfileSetupModal.jsx  카카오 로그인 직후 닉네임/나이/성별 입력
src/pages/Home.jsx           카테고리 선택 → 문제 풀이 (랜덤 순서)
src/pages/Submit.jsx         유저 문제 등록(UGC) → status: "pending"
src/pages/Admin.jsx          관리자 로그인 가드 + 탭(대시보드/플레이어/승인/엑셀업로드)
src/pages/HallOfFame.jsx     명예의 전당 (주간/월간 랭킹, 1위 칭호, 티어 배지)
```

## 7. 회원가입 (닉네임/나이/성별)

카카오 로그인 직후, 딱 한 번 닉네임/나이/성별을 입력해야 게임을 시작할 수 있습니다.
입력한 정보는 `profiles` 테이블에 저장되고, 관리자 대시보드에서 성별/연령대별 분포를 볼 수 있습니다.

## 8. 레벨/경험치/에너지 시스템 + 명예의 전당

**경험치(XP)**
- 문제 하나 풀 때마다 +1 XP
- 내가 등록한 문제가 관리자에게 승인되면 +5 XP
- 모든 XP 지급은 클라이언트가 아니라 DB 함수(`cast_vote`, `approve_question`)에서만 이뤄집니다.
  브라우저 개발자도구로 값을 조작할 수 없어서 Firebase 버전보다 훨씬 안전합니다.

**레벨 (1~30)**
- 레벨 1→2: 100 XP, 레벨 2→3: 300 XP, 그 다음부터도 계속 200씩 늘어나는 등차수열(500, 700, 900...)
  로 필요 경험치가 커집니다. 레벨은 별도로 저장하지 않고 누적 XP로부터 그때그때 계산합니다.

**에너지 (문제 풀 수 있는 횟수 제한)**
- 레벨 1의 에너지 최대치는 5, 레벨 2는 6, ... 레벨이 오를수록 최대치가 1씩 늘어납니다(레벨+4).
- 문제를 하나 풀 때마다 에너지 1을 소모하고, 30분마다 1씩 자동으로 회복됩니다.
- 에너지가 0이 되면 "에너지가 모두 소진됐어요" 화면과 함께 회복까지 남은 시간이 표시됩니다.
- 중복 투표는 `votes` 테이블의 `unique(user_id, question_id)` 제약으로 DB 단에서 원천 차단됩니다.

**명예의 전당** (헤더의 "명예의전당" 메뉴)
- 주간/월간 탭으로 나뉘어 있고, 각 기간 동안 획득한 XP 합계로 랭킹을 매깁니다(`xp_events` 테이블 기준).
- 1위에게는 "🏆 이번 주/이번 달 챔피언" 칭호가 목록에 표시됩니다.
- 각 플레이어에게는 레벨에 따라 롤 티어 스타일의 등급(아이언/브론즈/실버/골드/플래티넘/다이아몬드/마스터)이
  붙습니다. 등급 구간은 `src/utils/levels.js`의 `TIERS` 배열에서 조정할 수 있어요.
- 서버 스케줄러 없이 접속할 때마다 "이번 주 월요일 0시부터 지금까지"를 즉석에서 집계하는 방식이라
  항상 최신 상태입니다. 활동 로그가 아주 많아지면(수만 건 이상) 느려질 수 있어 5,000건까지만 조회합니다.

## 9. 알아두면 좋은 점 (한계)

- **XP/에너지 조작 방지**는 Firebase 버전보다 훨씬 강화됐습니다. 투표/승인 로직이 전부 Postgres 함수
  (`SECURITY DEFINER`) 안에서만 실행되고, 클라이언트는 그 함수를 호출할 권한만 가지고 있어서
  프로필의 xp/energy를 직접 수정할 방법이 없습니다.
- **명예의 전당 랭킹 집계**는 클라이언트에서 최근 5,000건의 XP 로그를 읽어와 합산하는 방식이라,
  사용자가 아주 많아지면 Postgres 함수(RPC)로 집계를 옮기는 걸 고려해보세요.
- **age/gender 등 프로필 정보**는 현재 누구나 읽을 수 있게 열려있습니다(닉네임 표시 등에 필요해서).
  더 엄격하게 하려면 `profiles` 테이블의 select 정책을 `id = auth.uid() OR is_admin()`으로 좁히고,
  명예의 전당용으로는 닉네임/레벨만 노출하는 별도 뷰(view)를 만드는 걸 추천합니다.
- GitHub Pages는 정적 호스팅이라 `supabaseClient.js`의 anon key가 브라우저에 그대로 노출됩니다.
  Supabase의 anon key는 원래 공개되어도 되는 값이며, 실제 보안은 RLS(Row Level Security) 정책이
  담당하므로 문제 없습니다. (단, `service_role` 키는 seed.js 실행 시에만 로컬에서 쓰고 절대 커밋하지 마세요.)
