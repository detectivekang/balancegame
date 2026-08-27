-- ============================================================================
-- 마이그레이션 007: 신규 카테고리 5개 + 예시 문제집/문제
-- Supabase 대시보드 > SQL Editor 에서 이 파일 전체를 붙여넣고 실행하세요.
-- (migration_002 question_sets 를 먼저 실행한 프로젝트 기준. 안 했다면
--  question_sets insert 부분은 건너뛰고 questions insert만 실행해도 앱은 동작합니다 - 폴백 처리됨)
--
-- 새 카테고리는 프론트(src/data/categories.js)에도 이미 추가돼 있어야 합니다.
-- ============================================================================

do $$
declare
  v_set_id uuid;
begin
  -- 🍕 음식/식탐 -----------------------------------------------------------
  insert into question_sets(category, title, emoji, description)
  values ('음식/식탐', '음식/식탐 모음집', '🍕', '먹는 걸로 싸우는 게 제일 재밌다')
  returning id into v_set_id;

  insert into questions(category, set_id, question, option_a, option_b, votes_a, votes_b, source, status)
  values
    ('음식/식탐', v_set_id, '평생 고기 안 먹기 vs 평생 탄수화물 안 먹기', '고기 끊기', '탄수화물 끊기', 0, 0, 'admin_excel', 'approved'),
    ('음식/식탐', v_set_id, '민초 찍먹 vs 탕수육 부먹', '민초 찍먹', '탕수육 부먹', 0, 0, 'admin_excel', 'approved');

  -- 👥 인간관계/친목 ---------------------------------------------------------
  insert into question_sets(category, title, emoji, description)
  values ('인간관계/친목', '인간관계/친목 모음집', '🤝', '친구, 동료, 모임에서의 매너 논쟁')
  returning id into v_set_id;

  insert into questions(category, set_id, question, option_a, option_b, votes_a, votes_b, source, status)
  values
    ('인간관계/친목', v_set_id, '손절해야 하는 친구, 매번 늦는 친구 vs 계산할 때 쏙 빠지는 친구', '매번 늦는 친구', '계산 빠지는 친구', 0, 0, 'admin_excel', 'approved'),
    ('인간관계/친목', v_set_id, '내 친구 깻잎 떼어주는 애인 vs 친구의 깻잎을 떼어주는 애인', '내 친구 깻잎 떼어줌', '친구가 내 깻잎 떼어줌', 0, 0, 'admin_excel', 'approved');

  -- 🎬 덕질/문화 -------------------------------------------------------------
  insert into question_sets(category, title, emoji, description)
  values ('덕질/문화', '덕질/문화 모음집', '🎬', '영화, 음악, 아이돌 덕질 밸런스')
  returning id into v_set_id;

  insert into questions(category, set_id, question, option_a, option_b, votes_a, votes_b, source, status)
  values
    ('덕질/문화', v_set_id, '평생 영화만 보기 vs 평생 음악만 듣기', '영화만', '음악만', 0, 0, 'admin_excel', 'approved'),
    ('덕질/문화', v_set_id, '최애 아이돌 실물 한 번 보기 vs 평생 최애 전용 굿즈 받기', '실물 한 번 보기', '평생 굿즈 받기', 0, 0, 'admin_excel', 'approved');

  -- ✈️ 여행/휴식 -------------------------------------------------------------
  insert into question_sets(category, title, emoji, description)
  values ('여행/휴식', '여행/휴식 모음집', '✈️', '휴가철에 투표율 폭발하는 카테고리')
  returning id into v_set_id;

  insert into questions(category, set_id, question, option_a, option_b, votes_a, votes_b, source, status)
  values
    ('여행/휴식', v_set_id, '계획 100% 빡빡한 유럽 여행 vs 무계획 휴양지 힐링 여행', '빡빡한 유럽 여행', '무계획 휴양지', 0, 0, 'admin_excel', 'approved'),
    ('여행/휴식', v_set_id, '비행기 이코노미 15시간 vs 야간버스 24시간', '이코노미 15시간', '야간버스 24시간', 0, 0, 'admin_excel', 'approved');

  -- 🎒 학창시절/추억 ---------------------------------------------------------
  insert into question_sets(category, title, emoji, description)
  values ('학창시절/추억', '학창시절/추억 모음집', '🎒', '세대 공감대 저격 질문들')
  returning id into v_set_id;

  insert into questions(category, set_id, question, option_a, option_b, votes_a, votes_b, source, status)
  values
    ('학창시절/추억', v_set_id, '수능 날로 돌아가기 vs 군대 재입대하고 10억 받기', '수능 날로', '재입대+10억', 0, 0, 'admin_excel', 'approved'),
    ('학창시절/추억', v_set_id, '학창 시절로 돌아가기 vs 지금 재산 그대로 유지하기', '학창 시절로', '재산 유지', 0, 0, 'admin_excel', 'approved');
end $$;
