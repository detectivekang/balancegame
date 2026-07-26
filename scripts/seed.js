// scripts/generate-questions.cjs 로 만든 4000개(카테고리별 1000개) 문제를
// Supabase questions 테이블에 한 번에 업로드하는 스크립트입니다.
//
// 사용법:
//   1) node scripts/generate-questions.cjs   → scripts/output/generated-questions.json 생성
//   2) Supabase 프로젝트 설정 > API 에서 "service_role" 키를 복사
//      (⚠️ 이 키는 RLS를 우회하는 매우 강력한 키입니다. 이 스크립트 밖으로 절대 유출/커밋하지 마세요)
//   3) 아래 환경변수를 지정해서 실행:
//      SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seed.js

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수를 지정해주세요.\n" +
      "예) SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/seed.js"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const questions = JSON.parse(readFileSync("./scripts/output/generated-questions.json", "utf-8"));

async function seed() {
  const chunkSize = 500;
  let uploaded = 0;

  for (let i = 0; i < questions.length; i += chunkSize) {
    const chunk = questions.slice(i, i + chunkSize).map((q) => ({
      category: q.category,
      question: q.question,
      option_a: q.optionA,
      option_b: q.optionB,
      votes_a: 0,
      votes_b: 0,
      source: "admin_excel",
      status: "approved",
    }));

    const { error } = await supabase.from("questions").insert(chunk);
    if (error) {
      console.error(error);
      process.exit(1);
    }

    uploaded += chunk.length;
    console.log(`${uploaded} / ${questions.length} 업로드 완료`);
  }

  console.log(`총 ${questions.length}개 문제를 업로드했습니다.`);
}

seed();
