import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

type NavItem = { href: string; label: string };

export function Shell({
  role,
  who,
  nav,
  children,
}: {
  role: "admin" | "mentor";
  who: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen mesh-bg-soft">
      <header className="relative no-print bg-white border-b border-ink/[0.07]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 레포트 배너와 동일한 회사 로고 사용 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="SKY MATE 로고"
              className="h-10 w-10 rounded-[10px] object-contain"
            />
            <div>
              <div className="text-sm font-bold tracking-wide text-ink">
                SKY MATE 코칭 대시보드
              </div>
              <div className="text-[11px] text-ink/55 mt-0.5">
                <span className="inline-block px-1.5 py-0.5 rounded bg-indigo/10 text-indigo font-semibold">
                  {role === "admin" ? "ADMIN" : "MENTOR"}
                </span>
                <span className="ml-1.5">{who}</span>
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>

        <nav className="relative">
          <div className="max-w-6xl mx-auto px-6 flex gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="relative py-3 px-3 text-sm text-ink/60 hover:text-ink transition"
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div className="h-px bg-ink/[0.07]" />
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
