"use client";

import { useState } from "react";

export function SendButton({
  studentName,
  weekLabel,
}: {
  studentName: string;
  weekLabel: number;
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    const root = document.getElementById("plan-capture-root");
    if (!root || exporting) return;
    setExporting(true);

    const domtoimage = await import("dom-to-image-more");

    // Temporarily disable spellcheck to suppress red underlines in clone
    const textFields = root.querySelectorAll<HTMLElement>("input, textarea");
    textFields.forEach((el) => el.setAttribute("spellcheck", "false"));

    // Hide no-print elements inside the capture root
    const noPrintEls = Array.from(root.querySelectorAll<HTMLElement>(".no-print"));
    const prevDisplays = noPrintEls.map((el) => el.style.display);
    noPrintEls.forEach((el) => { el.style.display = "none"; });

    try {
      const dataUrl = await domtoimage.default.toPng(root, { scale: 2 });
      const link = document.createElement("a");
      link.download = `${studentName}_${weekLabel}주차_주간계획표.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      noPrintEls.forEach((el, i) => { el.style.display = prevDisplays[i]; });
      textFields.forEach((el) => el.removeAttribute("spellcheck"));
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo to-violet text-white shadow-md shadow-indigo/30 hover:opacity-90 active:scale-95 transition disabled:opacity-60 whitespace-nowrap"
    >
      {exporting ? "저장 중..." : "학생에게 보내기"}
    </button>
  );
}
