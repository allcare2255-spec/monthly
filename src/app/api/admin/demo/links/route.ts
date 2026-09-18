import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

/** 체험 링크 발급 대장 — 관리자 전용. */

function code6() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(i, l, o, 0, 1) 제외
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const clean = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await req.json();
  const label = clean(body.label, 60);
  if (!label) return NextResponse.json({ error: "받는 분을 입력해주세요" }, { status: 400 });

  const sb = getServiceClient();
  for (let tries = 0; tries < 8; tries++) {
    const code = clean(body.code, 24)?.toLowerCase().replace(/[^a-z0-9-]/g, "") || code6();
    const { data, error } = await sb
      .from("demo_links")
      .insert({
        code,
        label,
        who_type: clean(body.who_type, 20),
        grade: clean(body.grade, 20),
        channel: clean(body.channel, 30),
        contact: clean(body.contact, 60),
        memo: clean(body.memo, 500),
        created_by: clean(session.mentorName, 40) ?? "admin",
      })
      .select()
      .single();
    if (!error) return NextResponse.json({ link: data });
    // 코드 중복이면 다시 뽑는다 (직접 입력한 코드면 바로 알려준다)
    if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    if (clean(body.code, 24)) return NextResponse.json({ error: "이미 쓰고 있는 코드예요" }, { status: 400 });
  }
  return NextResponse.json({ error: "코드 생성에 실패했어요" }, { status: 500 });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await req.json();
  const code = clean(body.code, 24);
  if (!code) return NextResponse.json({ error: "코드가 없습니다" }, { status: 400 });

  const patch: Record<string, string | null> = {};
  for (const k of ["label", "who_type", "grade", "channel", "contact", "memo"]) {
    if (k in body) patch[k] = clean(body[k], k === "memo" ? 500 : 60);
  }
  const { error } = await getServiceClient().from("demo_links").update(patch).eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
