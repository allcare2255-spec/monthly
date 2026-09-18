"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DemoLink, DemoSession, DemoStats } from "@/lib/demo/aggregate";

const RANGES: { label: string; value: string }[] = [
  { label: "7일", value: "7" },
  { label: "30일", value: "30" },
  { label: "90일", value: "90" },
  { label: "전체", value: "all" },
];

function ms(v: number) {
  if (!v) return "–";
  const s = Math.round(v / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return `${m}분 ${s % 60}초`;
}
function when(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

export function DemoView({
  stats,
  links,
  days,
}: {
  stats: DemoStats;
  links: DemoLink[];
  days: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    label: "",
    who_type: "parent",
    grade: "",
    channel: "카카오채널",
    contact: "",
    memo: "",
    code: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [detail, setDetail] = useState<DemoSession | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkUrl = (code: string) => `${origin}/demo?c=${code}`;

  const byCode = useMemo(() => {
    const m = new Map<string, DemoSession[]>();
    for (const s of stats.sessions) {
      if (!s.code) continue;
      const list = m.get(s.code) ?? [];
      list.push(s);
      m.set(s.code, list);
    }
    return m;
  }, [stats.sessions]);

  const anonymous = stats.sessions.filter((s) => !s.code);
  const maxReach = stats.funnel[0]?.reached || 1;

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/demo/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "발급에 실패했어요");
      await navigator.clipboard.writeText(linkUrl(json.link.code)).catch(() => {});
      setCopied(json.link.code);
      setForm({ label: "", who_type: "parent", grade: "", channel: "카카오채널", contact: "", memo: "", code: "" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "발급에 실패했어요");
    } finally {
      setSaving(false);
    }
  }

  async function copy(code: string) {
    await navigator.clipboard.writeText(linkUrl(code)).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
  }

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo">Demo funnel</div>
          <h1 className="text-gradient mt-2 text-4xl font-extrabold">개인 링크 &amp; 집계</h1>
          <p className="mt-2 text-sm text-ink/55">
            상담 오신 분께 개인 링크를 드리고, 체험 페이지를 어디까지 보셨는지 확인해요.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {RANGES.map((r) => {
            const active = (days === null ? "all" : String(days)) === r.value;
            return (
              <button
                key={r.value}
                onClick={() => router.push(`/admin/demo?days=${r.value}`)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                  active ? "bg-ink text-white" : "text-ink/55 hover:bg-ink/[0.04]"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="방문" value={stats.summary.visits} unit="번" />
        <Stat label="순 방문자" value={stats.summary.visitors} unit="명" />
        <Stat label="재방문" value={stats.summary.repeatVisits} unit="번" />
        <Stat
          label="끝까지 봄"
          value={stats.summary.completed}
          unit={`번 · ${pct(stats.summary.completed, stats.summary.visits)}%`}
        />
        <Stat
          label="상담 버튼"
          value={stats.summary.consult}
          unit={`번 · ${pct(stats.summary.consult, stats.summary.visits)}%`}
          highlight
        />
        <Stat label="평균 체류" value={ms(stats.summary.medActiveMs)} unit={`평균 ${ms(stats.summary.avgActiveMs)}`} />
      </div>

      {/* 퍼널 */}
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">단계별 이탈</h2>
          <span className="text-[12px] text-ink/45">평균 {stats.summary.avgMaxStep}단계까지 봄</span>
        </div>
        <div className="mt-4 space-y-1.5">
          {stats.funnel.map((f) => (
            <div key={f.index} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-right text-[12.5px] font-semibold text-ink/70">
                {f.index + 1}. {f.label}
              </div>
              <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-ink/[0.04]">
                <div
                  className="h-full rounded-lg bg-gradient-to-r from-sky-400 to-sky-600 transition-all"
                  style={{ width: `${pct(f.reached, maxReach)}%` }}
                />
                <div className="absolute inset-y-0 left-2.5 flex items-center gap-2 text-[12px] font-bold text-white mix-blend-difference">
                  {f.reached}명
                  <span className="font-medium opacity-80">{pct(f.reached, maxReach)}%</span>
                </div>
              </div>
              <div className="w-24 shrink-0 text-[12px] text-ink/45">{ms(f.avgMs)}</div>
              <div className="w-20 shrink-0 text-[12px] font-semibold text-rose-500">
                {f.leftHere > 0 ? `−${f.leftHere} 이탈` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 개인 링크 */}
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">발급한 개인 링크</h2>
            <p className="mt-1 text-[12.5px] text-ink/50">누구에게 어떤 링크를 줬는지, 그분이 어디까지 봤는지</p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl bg-ink px-4 py-2 text-[13px] font-bold text-white transition hover:bg-ink/85"
          >
            {open ? "닫기" : "+ 링크 발급"}
          </button>
        </div>

        {open && (
          <div className="mt-4 rounded-2xl border border-ink/[0.07] bg-ink/[0.02] p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="받는 분 *" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="고2 김OO 학부모님" />
              <Select
                label="구분"
                value={form.who_type}
                onChange={(v) => setForm({ ...form, who_type: v })}
                options={[
                  ["parent", "학부모"],
                  ["student", "학생"],
                  ["etc", "기타"],
                ]}
              />
              <Field label="학년" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} placeholder="고2" />
              <Field label="상담 경로" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} placeholder="카카오채널" />
              <Field label="연락처 · 카톡 닉네임" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} placeholder="구분용 메모" />
              <Field label="직접 지정할 코드" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="비우면 자동 생성" />
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="상담 메모" value={form.memo} onChange={(v) => setForm({ ...form, memo: v })} placeholder="상담 내용, 고민 등" />
              </div>
            </div>
            {error && <div className="mt-3 text-[13px] font-semibold text-rose-500">{error}</div>}
            <button
              onClick={create}
              disabled={saving || !form.label.trim()}
              className="mt-4 rounded-xl bg-sky-600 px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-sky-700 disabled:opacity-40"
            >
              {saving ? "발급 중…" : "발급하고 링크 복사"}
            </button>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink/[0.07] text-[11.5px] text-ink/45">
                <th className="py-2 text-left font-semibold">받는 분</th>
                <th className="py-2 text-left font-semibold">발급일</th>
                <th className="py-2 text-center font-semibold">방문</th>
                <th className="py-2 text-left font-semibold">어디까지 봤나</th>
                <th className="py-2 text-center font-semibold">체류</th>
                <th className="py-2 text-center font-semibold">상담</th>
                <th className="py-2 text-left font-semibold">마지막 방문</th>
                <th className="py-2 text-right font-semibold">링크</th>
              </tr>
            </thead>
            <tbody>
              {links.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink/40">
                    아직 발급한 링크가 없어요. 상담 오신 분께 드릴 링크를 발급해보세요.
                  </td>
                </tr>
              )}
              {links.map((l) => {
                const ss = byCode.get(l.code) ?? [];
                const best = ss.reduce((a, s) => Math.max(a, s.maxStep), -1);
                const total = ss.reduce((a, s) => a + s.activeMs, 0);
                const consulted = ss.some((s) => s.consult);
                const last = ss[0];
                return (
                  <tr key={l.code} className="border-b border-ink/[0.05] hover:bg-ink/[0.015]">
                    <td className="py-2.5">
                      <div className="font-bold text-ink/85">{l.label}</div>
                      <div className="text-[11.5px] text-ink/45">
                        {[l.grade, l.channel, l.contact].filter(Boolean).join(" · ")}
                        {l.memo ? ` — ${l.memo}` : ""}
                      </div>
                    </td>
                    <td className="py-2.5 text-ink/55">{when(l.created_at)}</td>
                    <td className="py-2.5 text-center font-bold">{ss.length || <span className="text-ink/30">0</span>}</td>
                    <td className="py-2.5">
                      {best < 0 ? (
                        <span className="text-ink/35">아직 안 열어봄</span>
                      ) : (
                        <span className="font-semibold text-ink/75">
                          {best + 1}. {stats.steps[best]?.label}
                          {best >= stats.steps.length - 1 && (
                            <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                              완주
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-center text-ink/60">{ms(total)}</td>
                    <td className="py-2.5 text-center">
                      {consulted ? <span className="text-[15px]">✅</span> : <span className="text-ink/25">–</span>}
                    </td>
                    <td className="py-2.5 text-ink/55">{last ? when(last.lastAt) : "–"}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => copy(l.code)}
                        className="rounded-lg bg-ink/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-ink/70 transition hover:bg-ink/10"
                      >
                        {copied === l.code ? "복사됨!" : "복사"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 방문 기록 */}
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">방문 기록</h2>
        <p className="mt-1 text-[12.5px] text-ink/50">
          개인 링크 없이 들어온 방문 {anonymous.length}번 포함 · 행을 누르면 단계별 체류 시간을 봅니다
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink/[0.07] text-[11.5px] text-ink/45">
                <th className="py-2 text-left font-semibold">시각</th>
                <th className="py-2 text-left font-semibold">누구</th>
                <th className="py-2 text-left font-semibold">어디까지</th>
                <th className="py-2 text-center font-semibold">체류</th>
                <th className="py-2 text-center font-semibold">상담</th>
                <th className="py-2 text-left font-semibold">기기 · 유입</th>
              </tr>
            </thead>
            <tbody>
              {stats.sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink/40">
                    아직 방문 기록이 없어요.
                  </td>
                </tr>
              )}
              {stats.sessions.slice(0, 200).map((s) => {
                const link = s.code ? links.find((l) => l.code === s.code) : null;
                return (
                  <tr
                    key={s.sessionId}
                    onClick={() => setDetail(detail?.sessionId === s.sessionId ? null : s)}
                    className="cursor-pointer border-b border-ink/[0.05] hover:bg-ink/[0.015]"
                  >
                    <td className="py-2.5 whitespace-nowrap text-ink/55">{when(s.firstAt)}</td>
                    <td className="py-2.5">
                      {link ? (
                        <span className="font-bold text-ink/85">{link.label}</span>
                      ) : s.code ? (
                        <span className="font-semibold text-ink/60">코드 {s.code}</span>
                      ) : (
                        <span className="text-ink/45">익명 {s.visitorId.slice(0, 4)}</span>
                      )}
                      {s.visitNo > 1 && (
                        <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">
                          {s.visitNo}번째
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-ink/75">
                      {s.maxStep + 1}. {stats.steps[s.maxStep]?.label}
                      {s.completed && <span className="ml-1.5 text-[11px] font-bold text-emerald-600">완주</span>}
                    </td>
                    <td className="py-2.5 text-center text-ink/60">{ms(s.activeMs)}</td>
                    <td className="py-2.5 text-center">{s.consult ? "✅" : <span className="text-ink/25">–</span>}</td>
                    <td className="py-2.5 text-[12px] text-ink/50">
                      {[s.device, s.os, s.inapp ? `${s.inapp} 인앱` : null, s.city].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="mt-4 rounded-2xl border border-ink/[0.07] bg-ink/[0.02] p-4">
            <div className="text-[13px] font-bold">단계별 머문 시간</div>
            <div className="mt-2.5 grid gap-1 sm:grid-cols-2">
              {stats.steps.map((st, i) => (
                <div
                  key={st.key}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-[12.5px] ${
                    i > detail.maxStep ? "text-ink/25" : "bg-white text-ink/75"
                  }`}
                >
                  <span>
                    {i + 1}. {st.label}
                  </span>
                  <span className="font-semibold">
                    {i > detail.maxStep ? "안 봄" : ms(detail.stepMs[i])}
                    {detail.scrollPct[i] > 0 && i <= detail.maxStep && (
                      <span className="ml-1.5 text-[11px] text-ink/40">↓{detail.scrollPct[i]}%</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12px] text-ink/45">
              뒤로 {detail.backCount}번 · 단계 건너뛰기 {detail.chipCount}번 · 총 {ms(detail.dwellMs)} 열어둠 ·{" "}
              {detail.referrer ? `유입 ${detail.referrer.slice(0, 60)}` : "링크 직접 열기"}
            </div>
          </div>
        )}
      </section>

      {/* 기기 · 유입 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Breakdown title="기기" rows={stats.devices} total={stats.summary.visits} />
        <Breakdown title="유입 경로" rows={stats.sources} total={stats.summary.visits} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number | string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${highlight ? "bg-sky-600 text-white" : "bg-white"}`}>
      <div className={`text-[11.5px] font-semibold ${highlight ? "text-white/70" : "text-ink/45"}`}>{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {unit && <div className={`text-[11px] ${highlight ? "text-white/65" : "text-ink/40"}`}>{unit}</div>}
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: { label: string; n: number }[]; total: number }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <div className="mt-3 space-y-1.5">
        {rows.length === 0 && <div className="text-[13px] text-ink/35">기록 없음</div>}
        {rows.slice(0, 8).map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-[12.5px]">
            <span className="w-40 shrink-0 truncate text-ink/65">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
              <div className="h-full rounded-full bg-indigo/60" style={{ width: `${pct(r.n, total)}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right font-semibold text-ink/55">{r.n}번</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold text-ink/50">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-ink/[0.1] bg-white px-3 py-2 text-[13px] outline-none focus:border-sky-400"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold text-ink/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-ink/[0.1] bg-white px-3 py-2 text-[13px] outline-none focus:border-sky-400"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
