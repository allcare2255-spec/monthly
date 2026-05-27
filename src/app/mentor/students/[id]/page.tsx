import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays } from "@/lib/dates";
import { NewCycleButton } from "./new-cycle-button";

export const dynamic = "force-dynamic";

export default async function StudentHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("id, name, age, high_school, phone, parent_phone, coaching_start_date, mentor_id, mentor:coaching_mentors(name)")
    .eq("id", id)
    .maybeSingle();
  if (!student) return notFound();
  if (session.role !== "admin" && student.mentor_id !== session.mentorId) return notFound();
  const isAdmin = session.role === "admin";
  const start = student.coaching_start_date;

  // 학생의 사이클 목록 — weekly_reports 또는 monthly_reports에 존재하는 모든 cycle_number
  const { data: weeklyRows } = await supabase
    .from("coaching_weekly_reports")
    .select("cycle_number, week_number")
    .eq("student_id", id);
  const { data: monthlyRows } = await supabase
    .from("coaching_monthly_reports")
    .select("cycle_number")
    .eq("student_id", id);

  const cycleSet = new Set<number>();
  (weeklyRows || []).forEach((r) => cycleSet.add(r.cycle_number));
  (monthlyRows || []).forEach((r) => cycleSet.add(r.cycle_number));
  const cycles = Array.from(cycleSet).sort((a, b) => a - b);
  const nextCycle = cycles.length ? Math.max(...cycles) + 1 : 1;

  // 사이클별 week 진행 카운트 (몇 주차까지 시작됐는지)
  const weekCountByCycle: Record<number, number> = {};
  (weeklyRows || []).forEach((r) => {
    weekCountByCycle[r.cycle_number] = Math.max(
      weekCountByCycle[r.cycle_number] || 0,
      r.week_number,
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href={isAdmin ? "/admin/students" : "/mentor"} className="text-sm text-ink/55 hover:text-indigo">
          ← {isAdmin ? "학생 관리" : "내 학생 목록"}
        </Link>
        <h1 className="text-4xl font-extrabold text-gradient mt-2">{student.name}</h1>
        <p className="text-ink/55 mt-2 text-sm">
          {student.high_school || "학교 미입력"}
          {student.age ? ` · ${student.age}세` : ""}
          {isAdmin && (student as any).mentor?.name ? ` · 담당 ${(student as any).mentor.name} 멘토` : ""}
        </p>
      </div>

      <section className="rounded-2xl bg-white border border-ink/5 p-6 shadow-sm">
        <h2 className="text-base font-bold text-ink mb-4">학생 정보</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info label="본인 연락처" value={student.phone} />
          <Info label="학부모 연락처" value={student.parent_phone} />
          <Info label="코칭 시작일" value={student.coaching_start_date} />
        </div>
      </section>

      {!start ? (
        <div className="rounded-2xl bg-gradient-to-br from-sunset/10 to-rose/10 border border-sunset/30 p-6 text-sm text-ink/80">
          이 학생은 아직 코칭 시작일이 등록되지 않아 레포트를 작성할 수 없습니다.
          관리자에게 시작일 등록을 요청해주세요.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              코칭 사이클 <span className="text-ink/40">({cycles.length || 0}개 진행 / 다음 #{nextCycle})</span>
            </h2>
            <NewCycleButton studentId={id} nextCycle={nextCycle} />
          </div>

          {cycles.length === 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo/5 to-fuchsia/5 border border-indigo/15 p-8 text-center">
              <p className="text-ink/70 text-sm">아직 시작된 사이클이 없습니다.</p>
              <p className="text-ink/50 text-xs mt-1">
                아래 첫 번째 사이클부터 시작해주세요. (코칭 시작일 {start} 기준)
              </p>
              <div className="mt-5">
                <NewCycleButton studentId={id} nextCycle={1} primary />
              </div>
            </div>
          )}

          <div className="space-y-3">
            {cycles.map((cyc) => {
              const cycleStart = addDays(start, (cyc - 1) * 28);
              const cycleEnd = addDays(cycleStart, 27);
              const weekProgress = weekCountByCycle[cyc] || 0;
              return (
                <div
                  key={cyc}
                  className="relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className={`absolute -right-12 -top-12 w-44 h-44 rounded-full bg-gradient-to-br ${
                    cyc % 2 === 1
                      ? "from-indigo/12 via-violet/10 to-fuchsia/12"
                      : "from-fuchsia/12 via-rose/10 to-sunset/12"
                  } blur-2xl pointer-events-none`} />
                  <div className="relative flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-indigo font-semibold">
                        Cycle {cyc}
                      </div>
                      <div className="text-xl font-extrabold text-ink mt-1">
                        {cyc}번째 사이클
                      </div>
                      <div className="text-xs text-ink/55 mt-0.5">
                        {cycleStart} ~ {cycleEnd}
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded-full bg-ink/5 text-ink/60 text-[10px]">
                          {weekProgress}/4 주차 진행
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[1, 2, 3, 4].map((w) => (
                        <Link
                          key={w}
                          href={`/mentor/students/${id}/weekly?cycle=${cyc}&week=${w}`}
                          className={`text-xs rounded-full px-2.5 py-1 font-semibold border transition ${
                            w <= weekProgress
                              ? "bg-gradient-to-r from-indigo/15 to-violet/15 text-indigo border-indigo/25 hover:from-indigo/25 hover:to-violet/25"
                              : "text-ink/50 border-ink/10 hover:bg-indigo/5"
                          }`}
                        >
                          {w}주차
                        </Link>
                      ))}
                      <Link
                        href={`/mentor/students/${id}/monthly?cycle=${cyc}`}
                        className="text-xs rounded-full px-3 py-1 font-semibold bg-gradient-to-r from-fuchsia to-rose text-white border border-transparent hover:brightness-110 transition shadow-sm shadow-fuchsia/30"
                      >
                        월간 →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-ink/55 uppercase tracking-[0.12em] font-semibold">{label}</div>
      <div className="font-medium mt-1">{value || "-"}</div>
    </div>
  );
}
