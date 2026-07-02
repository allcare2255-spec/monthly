import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GatewayForm } from "./gateway-form";

export const dynamic = "force-dynamic";

// 디자인은 '고등 코칭 ERP'(skymate2) 로그인 화면과 완전히 동일하게 맞춤.
export default async function Home() {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "mentor") redirect("/mentor");

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "#f6f7f8",
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-[10px] p-10"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
      >
        {/* 로고 영역 */}
        <div className="flex flex-col items-center gap-3 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="SKY MATE 로고"
            className="w-14 h-14 rounded-[10px] object-contain"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1a1a1e" }}>
              SKY MATE
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#949ba8" }}>
              고등 코칭 ERP
            </p>
          </div>
        </div>

        {/* 폼 */}
        <GatewayForm />
      </div>
    </main>
  );
}
