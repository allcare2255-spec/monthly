"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mondayOf } from "@/lib/dates";

type Student = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  phone: string | null;
  parent_phone: string | null;
  high_school: string | null;
  mentor_id: string | null;
  coaching_start_date: string | null;
  coaching_ended?: boolean | null;
  mentor?: { name: string; mentor_code: string } | null;
};

type MentorOpt = { id: string; name: string };

// [변경 1] 학년 옵션
const GRADE_OPTIONS = ["고1", "고2", "고3", "재수생", "N수생"];

const EMPTY_FORM = {
  name: "",
  grade: "",
  phone: "",
  parent_phone: "",
  high_school: "",
  mentor_id: "",
  coaching_start_date: "",
};

export function StudentsView({
  initialStudents,
  mentors,
}: {
  initialStudents: Student[];
  mentors: MentorOpt[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [수정 6-3] 수정 모달
  const [editing, setEditing] = useState<Student | null>(null);

  // [변경 3] 재시작 모달
  const [restarting, setRestarting] = useState<Student | null>(null);

  // [수정 6-2] 엑셀 업로드
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const active = students.filter((s) => !s.coaching_ended);
  const ended = students.filter((s) => s.coaching_ended);

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

  // [수정 6-3] 코칭 종료 / 재개
  async function setEnded(id: string, ended: boolean) {
    const res = await fetch("/api/admin/students", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, coaching_ended: ended }),
    });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.error);
    }
    setStudents((s) => s.map((x) => (x.id === id ? { ...x, coaching_ended: ended } : x)));
    router.refresh();
  }

  // [변경 3] 코칭 재시작
  async function restart(id: string, restart_date: string) {
    const res = await fetch("/api/admin/students/restart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, restart_date }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "재시작 실패");
    setRestarting(null);
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

  // [수정 6-3] 수정 저장
  async function saveEdit(updated: Student) {
    const res = await fetch("/api/admin/students", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: updated.id,
        name: updated.name,
        grade: updated.grade,
        phone: updated.phone,
        parent_phone: updated.parent_phone,
        high_school: updated.high_school,
        mentor_id: updated.mentor_id,
        coaching_start_date: updated.coaching_start_date,
      }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    setStudents((s) => s.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    setEditing(null);
    router.refresh();
  }

  // ── [수정 6-2] 엑셀 템플릿 다운로드 ──
  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const header = [
      "이름",
      "학년",
      "학생 전화번호",
      "학부모 전화번호",
      "출신 고등학교",
      "담당 멘토",
      "첫 코칭 시작일 (월요일)",
    ];
    // 예시 시작일은 반드시 월요일로 안내 (2026-06-08 = 월). 월요일이 아니어도 업로드 시 자동 보정됨
    const example = ["김예시", "고3", "010-1234-5678", "010-8765-4321", "예시고등학교", mentors[0]?.name || "", "2026-06-08"];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws["!cols"] = header.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생목록");
    XLSX.writeFile(wb, "학생_일괄등록_양식.xlsx");
  }

  // ── [수정 6-2] 엑셀 업로드 ──
  function normDate(v: unknown): string | null {
    if (v == null || v === "") return null;
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    const m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(s);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return s;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const mentorByName = new Map(mentors.map((m) => [m.name.trim(), m.id]));
      let ok = 0;
      const fails: string[] = [];

      // "첫 코칭 시작일" 또는 "첫 코칭 시작일 (월요일)" 등 접두사로 시작하는 열을 모두 인식
      const startDateOf = (row: Record<string, unknown>) => {
        const key = Object.keys(row).find((k) => k.startsWith("첫 코칭 시작일"));
        return key ? row[key] : undefined;
      };

      for (const row of rows) {
        const name = String(row["이름"] ?? "").trim();
        if (!name) continue;
        const mentorName = String(row["담당 멘토"] ?? "").trim();
        const mentor_id = mentorName ? mentorByName.get(mentorName) ?? null : null;
        if (mentorName && !mentor_id) fails.push(`${name}: 멘토 "${mentorName}" 미발견 → 미배정 처리`);
        const gradeRaw = String(row["학년"] ?? "").trim();
        const payload = {
          name,
          grade: gradeRaw || null,
          phone: String(row["학생 전화번호"] ?? "").trim() || null,
          parent_phone: String(row["학부모 전화번호"] ?? "").trim() || null,
          high_school: String(row["출신 고등학교"] ?? "").trim() || null,
          mentor_id,
          coaching_start_date: normDate(startDateOf(row)),
        };
        const res = await fetch("/api/admin/students", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) ok++;
        else {
          const d = await res.json().catch(() => ({}));
          fails.push(`${name}: 등록 실패 (${d.error || res.status})`);
        }
      }

      setUploadMsg(`${ok}명 등록 완료${fails.length ? ` · 알림 ${fails.length}건:\n- ${fails.join("\n- ")}` : ""}`);
      if (ok > 0) {
        router.refresh();
        setTimeout(() => location.reload(), 1200);
      }
    } catch (err) {
      setUploadMsg(`업로드 실패: ${(err as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
          <Field label="학년">
            <select
              value={form.grade}
              onChange={(e) => setField("grade", e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>
                학년 선택
              </option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="학생 전화번호">
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
          <Field label="첫 코칭 시작일 (월요일 기준)">
            <input
              type="date"
              value={form.coaching_start_date}
              onChange={(e) => setField("coaching_start_date", e.target.value ? mondayOf(e.target.value) : "")}
              className={inputCls}
            />
            {form.coaching_start_date && (
              <p className="mt-1 text-[11px] text-indigo/70">
                코칭은 월요일에 시작합니다 · 시작일: {form.coaching_start_date}(월)
              </p>
            )}
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

      {/* [수정 6-2] 엑셀 일괄 업로드 */}
      <section className="rounded-2xl bg-white border border-ink/5 p-6 shadow-sm">
        <h2 className="text-base font-bold text-ink mb-1">엑셀 일괄 업로드</h2>
        <p className="text-xs text-ink/55 mb-4">
          양식을 내려받아 작성한 뒤 업로드하면 여러 학생을 한 번에 등록합니다. (담당 멘토는 이름으로 매칭됩니다)
          <br />
          <span className="text-indigo/70">
            ※ 코칭은 항상 <b>월요일</b>에 시작합니다. 시작일에 다른 요일을 적어도 그 주 월요일로 자동 보정됩니다.
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="text-sm rounded-xl border border-indigo/25 bg-gradient-to-r from-indigo/8 to-fuchsia/8 hover:from-indigo/15 hover:to-fuchsia/15 text-indigo font-semibold px-4 py-2 transition"
          >
            ↓ 양식 다운로드
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            disabled={uploading}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-gradient text-sm rounded-xl font-semibold px-5 py-2"
          >
            {uploading ? "업로드 중..." : "엑셀 파일 선택"}
          </button>
        </div>
        {uploadMsg && (
          <pre className="mt-3 whitespace-pre-wrap text-xs rounded-lg bg-indigo/5 border border-indigo/15 text-ink/70 px-3 py-2">
            {uploadMsg}
          </pre>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink mb-3">
          등록 학생 <span className="text-ink/40">({active.length})</span>
        </h2>
        <StudentTable
          students={active}
          mentors={mentors}
          onMentorChange={updateMentor}
          onEdit={setEditing}
          onEnd={(id) => setEnded(id, true)}
          onRemove={remove}
        />
      </section>

      {/* [수정 6-3 / 수정 7] 코칭 종료 학생 */}
      {ended.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-ink/70 mb-3">
            코칭 종료 학생 <span className="text-ink/40">({ended.length})</span>
          </h2>
          <div className="rounded-2xl bg-ink/[0.02] border border-ink/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink/5 text-ink/50 text-[11px] uppercase tracking-[0.15em]">
                <tr>
                  <th className="text-left px-4 py-3">학생</th>
                  <th className="text-left px-4 py-3">학교 / 학년</th>
                  <th className="text-left px-4 py-3">코칭 시작</th>
                  <th className="text-left px-4 py-3">담당 멘토</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5 text-ink/60">
                {ended.map((s) => (
                  <tr key={s.id} className="grayscale-[0.3]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-ink/40">{s.phone || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{s.high_school || "-"}</div>
                      <div className="text-xs text-ink/40">{s.grade || ""}</div>
                    </td>
                    <td className="px-4 py-3">{s.coaching_start_date || "-"}</td>
                    <td className="px-4 py-3">{s.mentor?.name || "미배정"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setRestarting(s)}
                        className="text-xs rounded-full px-2.5 py-1 font-semibold bg-gradient-to-r from-indigo/10 to-violet/10 text-indigo border border-indigo/15 hover:from-indigo/20 hover:to-violet/20 transition mr-3"
                      >
                        재시작
                      </button>
                      <button onClick={() => remove(s.id)} className="text-xs text-rose hover:underline">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <EditModal
          student={editing}
          mentors={mentors}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {restarting && (
        <RestartModal
          student={restarting}
          onClose={() => setRestarting(null)}
          onConfirm={(date) => restart(restarting.id, date)}
        />
      )}
    </div>
  );
}

// [변경 3] 코칭 재시작 모달
function RestartModal({
  student,
  onClose,
  onConfirm,
}: {
  student: Student;
  onClose: () => void;
  onConfirm: (date: string) => void;
}) {
  const today = (() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  })();
  const [date, setDate] = useState(mondayOf(today));
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink">코칭 재시작</h3>
        <p className="text-sm text-ink/60 mt-1">
          <span className="font-semibold text-ink">{student.name}</span> 학생의 코칭을 다시 시작합니다.
        </p>
        <p className="text-xs text-ink/45 mt-2 leading-relaxed">
          기존 코칭 이력은 유지되며, 선택한 날짜를 기준으로 이어지는 월차의 주간 레포트가 새로 생성됩니다.
        </p>
        <div className="mt-4">
          <label className="text-xs text-ink/55 font-medium">재시작일 (월요일 기준)</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value ? mondayOf(e.target.value) : "")}
            className={inputCls}
          />
          {date && (
            <p className="mt-1 text-[11px] text-indigo/70">월요일로 자동 조정됨 · {date}(월)</p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">
            취소
          </button>
          <button
            onClick={() => {
              if (!date) return;
              setBusy(true);
              onConfirm(date);
            }}
            disabled={busy || !date}
            className="btn-gradient rounded-xl font-semibold px-6 py-2 text-sm"
          >
            {busy ? "처리 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentTable({
  students,
  mentors,
  onMentorChange,
  onEdit,
  onEnd,
  onRemove,
}: {
  students: Student[];
  mentors: MentorOpt[];
  onMentorChange: (id: string, mentor_id: string) => void;
  onEdit: (s: Student) => void;
  onEnd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-ink/5 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-r from-indigo/5 to-fuchsia/5 text-ink/60 text-[11px] uppercase tracking-[0.15em]">
          <tr>
            <th className="text-left px-4 py-3">학생</th>
            <th className="text-left px-4 py-3">학교 / 학년</th>
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
                <div className="text-xs text-ink/50">{s.grade || ""}</div>
              </td>
              <td className="px-4 py-3 text-ink/70">{s.parent_phone || "-"}</td>
              <td className="px-4 py-3 text-ink/70">{s.coaching_start_date || "-"}</td>
              <td className="px-4 py-3">
                <select
                  value={s.mentor_id || ""}
                  onChange={(e) => onMentorChange(s.id, e.target.value)}
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
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button onClick={() => onEdit(s)} className="text-xs text-indigo hover:underline mr-3">
                  수정
                </button>
                <button onClick={() => onEnd(s.id)} className="text-xs text-sunset hover:underline mr-3">
                  코칭 종료
                </button>
                <button onClick={() => onRemove(s.id)} className="text-xs text-rose hover:underline">
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
  );
}

// [수정 6-3] 학생 정보 수정 모달
function EditModal({
  student,
  mentors,
  onClose,
  onSave,
}: {
  student: Student;
  mentors: MentorOpt[];
  onClose: () => void;
  onSave: (s: Student) => void;
}) {
  const [draft, setDraft] = useState<Student>({ ...student });
  function set<K extends keyof Student>(k: K, v: Student[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink mb-4">학생 정보 수정</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="이름 *">
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="학년">
            <select
              value={draft.grade ?? ""}
              onChange={(e) => set("grade", e.target.value || null)}
              className={inputCls}
            >
              <option value="" disabled>
                학년 선택
              </option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="학생 전화번호">
            <input value={draft.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="학부모 전화번호">
            <input
              value={draft.parent_phone ?? ""}
              onChange={(e) => set("parent_phone", e.target.value || null)}
              className={inputCls}
            />
          </Field>
          <Field label="출신 고등학교">
            <input
              value={draft.high_school ?? ""}
              onChange={(e) => set("high_school", e.target.value || null)}
              className={inputCls}
            />
          </Field>
          <Field label="담당 멘토">
            <select
              value={draft.mentor_id ?? ""}
              onChange={(e) => set("mentor_id", e.target.value || null)}
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
          <Field label="첫 코칭 시작일 (월요일 기준)">
            <input
              type="date"
              value={draft.coaching_start_date ?? ""}
              onChange={(e) => set("coaching_start_date", e.target.value ? mondayOf(e.target.value) : null)}
              className={inputCls}
            />
            {draft.coaching_start_date && (
              <p className="mt-1 text-[11px] text-indigo/70">
                코칭은 월요일에 시작합니다 · 시작일: {draft.coaching_start_date}(월)
              </p>
            )}
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5">
            취소
          </button>
          <button
            onClick={() => draft.name.trim() && onSave(draft)}
            className="btn-gradient rounded-xl font-semibold px-6 py-2 text-sm"
          >
            저장
          </button>
        </div>
      </div>
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
