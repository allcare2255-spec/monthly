"use client";

import { useEffect, useState, use } from "react";
import type { ConsultingField, AgreementItem } from "@/lib/consulting/forms";
import type { ConsultingFile } from "@/types";

type Prefill = { name: string; phone: string | null; mentorName: string | null };

type FormConfig =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "not_started"; prefill: Prefill }
  | {
      state: "form";
      prefill: Prefill;
      week: number;
      formType: "weekly" | "monthly" | "pre";
      title: string;
      fields: ConsultingField[];
      agreements: AgreementItem[];
      intro: string | null;
      outro: string | null;
    };

export default function ConsultingFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [cfg, setCfg] = useState<FormConfig>({ state: "loading" });

  useEffect(() => {
    let alive = true;
    fetch(`/api/consulting/${token}`)
      .then(async (r) => {
        if (!r.ok) return { state: "invalid" as const };
        const d = await r.json();
        return { ...d } as FormConfig;
      })
      .then((d) => alive && setCfg(d))
      .catch(() => alive && setCfg({ state: "invalid" }));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        {cfg.state === "loading" && <Centered>불러오는 중…</Centered>}
        {cfg.state === "invalid" && (
          <Centered>
            <p className="text-lg font-bold text-ink">유효하지 않은 링크예요</p>
            <p className="mt-2 text-sm text-ink/55">담당 멘토에게 받은 링크가 맞는지 확인해주세요.</p>
          </Centered>
        )}
        {cfg.state === "not_started" && (
          <Notice prefill={cfg.prefill}>
            아직 코칭 시작일이 등록되지 않았어요. 담당 멘토에게 문의해주세요.
          </Notice>
        )}
        {cfg.state === "form" && <ConsultingForm token={token} cfg={cfg} />}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-ink/5 p-8 text-center shadow-sm text-ink/70">
      {children}
    </div>
  );
}

function Header({ prefill, sub, isPre }: { prefill: Prefill; sub?: string; isPre?: boolean }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">SKY MATE</div>
      <h1 className="text-2xl font-extrabold text-gradient mt-1">컨설팅 준비</h1>
      {sub && <p className="text-sm text-ink/55 mt-1">{sub}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        {/* pre 는 이름 위주(+멘토 있으면). 전화번호는 표시하지 않음 */}
        <ReadonlyChip label="이름" value={prefill.name} />
        {!isPre && <ReadonlyChip label="전화번호" value={prefill.phone || "-"} />}
        {(!isPre || prefill.mentorName) && (
          <ReadonlyChip label="담당 멘토" value={prefill.mentorName ? `${prefill.mentorName} 멘토` : "-"} />
        )}
      </div>
    </div>
  );
}

function ReadonlyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-[100px] rounded-xl bg-white border border-ink/5 px-3 py-2">
      <div className="text-[10px] text-ink/45 font-semibold">{label}</div>
      <div className="text-ink font-medium truncate">{value}</div>
    </div>
  );
}

