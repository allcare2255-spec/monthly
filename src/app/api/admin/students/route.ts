import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const body = await req.json();
  const { name, grade, phone, parent_phone, high_school, mentor_id, coaching_start_date } = body;
  if (!name?.trim()) return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_students")
    .insert({
      name: name.trim(),
      grade: grade || null,
      phone: phone || null,
      parent_phone: parent_phone || null,
      high_school: high_school || null,
      mentor_id: mentor_id || null,
      coaching_start_date: coaching_start_date || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ student: data });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id, ...patch } = await req.json();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_students")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ student: data });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await req.json();
  const supabase = getServiceClient();
  const { error } = await supabase.from("coaching_students").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
