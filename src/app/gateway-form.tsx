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
    <form onSubmit={onSubmit}>
      <label className="mb-2 block text-center text-sm font-semibold text-[#374151]">
        접속 코드
      </label>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="접속 코드를 입력하세요"
        autoFocus
        className="w-full rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 text-center text-base text-[#1f2937] outline-none transition focus:border-[#818cf8] focus:ring-4 focus:ring-[#818cf8]/20 placeholder:text-[#9ca3af]"
      />
      {error && (
        <p className="mt-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2.5 text-center text-xs text-rose">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="mt-4 w-full rounded-lg bg-[#818cf8] py-3 font-semibold text-white transition hover:bg-[#6b76f0] disabled:opacity-60"
      >
        {loading ? "확인 중..." : "입장하기"}
      </button>
    </form>
  );
}
