import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { setSession } from "@/lib/session";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  const trimmed = String(code || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "코드를 입력해주세요" }, { status: 400 });
  }

  // 관리자 마스터 코드
  if (trimmed === process.env.COACHING_MASTER_CODE) {
    await setSession({ role: "admin" });
    return NextResponse.json({ ok: true, redirect: "/admin" });
  }

  // 멘토 ID 매칭
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_mentors")
    .select("id, name, mentor_code")
    .eq("mentor_code", trimmed)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "유효하지 않은 코드입니다" }, { status: 401 });
  }
  await setSession({ role: "mentor", mentorId: data.id, mentorName: data.name });
  return NextResponse.json({ ok: true, redirect: "/mentor" });
}
