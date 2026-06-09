"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DayData, DayPhoto, DayStatus, WeeklyReport } from "@/types";
import { hmToMinutes, minutesToHm } from "@/lib/dates";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];

export function WeeklyReportEditor({
  studentId,
  cycle,
  week,
}: {
  studentId: string;
  cycle: number;
  week: number;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/weekly?student_id=${studentId}&cycle=${cycle}&week=${week}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d.report);
        setLoading(false);
      });
  }, [studentId, cycle, week]);

  // [수정 4-3] PDF 저장 시 textarea 내용이 잘리지 않도록 높이를 자동 확장
  useEffect(() => {
    function expand() {
      document.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((t) => {
        t.setAttribute("data-prev-h", t.style.height);
        t.style.height = "auto";
        t.style.height = `${t.scrollHeight + 2}px`;
      });
    }
    function restore() {
      document.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((t) => {
        t.style.height = t.getAttribute("data-prev-h") || "";
      });
    }
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  async function patch(patchObj: Partial<WeeklyReport>, fieldKey: string) {
    if (!report) return;
    setSavingField(fieldKey);
    const res = await fetch("/api/reports/weekly", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: report.id, student_id: studentId, ...patchObj }),
    });
    const data = await res.json();
    setSavingField(null);
    if (res.ok) setReport(data.report);
  }

  function updateDay(idx: number, dayPatch: Partial<DayData>) {
    if (!report) return;
    const nextDays = report.day_data.map((d, i) =>
      i === idx ? { ...d, ...dayPatch } : d,
    );
    setReport({ ...report, day_data: nextDays });
    return nextDays;
  }

  async function commitDay(idx: number, dayPatch: Partial<DayData>) {
    const next = updateDay(idx, dayPatch);
    if (!next) return;
    await patch({ day_data: next }, `day-${idx}`);
  }

  const stats = useMemo(() => {
    if (!report) return null;
    const days = report.day_data;
    const counted = days.filter((d) => d.status !== "paused");
    const submitted = days.filter((d) => d.status === "submitted").length;
    const totalDay = counted.length;
    const studyDays = counted.filter((d) => d.study_minutes != null);
    const totalStudy = studyDays.reduce((s, d) => s + (d.study_minutes || 0), 0);
    const avgStudy = studyDays.length ? Math.round(totalStudy / studyDays.length) : 0;
    const wakeDays = counted.filter((d) => d.wake_up_time);
    const wakeMinutes = wakeDays
      .map((d) => hmToMinutes(d.wake_up_time))
      .filter((m): m is number => m != null);
    const avgWake = wakeMinutes.length
      ? Math.round(wakeMinutes.reduce((s, m) => s + m, 0) / wakeMinutes.length)
      : null;
    return {
      submitted,
      totalDay,
      taskRate: totalDay ? Math.round((submitted / totalDay) * 100) : 0,
      avgStudy,
      avgWake:
        avgWake != null
          ? `${String(Math.floor(avgWake / 60)).padStart(2, "0")}:${String(avgWake % 60).padStart(2, "0")}`
          : "-",
    };
  }, [report]);

  if (loading) {
    return <div className="rounded-xl bg-white border border-navy/10 p-8 text-center text-navy/50">불러오는 중...</div>;
  }
  if (!report) {
    return <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700">레포트를 불러올 수 없습니다</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end no-print">
        <button
          onClick={() => window.print()}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          PDF로 저장
        </button>
      </div>

      {/* [수정 1] 통계 요약 — 3분할 (일시 정지 카드 제거) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="과제 달성률" value={`${stats?.taskRate || 0}%`} sub={`${stats?.submitted}/${stats?.totalDay}일`} />
        <StatCard label="평균 순공" value={minutesToHm(stats?.avgStudy)} />
        <StatCard label="평균 기상" value={stats?.avgWake || "-"} />
      </div>

      {/* 일별 카드 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">일별 기록</h2>
        <div className="space-y-2">
          {report.day_data.map((day, idx) => (
            <DayCard
              key={day.date}
              day={day}
              weekday={WEEKDAY_KO[idx]}
              saving={savingField === `day-${idx}`}
              studentId={studentId}
              cycle={cycle}
              week={week}
              onChange={(patch) => commitDay(idx, patch)}
            />
          ))}
        </div>
      </section>

      {/* 3단계 멘토 총평 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">멘토 총평</h2>
        <CommentBlock
          label="이번 주에 잘 한 것"
          value={report.good_points || ""}
          saving={savingField === "good"}
          onSave={(v) => patch({ good_points: v }, "good")}
        />
        <CommentBlock
          label="이번 주에 아쉬운 것"
          value={report.improvement_points || ""}
          saving={savingField === "improve"}
          onSave={(v) => patch({ improvement_points: v }, "improve")}
        />
        <CommentBlock
          label="다음 주에 하면 좋을 것"
          value={report.next_week_actions || ""}
          saving={savingField === "next"}
          onSave={(v) => patch({ next_week_actions: v }, "next")}
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "muted";
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-4 shadow-sm">
      <div className={`absolute inset-x-0 -top-8 h-24 bg-gradient-to-br ${
        tone === "muted" ? "from-ink/5 to-ink/0" : "from-indigo/10 via-violet/8 to-fuchsia/10"
      } blur-xl`} />
      <div className="relative">
        <div className="text-[11px] text-ink/55 uppercase tracking-[0.15em] font-semibold">{label}</div>
        <div className={`text-2xl font-extrabold mt-1 tabular-nums ${
          tone === "muted" ? "text-ink/40" : "text-gradient"
        }`}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-ink/45 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<DayStatus, string> = {
  submitted: "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border-emerald-200",
  missed: "bg-gradient-to-r from-rose-50 to-pink-50 text-rose border-rose/30",
  paused: "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_LABEL: Record<DayStatus, string> = {
  submitted: "제출 완료",
  missed: "미제출",
  paused: "일시 정지",
};

// [수정 2] 상태 순환: 제출 완료 → 미제출 → 일시 정지 → 제출 완료 …
const STATUS_CYCLE: DayStatus[] = ["submitted", "missed", "paused"];
function nextStatus(s: DayStatus): DayStatus {
  const i = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

function DayCard({
  day,
  weekday,
  saving,
  studentId,
  cycle,
  week,
  onChange,
}: {
  day: DayData;
  weekday: string;
  saving: boolean;
  studentId: string;
  cycle: number;
  week: number;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const studyH = day.study_minutes != null ? Math.floor(day.study_minutes / 60) : "";
  const studyM = day.study_minutes != null ? day.study_minutes % 60 : "";

  function setStudy(h: string, m: string) {
    const hh = h === "" ? null : Number(h);
    const mm = m === "" ? null : Number(m);
    if (hh == null && mm == null) {
      onChange({ study_minutes: null, status: day.status === "submitted" ? "missed" : day.status });
      return;
    }
    const total = (hh || 0) * 60 + (mm || 0);
    // 순공 시간 입력 = 자동 제출 완료
    onChange({ study_minutes: total, status: day.status === "paused" ? "paused" : "submitted" });
  }

  return (
    <div className="bg-white border border-ink/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo to-violet text-white flex items-center justify-center font-bold shadow-sm shadow-indigo/30">
            {weekday}
          </div>
          <div>
            <div className="text-xs text-ink/55">{day.date}</div>
            {/* [수정 2] 배지 클릭 시 상태 순환 (오른쪽 버튼 3개 제거) */}
            <button
              type="button"
              onClick={() => onChange({ status: nextStatus(day.status) })}
              title="클릭하면 상태가 바뀝니다 (제출 완료 → 미제출 → 일시 정지)"
              className={`text-xs inline-block mt-0.5 px-2 py-0.5 rounded-full border font-medium cursor-pointer transition hover:brightness-95 ${STATUS_STYLES[day.status]}`}
            >
              {STATUS_LABEL[day.status]}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink/55 font-medium">기상 시간</label>
          {/* [수정 4] 오전 기본값 + 기상 인증 X 토글 */}
          <WakeTimeInput
            value={day.wake_up_time}
            certOff={!!day.wake_cert_off}
            onChange={onChange}
          />
        </div>
        <div>
          <label className="text-xs text-ink/55 font-medium">순공 시간</label>
          <div className="mt-1 flex gap-2 items-center">
            <input
              type="number"
              min="0"
              max="24"
              value={studyH}
              onChange={(e) => setStudy(e.target.value, String(studyM))}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">시간</span>
            <input
              type="number"
              min="0"
              max="59"
              value={studyM}
              onChange={(e) => setStudy(String(studyH), e.target.value)}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">분</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs text-ink/55 font-medium">
          일별 피드백 <span className="no-print">(카톡 복사·붙여넣기)</span>
        </label>
        <textarea
          rows={2}
          value={day.memo || ""}
          onChange={(e) => onChange({ memo: e.target.value || null })}
          className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
        />
      </div>

      {/* [수정 5] 공부 인증 사진 (최대 4장) */}
      <PhotoSection
        day={day}
        studentId={studentId}
        cycle={cycle}
        week={week}
        onChange={onChange}
      />

      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}

