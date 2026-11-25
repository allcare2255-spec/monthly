import "server-only";
import type { ReviewSet, GradeResult, GradedItem, ReviewAnswer } from "@/types";
import { gradeOpenEnded, type AiGradeInput } from "./anthropic";
import { normalizeAnswer as normalize, gradeClozeParts, coerceClozeAnswer, plainBody } from "./cloze";

/**
 * 학생 답안을 채점한다.
 * - 객관식/OX/단답: 결정적 비교
 * - 복합형(cloze): 칸별 채점, 맞힌 칸 비율만큼 부분 점수
 * - 서술형: AI 채점
 */
export async function gradeQuiz(
  quiz: ReviewSet,
  answers: ReviewAnswer[]
): Promise<GradeResult> {
  const items: GradedItem[] = new Array(quiz.questions.length);
  const aiQueue: AiGradeInput[] = [];

  quiz.questions.forEach((q, i) => {
    if (q.type === "cloze") {
      const parts = q.parts ?? [];
      const studentParts = coerceClozeAnswer(answers[i], parts.length);
      const graded = gradeClozeParts(parts, studentParts);
      const okCount = graded.filter((g) => g.ok).length;
      const score = parts.length === 0 ? 0 : okCount / parts.length;
      const isCorrect = parts.length > 0 && okCount === parts.length;
      items[i] = {
        index: i,
        type: q.type,
        question: q.question,
        detail: plainBody(q),
        studentAnswer: graded.map((g) => g.student || "—").join(" / "),
        correctAnswer: graded.map((g) => g.correct).join(" / "),
        isCorrect,
        score,
        explanation: q.explanation,
        feedback: isCorrect
          ? "정답입니다."
          : okCount > 0
            ? `${parts.length}칸 중 ${okCount}칸을 맞혔습니다.`
            : "해설을 확인하십시오.",
        parts: graded,
      };
      return;
    }

    const raw = answers[i];
    const studentAnswer = (Array.isArray(raw) ? raw.join(" ") : raw ?? "").toString();

    if (q.type === "essay") {
      aiQueue.push({
        index: i,
        question: q.question,
        modelAnswer: q.answer,
        studentAnswer,
      });
      items[i] = {
        index: i,
        type: q.type,
        question: q.question,
        studentAnswer,
        correctAnswer: q.answer,
        isCorrect: false,
        score: 0,
        explanation: q.explanation,
        feedback: "",
      };
      return;
    }

    let isCorrect = false;
    if (q.type === "short_answer") {
      const candidates = [q.answer, ...(q.acceptedAnswers ?? [])].map(normalize);
      isCorrect = candidates.includes(normalize(studentAnswer));
    } else {
      isCorrect = normalize(studentAnswer) === normalize(q.answer);
    }

    items[i] = {
      index: i,
      type: q.type,
      question: q.question,
      studentAnswer,
      correctAnswer: q.answer,
      isCorrect,
      score: isCorrect ? 1 : 0,
      explanation: q.explanation,
      feedback: isCorrect ? "정답입니다." : "해설을 확인하십시오.",
    };
  });

  // 서술형 AI 채점
  if (aiQueue.length > 0) {
    try {
      const graded = await gradeOpenEnded(aiQueue);
      for (const g of graded) {
        const item = items[g.index];
        if (item) {
          item.score = Math.max(0, Math.min(1, g.score));
          item.isCorrect = g.isCorrect;
          item.feedback = g.feedback;
        }
      }
    } catch (e) {
      console.error("[복습] 서술형 채점 실패:", e);
      for (const q of aiQueue) {
        const item = items[q.index];
        if (item) item.feedback = "자동 채점에 실패했습니다. 선생님께 확인하십시오.";
      }
    }
  }

  const scoreSum = items.reduce((acc, it) => acc + it.score, 0);
  const correct = items.filter((it) => it.isCorrect).length;
  const total = items.length;

  return {
    total,
    correct,
    scorePercent: total === 0 ? 0 : Math.round((scoreSum / total) * 100),
    items,
  };
}