function Notice({ prefill, children }: { prefill: Prefill; children: React.ReactNode }) {
  return (
    <div>
      <Header prefill={prefill} />
      <div className="rounded-2xl bg-gradient-to-br from-indigo/5 to-fuchsia/5 border border-indigo/15 p-6 text-sm text-ink/80 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ── 실제 폼 ───────────────────────────────────────────────
function ConsultingForm({
  token,
  cfg,
}: {
  token: string;
  cfg: Extract<FormConfig, { state: "form" }>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, ConsultingFile[]>>({});
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-2xl bg-white border border-ink/5 p-8 text-center shadow-sm">
        <div className="text-4xl">🎉</div>
        <p className="mt-3 text-lg font-bold text-ink">제출이 완료됐어요!</p>
        <p className="mt-2 text-sm text-ink/55 leading-relaxed">
          멘토님이 내용을 확인하고 줌 컨설팅을 준비할 거예요.
          <br />코칭 시간에 만나요 :)
        </p>
      </div>
    );
  }

  async function submit() {
    setError(null);
    // 클라이언트 1차 검증 (서버에서도 재검증)
    for (const f of cfg.fields) {
      if (!f.required) continue;
      if (f.type === "longtext" && !(answers[f.key] || "").trim()) {
        setError(`'${f.label}' 항목을 작성해주세요.`);
        return;
      }
      if (f.type === "image" && !(files[f.key]?.length)) {
        setError(`'${f.label}' 이미지를 업로드해주세요.`);
        return;
      }
    }
    if (!cfg.agreements.every((a) => agree[a.key])) {
      setError("모든 동의 항목을 확인해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/consulting/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, form: cfg.formType, answers, file_paths: files, agreements: agree }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "제출에 실패했어요.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("네트워크 오류로 제출에 실패했어요. 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  const isPre = cfg.formType === "pre";

  return (
    <div>
      <Header
        prefill={cfg.prefill}
        sub={isPre ? cfg.title : `${cfg.week}주차 · ${cfg.title}`}
        isPre={isPre}
      />

      {cfg.intro && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-indigo/[0.06] to-fuchsia/[0.06] border border-indigo/15 p-4 text-sm text-ink/80 leading-relaxed">
          {cfg.intro}
        </div>
      )}

      <div className="space-y-4">
        {cfg.fields.map((f, i) => (
          <FieldCard key={f.key} index={i + 1} field={f}>
            {f.type === "longtext" ? (
              <textarea
                rows={3}
                value={answers[f.key] || ""}
                onChange={(e) => setAnswers((s) => ({ ...s, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-ink/10 px-3 py-2 outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15 transition text-sm leading-relaxed"
                placeholder="자유롭게 작성해주세요"
              />
            ) : (
              <ImageField
                token={token}
                value={files[f.key] || []}
                onChange={(arr) => setFiles((s) => ({ ...s, [f.key]: arr }))}
              />
            )}
          </FieldCard>
        ))}
      </div>

      {/* 동의 항목 (pre 는 없음) */}
      {cfg.agreements.length > 0 && (
      <div className="mt-6 space-y-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-indigo font-semibold">주의사항 · 동의</div>
        {cfg.agreements.map((a) => (
          <label
            key={a.key}
            className={`block rounded-2xl border p-4 cursor-pointer transition ${
              agree[a.key] ? "border-indigo bg-indigo/[0.04]" : "border-ink/10 bg-white"
            }`}
          >
            <div className="font-bold text-sm text-ink">{a.title}</div>
            <ul className="mt-1.5 space-y-1 text-[13px] text-ink/65 leading-relaxed list-disc pl-4">
              {a.lines.map((l, idx) => (
                <li key={idx}>{l}</li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!agree[a.key]}
                onChange={(e) => setAgree((s) => ({ ...s, [a.key]: e.target.checked }))}
                className="h-4 w-4 accent-indigo"
              />
              <span className="text-sm font-semibold text-ink">확인했습니다</span>
            </div>
          </label>
        ))}
      </div>
      )}

      {cfg.outro && (
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-fuchsia/[0.06] to-rose/[0.06] border border-fuchsia/15 p-4 text-sm font-semibold text-ink/80 text-center leading-relaxed">
          {cfg.outro}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-rose/10 text-rose text-sm px-4 py-3 font-medium">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="btn-gradient mt-5 w-full rounded-2xl px-4 py-3.5 text-base font-bold disabled:opacity-55"
      >
        {submitting ? "제출 중…" : "제출하기"}
      </button>
      <div className="h-8" />
    </div>
  );
}

function FieldCard({
  index,
  field,
  children,
}: {
  index: number;
  field: ConsultingField;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-ink/5 p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-indigo/10 text-indigo text-[11px] font-bold h-5 w-5 grid place-items-center">
          {index}
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink leading-snug">
            {field.label}
            {field.required ? <span className="text-rose"> *</span> : <span className="text-ink/40 text-xs"> (선택)</span>}
          </div>
          {field.hint && <div className="text-xs text-ink/45 mt-0.5">{field.hint}</div>}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ImageField({
  token,
  value,
  onChange,
}: {
  token: string;
  value: ConsultingFile[];
  onChange: (arr: ConsultingFile[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
    setErr(null);
    setUploading(true);
    try {
      const uploaded: ConsultingFile[] = [];
      for (const file of list) {
        const fd = new FormData();
        fd.append("token", token);
        fd.append("file", file);
        const r = await fetch("/api/consulting/upload", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) {
          setErr(d.error || "업로드 실패");
          break;
        }
        uploaded.push({ url: d.url, path: d.path });
      }
      if (uploaded.length) onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  function remove(path: string) {
    onChange(value.filter((v) => v.path !== path));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((v) => (
          <div key={v.path} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.url} alt="" className="h-20 w-20 rounded-xl object-cover border border-ink/10" />
            <button
              type="button"
              onClick={() => remove(v.path)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose text-white text-xs font-bold grid place-items-center shadow"
            >
              ×
            </button>
          </div>
        ))}
        <label className="h-20 w-20 rounded-xl border-2 border-dashed border-ink/15 grid place-items-center cursor-pointer text-ink/40 hover:border-indigo hover:text-indigo transition">
          <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} disabled={uploading} />
          <span className="text-2xl leading-none">{uploading ? "…" : "＋"}</span>
        </label>
      </div>
      {err && <p className="text-xs text-rose mt-1.5">{err}</p>}
    </div>
  );
}
