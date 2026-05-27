import Link from "next/link";
import SkyMateLogo from "./SkyMateLogo";
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
      <header className="relative no-print overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #1B1238 0%, #2E1A5E 35%, #4F46E5 70%, #8B5CF6 100%)",
          }}
        />
        <div className="absolute -top-12 -right-16 w-72 h-72 rounded-full bg-fuchsia/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 w-72 h-72 rounded-full bg-indigo/40 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2">
              <SkyMateLogo size={32} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">
                SKY MATE 코칭 대시보드
              </div>
              <div className="text-[11px] text-white/70 mt-0.5">
                <span className="inline-block px-1.5 py-0.5 rounded bg-white/15 text-white/90 font-semibold">
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
                className="relative py-3 px-3 text-sm text-white/75 hover:text-white transition"
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div className="h-px bg-white/10" />
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
