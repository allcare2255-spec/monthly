import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = getServiceClient();
  const [{ count: mentorCount }, { count: studentCount }, { count: matchedCount }] = await Promise.all([
    supabase.from("coaching_mentors").select("id", { count: "exact", head: true }),
    supabase.from("coaching_students").select("id", { count: "exact", head: true }),
    supabase.from("coaching_students").select("id", { count: "exact", head: true }).not("mentor_id", "is", null),
  ]);
  const unmatched = (studentCount || 0) - (matchedCount || 0);

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
          value={mentorCount || 0}
          href="/admin/mentors"
          gradient="from-indigo via-violet to-fuchsia"
          icon="👥"
        />
        <StatCard
          label="등록 학생"
          value={studentCount || 0}
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
          alert={unmatched > 0}
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
  value: number;
  href: string;
  gradient: string;
  icon: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 hover:shadow-xl transition ${
        alert && value > 0 ? "hover:shadow-rose/20" : "hover:shadow-indigo/15"
      }`}
    >
      <div className={`absolute inset-x-0 -top-10 h-32 bg-gradient-to-br ${gradient} opacity-[0.08] blur-2xl`} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[11px] text-ink/55 uppercase tracking-[0.18em]">{label}</div>
          <div className={`text-4xl font-extrabold mt-2 tabular-nums ${
            alert && value > 0 ? "text-gradient-warm" : "text-gradient"
          }`}>
            {value}
          </div>
        </div>
        <div className={`text-3xl opacity-50 group-hover:opacity-90 transition`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}
