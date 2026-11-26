"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReviewOverviewRow } from "@/lib/review/overview";
import type { ReviewStatus } from "@/lib/review/store";
import { ReviewStatusBadge } from "@/app/mentor/review/status-badge";
import { fmtDuration } from "@/lib/review/format";

const STATUSES: ReviewStatus[] = ["링크 공유 전", "문제 풀이 중", "진행 완료"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const w = WEEK[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}월 ${day}일 (${w})`;
}

function when(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso);
  const k = new Date(t.getTime() + 9 * 3600e3);
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${hh}:${mm}`;
}

export function ReviewsView({ rows }: { rows: ReviewOverviewRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ReviewStatus>("");
  const [mentor, setMentor] = useState("");

  const mentors = useMemo(
    () => Array.from(new Set(rows.map((r) => r.mentorName).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!mentor || r.mentorName === mentor) &&
        (!k || [r.studentName, r.mentorName, r.unit, r.code].some((v) => (v || "").toLowerCase().includes(k)))
    );
  }, [rows, q, status, mentor]);

  const groups = useMemo(() => {
    const m = new Map<string, ReviewOverviewRow[]>();
    for (const r of filtered) {
      const list = m.get(r.issueDate) ?? [];
      list.push(r);
      m.set(r.issueDate, list);
    }
    return Array.from(m.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, list]) => ({
        date,
        list: list.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "", "ko") || a.unit.localeCompare(b.unit, "ko")),
      }));
  }, [filtered]);

  const count = (s: ReviewStatus, list = filtered) => list.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">Review</div>
        <h1 className="text-3xl font-extrabold text-gradient mt-1">복습 테스트 현황</h1>
        <p className="text-ink/55 mt-2 text-sm">
          출제일별로 학생에게 낸 테스트와 진행상황을 봅니다. 풀이 시간은 첫 답을 입력한 순간부터 제출까지입니다.
        </p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["전체", filtered.length, "text-ink"],
          ["링크 공유 전", count("링크 공유 전"), "text-ink/60"],
          ["문제 풀이 중", count("문제 풀이 중"), "text-amber-700"],
          ["진행 완료", count("진행 완료"), "text-emerald-700"],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="rounded-2xl bg-white border border-ink/5 px-4 py-3">
            <div className="text-xs text-ink/50">{label}</div>
            <div className={`text-2xl font-extrabold tabular-nums ${cls}`}>{n as number}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="학생·멘토·테스트 이름 검색"
          className="flex-1 min-w-[200px] rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | ReviewStatus)}
          className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
        >
          <option value="">모든 상태</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={mentor}
          onChange={(e) => setMentor(e.target.value)}
          className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
        >
          <option value="">모든 멘토</option>
          {mentors.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <p className="text-center text-ink/40 py-16 text-sm">조건에 맞는 테스트가 없습니다.</p>
      )}

      {groups.map(({ date, list }) => (
        <section key={date} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-bold text-ink">{dateLabel(date)} 출제</h2>
            <span className="text-xs text-ink/45">
              {list.length}개 · 공유 전 {count("링크 공유 전", list)} · 풀이 중 {count("문제 풀이 중", list)} · 완료{" "}
              {count("진행 완료", list)}
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-ink/5 overflow-hidden divide-y divide-ink/5">
            {list.map((r) => (
              <Link
                key={r.id}
                href={`/mentor/review/${r.id}`}
                className="grid grid-cols-1 md:grid-cols-[7rem_1fr_6.5rem_7.5rem_6.5rem_7.5rem] gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-indigo/[0.03] transition items-center"
              >
                <div>
                  <div className="font-bold text-ink">{r.studentName || "(학생 없음)"}</div>
                  <div className="text-[11px] text-ink/40">{r.mentorName ? `${r.mentorName} 멘토` : ""}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{r.unit}</div>
                  <div className="text-[11px] text-ink/40">
                    {r.questionCount}문항 · {r.code}
                  </div>
                </div>
                <div className="text-[11px]">
                  <ReviewStatusBadge status={r.status} />
                </div>
                <div className="text-xs text-ink/70">
                  {r.fullCount + r.retryCount === 0 ? (
                    <span className="text-ink/35">아직 안 풂</span>
                  ) : (
                    <>
                      처음부터 <b className="tabular-nums">{r.fullCount}</b>회
                      {r.retryCount > 0 && (
                        <>
                          <br />
                          오답만 <b className="tabular-nums">{r.retryCount}</b>회
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="text-xs text-ink/70 tabular-nums">
                  {r.firstScore == null ? (
                    <span className="text-ink/35">-</span>
                  ) : r.fullCount > 1 ? (
                    <>
                      {r.firstScore}점 → <b>{r.lastScore}점</b>
                    </>
                  ) : (
                    <b>{r.firstScore}점</b>
                  )}
                </div>
                <div className="text-xs text-ink/55">
                  {r.lastAt ? (
                    <>
                      {when(r.lastAt)}
                      {r.lastWasRetry && <span className="text-rose"> (오답)</span>}
                      <br />
                      {fmtDuration(r.lastDurationSec) ? `풀이 ${fmtDuration(r.lastDurationSec)}` : <span className="text-ink/35">시간 기록 없음</span>}
                    </>
                  ) : (
                    <span className="text-ink/35">-</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
