"use client";

// 체험(/demo) 추가 단계 — 매칭, 사전 질문지·첫 컨설팅, 커리큘럼, 질의응답, 맞춤 테스트지, 3인 관리, 비교
import { useMemo, useRef, useState } from "react";
import {
  COMPARE_COLUMNS,
  COMPARE_ROWS,
  DEMO_CURRICULUM,
  DEMO_FIRST_WRAPUP,
  DEMO_FIRST_ZOOM,
  DEMO_MATCH,
  DEMO_MATCH_CHAT,
  DEMO_PRE_ANSWERS,
  DEMO_QNA_CHAT,
  DEMO_QNA_ROOM,
  DEMO_STUDENT,
  DEMO_TEST,
  PARENT_REVIEWS,
  RESULT_CASES,
  TEAM,
  type CompareMark,
  type ResultCase,
  type ResultRow,
} from "./demo-data";
import { Reveal, useInView, useProgress, useStepper } from "./demo-motion";
import { FlowNote, Frame, KakaoRoom, Points, StepHeader, ZoomMock } from "./demo-ui";

// ─────────────────────────────────────────────────────────────
// 멘토 매칭 · 사전 질문지 전달
// ─────────────────────────────────────────────────────────────

export function MatchStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="신청하면, 딱 맞는 멘토와 코칭방이 열려요"
        desc="신청서와 요청사항을 보고 학생에게 맞는 담당 멘토를 매칭해요. 담당 멘토가 멘토·매니저·학생이 함께하는 코칭방을 열고, 사전 질문지와 첫 컨설팅 준비 사항을 하나씩 안내해요."
      />
      <Points
        items={[
          { icon: "🤝", title: "1:1 멘토 매칭", text: "목표·과목·성향을 보고 담당 멘토를 정해요" },
          { icon: "💬", title: "전용 코칭방 개설", text: "멘토·매니저·학생이 함께하는 카톡방이 열려요" },
          { icon: "📝", title: "시작 전 준비 안내", text: "사전 질문지·계획표·성적표를 먼저 받아요" },
        ]}
      />
      <KakaoRoom title={DEMO_MATCH.room} count={3} messages={DEMO_MATCH_CHAT} height={580} pinned={DEMO_MATCH.pinned} />
      <p className="mt-3 text-center text-[11.5px] text-ink/40">※ 링크와 학교 정보는 모자이크 처리했어요.</p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 사전 질문지 제출 · 첫 컨설팅
// ─────────────────────────────────────────────────────────────

export function PreStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="사전 질문지로 시작해, 첫 컨설팅에서 방향을 잡아요"
        desc="목표 대학, 지금 성적, 과목별 공부 방식과 고민을 미리 적어 보내요. 멘토는 이 내용을 꼼꼼히 읽고, 첫 줌 컨설팅에서 학생과 함께 4주 방향을 정해요."
      />
      <PreForm />
      <FlowNote>제출한 답변을 멘토가 미리 읽고 컨설팅을 준비해요</FlowNote>
      <ZoomMock
        badge="첫 컨설팅"
        startSec={18 * 60 + 5}
        captions={DEMO_FIRST_ZOOM.captions}
        screen={(inView) => <PreScreen inView={inView} />}
      />
      <FlowNote>컨설팅이 끝나면 멘토가 내용을 정리해 보내요</FlowNote>
      <KakaoRoom title={DEMO_MATCH.room} count={3} messages={DEMO_FIRST_WRAPUP} height={520} />
    </>
  );
}

