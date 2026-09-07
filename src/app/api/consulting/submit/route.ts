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

  const state = weekStateForStudent(student.coachingStartDate, student.cycleAnchors);

  // 폼 종류 결정 — 주차는 항상 서버가 계산한다 (클라이언트 값 신뢰 안 함).
  // 폼 종류는 ?form=... 직접 링크로 지정할 수 있어야 한다. 학생이 실제로 작성한 폼과
  // 서버가 검증하는 항목이 어긋나면 제출 자체가 막히기 때문.
  const forced =
    body.form === "pre" || body.form === "weekly" || body.form === "monthly"
      ? (body.form as "pre" | "weekly" | "monthly")
      : null;
  let formType: "weekly" | "monthly" | "pre";
  let weekNumber: number;
  if (forced === "pre") {
    // 사전 질문지는 가입 직후 1회만 받는 폼이라, 언제 제출하든 항상 1주차에 모은다.
    // (예전에는 제출 시점의 주차로 태깅돼 5주차·9주차 등에 흩어졌다)
    formType = "pre";
    weekNumber = 1;
  } else {
    if (state.kind !== "form") {
      return NextResponse.json({ error: "지금은 제출할 수 있는 폼이 없습니다." }, { status: 400 });
    }
    formType = forced ?? state.formType;
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
