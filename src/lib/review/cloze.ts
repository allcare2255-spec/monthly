import type { ClozePart, PublicClozePart, ReviewQuestion } from "@/types";

/**
 * 채점용 문자열 정규화.
 * 띄어쓰기·대소문자·문장부호·전각/아래첨자(₂→2) 차이와 둥근/곧은 따옴표 차이를 흡수한다.
 */
export function normalizeAnswer(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?;:'"`‘’“”()[\]{}<>·・~\-–—_/⁄]/g, "");
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
export const circled = (i: number) => CIRCLED[i] ?? `(${i + 1})`;

/** 굵게/밑줄 표시를 지운 본문 한 줄 (칸은 ①②…). 결과지·멘토 화면용. */
export function plainBody(q: Pick<ReviewQuestion, "body">): string {
  return (q.body ?? "")
    .replace(/\{\{(\d+)\}\}/g, (_, n) => `( ${circled(Number(n))} )`)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/** 칸의 대표 정답 (표시용). */
export function partAnswerText(p: ClozePart): string {
  if (p.kind === "input") return p.answers[0] ?? "";
  return p.answer;
}

/** 학생용, 정답을 지우고 입력칸 너비 힌트만 남긴다. */
export function toPublicParts(parts: ClozePart[] | undefined): PublicClozePart[] | undefined {
  if (!parts) return undefined;
  return parts.map((p) => {
    if (p.kind === "pick") return { kind: "pick", options: p.options };
    if (p.kind === "order") return { kind: "order", tokens: p.tokens };
    const len = Math.max(...p.answers.map((a) => a.length), 1);
    const size = len <= 4 ? "s" : len <= 10 ? "m" : "l";
    return { kind: "input", prefix: p.prefix, size };
  });
}

function inputMatches(p: Extract<ClozePart, { kind: "input" }>, student: string): boolean {
  const s = normalizeAnswer(student);
  if (!s) return false;
  const pre = p.prefix ? normalizeAnswer(p.prefix) : "";
  return p.answers.some((a) => {
    const n = normalizeAnswer(a);
    return n === s || (pre && n === pre + s);
  });
}

/** cloze 문항 채점 → 칸별 결과. 같은 group 의 입력칸은 순서 무관. */
export function gradeClozeParts(
  parts: ClozePart[],
  studentParts: string[]
): { student: string; correct: string; ok: boolean }[] {
  const res = parts.map((p, i) => ({
    student: (studentParts[i] ?? "").toString(),
    correct: partAnswerText(p),
    ok: false,
  }));

  const groups = new Map<string, number[]>();
  parts.forEach((p, i) => {
    if (p.kind === "input" && p.group) {
      const g = groups.get(p.group) ?? [];
      g.push(i);
      groups.set(p.group, g);
    }
  });

  parts.forEach((p, i) => {
    const student = res[i].student;
    if (p.kind === "pick") {
      res[i].ok = !!student && normalizeAnswer(student) === normalizeAnswer(p.answer);
    } else if (p.kind === "order") {
      const s = normalizeAnswer(student);
      res[i].ok = !!s && [p.answer, ...(p.answers ?? [])].some((a) => normalizeAnswer(a) === s);
    } else if (!p.group) {
      res[i].ok = inputMatches(p, student);
    }
    // 첫 글자 힌트를 빼고 쓴 답은 결과에 힌트를 붙여서 보여준다 (urvival → survival)
    if (
      p.kind === "input" &&
      p.prefix &&
      student.trim() &&
      !normalizeAnswer(student).startsWith(normalizeAnswer(p.prefix))
    ) {
      res[i].student = p.prefix + student.trim();
    }
  });

  // 순서 무관 그룹: 학생 답 하나가 그룹 안 아직 안 쓰인 칸 중 하나와 맞으면 정답
  for (const idxs of groups.values()) {
    const used = new Set<number>();
    for (const i of idxs) {
      const hit = idxs.find(
        (j) => !used.has(j) && inputMatches(parts[j] as Extract<ClozePart, { kind: "input" }>, res[i].student)
      );
      if (hit !== undefined) {
        used.add(hit);
        res[i].ok = true;
      }
    }
    // 정답 표시는 학생이 못 맞힌 칸에 남은 정답을 순서대로 보여준다
    const remaining = idxs.filter((j) => !used.has(j)).map((j) => partAnswerText(parts[j]));
    for (const i of idxs) {
      if (res[i].ok) res[i].correct = res[i].student;
      else res[i].correct = remaining.shift() ?? res[i].correct;
    }
  }

  return res;
}

/** 학생 답안 정리: cloze 는 배열, 그 외는 문자열. */
export function coerceClozeAnswer(a: unknown, n: number): string[] {
  let arr: unknown = a;
  if (typeof a === "string") {
    try {
      arr = JSON.parse(a);
    } catch {
      arr = [a];
    }
  }
  const list = Array.isArray(arr) ? arr : [];
  return Array.from({ length: n }, (_, i) => (list[i] ?? "").toString());
}
