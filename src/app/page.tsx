import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GatewayForm } from "./gateway-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "mentor") redirect("/mentor");

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#f3f4f6" }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col items-center">
          {/* 회사 로고 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="SKY MATE" width={64} height={64} className="mb-4" />
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1f2937]">SKY MATE</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">고등 코칭 ERP</p>
        </div>

        <div className="mt-8">
          <GatewayForm />
        </div>
      </div>
    </main>
  );
}
