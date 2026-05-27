import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

async function ensureCanAccess(studentId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "권한 없음", status: 401 };
  if (session.role === "admin") return { ok: true, session };
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("mentor_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.mentor_id !== session.mentorId) {
    return { ok: false, error: "권한 없음", status: 403 };
  }
  return { ok: true, session };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get("student_id")!;
  const cycle = Number(url.searchParams.get("cycle") || 1);
  const access = await ensureCanAccess(studentId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data: existing } = await supabase
    .from("coaching_monthly_reports")
    .select("*")
    .eq("student_id", studentId)
    .eq("cycle_number", cycle)
    .maybeSingle();
  if (existing) return NextResponse.json({ report: existing });

  const { data: created, error } = await supabase
    .from("coaching_monthly_reports")
    .insert({ student_id: studentId, cycle_number: cycle })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: created });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, student_id, ...patch } = body;
  const access = await ensureCanAccess(student_id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_monthly_reports")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}