const MAX_PHOTOS = 4;

function PhotoSection({
  day,
  studentId,
  cycle,
  week,
  onChange,
}: {
  day: DayData;
  studentId: string;
  cycle: number;
  week: number;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photos = day.photos || [];

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setErr(null);

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setErr(`하루 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      return;
    }
    const picked = files.slice(0, room);
    if (files.length > room) setErr(`최대 ${MAX_PHOTOS}장까지만 첨부되어 ${picked.length}장만 업로드합니다.`);

    setBusy(true);
    const uploaded: DayPhoto[] = [];
    for (const file of picked) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("student_id", studentId);
      fd.append("cycle", String(cycle));
      fd.append("week", String(week));
      fd.append("date", day.date);
      const res = await fetch("/api/reports/weekly/photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) uploaded.push({ url: data.url, path: data.path });
      else setErr(data.error || "업로드 실패");
    }
    setBusy(false);
    if (uploaded.length) onChange({ photos: [...photos, ...uploaded] });
  }

  async function removePhoto(p: DayPhoto) {
    onChange({ photos: photos.filter((x) => x.path !== p.path) });
    await fetch("/api/reports/weekly/photo", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ student_id: studentId, path: p.path }),
    }).catch(() => {});
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-ink/55 font-medium">
          공부 인증 사진 <span className="text-ink/40">({photos.length}/{MAX_PHOTOS})</span>
        </label>
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="no-print text-[11px] rounded-lg border border-indigo/25 bg-gradient-to-r from-indigo/8 to-fuchsia/8 hover:from-indigo/15 hover:to-fuchsia/15 text-indigo font-semibold px-2.5 py-1 transition disabled:opacity-50"
          >
            {busy ? "업로드 중..." : "+ 사진 추가"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="hidden"
      />
      {photos.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative group aspect-square rounded-xl overflow-hidden border border-ink/10 bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="공부 인증" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p)}
                title="삭제"
                className="no-print absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="text-[10px] text-rose mt-1">{err}</p>}
    </div>
  );
}

// [수정 3] 기상 시간 입력 — 오전/오후 토글(기본 오전) + 시/분 + 기상 인증 X
function parseHM(value: string | null) {
  const min = hmToMinutes(value);
  if (min == null) return null;
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm: "오전" | "오후" = h24 < 12 ? "오전" : "오후";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { ampm, h12, m };
}
const pad2 = (n: number) => String(n).padStart(2, "0");
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function WakeTimeInput({
  value,
  certOff,
  onChange,
}: {
  value: string | null;
  certOff: boolean;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const parsed = parseHM(value);
  const [ampm, setAmpm] = useState<"오전" | "오후">(parsed?.ampm ?? "오전");
  const [h12, setH12] = useState<string>(parsed ? String(parsed.h12) : "");
  const [mm, setMm] = useState<string>(parsed ? pad2(parsed.m) : "");

  useEffect(() => {
    const p = parseHM(value);
    setAmpm(p?.ampm ?? "오전");
    setH12(p ? String(p.h12) : "");
    setMm(p ? pad2(p.m) : "");
  }, [value]);

  function commit(nAmpm: "오전" | "오후", nH12: string, nMm: string) {
    if (nH12 === "") return; // 시(時)가 선택되어야 인증으로 처리
    const minute = nMm === "" ? "00" : nMm;
    let h = Number(nH12) % 12;
    if (nAmpm === "오후") h += 12;
    onChange({ wake_up_time: `${pad2(h)}:${minute}` });
  }

  // [수정 4] 기상 인증 X 상태 → 배지로 전환 (클릭 시 시간 입력으로 복귀)
  if (certOff) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={() => onChange({ wake_cert_off: false })}
          title="클릭하면 기상 시간 입력으로 돌아갑니다"
          className="text-xs inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-medium bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 transition"
        >
          기상 인증 X
        </button>
      </div>
    );
  }

  const minuteOptions = parsed && !MINUTE_OPTIONS.includes(parsed.m)
    ? [parsed.m, ...MINUTE_OPTIONS].sort((a, b) => a - b)
    : MINUTE_OPTIONS;

  const selCls =
    "rounded-xl border border-ink/10 px-2 py-1.5 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition bg-white";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <select
        value={ampm}
        onChange={(e) => {
          const v = e.target.value as "오전" | "오후";
          setAmpm(v);
          commit(v, h12, mm);
        }}
        className={selCls}
      >
        <option value="오전">오전</option>
        <option value="오후">오후</option>
      </select>
      <select
        value={h12}
        onChange={(e) => {
          setH12(e.target.value);
          commit(ampm, e.target.value, mm === "" ? "00" : mm);
        }}
        className={selCls}
      >
        <option value="">시</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}시</option>
        ))}
      </select>
      <select
        value={mm}
        onChange={(e) => {
          setMm(e.target.value);
          commit(ampm, h12, e.target.value);
        }}
        className={selCls}
      >
        {minuteOptions.map((m) => (
          <option key={m} value={pad2(m)}>{pad2(m)}분</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange({ wake_up_time: null, wake_cert_off: true })}
        className="text-xs px-2.5 py-1.5 rounded-xl border font-medium transition text-ink/55 border-ink/15 hover:bg-rose/5 hover:text-rose hover:border-rose/30"
      >
        기상 인증 X
      </button>
    </div>
  );
}

function CommentBlock({
  label,
  value: initial,
  saving,
  onSave,
}: {
  label: string;
  value: string;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  return (
    <div className="bg-white border border-ink/5 rounded-2xl p-4 shadow-sm">
      <label className="text-sm font-bold text-ink">{label}</label>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed"
        placeholder="자유롭게 작성하세요"
      />
      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}
