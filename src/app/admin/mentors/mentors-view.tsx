"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Mentor } from "@/types";

type SortKey = "name" | "first_date" | "unique_number";

export function MentorsView({ initial }: { initial: Mentor[] }) {
  const router = useRouter();
  const [mentors, setMentors] = useState<Mentor[]>(initial);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  // [수정 9] 고유 번호 / 첫 코칭 시작일
  const [num, setNum] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [수정 11] 정렬 — 기본 이름순
  const [sortKey, setSortKey] = useState<SortKey>("name");

  // [수정 5] 멘토 인라인 수정
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editNum, setEditNum] = useState("");
  const [editDate, setEditDate] = useState("");

  const sorted = useMemo(() => {
    const list = [...mentors];
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "ko");
      if (sortKey === "first_date") {
        // 값 없는 항목은 뒤로
        const av = a.first_coaching_date || "";
        const bv = b.first_coaching_date || "";
        if (!av && !bv) return a.name.localeCompare(b.name, "ko");
        if (!av) return 1;
        if (!bv) return -1;
        return av.localeCompare(bv);
      }
      // unique_number — 값 없는 항목은 뒤로
      const an = a.unique_number;
      const bn = b.unique_number;
      if (an == null && bn == null) return a.name.localeCompare(b.name, "ko");
      if (an == null) return 1;
      if (bn == null) return -1;
      return an - bn;
    });
    return list;
  }, [mentors, sortKey]);

  function startEdit(m: Mentor) {
    setEditId(m.id);
    setEditName(m.name);
    setEditCode(m.mentor_code);
    setEditNum(m.unique_number != null ? String(m.unique_number) : "");
    setEditDate(m.first_coaching_date || "");
  }

  async function saveEdit() {
    if (!editId || !editName.trim() || !editCode.trim()) return;
    const res = await fetch("/api/admin/mentors", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editId,
        name: editName,
        mentor_code: editCode,
        unique_number: editNum,
        first_coaching_date: editDate,
      }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setMentors((m) => m.map((x) => (x.id === editId ? data.mentor : x)));
    setEditId(null);
    router.refresh();
  }

  async function add() {
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/mentors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        mentor_code: code,
        unique_number: num,
        first_coaching_date: firstDate,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error);
    setMentors((m) => [data.mentor, ...m]);
    setName("");
    setCode("");
    setNum("");
    setFirstDate("");
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink/55 font-medium">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김멘토"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-ink/55 font-medium">멘토 코드 (영문+숫자)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: kim2026"
              className={`${inputCls} font-mono`}
            />
          </div>
          {/* [수정 9] 고유 번호 */}
          <div>
            <label className="text-xs text-ink/55 font-medium">고유 번호</label>
            <input
              type="number"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="예: 101"
              className={inputCls}
            />
          </div>
          {/* [수정 9] 첫 코칭 시작일 */}
          <div>
            <label className="text-xs text-ink/55 font-medium">첫 코칭 시작일</label>
            <input
              type="date"
              value={firstDate}
              onChange={(e) => setFirstDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end pt-1">
            <button
              onClick={add}
              disabled={saving || !name.trim() || !code.trim()}
              className="btn-gradient rounded-xl font-semibold px-6 py-2.5"
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
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-base font-bold text-ink">
            등록 멘토 <span className="text-ink/40">({mentors.length})</span>
          </h2>
          {/* [수정 11] 정렬 선택 */}
          <label className="flex items-center gap-2 text-xs text-ink/55">
            정렬
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-ink/10 bg-white px-2.5 py-1.5 text-sm text-ink/80 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
            >
              <option value="name">이름순</option>
              <option value="first_date">첫 코칭 시작일순</option>
              <option value="unique_number">고유 번호순</option>
            </select>
          </label>
        </div>
        <div className="rounded-2xl bg-white border border-ink/5 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-indigo/5 to-fuchsia/5 text-ink/60 text-[11px] uppercase tracking-[0.15em]">
              <tr>
                <th className="text-left px-4 py-3">이름</th>
                <th className="text-left px-4 py-3">멘토 코드</th>
                {/* [수정 10] 고유 번호 / 첫 코칭 시작일 컬럼, 등록일 제거 */}
                <th className="text-left px-4 py-3">고유 번호</th>
                <th className="text-left px-4 py-3">첫 코칭 시작일</th>
                <th className="text-right px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {sorted.map((m) =>
                editId === m.id ? (
                  <tr key={m.id} className="bg-indigo/[0.03]">
                    <td className="px-4 py-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-ink/15 px-2 py-1 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full rounded-lg border border-ink/15 px-2 py-1 font-mono outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={editNum}
                        onChange={(e) => setEditNum(e.target.value)}
                        className="w-24 rounded-lg border border-ink/15 px-2 py-1 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="rounded-lg border border-ink/15 px-2 py-1 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={saveEdit} className="text-xs font-semibold text-indigo hover:underline mr-3">
                        저장
                      </button>
                      <button onClick={() => setEditId(null)} className="text-xs text-ink/50 hover:underline">
                        취소
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-indigo/[0.02] transition">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs px-2 py-1 rounded-md font-mono font-semibold bg-gradient-to-r from-indigo/10 to-fuchsia/10 text-indigo border border-indigo/15">
                        {m.mentor_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-ink/70 tabular-nums">{m.unique_number ?? "-"}</td>
                    <td className="px-4 py-3 text-ink/70">{m.first_coaching_date || "-"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {/* [수정 8] 학생 관리와 동일한 둥근 버튼 (라벤더/보라) */}
                      <Link
                        href={`/mentor?mentorId=${m.id}`}
                        className="text-xs rounded-full px-3 py-1 font-semibold bg-gradient-to-r from-indigo/10 to-violet/10 text-indigo border border-indigo/15 hover:from-indigo/20 hover:to-violet/20 transition mr-3"
                      >
                        관리
                      </Link>
                      <button
                        onClick={() => startEdit(m)}
                        className="text-xs text-indigo hover:underline mr-3"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => remove(m.id)}
                        className="text-xs text-rose hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ),
              )}
              {mentors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ink/40 text-sm">
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

const inputCls =
  "mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 outline-none focus:border-indigo focus:ring-4 focus:ring-indigo/15 transition";