function PreForm() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.25);
  const filled = useStepper(inView, DEMO_PRE_ANSWERS.length + 1, 650, 500);
  const submitted = filled > DEMO_PRE_ANSWERS.length;

  return (
    <Reveal delay={250} from="scale">
      <div ref={ref} className="mx-auto max-w-[460px] overflow-hidden rounded-[28px] border border-ink/10 bg-[#f6f8fb] shadow-[0_12px_40px_rgba(15,40,80,0.12)]">
        <div className="bg-white px-5 pb-4 pt-5">
          <div className="text-[11px] font-bold tracking-[0.2em] text-sky-600">SKY MATE</div>
          <div className="mt-1 text-[18px] font-extrabold">사전 질문지</div>
          <div className="mt-1 text-[12px] text-ink/50">성실하게 작성할수록 상담의 퀄리티가 상승합니다.</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-500"
              style={{ width: `${(Math.min(filled, DEMO_PRE_ANSWERS.length) / DEMO_PRE_ANSWERS.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="space-y-2.5 p-4">
          {DEMO_PRE_ANSWERS.map((q, i) => {
            const on = i < filled;
            return (
              <div key={q.label} className="rounded-2xl bg-white p-3.5 ring-1 ring-ink/[0.06]">
                <div className="text-[12.5px] font-bold text-ink/80">
                  {i + 1}. {q.label} <span className="text-rose">*</span>
                </div>
                <div
                  className={`mt-2 min-h-[38px] rounded-xl border px-3 py-2 text-[13px] leading-relaxed transition-colors duration-300 ${
                    on ? "border-sky-200 bg-sky-50/40 text-ink/80" : "border-ink/10 text-ink/25"
                  }`}
                >
                  {on ? <span className="animate-[demoFade_.4s_ease]">{q.answer}</span> : "답변을 입력해주세요"}
                </div>
              </div>
            );
          })}
          <div
            className={`flex h-12 items-center justify-center rounded-2xl text-[15px] font-bold transition-all duration-500 ${
              submitted ? "bg-emerald-500 text-white" : "bg-ink/10 text-ink/35"
            }`}
          >
            {submitted ? "✓ 제출 완료! 멘토에게 전달됐어요" : "제출하기"}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function PreScreen({ inView }: { inView: boolean }) {
  const rows = useStepper(inView, DEMO_PRE_ANSWERS.length, 500, 600);
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-extrabold">{DEMO_STUDENT.name} · 사전 질문지</div>
        <div className="text-[11px] font-bold text-sky-600">함께 보는 중</div>
      </div>
      <div className="mt-2 space-y-1.5">
        {DEMO_PRE_ANSWERS.slice(0, 4).map((q, i) => {
          const on = i < rows;
          return (
            <div
              key={q.label}
              className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px]"
              style={{
                opacity: on ? 1 : 0,
                transform: on ? "none" : "translateX(-10px)",
                transition: "opacity .45s ease, transform .45s cubic-bezier(.2,.8,.2,1)",
              }}
            >
              <div className="font-bold text-ink/50">{q.label}</div>
              <div className="truncate text-ink/80">{q.answer}</div>
            </div>
          );
        })}
      </div>
      <div
        className="mt-2.5 rounded-md border-l-[3px] border-fuchsia bg-pink-50 px-2 py-1.5 text-[11.5px] text-ink/75"
        style={{ opacity: rows >= 4 ? 1 : 0, transition: "opacity .6s ease" }}
      >
        4주 목표: 영단어 1회독 · 수열의 극한 완성 · 문학 기출 매일
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 4주 커리큘럼 (주간 계획표 단계 위에 붙는다)
// ─────────────────────────────────────────────────────────────

export function CurriculumCard({ current }: { current: number }) {
  return (
    <Frame label={`컨설팅을 바탕으로 짠 ${DEMO_STUDENT.cycle}개월차 4주 커리큘럼 (예시)`}>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-left">
          <thead>
            <tr>
              <th className="w-14" />
              {[1, 2, 3, 4].map((w) => (
                <th
                  key={w}
                  className={`rounded-lg px-2 py-1.5 text-center text-[12px] font-bold ${
                    w === current ? "bg-sky-600 text-white" : "bg-slate-100 text-ink/55"
                  }`}
                >
                  {w}주차{w === current && " · 이번 주"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_CURRICULUM.map((row, r) => (
              <tr key={row.subject}>
                <td className="px-1 text-[12.5px] font-bold text-ink/70">{row.subject}</td>
                {row.weeks.map((txt, w) => (
                  <td key={w} className="p-0 align-top">
                    <Reveal delay={r * 90 + w * 60}>
                      <div
                        className={`h-full min-h-[52px] rounded-lg px-2 py-1.5 text-[11.5px] leading-snug ${
                          w + 1 === current
                            ? "bg-sky-50 font-semibold text-sky-800 ring-1 ring-sky-200"
                            : w + 1 < current
                              ? "bg-slate-50 text-ink/45"
                              : "bg-slate-50 text-ink/70"
                        }`}
                      >
                        {w + 1 < current && <span className="mr-0.5 text-sky-500">✓</span>}
                        {txt}
                      </div>
                    </Reveal>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

// ─────────────────────────────────────────────────────────────
// 모르는 문제 질의응답
// ─────────────────────────────────────────────────────────────

export function QnaStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="모르는 문제는 사진 찍어 바로 물어봐요"
        desc="공부하다 막힌 문제는 수강생 전용 문제풀이방에 올려요. 내 풀이와 막힌 지점을 함께 적으면, 멘토가 풀이 과정과 함께 어떤 개념에서 막혔는지까지 짚어줘요."
      />
      <Points
        items={[
          { icon: "📷", title: "사진 한 장이면 끝", text: "막힌 문제를 찍어서 문제풀이방에 올려요" },
          { icon: "✍️", title: "풀이 + 개념 짚기", text: "답만이 아니라 막힌 개념부터 설명해요" },
          { icon: "💬", title: "막힌 지점부터", text: "어디서 막혔는지 적으면 딱 그 부분을 풀어줘요" },
        ]}
      />
      <KakaoRoom title={DEMO_QNA_ROOM} count={128} messages={DEMO_QNA_CHAT} height={560} mentorName="SKY MATE 멘토" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 약점 맞춤 테스트지 — 직접 풀어보고 채점
// ─────────────────────────────────────────────────────────────

export function TestStep({ n }: { n: number }) {
  const qs = DEMO_TEST.questions;
  const [answers, setAnswers] = useState<(string | null)[]>(() => qs.map(() => null));
  const done = answers.every((a) => a !== null);
  const correct = useMemo(() => answers.filter((a, i) => a === qs[i].answer).length, [answers, qs]);

  return (
    <>
      <StepHeader
        n={n}
        title="부족한 부분은 맞춤 테스트지로 다시 채워요"
        desc="학생이 약한 단원을 고르면 매니저가 난이도를 맞춰 맞춤 테스트지를 만들어요. 예를 들어 월·화·목·토 아침마다 5문제씩 보내고, 문제지의 QR에 정답을 입력하면 다음 날 채점 결과를 알려줘요. 틀린 유형은 [오답] 테스트로 한 번 더 풀어요."
      />
      <Points
        items={[
          { icon: "🎯", title: "약한 단원 맞춤", text: "학생이 고른 단원·난이도로 문제를 만들어요" },
          { icon: "📱", title: "QR로 제출 · 채점", text: "정답을 입력하면 다음 날 채점 결과가 와요" },
          { icon: "🔁", title: "[오답] 테스트", text: "틀린 유형만 모아 다시 풀고, 멘토 퀴즈로 복습해요" },
        ]}
      />
      <Frame label="직접 풀어보세요 — 누르면 바로 채점돼요">
        <div className="rounded-2xl border border-ink/10">
          <div className="border-b border-ink/10 px-4 py-3">
            <div className="text-[11px] font-bold tracking-[0.18em] text-sky-600">SKY MATE · 맞춤 테스트</div>
            <div className="mt-1 text-[16px] font-extrabold leading-snug">{DEMO_TEST.title}</div>
            <div className="mt-0.5 text-[11.5px] text-ink/45">{DEMO_TEST.date} · 문제지 PDF + QR 전용 코드 · 채점·오답 제공</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[12px] font-bold text-ink/55">이번 주 약점에서 출제</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_TEST.weakPoints.map((w, i) => (
                <Reveal key={w} delay={i * 80} from="scale">
                  <span className="inline-block rounded-full bg-pink-50 px-2.5 py-1 text-[11.5px] font-semibold text-fuchsia">
                    {w}
                  </span>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {qs.map((q, i) => {
            const picked = answers[i];
            return (
              <Reveal key={q.question} delay={i * 90}>
                <div className="rounded-2xl border border-ink/[0.08] p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-extrabold text-ink/80">{i + 1}.</span>
                    <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">{q.subject}</span>
                    <span className="text-[11px] text-ink/40">{q.weak}</span>
                  </div>
                  <div className="mt-2 text-[14.5px] font-semibold leading-relaxed">{q.question}</div>
                  <div className={`mt-3 grid gap-1.5 ${q.choices.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                    {q.choices.map((c) => {
                      const isAnswer = c === q.answer;
                      const isPicked = c === picked;
                      const tone =
                        picked === null
                          ? "border-ink/10 bg-white hover:border-sky-300 hover:bg-sky-50/50"
                          : isAnswer
                            ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                            : isPicked
                              ? "border-rose/60 bg-rose/10 text-rose"
                              : "border-ink/10 bg-white text-ink/35";
                      return (
                        <button
                          key={c}
                          disabled={picked !== null}
                          onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? c : x)))}
                          className={`rounded-xl border px-3 py-2.5 text-left text-[13.5px] font-medium transition active:scale-[0.99] ${tone}`}
                        >
                          {picked !== null && isAnswer && "✓ "}
                          {picked !== null && isPicked && !isAnswer && "✕ "}
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  {picked !== null && (
                    <div className="mt-2.5 animate-[demoFade_.4s_ease] rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] leading-relaxed text-ink/70">
                      <span className="mr-1 font-bold text-sky-700">해설</span>
                      {q.explain}
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>

        {done && (
          <div className="mt-4 animate-[demoPop_.45s_ease_both] rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 p-5 text-center text-white">
            <div className="text-[13px] font-semibold text-white/80">채점 결과</div>
            <div className="mt-1 text-[30px] font-extrabold tabular-nums">
              {correct} / {qs.length}
            </div>
            <div className="mt-1 text-[13px] text-white/85">
              {correct === qs.length
                ? "완벽해요! 다음 테스트는 한 단계 어려운 유형으로 넘어가요."
                : "틀린 유형은 멘토가 다음 주 계획표와 테스트지에 다시 넣어요."}
            </div>
            <button
              onClick={() => setAnswers(qs.map(() => null))}
              className="mt-3 rounded-full bg-white/20 px-3.5 py-1.5 text-[12.5px] font-semibold transition hover:bg-white/30"
            >
              ↻ 다시 풀기
            </button>
          </div>
        )}
      </Frame>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 멘토 · 매니저 · 대표강사 3인 관리 (TEAM 이 있을 때만)
// ─────────────────────────────────────────────────────────────

export function TeamStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="한 학생을 세 명이 함께 관리해요"
        desc="담당 멘토 혼자가 아니라, 매니저와 대표강사가 함께 한 학생의 코칭을 챙겨요. 공부는 멘토가, 매일의 관리는 매니저가, 전체 방향과 전용 자료는 대표강사가 맡아요."
      />
      <div className="relative space-y-3">
        {TEAM.map((m, i) => (
          <Reveal key={m.role} delay={i * 140} from="left">
            <div className="flex gap-4 rounded-3xl border border-ink/[0.06] bg-white p-5 shadow-[0_8px_30px_rgba(15,40,80,0.05)]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-2xl">{m.icon}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[16px] font-extrabold">{m.role}</span>
                  <span className="text-[12.5px] font-semibold text-sky-600">{m.tagline}</span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {m.lines.map((l) => (
                    <li key={l} className="flex gap-1.5 text-[13.5px] leading-relaxed text-ink/70">
                      <span className="text-sky-500">•</span>
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 비교표
// ─────────────────────────────────────────────────────────────

export function CompareStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="같은 시간, 다른 결과"
        desc="혼자 공부·학원·과외와 비교해 보세요. 스카이메이트는 '무엇을 배우느냐'가 아니라 '매일 제대로 공부하느냐'를 관리해요."
      />
      <Reveal delay={200} from="scale">
        <div className="overflow-hidden rounded-3xl border border-ink/[0.06] bg-white shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
          <table className="w-full table-fixed text-center">
            <colgroup>
              <col style={{ width: "40%" }} />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className="px-3 py-3 text-left text-[11.5px] font-semibold text-ink/40">항목</th>
                {COMPARE_COLUMNS.map((col, i) => {
                  const hl = i === COMPARE_COLUMNS.length - 1;
                  return (
                    <th
                      key={col}
                      className={`whitespace-pre-line px-1 py-3 text-[11.5px] font-bold leading-tight ${
                        hl ? "bg-sky-600 text-white" : "text-ink/55"
                      }`}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, r) => (
                <tr key={row.label} className="border-t border-ink/[0.06]">
                  <td className="break-keep px-3 py-2.5 text-left text-[12.5px] font-semibold leading-snug text-ink/80">
                    {row.label}
                  </td>
                  {row.marks.map((m, i) => {
                    const hl = i === row.marks.length - 1;
                    return (
                      <td key={i} className={`px-1 py-2.5 ${hl ? "bg-sky-50" : ""}`}>
                        <Reveal delay={250 + r * 70 + i * 40} from="scale">
                          <Mark m={m} highlight={hl} />
                        </Reveal>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      <Reveal delay={300}>
        <div className="mt-3 rounded-2xl bg-sky-50 px-4 py-3.5 text-center text-[14px] font-bold text-sky-700">
          {COMPARE_ROWS.length}개 항목 모두 ✓ — 학원·과외와 함께 병행할 수 있어요
        </div>
      </Reveal>
      <p className="mt-2 text-center text-[11px] text-ink/40">※ 일반적인 학습 방식을 기준으로 비교했으며, 학원·과외마다 다를 수 있어요.</p>
    </>
  );
}

function Mark({ m, highlight }: { m: CompareMark; highlight: boolean }) {
  if (m === "o")
    return (
      <span
        className={`inline-grid h-6 w-6 place-items-center rounded-full text-[13px] font-bold ${
          highlight ? "bg-sky-600 text-white" : "bg-ink/10 text-ink/60"
        }`}
      >
        ✓
      </span>
    );
  if (m === "tri") return <span className="text-[15px] font-bold text-ink/35">△</span>;
  return <span className="text-[15px] font-bold text-ink/20">✕</span>;
}

// ─────────────────────────────────────────────────────────────
// 실제 성적 향상 사례 — 등급 막대 위에서 점이 올라간다
// ─────────────────────────────────────────────────────────────

export function ResultsStep({ n }: { n: number }) {
  return (
    <>
      <StepHeader
        n={n}
        title="실제 성적이 이렇게 올랐어요"
        desc="SKY MATE 고등 코칭을 받은 학생들의 실제 성적 기록과 학부모님 반응이에요. 학생 이름만 가렸어요."
      />
      <div className="space-y-5">
        {RESULT_CASES.map((c, i) => (
          <ResultCard key={i} c={c} />
        ))}
      </div>
      <FlowNote>학부모님이 보내주신 이야기</FlowNote>
      <ParentReviews />
      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink/40">
        ※ 학생·학부모님이 카톡으로 직접 보내주신 내용을 이름만 가리고 옮겼어요. 개인별 결과는 다를 수 있어요.
      </p>
    </>
  );
}

function ResultCard({ c }: { c: ResultCase }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.3);
  const p = useProgress(inView, 1400, 300);
  const graded = c.rows.filter((r) => r.from != null && r.to != null);
  const scored = c.rows.filter((r) => r.from == null && r.scoreFrom != null && r.scoreTo != null);
  const table = c.rows.filter((r) => r.from == null && r.scoreFrom == null);

  return (
    <Reveal from="scale">
      <div ref={ref} className="overflow-hidden rounded-3xl border border-ink/[0.06] bg-white shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <div
          className="px-5 py-4 text-white"
          style={{ backgroundImage: "linear-gradient(90deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-extrabold">{c.who}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">{c.tag}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-white/80">{c.period}</div>
          <div className="mt-2 text-[16px] font-extrabold leading-snug">{c.headline}</div>
        </div>

        <div className="p-4 sm:p-5">
          {graded.length > 0 && (
            <div className="space-y-4">
              {graded.map((r) => (
                <GradeTrack key={r.subject} r={r} p={p} beforeLabel={c.beforeLabel} afterLabel={c.afterLabel} />
              ))}
            </div>
          )}

          {scored.length > 0 && (
            <div className={`space-y-4 ${graded.length ? "mt-5" : ""}`}>
              {scored.map((r) => (
                <ScoreBar key={r.subject} r={r} p={p} beforeLabel={c.beforeLabel} afterLabel={c.afterLabel} />
              ))}
            </div>
          )}

          {table.length > 0 && (
            <table className={`w-full text-[13px] ${graded.length || scored.length ? "mt-5" : ""}`}>
              <thead>
                <tr className="text-[11.5px] text-ink/45">
                  <th className="py-1.5 text-left font-semibold">과목</th>
                  <th className="py-1.5 text-right font-semibold">{c.beforeLabel}</th>
                  <th className="w-6" />
                  <th className="py-1.5 text-left font-semibold">{c.afterLabel}</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={r.subject} className="border-t border-ink/[0.06]">
                    <td className="py-2 font-bold text-ink/75">{r.subject}</td>
                    <td className="py-2 text-right tabular-nums text-ink/45">{r.before}</td>
                    <td className="py-2 text-center text-sky-500">→</td>
                    <td className="py-2">
                      <span
                        className="inline-block rounded-md bg-sky-50 px-2 py-0.5 font-extrabold text-sky-700 transition-all duration-500"
                        style={{
                          opacity: inView ? 1 : 0,
                          transform: inView ? "none" : "translateX(-8px)",
                          transitionDelay: `${400 + i * 150}ms`,
                        }}
                      >
                        {r.after}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {c.extra && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold leading-relaxed text-emerald-800">
              ➕ {c.extra}
            </div>
          )}
          <div className="mt-4 border-l-[3px] border-sky-300 pl-3 text-[13.5px] leading-relaxed text-ink/70">
            “{c.quote}”
            <div className="mt-1 text-[11px] text-ink/40">— {c.quoteBy ?? "학생이 코칭방에 남긴 회고"}</div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// 점수 막대 — 이전 점수(회색)에서 지금 점수(파랑)까지 늘어난다
function ScoreBar({ r, p, beforeLabel, afterLabel }: { r: ResultRow; p: number; beforeLabel: string; afterLabel: string }) {
  const max = r.max ?? 100;
  const from = r.scoreFrom ?? 0;
  const to = r.scoreTo ?? 0;
  const cur = from + (to - from) * p;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const diff = Math.round((to - from) * 10) / 10;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[14px] font-extrabold">{r.subject}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-extrabold text-emerald-700">+{diff}점</span>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[11px] text-ink/45">{beforeLabel}</span>
          <div className="relative h-5 flex-1 rounded-md bg-slate-100">
            <div className="absolute inset-y-0 left-0 rounded-md bg-slate-300" style={{ width: pct(from) }} />
          </div>
          <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-ink/50">{r.before}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[11px] font-bold text-sky-700">{afterLabel}</span>
          <div className="relative h-5 flex-1 rounded-md bg-slate-100">
            <div className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-sky-400 to-sky-600" style={{ width: pct(cur) }} />
          </div>
          <span className="w-12 shrink-0 text-right text-[12px] font-extrabold tabular-nums text-sky-700">
            {Math.round(cur * 10) / 10}점
          </span>
        </div>
      </div>
      {r.note && <div className="mt-1 text-[11.5px] font-semibold text-emerald-700">✓ {r.note}</div>}
    </div>
  );
}

function ParentReviews() {
  return (
    <div className="space-y-2.5">
      {PARENT_REVIEWS.map((r, i) => (
        <Reveal key={i} delay={i * 70}>
          <div className="flex gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-amber-300 to-orange-400 text-[15px]">
              👩
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                <span className="font-bold text-ink/70">{r.student} 학부모님</span>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold text-sky-700">{r.tag}</span>
              </div>
              <div className="rounded-2xl rounded-tl-md border border-ink/[0.06] bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/80 shadow-[0_4px_16px_rgba(15,40,80,0.05)]">
                {r.text}
              </div>
              <div className="mt-1 text-right text-[10.5px] text-ink/35">{r.date}</div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// 9등급(왼쪽) → 1등급(오른쪽) 막대. 점이 이전 등급에서 지금 등급으로 이동한다.
function GradeTrack({ r, p, beforeLabel, afterLabel }: { r: ResultRow; p: number; beforeLabel: string; afterLabel: string }) {
  const pos = (g: number) => ((9 - g) / 8) * 100;
  const from = pos(r.from ?? 9);
  const to = pos(r.to ?? 9);
  const cur = from + (to - from) * p;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[14px] font-extrabold">{r.subject}</span>
        <span className="text-[12.5px]">
          <span className="text-ink/45">
            {beforeLabel} {r.before}
          </span>
          <span className="mx-1.5 text-sky-500">→</span>
          <span className="font-extrabold text-sky-700">
            {afterLabel} {r.after}
          </span>
        </span>
      </div>
      <div className="relative mx-3 mt-2.5 h-3 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-200 to-sky-500"
          style={{ left: `${from}%`, width: `${Math.max(0, cur - from)}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300"
          style={{ left: `${from}%` }}
        />
        <div
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-sky-600 shadow-md"
          style={{ left: `${cur}%` }}
        />
      </div>
      <div className="relative mx-3 mt-1.5 h-4 text-[10px] text-ink/35">
        {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => (
          <span
            key={g}
            className={`absolute -translate-x-1/2 ${g === r.to ? "font-bold text-sky-700" : ""}`}
            style={{ left: `${pos(g)}%` }}
          >
            {g}
          </span>
        ))}
      </div>
      <div className="mx-3 flex justify-between text-[10px] text-ink/30">
        <span>등급 낮음</span>
        <span>등급 높음</span>
      </div>
      {r.note && <div className="mt-1 text-[11.5px] font-semibold text-emerald-700">✓ {r.note}</div>}
    </div>
  );
}
