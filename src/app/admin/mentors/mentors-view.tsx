"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Mentor } from "@/types";

export function MentorsView({ initial }: { initial: Mentor[] }) {
  const router = useRouter();
  const [mentors, setMentors] = useState<Mentor[]>(initial);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/mentors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mentor_code: code }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error);
    setMentors((m) => [data.mentor, ...m]);
    setName("");
    setCode("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("멘토를 삭제하면 배정된 학생의 멘토 연결이 해제됩니다. 계속하시겠습니까?")) return;
    const res = await fetch("/api/admin/mentors", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.error);
    }
    setMentors((m) => m.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
          Mentors
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-2">멘토 관리</h1>
        <p className="text-ink/55 mt-2 text-sm">새 멘토를 등록하고 고유 코드를 발급합니다</p>
      </div>

      <section className="rounded-2xl bg-white border border-ink/5 p-6 shadow-sm shadow-indigo/5">
        <h2 className="text-base font-bold text-ink mb-4">새 멘토 등록</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <div>
            <label className="text-xs text-ink/55 font-medium">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김멘토"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 outline-none focus:border-indigo focus:ring-4 focus:ring-indigo/15 transition"
            />
          </div>
          <div>
            <label className="text-xs text-ink/55 font-medium">멘토 코드 (영문+숫자)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: kim2026"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 outline-none focus:border-indigo focus:ring-4 focus:ring-indigo/15 transition font-mono"
            />
          </div>
          <div className="sm:self-end">
            <button
              onClick={add}
              disabled={saving || !name.trim() || !code.trim()}
              className="btn-gradient w-full sm:w-auto rounded-xl font-semibold px-6 py-2.5"
            >
              {saving ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-xs rounded-lg bg-rose/10 border border-rose/30 text-rose px-3 py-2">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink mb-3">
          등록 멘토 <span className="text-ink/40">({mentors.length})</span>
        </h2>
        <div className="rounded-2xl bg-white border border-ink/5 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-indigo/5 to-fuchsia/5 text-ink/60 text-[11px] uppercase tracking-[0.15em]">
              <tr>
                <th className="text-left px-4 py-3">이름</th>
                <th className="text-left px-4 py-3">멘토 코드</th>
                <th className="text-left px-4 py-3">등록일</th>
                <th className="text-right px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {mentors.map((m) => (
                <tr key={m.id} className="hover:bg-indigo/[0.02] transition">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs px-2 py-1 rounded-md font-mono font-semibold bg-gradient-to-r from-indigo/10 to-fuchsia/10 text-indigo border border-indigo/15">
                      {m.mentor_code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-ink/50">{m.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(m.id)}
                      className="text-xs text-rose hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {mentors.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-ink/40 text-sm">
                    아직 등록된 멘토가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
