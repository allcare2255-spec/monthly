"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReviewQuiz, ReviewQuestion, QuestionType } from "@/types";

interface Asset {
  kind: "image" | "pdf";
  data: string;
  mediaType: string;
  name: string;
  previewUrl?: string;
}

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "객관식",
  ox: "OX",
  short_answer: "단답",
  essay: "서술형",
};

function readFileAsBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve({ data: result.slice(comma + 1), mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** JSON 이 아닌 응답(타임아웃·서버 에러 페이지)도 사람이 읽을 수 있는 메시지로 바꿔준다. */
async function postJson(url: string, body: unknown, fallback: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(raw);
  } catch {
    if (res.status === 504 || /timeout/i.test(raw)) {
      throw new Error(
        "생성 시간이 초과됐어요(최대 5분). 자료를 몇 장씩 나눠 올리거나 문제 수를 줄여서 다시 시도해 주세요."
      );
    }
    throw new Error(`서버 오류 (${res.status}). 잠시 후 다시 시도해 주세요.`);
  }
  if (!res.ok) throw new Error(json.error || fallback);
  return json;
}

export function ReviewEditor({
  students,
  initialStudentId,
}: {
  students: { id: string; name: string; grade: string | null }[];
  initialStudentId: string;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [hint, setHint] = useState("");
  const [studentId, setStudentId] = useState(initialStudentId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState<ReviewQuiz | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const next: Asset[] = [];
    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf";
      const isImg = file.type.startsWith("image/");
      if (!isPdf && !isImg) continue;
      const { data, mediaType } = await readFileAsBase64(file);
      next.push({
        kind: isPdf ? "pdf" : "image",
        data,
        mediaType,
        name: file.name,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      });
    }
    setAssets((prev) => [...prev, ...next]);
  };

  const removeAsset = (i: number) => setAssets((prev) => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (assets.length === 0) {
      setError("자료를 1개 이상 올려주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const json = await postJson(
        "/api/review/generate",
        {
          assets: assets.map((a) => ({ kind: a.kind, data: a.data, mediaType: a.mediaType })),
          hint: hint.trim() || undefined,
        },
        "생성 실패"
      );
      setQuiz(json.quiz);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (i: number, patch: Partial<ReviewQuestion>) => {
    setQuiz((q) =>
      q
        ? { ...q, questions: q.questions.map((qq, idx) => (idx === i ? { ...qq, ...patch } : qq)) }
        : q
    );
  };
  const removeQuestion = (i: number) =>
    setQuiz((q) => (q ? { ...q, questions: q.questions.filter((_, idx) => idx !== i) } : q));

  const deploy = async () => {
    if (!quiz) return;
    setLoading(true);
    setError("");
    try {
      const json = await postJson(
        "/api/review/sets",
        { quiz, studentId: studentId || null },
        "배포 실패"
      );
      setCode(json.code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const shareUrl =
    typeof window !== "undefined" && code ? `${window.location.origin}/quiz/${code}` : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const inputCls =
    "w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm focus:border-indigo focus:ring-2 focus:ring-indigo/20 outline-none";

  // ── 배포 완료 ──
  if (code) {
    const student = students.find((s) => s.id === studentId);
    return (
      <div className="max-w-lg mx-auto">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="text-5xl">✅</div>
          <h1 className="mt-2 text-2xl font-extrabold text-gradient">배포 완료!</h1>
          <p className="mt-1 text-sm text-ink/55">
            아래 코드 또는 링크를 학생에게 전달하세요.
            {student && <> · 대상: <b>{student.name}</b></>}
          </p>
          <div className="mt-5 rounded-xl bg-indigo/5 border border-indigo/15 py-4 text-3xl font-bold tracking-widest text-indigo">
            {code}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input className={inputCls} readOnly value={shareUrl} />
            <button onClick={copyLink} className="btn-gradient rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap">
              {copied ? "복사됨" : "링크 복사"}
            </button>
          </div>
          <div className="mt-6 flex gap-2">
            <Link href="/mentor/review" className="flex-1 rounded-xl border border-ink/10 py-2.5 text-sm font-semibold text-ink/70 hover:bg-ink/[0.03]">
              목록으로
            </Link>
            <button
              onClick={() => {
                setAssets([]); setHint(""); setQuiz(null); setCode(""); setError("");
              }}
              className="flex-1 btn-gradient rounded-xl py-2.5 text-sm font-semibold"
            >
              새 복습 만들기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 검토/편집 ──
  if (quiz) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-gradient">생성된 문제 검토</h1>
          <button onClick={() => setQuiz(null)} className="text-sm text-ink/55 hover:text-indigo">
            ← 다시 생성
          </button>
        </div>
        <p className="text-sm text-ink/55">
          AI가 유형을 자동 판단해 출제했습니다. 확인·수정한 뒤 배포하세요.
        </p>

        <div className="rounded-2xl bg-white border border-ink/5 p-5 shadow-sm space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">테스트 제목</label>
            <input className={`${inputCls} mt-1.5`} value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">대상 학생 (선택)</label>
            <select className={`${inputCls} mt-1.5`} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">연결 안 함</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.grade ? ` (${s.grade})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {quiz.questions.map((q, i) => (
          <div key={i} className="rounded-2xl bg-white border border-ink/5 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">
                {i + 1}. {TYPE_LABEL[q.type]} · {q.difficulty}
              </span>
              <button onClick={() => removeQuestion(i)} className="text-xs text-rose hover:underline">
                삭제
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-ink/55">문제</label>
              <textarea className={`${inputCls} mt-1`} rows={2} value={q.question} onChange={(e) => updateQuestion(i, { question: e.target.value })} />
            </div>

            {(q.type === "multiple_choice" || q.type === "ox") && q.options.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-ink/55">보기 (왼쪽 ○로 정답 지정)</label>
                <div className="space-y-2 mt-1">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" checked={q.answer === opt} onChange={() => updateQuestion(i, { answer: opt })} title="정답으로 지정" />
                      <input
                        className={inputCls}
                        value={opt}
                        onChange={(e) => {
                          const options = [...q.options];
                          const wasAnswer = q.answer === opt;
                          options[oi] = e.target.value;
                          updateQuestion(i, { options, ...(wasAnswer ? { answer: e.target.value } : {}) });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(q.type === "short_answer" || q.type === "essay") && (
              <div>
                <label className="text-[11px] font-semibold text-ink/55">{q.type === "essay" ? "모범답안" : "정답"}</label>
                <textarea className={`${inputCls} mt-1`} rows={q.type === "essay" ? 3 : 1} value={q.answer} onChange={(e) => updateQuestion(i, { answer: e.target.value })} />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-ink/55">해설</label>
              <textarea className={`${inputCls} mt-1`} rows={2} value={q.explanation} onChange={(e) => updateQuestion(i, { explanation: e.target.value })} />
            </div>

            <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
              <label className="text-xs font-semibold text-amber-800">🔒 멘토 메모 (학생에게 안 보임)</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                rows={2}
                placeholder="이 문제에 대한 멘토용 메모"
                value={q.mentorNote ?? ""}
                onChange={(e) => updateQuestion(i, { mentorNote: e.target.value })}
              />
            </div>
          </div>
        ))}

        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
          <label className="text-xs font-semibold text-amber-800">🔒 멘토 메모 — 테스트 전체 (학생 비공개)</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            rows={3}
            placeholder="이 복습 세트에 대한 멘토용 종합 메모"
            value={quiz.mentorNote ?? ""}
            onChange={(e) => setQuiz({ ...quiz, mentorNote: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-rose">{error}</p>}

        <div className="sticky bottom-4 flex justify-end">
          <button onClick={deploy} disabled={loading || quiz.questions.length === 0} className="btn-gradient rounded-xl px-6 py-3 font-semibold shadow-lg">
            {loading ? "배포 중…" : `배포하기 (${quiz.questions.length}문제)`}
          </button>
        </div>
      </div>
    );
  }

  // ── 업로드 ──
  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <Link href="/mentor/review" className="text-sm text-ink/55 hover:text-indigo">← 복습 목록</Link>
        <h1 className="text-3xl font-extrabold text-gradient mt-2">자료 올리기</h1>
        <p className="text-sm text-ink/55 mt-1">
          학생이 푼 문제, 개념 노트 등의 사진이나 PDF를 올려주세요. 손글씨도 인식합니다.
        </p>
      </div>

      <label className="rounded-2xl bg-white border-2 border-dashed border-ink/15 p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo transition">
        <span className="text-3xl">📤</span>
        <span className="mt-2 font-medium text-ink">클릭해서 파일 선택</span>
        <span className="text-xs text-ink/40">이미지(JPG/PNG) 또는 PDF · 여러 개 가능</span>
        <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </label>

      {assets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {assets.map((a, i) => (
            <div key={i} className="relative rounded-xl bg-white border border-ink/5 p-3">
              <button onClick={() => removeAsset(i)} className="absolute right-2 top-2 z-10 rounded-full bg-white/90 px-2 text-sm text-rose shadow">✕</button>
              {a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.previewUrl} alt={a.name} className="h-28 w-full rounded object-cover" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center rounded bg-ink/5 text-3xl">📄</div>
              )}
              <p className="mt-2 truncate text-xs text-ink/50">{a.name}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-ink/5 p-5">
        <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-[0.12em]">추가 요청 (선택)</label>
        <input className={`${inputCls} mt-1.5`} placeholder="예: 객관식 위주로, 계산 문제는 숫자를 바꿔서" value={hint} onChange={(e) => setHint(e.target.value)} />
      </div>

      {error && <p className="text-sm text-rose">{error}</p>}

      <button onClick={generate} disabled={loading || assets.length === 0} className="btn-gradient w-full rounded-xl py-3.5 text-base font-semibold">
        {loading ? "AI가 문제를 만드는 중… (자료가 많으면 최대 5분)" : "🤖 문제 생성하기"}
      </button>
    </div>
  );
}
