"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  name: string;
  age: number | null;
  phone: string | null;
  parent_phone: string | null;
  high_school: string | null;
  mentor_id: string | null;
  coaching_start_date: string | null;
  mentor?: { name: string; mentor_code: string } | null;
};

type MentorOpt = { id: string; name: string };

export function StudentsView({
  initialStudents,
  mentors,
}: {
  initialStudents: Student[];
  mentors: MentorOpt[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [form, setForm] = useState({
    name: "",
    age: "",
    phone: "",
    parent_phone: "",
    high_school: "",
    mentor_id: "",
    coaching_start_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        mentor_id: form.mentor_id || null,
        coaching_start_date: form.coaching_start_date || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error);
    router.refresh();
    location.reload();
  }

  async function updateMentor(id: string, mentor_id: string) {
    const res = await fetch("/api/admin/students", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, mentor_id: mentor_id || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.error);
    }
    router.refresh();
    location.reload();
  }

  async function remove(id: string) {
    if (!confirm("학생과 관련된 모든 레포트가 삭제됩니다. 계속하시겠습니까?")) return;
    const res = await fetch("/api/admin/students", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.error);
    }
    setStudents((s) => s.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-fuchsia font-semibold">
          Students
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-2">학생 관리</h1>
        <p className="text-ink/55 mt-2 text-sm">학생 등록 · 멘토 매칭 · 레포트 조회</p>
      </div>

      <section className="rounded-2xl bg-white border border-ink/5 p-6 shadow-sm shadow-fuchsia/5">
        <h2 className="text-base font-bold text-ink mb-4">새 학생 등록</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="이름 *">
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="나이">
            <input
              type="number"
              value={form.age}
              onChange={(e) => setField("age", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="본인 전화번호">
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="010-0000-0000"
              className={inputCls}
            />
          </Field>
          <Field label="학부모 전화번호">
            <input
              value={form.parent_phone}
              onChange={(e) => setField("parent_phone", e.target.value)}
              placeholder="010-0000-0000"
              className={inputCls}
            />
          </Field>
          <Field label="출신 고등학교">
            <input
              value={form.high_school}
              onChange={(e) => setField("high_school", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="담당 멘토">
            <select
              value={form.mentor_id}
              onChange={(e) => setField("mentor_id", e.target.value)}
              className={inputCls}
            >
              <option value="">미배정</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="코칭 시작일 (월요일 권장)">
            <input
              type="date"
              value={form.coaching_start_date}
              onChange={(e) => setField("coaching_start_date", e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end pt-2">
            <button
              onClick={add}
              disabled={saving || !form.name.trim()}
              className="btn-gradient rounded-xl font-semibold px-7 py-2.5"
            >
              {saving ? "등록 중..." : "학생 등록"}
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
          등록 학생 <span className="text-ink/40">({students.length})</span>
        </h2>
        <div className="rounded-2xl bg-white border border-ink/5 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-indigo/5 to-fuchsia/5 text-ink/60 text-[11px] uppercase tracking-[0.15em]">
              <tr>
                <th className="text-left px-4 py-3">학생</th>
                <th className="text-left px-4 py-3">학교 / 나이</th>
                <th className="text-left px-4 py-3">학부모 전화</th>
                <th className="text-left px-4 py-3">코칭 시작</th>
                <th className="text-left px-4 py-3">담당 멘토</th>
                <th className="text-left px-4 py-3">레포트</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-indigo/[0.02] transition">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-ink/50">{s.phone || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.high_school || "-"}</div>
                    <div className="text-xs text-ink/50">{s.age ? `${s.age}세` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{s.parent_phone || "-"}</td>
                  <td className="px-4 py-3 text-ink/70">{s.coaching_start_date || "-"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={s.mentor_id || ""}
                      onChange={(e) => updateMentor(s.id, e.target.value)}
                      className="rounded-lg border border-ink/10 bg-white px-2 py-1 text-sm focus:border-indigo focus:ring-2 focus:ring-indigo/15 outline-none"
                    >
                      <option value="">미배정</option>
                      {mentors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {s.coaching_start_date ? (
                      <div className="flex gap-1.5">
                        <Link
                          href={`/mentor/students/${s.id}/weekly?cycle=1&week=1`}
                          className="text-xs rounded-full px-2.5 py-1 font-semibold bg-gradient-to-r from-indigo/10 to-violet/10 text-indigo border border-indigo/15 hover:from-indigo/20 hover:to-violet/20 transition"
                        >
                          주간
                        </Link>
                        <Link
                          href={`/mentor/students/${s.id}/monthly?cycle=1`}
                          className="text-xs rounded-full px-2.5 py-1 font-semibold bg-gradient-to-r from-fuchsia/10 to-rose/10 text-fuchsia border border-fuchsia/15 hover:from-fuchsia/20 hover:to-rose/20 transition"
                        >
                          월간
                        </Link>
                      </div>
                    ) : (
                      <span className="text-xs text-ink/40">시작일 미설정</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(s.id)} className="text-xs text-rose hover:underline">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink/40 text-sm">
                    아직 등록된 학생이 없습니다
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink/55 font-medium">{label}</label>
      {children}
    </div>
  );
}
