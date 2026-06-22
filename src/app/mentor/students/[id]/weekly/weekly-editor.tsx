"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DayData, DayPhoto, DayStatus, WeeklyReport } from "@/types";
import { hmToMinutes, minutesToHm } from "@/lib/dates";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
const pad2 = (n: number) => String(n).padStart(2, "0");

export function WeeklyReportEditor({
  studentId,
  cycle,
  week,
  studentName,
  cumWeek,
  weekStart,
  weekEnd,
}: {
  studentId: string;
  cycle: number;
  week: number;
  studentName: string;
  cumWeek: number;
  weekStart: string;
  weekEnd: string;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  // [수정 4] 학생에게 보내기 → 완성 레포트 미리보기 화면
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/weekly?student_id=${studentId}&cycle=${cycle}&week=${week}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d.report);
        setLoading(false);
      });
  }, [studentId, cycle, week]);

  // [수정 4] 미리보기가 열려 있는 동안 body에 클래스 부여 → 인쇄 시 미리보기만 출력
  useEffect(() => {
    if (preview) document.body.classList.add("preview-active");
    else document.body.classList.remove("preview-active");
    return () => document.body.classList.remove("preview-active");
  }, [preview]);

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

  function updateDayByDate(date: string, dayPatch: Partial<DayData>) {
    if (!report) return;
    const nextDays = report.day_data.map((d) =>
      d.date === date ? { ...d, ...dayPatch } : d,
    );
    setReport({ ...report, day_data: nextDays });
    return nextDays;
  }

  async function commitDayByDate(date: string, dayPatch: Partial<DayData>) {
    const next = updateDayByDate(date, dayPatch);
    if (!next) return;
    await patch({ day_data: next }, `day-${date}`);
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
        {/* [수정 4] PDF로 저장 → 학생에게 보내기 (미리보기 화면 표시) */}
        <button
          onClick={() => setPreview(true)}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          학생에게 보내기
        </button>
      </div>

      {/* [수정 1] 1. 통계 요약 — 3분할 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="과제 달성률" value={`${stats?.taskRate || 0}%`} sub={`${stats?.submitted}/${stats?.totalDay}일`} />
        <StatCard label="평균 순공" value={minutesToHm(stats?.avgStudy)} />
        <StatCard label="평균 기상" value={stats?.avgWake || "-"} />
      </div>

      {/* [수정 1·2] 2. 도넛 차트 2개 */}
      <DonutCharts report={report} />

      {/* [수정 1] 3. 멘토 총평 */}
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

      {/* [수정 1] 4. 일별 기록 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">일별 기록</h2>
        <div className="space-y-2">
          {report.day_data.map((day, idx) => (
            <DayCard
              key={day.date}
              day={day}
              weekday={WEEKDAY_KO[idx]}
              saving={savingField === `day-${day.date}`}
              studentId={studentId}
              cycle={cycle}
              week={week}
              onChange={(p) => commitDayByDate(day.date, p)}
            />
          ))}
        </div>
      </section>

      {/* [수정 4·5·6] 완성 레포트 미리보기 (학생에게 보내기) */}
      {preview &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportPreview
            studentName={studentName}
            cycle={cycle}
            cumWeek={cumWeek}
            weekStart={weekStart}
            weekEnd={weekEnd}
            report={report}
            stats={stats}
            onClose={() => setPreview(false)}
          />,
          document.body,
        )}
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

// [수정 2] 도넛 차트 2개 — 일별 기록 데이터 기반 자동 계산
type Seg = { label: string; count: number; color: string };

