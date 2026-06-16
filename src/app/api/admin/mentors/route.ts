import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_mentors")
    .select("id, name, mentor_code, unique_number, first_coaching_date, created_at")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mentors: data });
}

// 고유 번호(정수)·첫 코칭 시작일(yyyy-mm-dd) 정규화
function parseUniqueNumber(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function parseDate(v: unknown): string | null {
  if (v === "" || v == null) return null;
  return String(v);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { name, mentor_code, unique_number, first_coaching_date } = await req.json();
  if (!name?.trim() || !mentor_code?.trim()) {
    return NextResponse.json({ error: "이름과 코드를 입력해주세요" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9]+$/.test(mentor_code.trim())) {
    return NextResponse.json({ error: "멘토 코드는 영문과 숫자만 사용 가능합니다" }, { status: 400 });
  }
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_mentors")
    .insert({
      name: name.trim(),
      mentor_code: mentor_code.trim(),
      unique_number: parseUniqueNumber(unique_number),
      first_coaching_date: parseDate(first_coaching_date),
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 코드입니다" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mentor: data });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id, name, mentor_code, unique_number, first_coaching_date } = await req.json();
  if (!id) return NextResponse.json({ error: "대상이 없습니다" }, { status: 400 });
  if (!name?.trim() || !mentor_code?.trim()) {
    return NextResponse.json({ error: "이름과 코드를 입력해주세요" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9]+$/.test(mentor_code.trim())) {
    return NextResponse.json({ error: "멘토 코드는 영문과 숫자만 사용 가능합니다" }, { status: 400 });
  }
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("coaching_mentors")
    .update({
      name: name.trim(),
      mentor_code: mentor_code.trim(),
      unique_number: parseUniqueNumber(unique_number),
      first_coaching_date: parseDate(first_coaching_date),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 코드입니다" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mentor: data });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  const { id } = await req.json();
  const supabase = getServiceClient();
  const { error } = await supabase.from("coaching_mentors").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
