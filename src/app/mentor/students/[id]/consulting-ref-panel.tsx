"use client";

import { useState } from "react";
import { fieldsFor } from "@/lib/consulting/forms";
import type { ConsultingSubmission } from "@/types";

/**
 * 레포트 에디터 상단에 띄우는 "학생 제출 내용" 참고 패널 (읽기 전용).
 * 제출 데이터는 레포트 본문에 자동 반영하지 않고, 멘토가 보고 참고만 한다.
 * 인쇄(PDF)에는 포함하지 않음(no-print).
 */
export function ConsultingRefPanel({ submission }: { submission: ConsultingSubmission | null }) {
  const [open, setOpen] = useState(false);
  if (!submission) return null;

  const fields = fieldsFor(submission.form_type);
  const when = new Date(submission.submitted_at).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const typeLabel =
    submission.form_type === "monthly"
      ? "월간 비전 컨설팅"
      : submission.form_type === "pre"
        ? "사전 질문지"
        : "주간 성장 코칭";

  return (
    <div className="no-print rounded-2xl border border-indigo/20 bg-gradient-to-br from-indigo/[0.04] to-fuchsia/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo/10 text-indigo px-2.5 py-1 text-[11px] font-semibold">
            📋 학생 제출 내용
          </span>
          <span className="text-xs text-ink/55">
            {submission.week_number}주차 · {typeLabel} · {when}
          </span>
        </div>
        <span className="text-ink/40 text-sm">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-indigo/10 pt-4">
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
                          className="h-28 w-28 rounded-xl object-cover border border-ink/10 hover:ring-2 hover:ring-indigo/30 transition"
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
      )}
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