function Donut({ title, segments }: { title: string; segments: Seg[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  const R = 54;
  const STROKE = 22;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="rounded-2xl bg-white border border-ink/5 p-5 shadow-sm">
      <div className="text-sm font-bold text-ink mb-3 text-center">{title}</div>
      <div className="flex items-center justify-center gap-5">
        <svg viewBox="0 0 160 160" className="w-32 h-32 -rotate-90">
          {/* 배경 트랙 */}
          <circle cx="80" cy="80" r={R} fill="none" stroke="#EceEF3" strokeWidth={STROKE} />
          {total > 0 &&
            segments.map((s) => {
              if (s.count <= 0) return null;
              const len = (s.count / total) * C;
              const seg = (
                <circle
                  key={s.label}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return seg;
            })}
        </svg>
        <div className="space-y-1.5">
          {segments.map((s) => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                <span className="text-ink/70 font-medium">{s.label}</span>
                <span className="text-ink/50 tabular-nums">
                  {s.count}개 ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 색상 (Tailwind 팔레트와 동일 톤)
const C_GREEN = "#10B981";
const C_PINK = "#EC4899";
const C_RED = "#F43F5E";
const C_GRAY = "#94A3B8";

function DonutCharts({ report }: { report: WeeklyReport }) {
  const days = report.day_data;
  // 차트 1 — 제출 과제 인증
  const submitted = days.filter((d) => d.status === "submitted").length;
  const incomplete = days.filter((d) => d.status === "incomplete").length;
  const missed = days.filter((d) => d.status === "missed").length;
  // 차트 2 — 기상 인증 (기상 시간 입력 여부)
  const wakeOn = days.filter((d) => !!d.wake_up_time).length;
  const wakeOff = days.length - wakeOn;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Donut
        title="제출 과제 인증"
        segments={[
          { label: "제출 완료", count: submitted, color: C_GREEN },
          { label: "과제 미흡", count: incomplete, color: C_PINK },
          { label: "미제출", count: missed, color: C_RED },
        ]}
      />
      <Donut
        title="기상 인증"
        segments={[
          { label: "기상 인증", count: wakeOn, color: C_GREEN },
          { label: "기상 인증 X", count: wakeOff, color: C_GRAY },
        ]}
      />
    </div>
  );
}

const STATUS_STYLES: Record<DayStatus, string> = {
  submitted: "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border-emerald-200",
  // [수정 3] 과제 미흡 — 분홍색
  incomplete: "bg-pink-100 text-pink-600 border-pink-300",
  missed: "bg-gradient-to-r from-rose-50 to-pink-50 text-rose border-rose/30",
  paused: "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_LABEL: Record<DayStatus, string> = {
  submitted: "제출 완료",
  incomplete: "과제 미흡",
  missed: "미제출",
  paused: "일시 정지",
};

// [수정 3] 상태 순환: 제출 완료 → 과제 미흡 → 미제출 → 제출 완료 …
const STATUS_CYCLE: DayStatus[] = ["submitted", "incomplete", "missed"];
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
  // 로컬 state: 포커스 중에는 서버 응답이 값을 덮어쓰지 않도록 분리
  const [studyHLocal, setStudyHLocal] = useState(() =>
    day.study_minutes != null ? String(Math.floor(day.study_minutes / 60)) : ""
  );
  const [studyMLocal, setStudyMLocal] = useState(() =>
    day.study_minutes != null ? String(day.study_minutes % 60) : ""
  );
  const studyFocused = useRef(false);

  useEffect(() => {
    if (studyFocused.current) return;
    setStudyHLocal(day.study_minutes != null ? String(Math.floor(day.study_minutes / 60)) : "");
    setStudyMLocal(day.study_minutes != null ? String(day.study_minutes % 60) : "");
  }, [day.study_minutes]);

  function commitStudy() {
    const hh = studyHLocal === "" ? null : Number(studyHLocal);
    const mm = studyMLocal === "" ? null : Number(studyMLocal);
    if (hh == null && mm == null) {
      onChange({ study_minutes: null, status: day.status === "submitted" ? "missed" : day.status });
      return;
    }
    const total = (hh || 0) * 60 + (mm || 0);
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
            {/* [수정 1] 일별 날짜 색상 회색 → 검정 */}
            <div className="text-xs text-ink">{day.date}</div>
            {/* [수정 3] 배지 클릭 시 상태 순환 (오른쪽 버튼 3개 제거) */}
            <button
              type="button"
              onClick={() => onChange({ status: nextStatus(day.status) })}
              title="클릭하면 상태가 바뀝니다 (제출 완료 → 과제 미흡 → 미제출)"
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
          {/* [수정 2] 시/분 직접 타이핑 + 기상 인증 X 토글 */}
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
              value={studyHLocal}
              onChange={(e) => setStudyHLocal(e.target.value)}
              onFocus={() => { studyFocused.current = true; }}
              onBlur={() => { studyFocused.current = false; commitStudy(); }}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">시간</span>
            <input
              type="number"
              min="0"
              max="59"
              value={studyMLocal}
              onChange={(e) => setStudyMLocal(e.target.value)}
              onFocus={() => { studyFocused.current = true; }}
              onBlur={() => { studyFocused.current = false; commitStudy(); }}
              className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
              placeholder="0"
            />
            <span className="text-sm text-ink/55">분</span>
          </div>
        </div>
      </div>

      {/* [수정 3] 학생 셀프 피드백 */}
      <div className="mt-3">
        <label className="text-xs text-ink/55 font-medium">학생 셀프 피드백</label>
        <AutoTextarea
          value={day.memo || ""}
          onChange={(v) => onChange({ memo: v || null })}
          className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm"
        />
      </div>

      {/* [수정 3] 멘토 피드백 요약 */}
      <div className="mt-3">
        <label className="text-xs text-ink/55 font-medium">멘토 피드백 요약</label>
        <AutoTextarea
          value={day.mentor_memo || ""}
          onChange={(v) => onChange({ mentor_memo: v || null })}
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
  // 업로드가 진행되는 동안 클로저가 stale해지는 것을 방지: ref로 최신 사진 목록 유지
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = day.photos || []; }, [day.photos]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setErr(null);

    const currentPhotos = photosRef.current;
    const room = MAX_PHOTOS - currentPhotos.length;
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
    // 업로드 완료 시점의 최신 목록(ref)에 합쳐서 저장 (stale 클로저 방지)
    if (uploaded.length) onChange({ photos: [...photosRef.current, ...uploaded] });
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

// [수정 2] 기상 시간 — 시/분 숫자 직접 입력 + 기상 인증 X
// 로컬 state로 관리하여 서버 응답이 입력 중 값을 덮어쓰지 않도록 처리
function WakeTimeInput({
  value,
  certOff,
  onChange,
}: {
  value: string | null;
  certOff: boolean;
  onChange: (patch: Partial<DayData>) => void;
}) {
  const [localH, setLocalH] = useState(() => {
    const min = hmToMinutes(value);
    return min != null ? String(Math.floor(min / 60)) : "";
  });
  const [localM, setLocalM] = useState(() => {
    const min = hmToMinutes(value);
    return min != null ? String(min % 60) : "";
  });
  const focused = useRef(false);

  // 포커스 없을 때만 서버 데이터로 싱크
  useEffect(() => {
    if (focused.current) return;
    const min = hmToMinutes(value);
    setLocalH(min != null ? String(Math.floor(min / 60)) : "");
    setLocalM(min != null ? String(min % 60) : "");
  }, [value]);

  function commitWake() {
    const hv = localH === "" ? null : Number(localH);
    const mv = localM === "" ? null : Number(localM);
    if (hv == null && mv == null) {
      onChange({ wake_up_time: null });
      return;
    }
    onChange({ wake_up_time: `${pad2(hv || 0)}:${pad2(mv || 0)}` });
  }

  // [수정 2/6] 기상 인증 X 상태 → 배지로 전환 (클릭 시 시간 입력으로 복귀)
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

  return (
    <div className="mt-1 flex gap-2 items-center">
      <input
        type="number"
        min="0"
        max="23"
        value={localH}
        onChange={(e) => setLocalH(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commitWake(); }}
        className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
        placeholder="7"
      />
      <span className="text-sm text-ink/55">시</span>
      <input
        type="number"
        min="0"
        max="59"
        value={localM}
        onChange={(e) => setLocalM(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commitWake(); }}
        className="w-16 rounded-xl border border-ink/10 px-2 py-1.5 text-center outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
        placeholder="00"
      />
      <span className="text-sm text-ink/55">분</span>
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
      {/* [수정 4] 내용 길이에 맞게 자동 확장 */}
      <AutoTextarea
        value={text}
        onChange={setText}
        onBlur={() => text !== initial && onSave(text)}
        className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed"
        placeholder="자유롭게 작성하세요"
      />
      {saving && <p className="text-[10px] text-ink/40 mt-1">저장 중...</p>}
    </div>
  );
}

// [수정 4] 내용 길이에 맞게 높이 자동 확장 + 스크롤바 없음
function AutoTextarea({
  value,
  onChange,
  onBlur,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`resize-none overflow-hidden ${className || ""}`}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// [수정 4·5·6] 완성 레포트 미리보기 + PDF 저장
// ─────────────────────────────────────────────────────────────

type StatsShape = {
  submitted: number;
  totalDay: number;
  taskRate: number;
  avgStudy: number;
  avgWake: string;
} | null;

function wakeText(day: DayData): string | null {
  // 기상 인증 X → "기상 인증 X", 시간 입력 → "7시 00분", 둘 다 없으면 null(미표시)
  if (day.wake_cert_off) return "기상 인증 X";
  const min = hmToMinutes(day.wake_up_time);
  if (min == null) return null;
  return `${Math.floor(min / 60)}시 ${pad2(min % 60)}분`;
}

function ReportPreview({
  studentName,
  cycle,
  cumWeek,
  weekStart,
  weekEnd,
  report,
  stats,
  onClose,
}: {
  studentName: string;
  cycle: number;
  cumWeek: number;
  weekStart: string;
  weekEnd: string;
  report: WeeklyReport;
  stats: StatsShape;
  onClose: () => void;
}) {
  const comments = [
    { label: "이번 주에 잘 한 것", value: report.good_points },
    { label: "이번 주에 아쉬운 것", value: report.improvement_points },
    { label: "다음 주에 하면 좋을 것", value: report.next_week_actions },
  ].filter((c) => (c.value || "").trim());

  return (
    <div
      data-preview-root
      className="fixed inset-0 z-50 overflow-auto bg-white"
    >
      {/* 액션 바 (인쇄 시 숨김) */}
      <div className="preview-actions no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur border-b border-ink/10 px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 transition"
        >
          ← 닫기
        </button>
        <div className="text-sm font-semibold text-ink/60">완성 레포트 미리보기</div>
        <button
          onClick={() => window.print()}
          className="btn-gradient rounded-xl font-semibold px-5 py-2.5"
        >
          PDF로 저장
        </button>
      </div>

      {/* 완성 문서 */}
      <div className="preview-doc mx-auto max-w-[820px] px-8 py-10">
        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
            Weekly · {cumWeek}주차
          </div>
          <h1 className="text-3xl font-extrabold text-ink mt-1">
            {studentName} <span className="text-ink/30 font-bold">·</span> {cumWeek}주차 주간 레포트
          </h1>
          {/* [수정 1] 날짜 검정 */}
          <p className="text-ink mt-2 text-sm">
            코칭 {cycle}개월차 · {weekStart} ~ {weekEnd}
          </p>
        </header>

        {/* [수정 1] 1. 통계 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <PreviewStat label="과제 달성률" value={`${stats?.taskRate || 0}%`} sub={`${stats?.submitted}/${stats?.totalDay}일`} />
          <PreviewStat label="평균 순공" value={minutesToHm(stats?.avgStudy)} />
          <PreviewStat label="평균 기상" value={stats?.avgWake || "-"} />
        </div>

        {/* [수정 1·2] 2. 도넛 차트 2개 */}
        <div className="mb-8">
          <DonutCharts report={report} />
        </div>

        {/* [수정 1] 3. 멘토 총평 — 내용 있는 항목만 */}
        {comments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-bold text-ink mb-3">멘토 총평</h2>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.label} className="preview-day-card border border-ink/10 rounded-2xl p-5">
                  <div className="text-sm font-bold text-ink mb-1.5">{c.label}</div>
                  <div className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* [수정 1] 4. 일별 기록 */}
        <h2 className="text-base font-bold text-ink mb-3">일별 기록</h2>
        <div className="space-y-3">
          {report.day_data.map((day, idx) => (
            <PreviewDayCard key={day.date} day={day} weekday={WEEKDAY_KO[idx]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 p-4">
      <div className="text-[11px] text-ink/55 uppercase tracking-[0.15em] font-semibold">{label}</div>
      <div className="text-2xl font-extrabold mt-1 tabular-nums text-ink">{value}</div>
      {sub && <div className="text-[11px] text-ink/45 mt-0.5">{sub}</div>}
    </div>
  );
}

function PreviewDayCard({ day, weekday }: { day: DayData; weekday: string }) {
  const wake = wakeText(day);
  const study = day.study_minutes != null ? minutesToHm(day.study_minutes) : null;
  const memo = (day.memo || "").trim();
  const mentorMemo = (day.mentor_memo || "").trim();
  const photos = day.photos || [];

  return (
    <div className="preview-day-card border border-ink/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo to-violet text-white flex items-center justify-center font-bold">
          {weekday}
        </div>
        <div>
          {/* [수정 1] 날짜 검정 */}
          <div className="text-xs text-ink">{day.date}</div>
          {/* [수정 5] 정적 배지 (클릭 불가) */}
          <span className={`text-xs inline-block mt-0.5 px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[day.status]}`}>
            {STATUS_LABEL[day.status]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* [수정 6] 기상 시간은 항상 표시 */}
        <div>
          <div className="text-xs text-ink/55 font-medium">기상 시간</div>
          <div className="mt-1 text-sm text-ink">{wake ?? "-"}</div>
        </div>
        {/* [수정 6] 순공 시간 없으면 숨김 */}
        {study && (
          <div>
            <div className="text-xs text-ink/55 font-medium">순공 시간</div>
            <div className="mt-1 text-sm text-ink">{study}</div>
          </div>
        )}
      </div>

      {/* [수정 3·6] 학생 셀프 피드백 — 비어있으면 숨김 */}
      {memo && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium">학생 셀프 피드백</div>
          <div className="mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{memo}</div>
        </div>
      )}

      {/* [수정 3·6] 멘토 피드백 요약 — 비어있으면 숨김 */}
      {mentorMemo && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium">멘토 피드백 요약</div>
          <div className="mt-1 text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{mentorMemo}</div>
        </div>
      )}

      {/* [수정 6] 공부 인증 사진 없으면 섹션 숨김 */}
      {photos.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-ink/55 font-medium">공부 인증 사진</div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p.path} className="aspect-square rounded-xl overflow-hidden border border-ink/10 bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="공부 인증" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
