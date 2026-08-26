import React, { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES } from "../data/categories";

const REQUIRED_COLUMNS = ["카테고리", "문제", "선택지A", "선택지B"];

function downloadTemplate() {
  const sampleRows = [
    {
      카테고리: CATEGORIES[0],
      문제집: "예시 문제집 (비워두면 문제집 없이 등록돼요)",
      문제: "예: 평생 여름만 있는 나라 vs 평생 겨울만 있는 나라",
      선택지A: "여름만 있는 나라",
      선택지B: "겨울만 있는 나라",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(sampleRows, {
    header: ["카테고리", "문제집", "문제", "선택지A", "선택지B"],
  });
  sheet["!cols"] = [{ wch: 16 }, { wch: 26 }, { wch: 46 }, { wch: 22 }, { wch: 22 }];

  const guideSheet = XLSX.utils.aoa_to_sheet([
    ["작성 가이드"],
    ["카테고리는 아래 목록 중 하나를 정확히 입력해주세요:"],
    ...CATEGORIES.map((c) => [c]),
    [""],
    ["문제집 컬럼은 선택 사항이에요."],
    ["- 이미 있는 문제집 이름을 적으면 그 문제집에 문제가 추가됩니다."],
    ["- 새로운 이름을 적으면 같은 이름의 새 문제집이 자동으로 만들어져요."],
    ["- 비워두면 문제집 없이 문제만 등록돼요."],
  ]);
  guideSheet["!cols"] = [{ wch: 60 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "문제 업로드 양식");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "작성 가이드");
  XLSX.writeFile(workbook, "밸런스게임_문제_업로드_양식.xlsx");
}

export default function AdminExcelUpload() {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | parsed | uploading | done | error
  const [fileName, setFileName] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus("idle");
    setErrors([]);
    setRows([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (json.length === 0) {
        setErrors(["엑셀에 데이터가 없습니다."]);
        return;
      }

      const header = Object.keys(json[0]);
      const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
      if (missing.length > 0) {
        setErrors([`필수 컬럼 누락: ${missing.join(", ")}`]);
        return;
      }

      const parsed = [];
      const rowErrors = [];

      json.forEach((row, idx) => {
        const lineNum = idx + 2;
        const category = String(row["카테고리"] || "").trim();
        const setTitle = String(row["문제집"] || "").trim();
        const question = String(row["문제"] || "").trim();
        const optionA = String(row["선택지A"] || "").trim();
        const optionB = String(row["선택지B"] || "").trim();

        if (!category || !question || !optionA || !optionB) {
          rowErrors.push(`${lineNum}행: 빈 값이 있습니다.`);
          return;
        }
        if (!CATEGORIES.includes(category)) {
          rowErrors.push(`${lineNum}행: 알 수 없는 카테고리 "${category}"`);
          return;
        }

        parsed.push({ category, setTitle, question, optionA, optionB });
      });

      setRows(parsed);
      setErrors(rowErrors);
      setStatus("parsed");
    } catch (err) {
      console.error(err);
      setErrors(["엑셀 파일을 읽는 중 오류가 발생했습니다. 형식을 확인해주세요."]);
      setStatus("error");
    }
  };

  // 카테고리+문제집명 조합마다 question_sets에 있는지 확인하고, 없으면 새로 만들어서
  // "카테고리|문제집명" -> set_id 맵을 만들어 반환. question_sets 테이블이 없는(마이그레이션 전)
  // 프로젝트에서는 조용히 빈 맵을 반환해서 기존처럼 동작하게 함.
  const resolveSetIds = async (rowsNeedingSets) => {
    const map = {};
    const uniqueKeys = [...new Set(rowsNeedingSets.map((r) => `${r.category}|||${r.setTitle}`))];
    if (uniqueKeys.length === 0) return map;

    const { data: existing, error } = await supabase
      .from("question_sets")
      .select("id, category, title");
    if (error) {
      // question_sets 테이블 자체가 없으면 문제집 연결 없이 진행
      return map;
    }

    for (const key of uniqueKeys) {
      const [category, title] = key.split("|||");
      const found = (existing || []).find((s) => s.category === category && s.title === title);
      if (found) {
        map[key] = found.id;
        continue;
      }
      const { data: created, error: createError } = await supabase
        .from("question_sets")
        .insert({ category, title })
        .select()
        .single();
      if (createError) {
        console.error("문제집 생성 실패:", createError);
        continue;
      }
      map[key] = created.id;
      existing.push(created); // 같은 이름이 여러 행에 또 나올 때 중복 생성 방지
    }

    return map;
  };

  const handleUpload = async () => {
    if (rows.length === 0) return;
    setStatus("uploading");

    try {
      const rowsNeedingSets = rows.filter((r) => r.setTitle);
      const setIdMap = await resolveSetIds(rowsNeedingSets);

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((row) => ({
          category: row.category,
          set_id: row.setTitle ? setIdMap[`${row.category}|||${row.setTitle}`] || null : null,
          question: row.question,
          option_a: row.optionA,
          option_b: row.optionB,
          votes_a: 0,
          votes_b: 0,
          source: "admin_excel",
          status: "approved",
        }));
        const { error } = await supabase.from("questions").insert(chunk);
        if (error) throw error;
      }
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrors((prev) => [...prev, "업로드 중 오류가 발생했습니다."]);
      setStatus("error");
    }
  };

  return (
    <div className="excel-upload">
      <p className="excel-upload__desc">
        필수 컬럼: 카테고리, 문제, 선택지A, 선택지B / 선택 컬럼: 문제집 (카테고리는{" "}
        {CATEGORIES.join(", ")} 중 하나)
      </p>

      <button type="button" className="excel-upload__template-btn" onClick={downloadTemplate}>
        📥 업로드 양식 다운로드
      </button>

      <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
      {fileName && <p className="excel-upload__filename">선택된 파일: {fileName}</p>}

      {errors.length > 0 && (
        <div className="excel-upload__errors">
          {errors.map((err, i) => (
            <div key={i}>⚠ {err}</div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <p>
            정상 파싱된 문제: <b>{rows.length}건</b>
          </p>
          <div className="excel-upload__table-wrap">
            <table className="excel-upload__table">
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th>문제집</th>
                  <th>문제</th>
                  <th>A</th>
                  <th>B</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.category}</td>
                    <td>{r.setTitle || "-"}</td>
                    <td>{r.question}</td>
                    <td>{r.optionA}</td>
                    <td>{r.optionB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p>...외 {rows.length - 50}건</p>}
          </div>

          <button onClick={handleUpload} disabled={status === "uploading"}>
            {status === "uploading" ? "업로드 중..." : `${rows.length}건 등록하기`}
          </button>
        </>
      )}

      {status === "done" && <p className="excel-upload__success">✅ 업로드가 완료되었습니다.</p>}
    </div>
  );
}
