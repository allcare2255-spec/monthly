"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fieldsFor, FORM_TITLE } from "@/lib/consulting/forms";
import { noteToHtml, isEmptyNoteHtml } from "@/lib/consulting/note-html";
import type { ConsultingSubmission, ConsultingFormType } from "@/types";
import { RichEditor } from "./rich-editor";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ConsultWorkspace({
  studentId,
  studentName,
  mentorName,
  cumWeek,
  cycle,
  weekStart,
  weekEnd,
  submission,
  expectedType,
  initialNote,
  noteSavable,
}: {
  studentId: string;
  studentName: string;
  mentorName: string;
  cumWeek: number;
  cycle: number;
  weekStart: string | null;
  weekEnd: string | null;
  submission: ConsultingSubmission | null;
  expectedType: ConsultingFormType;
  initialNote: string;
  noteSavable: boolean;
}) {
  // 예전 평문 메모도 그대로 열리도록 HTML 로 정규화해 시작한다
  const initialHtml = useMemo(() => noteToHtml(initialNote), [initialNote]);

  const [note, setNote] = useState(initialHtml);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState(false);

  // 저장한 마지막 값 — 이 값과 같으면 자동 저장을 건너뛴다
  const savedRef = useRef(initialHtml);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (raw: string) => {
      if (!noteSavable) return;
      // 빈 문단만 남은 상태("<p></p>")는 빈 값으로 취급 — 빈 행이 쌓이지 않게 한다
      const value = isEmptyNoteHtml(raw) ? "" : raw;
      if (value === savedRef.current) return;
      setSaveState("saving");
      try {
        const res = await fetch("/api/consulting/note", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ student_id: studentId, week_number: cumWeek, note: value }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "저장 실패");
        }
        savedRef.current = value;
        setErrorMsg("");
        setSaveState("saved");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "저장 실패");
        setSaveState("error");
      }
    },
    [studentId, cumWeek, noteSavable],
  );

  const dirty = (isEmptyNoteHtml(note) ? "" : note) !== savedRef.current;

  // 0.8초 디바운스 자동 저장
  useEffect(() => {
    if (!noteSavable) return;
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(note), 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [note, dirty, save, noteSavable]);

  // 저장 안 된 채로 페이지를 떠나려 할 때 경고
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // 이 페이지에서만 Shell 폭 제한 해제 (좌우 여백 축소 → 2단을 넓게)
  useEffect(() => {
    document.body.classList.add("consult-page");
    return () => document.body.classList.remove("consult-page");
  }, []);

  useEffect(() => {
    if (preview) document.body.classList.add("preview-active");
    else document.body.classList.remove("preview-active");
    return () => document.body.classList.remove("preview-active");
  }, [preview]);

  const typeLabel = FORM_TITLE[submission?.form_type ?? expectedType];

  return (
    <>
      {/* 좌: 학생 제출 폼 / 우: 멘토 메모 — 화면 공유용 2단.
          items-stretch(기본) + flex 로 양쪽 카드 높이를 같게 맞춘다. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        <SubmissionPanel submission={submission} typeLabel={typeLabel} cumWeek={cumWeek} />

        <section className="flex flex-col rounded-2xl bg-white border border-ink/5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-5 py-3.5">
            <h2 className="text-base font-bold text-ink">컨설팅 내용 정리</h2>
            <div className="flex items-center gap-2">
              <SaveBadge state={saveState} savable={noteSavable} error={errorMsg} />
              <ShareMenu studentId={studentId} cumWeek={cumWeek} />
              <button
                onClick={() => setPreview(true)}
                className="btn-gradient rounded-xl px-3.5 py-1.5 text-xs font-semibold"
              >
                PDF로 저장
              </button>
            </div>
          </div>
          <div className="flex flex-1 flex-col p-5">
            <RichEditor
              studentId={studentId}
              initialHtml={initialHtml}
              onChange={setNote}
              editable={noteSavable}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink/45">
              <span>
                자동 저장됩니다. &quot;/&quot; 로 블록 추가, 왼쪽 ⠿ 를 잡아 순서 변경·＋로 블록 추가.
              </span>
              <button
                onClick={() => save(note)}
                disabled={!noteSavable || !dirty}
                className="font-semibold text-indigo hover:underline disabled:text-ink/25 disabled:no-underline"
              >
                지금 저장
              </button>
            </div>
          </div>
        </section>
      </div>

      {preview && (
        <ConsultPreview
          studentName={studentName}
          mentorName={mentorName}
          cumWeek={cumWeek}
          cycle={cycle}
          weekStart={weekStart}
          weekEnd={weekEnd}
          submission={submission}
          typeLabel={typeLabel}
          note={note}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

/** 공개 링크 만들기 / 끄기 — 그 주차의 "학생 제출 + 멘토 메모"만 열리는 주소 */
function ShareMenu({ studentId, cumWeek }: { studentId: string; cumWeek: number }) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<{ token: string | null; enabled: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 패널을 열 때 현재 상태를 읽어온다
  useEffect(() => {
    if (!open || share) return;
    let alive = true;
    fetch(`/api/consulting/note/share?student_id=${studentId}&week_number=${cumWeek}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "상태를 불러오지 못했습니다.");
        return d as { token: string | null; enabled: boolean };
      })
      .then((d) => alive && setShare(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "오류"));
    return () => {
      alive = false;
    };
  }, [open, share, studentId, cumWeek]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  async function act(action: "enable" | "disable" | "regenerate") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/consulting/note/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, week_number: cumWeek, action }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "실패했습니다.");
      setShare(d);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const url = share?.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${share.token}` : "";
  const live = Boolean(share?.enabled && share?.token);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("복사에 실패했습니다. 주소를 직접 선택해 복사해주세요.");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-ink/5"
      >
        🔗 링크 공유
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[330px] rounded-2xl border border-ink/10 bg-white p-4 shadow-xl">
          <div className="text-sm font-bold text-ink">{cumWeek}주차 기록 공유</div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/50">
            이 주차의 <b>학생 제출 내용</b>과 <b>멘토 메모</b>만 열립니다. 로그인 없이 링크만
            있으면 볼 수 있으니 전달에 주의해주세요.
          </p>

          {!share && !error && <p className="mt-3 text-xs text-ink/45">불러오는 중…</p>}

          {share && (
            <>
              {live ? (
                <>
                  <div className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-3 py-2">
                    <div className="break-all text-[11px] leading-relaxed text-ink/70">{url}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={copy}
                      className="btn-gradient rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                    >
                      {copied ? "복사됨!" : "주소 복사"}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-[11px] font-semibold text-ink/70 hover:bg-ink/5"
                    >
                      미리보기
                    </a>
                    <button
                      onClick={() => act("disable")}
                      disabled={busy}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-[11px] font-semibold text-ink/70 hover:bg-ink/5 disabled:opacity-50"
                    >
                      링크 끄기
                    </button>
                    <button
                      onClick={() => act("regenerate")}
                      disabled={busy}
                      className="rounded-lg border border-rose/30 px-3 py-1.5 text-[11px] font-semibold text-rose hover:bg-rose/5 disabled:opacity-50"
                    >
                      새 주소로 교체
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-ink/40">
                    &quot;새 주소로 교체&quot;를 누르면 이전에 보낸 링크는 즉시 열리지 않습니다.
                  </p>
                </>
              ) : (
                <>
                  <button
                    onClick={() => act("enable")}
                    disabled={busy}
                    className="btn-gradient mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {busy ? "만드는 중…" : share.token ? "링크 다시 켜기" : "공유 링크 만들기"}
                  </button>
                  {share.token && (
                    <p className="mt-2 text-[10px] text-ink/40">
                      지금은 꺼져 있습니다. 다시 켜면 이전과 같은 주소가 살아납니다.
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {error && <p className="mt-2 text-[11px] font-semibold text-rose">{error}</p>}
        </div>
      )}
    </div>
  );
}

function SaveBadge({ state, savable, error }: { state: SaveState; savable: boolean; error: string }) {
  if (!savable) return <span className="text-[11px] text-sunset font-semibold">저장 불가</span>;
  if (state === "saving") return <span className="text-[11px] text-ink/45">저장 중…</span>;
  if (state === "saved") return <span className="text-[11px] text-emerald-600 font-semibold">저장됨</span>;
  if (state === "error")
    return <span className="text-[11px] text-rose font-semibold" title={error}>저장 실패</span>;
  return null;
}

function SubmissionPanel({
  submission,
  typeLabel,
  cumWeek,
}: {
  submission: ConsultingSubmission | null;
  typeLabel: string;
  cumWeek: number;
}) {
  return (
    <section className="rounded-2xl bg-white border border-ink/5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-5 py-3.5">
        <h2 className="text-base font-bold text-ink">학생 제출 내용</h2>
        <span className="rounded-full bg-indigo/10 text-indigo px-2.5 py-1 text-[11px] font-semibold">
          {typeLabel}
        </span>
      </div>
      <div className="p-5">
        {submission ? (
          <SubmissionBody submission={submission} />
        ) : (
          <p className="py-16 text-center text-sm text-ink/45">
            아직 학생이 {cumWeek}주차 {typeLabel}을(를) 제출하지 않았어요.
          </p>
        )}
      </div>
    </section>
  );
}

function SubmissionBody({ submission }: { submission: ConsultingSubmission }) {
  const fields = fieldsFor(submission.form_type);
  return (
    <div className="space-y-5">
      {fields.map((f) => {
        if (f.type === "image") {
          const imgs = submission.file_paths?.[f.key] || [];
          if (!imgs.length) return null;
          return (
            <Block key={f.key} label={f.label}>
              <div className="flex flex-wrap gap-2">
                {imgs.map((im) => (
                  <a key={im.path} href={im.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.url}
                      alt=""
                      className="h-40 w-40 rounded-xl object-cover border border-ink/10 hover:ring-2 hover:ring-indigo/30 transition"
                    />
                  </a>
                ))}
              </div>
            </Block>
          );
        }
        const text = submission.answers?.[f.key];
        if (!text) return null;
        return (
          <Block key={f.key} label={f.label}>
            <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{text}</p>
          </Block>
        );
      })}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-indigo font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}

/** PDF 저장용 미리보기 — 주간/월간 레포트와 동일한 인쇄 패턴 (window.print) */
function ConsultPreview({
  studentName,
  mentorName,
  cumWeek,
  cycle,
  weekStart,
  weekEnd,
  submission,
  typeLabel,
  note,
  onClose,
}: {
  studentName: string;
  mentorName: string;
  cumWeek: number;
  cycle: number;
  weekStart: string | null;
  weekEnd: string | null;
  submission: ConsultingSubmission | null;
  typeLabel: string;
  note: string;
  onClose: () => void;
}) {
  const [preparing, setPreparing] = useState(false);

  async function handleSavePdf() {
    setPreparing(true);
    try {
      // 미리보기 안의 이미지 디코딩 완료까지 대기 → 인쇄 중 멈춤 방지
      const root = document.querySelector("[data-preview-root]");
      if (root) {
        const imgs = Array.from(root.querySelectorAll("img"));
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? img.decode().catch(() => {})
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                }),
          ),
        );
      }
    } finally {
      setPreparing(false);
    }

    const fileName = `${studentName} ${cumWeek}주차 컨설팅 기록`
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const prevTitle = document.title;
    document.title = fileName;
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const fmtDot = (d: string | null) => (d || "").replace(/-/g, ".");
  const fields = submission ? fieldsFor(submission.form_type) : [];

  return (
    <div data-preview-root className="fixed inset-0 z-50 overflow-auto bg-white">
      <div className="preview-actions no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur border-b border-ink/10 px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 transition"
        >
          ← 닫기
        </button>
        <div className="text-sm font-semibold text-ink/60">컨설팅 기록 미리보기</div>
        <button
          onClick={handleSavePdf}
          disabled={preparing}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5 disabled:opacity-60"
        >
          {preparing ? "준비 중..." : "PDF로 저장"}
        </button>
      </div>

      <div className="preview-doc mx-auto max-w-[860px] px-4 sm:px-6 py-6 sm:py-8">
        <header className="preview-banner overflow-hidden rounded-3xl bg-gradient-to-r from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] px-6 py-6 sm:px-9 sm:py-8 text-white shadow-lg shadow-[#0ea5e9]/25">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="SKY MATE 로고" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">SKY MATE</div>
                <div className="mt-0.5 text-[13px] font-medium text-white/70">{typeLabel} 컨설팅 기록</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold sm:text-[26px]">{cumWeek}주차</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                코칭 {cycle}개월차
                {weekStart && weekEnd ? (
                  <>
                    <br />
                    {fmtDot(weekStart)} ~ {fmtDot(weekEnd)}
                  </>
                ) : null}
                {mentorName ? (
                  <>
                    <br />
                    담당 {mentorName} 멘토
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="preview-body pt-7">
          <h1 className="text-3xl font-extrabold text-ink">
            {studentName} <span className="text-ink/30">·</span> {cumWeek}주차 컨설팅
          </h1>

          <section className="mt-6 print-avoid-break">
            <h2 className="text-lg font-extrabold text-ink mb-3">컨설팅 내용 정리</h2>
            <div className="comment-card rounded-2xl border border-ink/10 bg-[#f8fafc] px-5 py-4">
              {isEmptyNoteHtml(note) ? (
                <p className="text-sm text-ink/40">작성된 내용이 없습니다.</p>
              ) : (
                /* 에디터에서 만든 HTML 을 화면과 같은 스타일(.rich-content)로 렌더 */
                <div className="rich-content" dangerouslySetInnerHTML={{ __html: note }} />
              )}
            </div>
          </section>

          {submission && (
            <section className="mt-8">
              <h2 className="text-lg font-extrabold text-ink mb-3">학생 제출 내용 · {typeLabel}</h2>
              <div className="space-y-4">
                {fields.map((f) => {
                  if (f.type === "image") {
                    const imgs = submission.file_paths?.[f.key] || [];
                    if (!imgs.length) return null;
                    return (
                      <div
                        key={f.key}
                        className="preview-photos rounded-2xl border border-ink/10 px-5 py-4"
                      >
                        <div className="text-[11px] font-semibold text-[#0284c7] mb-2">{f.label}</div>
                        <div className="flex flex-wrap gap-2">
                          {imgs.map((im) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={im.path}
                              src={im.url}
                              alt=""
                              className="max-h-64 rounded-xl border border-ink/10 object-contain"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }
                  const text = submission.answers?.[f.key];
                  if (!text) return null;
                  return (
                    <div
                      key={f.key}
                      className="print-avoid-break rounded-2xl border border-ink/10 px-5 py-4"
                    >
                      <div className="text-[11px] font-semibold text-[#0284c7] mb-1.5">{f.label}</div>
                      <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
