"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fieldsFor } from "@/lib/consulting/forms";
import type { ConsultingSubmission } from "@/types";

type CurrentWeek =
  | { state: "form"; week: number; formType: "weekly" | "monthly" | "pre" }
  | { state: "other" };

export function ConsultingSection({
  token,
  submissions,
  trashed,
  current,
}: {
  token: string;
  submissions: ConsultingSubmission[];
  trashed: ConsultingSubmission[];
  current: CurrentWeek;
}) {
  const [showTrash, setShowTrash] = useState(false);
  const submittedThisWeek =
    current.state === "form" && submissions.some((s) => s.week_number === current.week);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">컨설팅 제출 내역</h2>
        <div className="flex items-center gap-2">
          {current.state === "form" && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                submittedThisWeek ? "bg-indigo/10 text-indigo" : "bg-sunset/15 text-sunset"
              }`}
            >
              {current.week}주차 {submittedThisWeek ? "제출완료" : "미제출"}
            </span>
          )}
          <button
            onClick={() => setShowTrash((v) => !v)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
              showTrash
                ? "bg-ink/80 text-white border-ink/80"
                : "bg-white text-ink/55 border-ink/10 hover:text-ink"
            }`}
          >
            🗑 휴지통 {trashed.length > 0 && `(${trashed.length})`}
          </button>
        </div>
      </div>

      <ShareLink token={token} />

      {showTrash ? (
        trashed.length === 0 ? (
          <p className="text-sm text-ink/45 py-5 text-center rounded-2xl bg-white border border-ink/5">
            휴지통이 비어 있습니다.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-ink/45">
              휴지통의 제출물은 레포트·컨설팅 화면에 표시되지 않습니다. 복원하기 전까지 보관되며, 기간 제한은 없습니다.
            </p>
            {trashed.map((s) => (
              <SubmissionCard key={s.id} sub={s} inTrash />
            ))}
          </div>
        )
      ) : submissions.length === 0 ? (
        <p className="text-sm text-ink/45 py-5 text-center rounded-2xl bg-white border border-ink/5">
          아직 제출된 컨설팅 폼이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} sub={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function ShareLink({ token }: { token: string }) {
  const base = typeof window !== "undefined" ? `${window.location.origin}/c/${token}` : "";
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <LinkRow label="사전 질문지 링크 (가입 직후 · 주차 무시하고 사전 질문지)" url={base ? `${base}?form=pre` : ""} />
      <LinkRow label="주간 성장 코칭 링크 (주차 무시하고 항상 주간 폼)" url={base ? `${base}?form=weekly` : ""} />
      <LinkRow label="월간 비전 컨설팅 링크 (주차 무시하고 항상 월간 폼)" url={base ? `${base}?form=monthly` : ""} />
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm bg-ink/[0.02] outline-none"
        />
        <button
          onClick={copy}
          className="btn-gradient rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
        >
          {copied ? "복사됨" : "링크 복사"}
        </button>
      </div>
    </div>
  );
}

function SubmissionCard({ sub, inTrash = false }: { sub: ConsultingSubmission; inTrash?: boolean }) {
  const [open, setOpen] = useState(false);
  const fields = fieldsFor(sub.form_type);
  const when = new Date(sub.submitted_at).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const typeLabel =
    sub.form_type === "monthly" ? "월간 비전 컨설팅" : sub.form_type === "pre" ? "사전 질문지" : "주간 성장 코칭";
  const badgeCls =
    sub.form_type === "monthly"
      ? "bg-fuchsia/10 text-fuchsia"
      : sub.form_type === "pre"
        ? "bg-violet/10 text-violet"
        : "bg-indigo/10 text-indigo";

  return (
    <div
      className={`rounded-2xl border shadow-sm overflow-hidden ${
        inTrash ? "bg-ink/[0.02] border-ink/10" : "bg-white border-ink/5"
      }`}
    >
      <div className="flex items-center gap-2 pr-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center justify-between gap-3 p-4 text-left hover:bg-ink/[0.015] transition"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeCls}`}>
              {sub.week_number}주차 · {typeLabel}
            </span>
            <span className="text-xs text-ink/45">{when}</span>
            {inTrash && <DeletedBadge sub={sub} />}
          </div>
          <span className="text-ink/40 text-sm">{open ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
        <TrashActions sub={sub} inTrash={inTrash} />
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-ink/5 pt-4">
          {fields.map((f) => {
            if (f.type === "image") {
              const imgs = sub.file_paths?.[f.key] || [];
              if (!imgs.length) return null;
              return (
                <PrepBlock key={f.key} label={f.label}>
                  <div className="flex flex-wrap gap-2">
                    {imgs.map((im) => (
                      <a key={im.path} href={im.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={im.url}
                          alt=""
                          className="h-32 w-32 rounded-xl object-cover border border-ink/10 hover:ring-2 hover:ring-indigo/30 transition"
                        />
                      </a>
                    ))}
                  </div>
                </PrepBlock>
              );
            }
            const text = sub.answers?.[f.key];
            if (!text) return null;
            return (
              <PrepBlock key={f.key} label={f.label}>
                <p className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed">{text}</p>
              </PrepBlock>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeletedBadge({ sub }: { sub: ConsultingSubmission }) {
  if (!sub.deleted_at) return null;
  const when = new Date(sub.deleted_at).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span className="rounded-full bg-ink/10 text-ink/55 px-2.5 py-1 text-[11px] font-semibold">
      {when} 삭제{sub.deleted_by ? ` · ${sub.deleted_by}` : ""}
    </span>
  );
}

/** 삭제(휴지통 이동) / 복원 / 영구삭제 — 멘토·관리자 모두 사용 가능. */
function TrashActions({ sub, inTrash }: { sub: ConsultingSubmission; inTrash: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function run(action: "delete" | "restore" | "purge") {
    if (action === "delete" && !confirm(`${sub.week_number}주차 제출물을 휴지통으로 옮길까요?\n휴지통에서 언제든 복원할 수 있습니다.`)) return;
    if (action === "purge" && !confirm(`${sub.week_number}주차 제출물을 영구삭제할까요?\n업로드된 이미지까지 사라지며 복원할 수 없습니다.`)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/consulting/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sub.id, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "처리에 실패했습니다.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      alert("네트워크 오류로 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;
  const btn = "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition disabled:opacity-40";

  if (!inTrash) {
    return (
      <button
        onClick={() => run("delete")}
        disabled={disabled}
        className={`${btn} border-ink/10 text-ink/50 hover:text-rose hover:border-rose/30`}
      >
        삭제
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => run("restore")}
        disabled={disabled}
        className={`${btn} border-indigo/30 text-indigo hover:bg-indigo/5`}
      >
        복원
      </button>
      <button
        onClick={() => run("purge")}
        disabled={disabled}
        className={`${btn} border-rose/30 text-rose hover:bg-rose/5`}
      >
        영구삭제
      </button>
    </div>
  );
}

function PrepBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-indigo font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}
