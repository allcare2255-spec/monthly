import { NextResponse } from "next/server";
import { getStudentByToken, saveSubmission } from "@/lib/consulting/store";
import { weekStateForStudent } from "@/lib/consulting/week";
import { fieldsFor, AGREEMENTS } from "@/lib/consulting/forms";
import type { ConsultingFile } from "@/types";

// POST { token, answers, file_paths, agreements }
// 주차 / form_type 는 서버가 다시 계산해 태깅한다 (클라이언트 값 신뢰 안 함).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const token = String(body.token || "");
  const student = await getStudentByToken(token);
  if (!student) return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });

  const state = weekStateForStudent(student.coachingStartDate);

  // 폼 종류 결정: ?form=pre 직접 링크면 사전 질문지(주차 무시), 아니면 서버가 주차로 재계산.
  const forcedPre = body.form === "pre";
  let formType: "weekly" | "monthly" | "pre";
  let weekNumber: number;
  if (forcedPre) {
    formType = "pre";
    weekNumber = state.kind === "form" ? state.week : 1;
  } else {
    if (state.kind !== "form") {
      return NextResponse.json({ error: "지금은 제출할 수 있는 폼이 없습니다." }, { status: 400 });
    }
    formType = state.formType;
    weekNumber = state.week;
  }

  const fields = fieldsFor(formType);
  const rawAnswers = (body.answers ?? {}) as Record<string, string>;
  const rawFiles = (body.file_paths ?? {}) as Record<string, ConsultingFile[]>;
  const rawAgreements = (body.agreements ?? {}) as Record<string, boolean>;

  // 필수 항목 검증
  const answers: Record<string, string> = {};
  const filePaths: Record<string, ConsultingFile[]> = {};
  for (const f of fields) {
    if (f.type === "longtext") {
      const v = (rawAnswers[f.key] ?? "").toString().trim();
      if (f.required && !v) {
        return NextResponse.json({ error: `'${f.label}' 항목을 작성해주세요.` }, { status: 400 });
      }
      if (v) answers[f.key] = v;
    } else {
      const files = Array.isArray(rawFiles[f.key]) ? rawFiles[f.key] : [];
      // 경로 변조 방지: 반드시 이 학생 폴더 하위만 허용
      const safe = files.filter(
        (x) => x && typeof x.path === "string" && x.path.startsWith(`consulting/${student.id}/`),
      );
      if (f.required && safe.length === 0) {
        return NextResponse.json({ error: `'${f.label}' 이미지를 업로드해주세요.` }, { status: 400 });
      }
      if (safe.length) filePaths[f.key] = safe;
    }
  }

  // 동의 항목 — weekly/monthly 만 전부 필수 체크 (pre 는 동의 없음)
  const agreements: Record<string, boolean> = {};
  if (formType !== "pre") {
    for (const a of AGREEMENTS) {
      if (rawAgreements[a.key] !== true) {
        return NextResponse.json({ error: "모든 동의 항목을 확인해주세요." }, { status: 400 });
      }
      agreements[a.key] = true;
    }
  }

  await saveSubmission({
    studentId: student.id,
    weekNumber,
    formType,
    answers,
    filePaths,
    agreements,
    memo: answers["memo"] ?? null,
  });

  return NextResponse.json({ ok: true });
}
