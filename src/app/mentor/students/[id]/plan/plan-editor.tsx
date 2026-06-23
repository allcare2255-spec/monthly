"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { PlanTask, PlanDay, WeekdayKey, WeeklyPlanData } from "@/types";

const WEEKDAY_LABEL: { key: WeekdayKey; en: string; ko: string }[] = [
  { key: "mon", en: "Monday", ko: "월" },
  { key: "tue", en: "Tuesday", ko: "화" },
  { key: "wed", en: "Wednesday", ko: "수" },
  { key: "thu", en: "Thursday", ko: "목" },
  { key: "fri", en: "Friday", ko: "금" },
  { key: "sat", en: "Saturday", ko: "토" },
  { key: "sun", en: "Sunday", ko: "일" },
];

function uid() {
  return crypto.randomUUID();
}

export function WeeklyPlanEditor({
  studentId,
  cycle,
  week,
  dates,
}: {
  studentId: string;
  cycle: number;
  week: number;
  dates: string[]; // 월~일 7개
}) {
  const [plan, setPlan] = useState<WeeklyPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/plans?student_id=${studentId}&cycle=${cycle}&week=${week}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErrMsg(d.error);
        else setPlan(d.plan.plan_data as WeeklyPlanData);
        setLoading(false);
      })
      .catch((e) => {
        setErrMsg(String(e));
        setLoading(false);
      });
  }, [studentId, cycle, week]);

  // 노션형 자동저장 (디바운스 700ms)
  function update(next: WeeklyPlanData) {
    setPlan(next);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, cycle, week, plan_data: next }),
      });
      setSaveState(res.ok ? "saved" : "idle");
    }, 700);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (loading) {
    return <div className="rounded-xl bg-white border border-ink/5 p-8 text-center text-ink/50">불러오는 중...</div>;
  }
  if (errMsg || !plan) {
    return (
      <div className="rounded-xl bg-rose/5 border border-rose/20 p-6 text-sm text-rose">
        주간 계획표를 불러오지 못했습니다.
        {errMsg && <div className="mt-2 text-xs text-ink/60">({errMsg})</div>}
        <div className="mt-2 text-xs text-ink/60">
          ※ <b>coaching_weekly_plans</b> 테이블이 아직 없으면 Supabase SQL Editor에서 마이그레이션을 먼저 실행해주세요.
        </div>
      </div>
    );
  }

  const setDay = (key: WeekdayKey, dayPatch: Partial<PlanDay>) =>
    update({ ...plan, days: { ...plan.days, [key]: { ...plan.days[key], ...dayPatch } } });

  // [수정 3-2] 달성률 = 월~일 요일별 할 일 체크 수 ÷ 전체 할 일 수 × 100 (Weekly Goals 제외)
  const dayTasks = WEEKDAY_LABEL.flatMap((wd) => plan.days[wd.key]?.tasks || []);
  const totalTasks = dayTasks.length;
  const doneTasks = dayTasks.filter((t) => t.done).length;
  const achievement = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-4" id="plan-capture-root">
      <div className="flex justify-end no-print">
        <span className="text-xs text-ink/45">
          {saveState === "saving" ? "저장 중..." : saveState === "saved" ? "자동 저장됨 ✓" : ""}
        </span>
      </div>

      {/* 상단: Weekly goals | Main Test */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Weekly Goals" accent="indigo" subtitle="이번 주 목표">
          <Checklist
            items={plan.weekly_goals}
            onChange={(weekly_goals) => update({ ...plan, weekly_goals })}
            placeholder="목표를 입력하세요"
          />
        </SectionCard>
        <SectionCard title="Main Test" accent="fuchsia" subtitle="시험 일정">
          <NumberedList
            items={plan.main_test}
            onChange={(main_test) => update({ ...plan, main_test })}
            placeholder="시험명 / 일정을 입력하세요"
          />
        </SectionCard>
      </div>

      {/* 중단: 월~목 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {WEEKDAY_LABEL.slice(0, 4).map((wd, i) => (
          <DayColumn
            key={wd.key}
            label={wd.en}
            ko={wd.ko}
            date={dates[i]}
            day={plan.days[wd.key]}
            onChange={(patch) => setDay(wd.key, patch)}
          />
        ))}
      </div>

      {/* 하단: 금/토/일 + Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {WEEKDAY_LABEL.slice(4).map((wd, i) => (
          <DayColumn
            key={wd.key}
            label={wd.en}
            ko={wd.ko}
            date={dates[i + 4]}
            day={plan.days[wd.key]}
            onChange={(patch) => setDay(wd.key, patch)}
          />
        ))}
        {/* [수정 3-2] 달성률만 칸 전체를 꽉 채워 크게 표시 (할 일 체크 기반 자동 계산) */}
        <SectionCard title="Summary" accent="violet" subtitle="달성률">
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="text-6xl font-extrabold text-gradient tabular-nums leading-none">
              {achievement}%
            </div>
            <div className="mt-3 text-xs text-ink/45">
              할 일 {doneTasks}/{totalTasks} 완료
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

const ACCENT: Record<string, string> = {
  indigo: "from-indigo to-violet",
  fuchsia: "from-fuchsia to-rose",
  violet: "from-violet to-fuchsia",
  slate: "from-slate-400 to-slate-500",
};

function SectionCard({
  title,
  subtitle,
  accent = "indigo",
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: keyof typeof ACCENT | string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-ink/5 p-4 shadow-sm flex flex-col">
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`h-4 w-1.5 rounded-full bg-gradient-to-b ${ACCENT[accent] || ACCENT.indigo}`} />
        <h3 className="text-sm font-extrabold text-ink tracking-wide">{title}</h3>
        {subtitle && <span className="text-[11px] text-ink/45">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function DayColumn({
  label,
  ko,
  date,
  day,
  onChange,
}: {
  label: string;
  ko: string;
  date?: string;
  day: PlanDay;
  onChange: (patch: Partial<PlanDay>) => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-ink/5 p-4 shadow-sm flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-extrabold text-ink">{label}</h3>
        <span className="text-[11px] text-ink/45">
          {ko}{date ? ` · ${date.slice(5)}` : ""}
        </span>
      </div>
      <AutoResizeTextarea
        value={day.notes}
        onChange={(v) => onChange({ notes: v })}
        placeholder="Notes"
        rows={2}
        className="w-full rounded-lg border border-ink/10 px-2.5 py-1.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition"
      />
      <div className="mt-2">
        <Checklist
          items={day.tasks}
          onChange={(tasks) => onChange({ tasks })}
          placeholder="할 일 입력"
          compact
        />
      </div>
    </div>
  );
}

/* ── 체크박스 목록 (자유 추가/삭제, 자동저장) ── */
function Checklist({
  items,
  onChange,
  placeholder,
  compact,
}: {
  items: PlanTask[];
  onChange: (items: PlanTask[]) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<PlanTask>) =>
    onChange(items.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => onChange(items.filter((t) => t.id !== id));

  function add() {
    const newId = uid();
    onChange([...items, { id: newId, text: "", done: false }]);
    setFocusId(newId);
  }

  function addAfter(id: string) {
    const idx = items.findIndex((t) => t.id === id);
    const newId = uid();
    const next = [
      ...items.slice(0, idx + 1),
      { id: newId, text: "", done: false },
      ...items.slice(idx + 1),
    ];
    onChange(next);
    setFocusId(newId);
  }

  function removeAndFocusPrev(id: string) {
    const idx = items.findIndex((t) => t.id === id);
    const prev = items[idx - 1];
    onChange(items.filter((t) => t.id !== id));
    if (prev) setFocusId(prev.id);
  }

  return (
    <div className="space-y-1.5">
      {items.map((t) => (
        <ChecklistItem
          key={t.id}
          item={t}
          shouldFocus={focusId === t.id}
          onFocusConsumed={() => setFocusId(null)}
          onUpdate={(patch) => update(t.id, patch)}
          onRemove={() => remove(t.id)}
          onEnter={() => addAfter(t.id)}
          onBackspaceEmpty={() => removeAndFocusPrev(t.id)}
          placeholder={placeholder}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className={`no-print text-ink/45 hover:text-indigo transition ${compact ? "text-[11px]" : "text-xs"} font-medium`}
      >
        + 항목 추가
      </button>
    </div>
  );
}

function ChecklistItem({
  item,
  shouldFocus,
  onFocusConsumed,
  onUpdate,
  onRemove,
  onEnter,
  onBackspaceEmpty,
  placeholder,
}: {
  item: PlanTask;
  shouldFocus: boolean;
  onFocusConsumed: () => void;
  onUpdate: (patch: Partial<PlanTask>) => void;
  onRemove: () => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const consumeRef = useRef(onFocusConsumed);
  useEffect(() => { consumeRef.current = onFocusConsumed; });

  useEffect(() => {
    if (!shouldFocus) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    consumeRef.current();
  }, [shouldFocus]);

  return (
    <div className="group flex items-center gap-2">
      <input
        type="checkbox"
        checked={item.done}
        onChange={(e) => onUpdate({ done: e.target.checked })}
        className="h-4 w-4 shrink-0 rounded border-ink/30 text-indigo focus:ring-indigo/30 cursor-pointer accent-indigo-600"
      />
      <AutoResizeTextarea
        ref={textareaRef}
        value={item.text}
        onChange={(v) => onUpdate({ text: v })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (item.text.trim()) onEnter();
          } else if (e.key === "Backspace" && !item.text) {
            e.preventDefault();
            onBackspaceEmpty();
          }
        }}
        placeholder={placeholder}
        rows={1}
        className={`flex-1 bg-transparent border-b border-transparent hover:border-ink/10 focus:border-indigo outline-none text-sm py-0.5 transition break-words ${
          item.done ? "line-through text-ink/40" : "text-ink/80"
        }`}
      />
      <button
        type="button"
        onClick={onRemove}
        title="삭제"
        className="no-print shrink-0 text-ink/30 hover:text-rose opacity-0 group-hover:opacity-100 transition text-sm"
      >
        ×
      </button>
    </div>
  );
}

/* ── Notes / 할 일 항목 — 높이 자동 확장 textarea ── */
const AutoResizeTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
    rows?: number;
  }
>(({ value, onChange, onKeyDown, placeholder, className, rows = 2 }, forwardedRef) => {
  const localRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        (localRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`resize-none overflow-hidden ${className ?? ""}`}
    />
  );
});
AutoResizeTextarea.displayName = "AutoResizeTextarea";

/* ── 번호 매기기 목록 (자유 추가/삭제, 자동저장) ── */
function NumberedList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const update = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div className="space-y-1.5">
      {items.map((x, i) => (
        <div key={i} className="group flex items-center gap-2">
          <span className="shrink-0 w-5 text-right text-sm font-semibold text-fuchsia/70 tabular-nums">{i + 1}.</span>
          <input
            value={x}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-b border-transparent hover:border-ink/10 focus:border-fuchsia outline-none text-sm py-0.5 text-ink/80 transition"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            title="삭제"
            className="no-print shrink-0 text-ink/30 hover:text-rose opacity-0 group-hover:opacity-100 transition text-sm"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="no-print text-xs text-ink/45 hover:text-fuchsia transition font-medium"
      >
        + 항목 추가
      </button>
    </div>
  );
}
