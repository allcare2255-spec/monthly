"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-gradient rounded-xl px-4 py-2 text-sm font-semibold"
    >
      PDF로 저장 · 인쇄
    </button>
  );
}
