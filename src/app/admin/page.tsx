import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** 카운트 조회 — 실패 시 1회 재시도하고, 그래도 실패하면 null(=화면에 "–")을 반환한다.
 *  실패를 0 으로 뭉개면 "등록 학생 0 / 미배정 -45" 같은 잘못된 숫자가 표시되므로
 *  절대 0 으로 대체하지 않는다. */
async function countRows(
  build: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { count, error } = await build();
    if (!error && typeof count === "number") return count;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

export default async function AdminHomePage() {
  const supabase = getServiceClient();
  const [mentorCount, studentCount, unmatched] = await Promise.all([
    countRows(() => supabase.from("coaching_mentors").select("id", { count: "exact", head: true })),
    countRows(() => supabase.from("coaching_students").select("id", { count: "exact", head: true })),
    // 미배정 학생은 (전체 - 매칭) 뺄셈이 아니라 직접 조회한다.
    // 뺄셈은 두 쿼리 중 하나만 실패해도 음수가 나오기 때문.
    countRows(() =>
      supabase.from("coaching_students").select("id", { count: "exact", head: true }).is("mentor_id", null),
    ),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
          Overview
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-2">대시보드</h1>
        <p className="text-ink/55 mt-2 text-sm">전체 운영 현황 한눈에 보기</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="등록 멘토"
          value={mentorCount}
          href="/admin/mentors"
          gradient="from-indigo via-violet to-fuchsia"
          icon="👥"
        />
        <StatCard
          label="등록 학생"
          value={studentCount}
          href="/admin/students"
          gradient="from-violet via-fuchsia to-rose"
          icon="🎓"
        />
        <StatCard
          label="미배정 학생"
          value={unmatched}
          href="/admin/students"
          gradient="from-rose to-sunset"
          icon="⚠"
          alert={(unmatched ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/mentors"
          className="group relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-6 hover:shadow-xl hover:shadow-indigo/15 transition"
        >
          <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-gradient-to-br from-indigo/15 to-violet/20 blur-2xl group-hover:scale-125 transition duration-500" />
          <div className="relative">
            <div className="text-2xl">👥</div>
            <div className="text-ink font-bold text-lg mt-3">멘토 관리 →</div>
            <p className="text-ink/55 text-sm mt-1">새 멘토 등록, 멘토 코드 발급</p>
          </div>
        </Link>
        <Link
          href="/admin/students"
          className="group relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-6 hover:shadow-xl hover:shadow-fuchsia/15 transition"
        >
          <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-gradient-to-br from-fuchsia/15 to-rose/20 blur-2xl group-hover:scale-125 transition duration-500" />
          <div className="relative">
            <div className="text-2xl">🎓</div>
            <div className="text-ink font-bold text-lg mt-3">학생 관리 →</div>
            <p className="text-ink/55 text-sm mt-1">학생 등록, 멘토 매칭, 레포트 조회</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  gradient,
  icon,
  alert,
}: {
  label: string;
  /** null = 조회 실패(0 이 아님) → "–" 로 표시 */
  value: number | null;
  href: string;
  gradient: string;
  icon: string;
  alert?: boolean;
}) {
  const failed = value === null;
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 hover:shadow-xl transition ${
        alert && !failed && value > 0 ? "hover:shadow-rose/20" : "hover:shadow-indigo/15"
      }`}
    >
      <div className={`absolute inset-x-0 -top-10 h-32 bg-gradient-to-br ${gradient} opacity-[0.08] blur-2xl`} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[11px] text-ink/55 uppercase tracking-[0.18em]">{label}</div>
          <div className={`text-4xl font-extrabold mt-2 tabular-nums ${
            failed ? "text-ink/25" : alert && value > 0 ? "text-gradient-warm" : "text-gradient"
          }`}>
            {failed ? "–" : value}
          </div>
          {failed && <div className="text-[11px] text-ink/40 mt-1">불러오지 못함 · 새로고침</div>}
        </div>
        <div className={`text-3xl opacity-50 group-hover:opacity-90 transition`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}
