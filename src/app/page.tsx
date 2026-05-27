import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GatewayForm } from "./gateway-form";
import SkyMateLogo from "@/components/SkyMateLogo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "mentor") redirect("/mentor");

  return (
    <main className="mesh-bg min-h-screen relative overflow-hidden">
      {/* 노이즈 / 별빛 느낌 */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-10">
            <div className="mb-5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 p-3 shadow-2xl shadow-violet/20">
              <SkyMateLogo size={56} />
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/60 mb-2">
              Premium Coaching
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">
              SKY MATE
            </h1>
            <p className="mt-3 text-sm text-white/70">관리자 또는 멘토 코드를 입력해주세요</p>
          </div>

          <div className="glass rounded-3xl shadow-2xl shadow-indigo/20 p-7 ring-1 ring-white/30">
            <GatewayForm />
          </div>

          <p className="mt-8 text-center text-[11px] text-white/40 tracking-wider">
            INTERNAL · 외부 공유 금지
          </p>
        </div>
      </div>
    </main>
  );
}
