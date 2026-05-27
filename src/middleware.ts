import { NextResponse, type NextRequest } from "next/server";

const COOKIE = process.env.SESSION_COOKIE_NAME || "coaching_session";

function readSession(req: NextRequest): { role?: string; mentorId?: string } | null {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = path === "/" || path.startsWith("/api/login");
  const session = readSession(req);

  // 비로그인 + 보호 라우트
  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 권한 분기
  if (session) {
    if (path === "/") {
      const url = req.nextUrl.clone();
      url.pathname = session.role === "admin" ? "/admin" : "/mentor";
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/admin") && session.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/mentor";
      return NextResponse.redirect(url);
    }
    // admin은 모든 멘토의 학생 레포트를 조회할 수 있도록 /mentor/* 허용
    if (path.startsWith("/mentor") && session.role !== "mentor" && session.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)$).*)"],
};
