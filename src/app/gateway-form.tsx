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
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-[0.18em]">
          Access Code
        </span>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="••••••••"
          autoFocus
          className="mt-2 w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-3.5 text-base outline-none focus:border-indigo focus:bg-white focus:ring-4 focus:ring-indigo/15 transition placeholder:text-ink/30"
        />
      </label>
      {error && (
        <p className="rounded-lg bg-rose/10 border border-rose/30 text-rose text-xs px-3 py-2.5">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="btn-gradient w-full rounded-xl font-semibold py-3.5 tracking-wide"
      >
        {loading ? "확인 중..." : "입장 →"}
      </button>
    </form>
  );
}
