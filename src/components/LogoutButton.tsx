"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/85 hover:bg-white/15 backdrop-blur-md transition"
    >
      로그아웃
    </button>
  );
}
