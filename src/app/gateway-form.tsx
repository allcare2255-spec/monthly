"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GatewayForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "로그인 실패");
        setLoading(false);
        return;
      }
      router.push(data.redirect || "/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "오류가 발생했습니다");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(null); }}
          placeholder="접속 코드를 입력하세요"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="w-full h-12 rounded-[10px] border px-4 text-center text-base font-semibold outline-none transition-colors"
          style={{ borderColor: error ? "#ff4d4f" : "#e6e8ea", color: "#1a1a1e" }}
          onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "#083ccc"; }}
          onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = "#e6e8ea"; }}
        />
        {error && (
          <p className="text-xs text-center" style={{ color: "#ff4d4f" }}>
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full h-12 rounded-[10px] font-semibold text-white text-base transition-opacity disabled:opacity-50"
        style={{ background: "#083ccc" }}
      >
        {loading ? "입장 중..." : "입장하기"}
      </button>
    </form>
  );
}
