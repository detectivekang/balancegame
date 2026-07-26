import React, { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES } from "../data/categories";

const REQUIRED_COLUMNS = ["카테고리", "문제", "선택지A", "선택지B"];

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

        parsed.push({ category, question, optionA, optionB });
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

  const handleUpload = async () => {
    if (rows.length === 0) return;
    setStatus("uploading");

    try {
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((row) => ({
          category: row.category,
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
        필수 컬럼: 카테고리, 문제, 선택지A, 선택지B (카테고리는{" "}
        {CATEGORIES.join(", ")} 중 하나)
      </p>

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
                  <th>문제</th>
                  <th>A</th>
                  <th>B</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.category}</td>
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
