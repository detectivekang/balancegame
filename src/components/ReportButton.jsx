import React, { useState } from "react";
import ReportModal from "./ReportModal";

export default function ReportButton({ target, className = "report-btn", label = "🚩 신고" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <ReportModal target={target} onClose={() => setOpen(false)} />}
    </>
  );
}
