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

    // Show png-only elements (hidden in web view, visible in PNG)
    const pngOnlyEls = Array.from(root.querySelectorAll<HTMLElement>(".png-only"));
    const pngOnlyPrevDisplays = pngOnlyEls.map((el) => el.style.display);
    pngOnlyEls.forEach((el) => { el.style.display = "block"; });

    // Replace native checkboxes with SVG visuals (dom-to-image-more cannot render native checkbox states)
    const checkboxEls = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const checkboxCleanup: (() => void)[] = [];
    checkboxEls.forEach((cb) => {
      const checked = cb.checked;
      const visual = document.createElement("span");
      visual.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "width:16px",
        "height:16px",
        "border-radius:4px",
        "flex-shrink:0",
        `border:2px solid ${checked ? "#4F46E5" : "rgba(0,0,0,0.25)"}`,
        `background:${checked ? "#4F46E5" : "transparent"}`,
      ].join(";");
      if (checked) {
        visual.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10" fill="none"><path d="M1.5 5.5l2.5 2.5 4.5-4.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      cb.style.display = "none";
      cb.parentElement?.insertBefore(visual, cb);
      checkboxCleanup.push(() => {
        visual.remove();
        cb.style.display = "";
      });
    });

    try {
      const dataUrl = await domtoimage.default.toPng(root, { scale: 2, bgcolor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${studentName}_${weekLabel}주차_주간계획표.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      noPrintEls.forEach((el, i) => { el.style.display = prevDisplays[i]; });
      pngOnlyEls.forEach((el, i) => { el.style.display = pngOnlyPrevDisplays[i]; });
      textFields.forEach((el) => el.removeAttribute("spellcheck"));
      checkboxCleanup.forEach((fn) => fn());
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
