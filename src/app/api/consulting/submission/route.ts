import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import {
  getSubmissionById,
  purgeSubmission,
  setSubmissionDeleted,
  TrashNotReadyError,
} from "@/lib/consulting/store";

// 학생 접근 권한 확인 (admin 또는 담당 멘토) — /api/consulting/note 와 동일한 패턴
async function ensureCanAccess(studentId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "권한 없음", status: 401 };
  if (session.role === "admin") return { ok: true as const, actor: "관리자" };
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("mentor_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.mentor_id !== session.mentorId) {
    return { ok: false as const, error: "권한 없음", status: 403 };
  }
  return { ok: true as const, actor: session.mentorName ?? "멘토" };
}

const ACTIONS = ["delete", "restore", "purge"] as const;
type Action = (typeof ACTIONS)[number];

// POST { id, action: delete | restore | purge }
//  - delete  : 휴지통으로 이동 (소프트 삭제, 복원 가능)
//  - restore : 휴지통에서 되돌리기
//  - purge   : 영구삭제 (업로드 이미지까지 제거, 복원 불가)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const id = String(body.id || "");
  const action = String(body.action || "") as Action;
  if (!id) return NextResponse.json({ error: "id 누락" }, { status: 400 });
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "action 값이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const sub = await getSubmissionById(id);
    if (!sub) return NextResponse.json({ error: "제출물을 찾을 수 없습니다." }, { status: 404 });

    const access = await ensureCanAccess(sub.student_id);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    if (action === "purge") {
      // 안전장치: 휴지통을 거치지 않은 제출물은 바로 영구삭제하지 않는다
      if (!sub.deleted_at) {
        return NextResponse.json(
          { error: "먼저 휴지통으로 옮긴 뒤에 영구삭제할 수 있습니다." },
          { status: 400 },
        );
      }
      await purgeSubmission(id);
      return NextResponse.json({ ok: true, purged: true });
    }

    const updated = await setSubmissionDeleted(id, action === "delete", access.actor);
    return NextResponse.json({ ok: true, submission: updated });
  } catch (e) {
    if (e instanceof TrashNotReadyError) {
      return NextResponse.json({ error: e.message, notReady: true }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "실패" },
      { status: 500 },
    );
  }
}
