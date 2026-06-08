"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CycleNote = { id: string; text: string };

async function patchCycle(
  studentId: string,
  cycle: number,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch("/api/cycles", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ student_id: studentId, cycle_number: cycle, ...patch }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    alert(d.error || "저장 실패");
    return false;
  }
  return true;
}

/* ── [변경 2-1] 코칭 기간 날짜 인라인 편집 ── */
export function EditableCycleDate({
  studentId,
  cycle,
  defaultStart,
  defaultEnd,
  overrideStart,
  overrideEnd,
}: {
  studentId: string;
  cycle: number;
  defaultStart: string;
  defaultEnd: string;
  overrideStart: string | null;
  overrideEnd: string | null;
}) {
  const router = useRouter();
  const shownStart = overrideStart || defaultStart;
  const shownEnd = overrideEnd || defaultEnd;

  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(shownStart);
  const [end, setEnd] = useState(shownEnd);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const ok = await patchCycle(studentId, cycle, { start_date: start, end_date: end });
    setBusy(false);
    if (ok) {
      setEditing(false);
      router.refresh();
    }
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-lg border border-ink/15 px-2 py-0.5 text-xs outline-none focus:border-indigo"
        />
        <span className="text-ink/40">~</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-lg border border-ink/15 px-2 py-0.5 text-xs outline-none focus:border-indigo"
        />
        <button onClick={save} disabled={busy} className="text-xs font-semibold text-indigo hover:underline">
          확인
        </button>
        <button
          onClick={() => {
            setStart(shownStart);
            setEnd(shownEnd);
            setEditing(false);
          }}
          className="text-xs text-ink/50 hover:underline"
        >
          취소
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span>
        {shownStart} ~ {shownEnd}
      </span>
      <button
        onClick={() => {
          setStart(shownStart);
          setEnd(shownEnd);
          setEditing(true);
        }}
        title="코칭 기간 수정"
        className="no-print text-indigo/80 hover:text-indigo"
      >
        ✏️
      </button>
    </span>
  );
}

/* ── [변경 2-2] 관리자 전용 메모 (PDF 제외) ── */
export function AdminMemoPanel({
  studentId,
  cycle,
  initialNotes,
}: {
  studentId: string;
  cycle: number;
  initialNotes: CycleNote[];
}) {
  const [notes, setNotes] = useState<CycleNote[]>(initialNotes);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function persist(next: CycleNote[]) {
    setBusy(true);
    const ok = await patchCycle(studentId, cycle, { notes: next });
    setBusy(false);
    if (ok) setNotes(next);
    return ok;
  }

  async function addNote() {
    const text = draft.trim();
    if (!text) return;
    const next = [...notes, { id: crypto.randomUUID(), text }];
    if (await persist(next)) {
      setDraft("");
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    const text = editDraft.trim();
    if (!text) return;
    const next = notes.map((n) => (n.id === id ? { ...n, text } : n));
    if (await persist(next)) setEditingId(null);
  }

  async function removeNote(id: string) {
    if (!confirm("이 메모를 삭제할까요?")) return;
    await persist(notes.filter((n) => n.id !== id));
  }

  return (
    <section className="no-print rounded-2xl border border-sunset/25 bg-sunset/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink/80">
          관리자 메모 <span className="text-[11px] font-normal text-ink/45">· PDF에는 포함되지 않습니다</span>
        </h2>
        {!adding && (
          <button
            onClick={() => {
              setDraft("");
              setAdding(true);
            }}
            className="text-xs rounded-lg border border-sunset/30 bg-white/60 px-3 py-1.5 font-semibold text-sunset hover:bg-white transition"
          >
            + 메모 추가
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3">
          <textarea
            rows={2}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            placeholder="메모를 입력하세요"
            className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setAdding(false)} className="text-xs text-ink/50 hover:underline">
              취소
            </button>
            <button onClick={addNote} disabled={busy} className="text-xs font-semibold text-indigo hover:underline">
              저장
            </button>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-ink/10 bg-white px-3 py-2">
              {editingId === n.id ? (
                <div>
                  <textarea
                    rows={2}
                    value={editDraft}
                    autoFocus
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditingId(null)} className="text-xs text-ink/50 hover:underline">
                      취소
                    </button>
                    <button
                      onClick={() => saveEdit(n.id)}
                      disabled={busy}
                      className="text-xs font-semibold text-indigo hover:underline"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink/75 whitespace-pre-wrap flex-1">{n.text}</p>
                  <div className="flex shrink-0 gap-2 pt-0.5">
                    <button
                      onClick={() => {
                        setEditingId(n.id);
                        setEditDraft(n.text);
                      }}
                      className="text-xs text-indigo hover:underline"
                    >
                      수정
                    </button>
                    <button onClick={() => removeNote(n.id)} className="text-xs text-rose hover:underline">
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {notes.length === 0 && !adding && (
        <p className="mt-2 text-xs text-ink/45">작성된 메모가 없습니다.</p>
      )}
    </section>
  );
}
