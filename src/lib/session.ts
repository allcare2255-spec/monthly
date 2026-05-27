import { cookies } from "next/headers";
import type { Session } from "@/types";

const COOKIE = process.env.SESSION_COOKIE_NAME || "coaching_session";

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as Session;
  } catch {
    return null;
  }
}

export async function setSession(session: Session) {
  const c = await cookies();
  c.set(COOKIE, Buffer.from(JSON.stringify(session), "utf-8").toString("base64"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}
