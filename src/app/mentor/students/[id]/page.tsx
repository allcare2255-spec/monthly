import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays } from "@/lib/dates";
import { NewCycleButton } from "./new-cycle-button";
import { CycleCards, type CycleInfo } from "./cycle-cards";

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

  // [수정 9] 월차별 날짜 오버라이드 / 메모
  const { data: cycleRows } = await supabase
    .from("coaching_cycles")
    .select("cycle_number, start_date, end_date, memo")
    .eq("student_id", id);
  const overrides: Record<number, { start_date: string | null; end_date: string | null; memo: string | null }> = {};
  (cycleRows || []).forEach((r) => {
    overrides[r.cycle_number] = { start_date: r.start_date, end_date: r.end_date, memo: r.memo };
  });

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
          {/* [수정 8-1] 라벨 변경 */}
          <Info label="학생 전화번호" value={student.phone} />
          {/* [수정 8-2] 학부모 연락처는 관리자 화면에서만 표시 */}
          {isAdmin && <Info label="학부모 연락처" value={student.parent_phone} />}
          <Info label="첫 코칭 시작일" value={student.coaching_start_date} />
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
              코칭 진행 <span className="text-ink/40">({cycles.length || 0}개월 진행 · 다음 {nextCycle}개월차)</span>
            </h2>
            <NewCycleButton studentId={id} nextCycle={nextCycle} />
          </div>

          {cycles.length === 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo/5 to-fuchsia/5 border border-indigo/15 p-8 text-center">
              <p className="text-ink/70 text-sm">아직 시작된 코칭이 없습니다.</p>
              <p className="text-ink/50 text-xs mt-1">
                코칭 1개월차부터 시작해주세요. (시작일 {start} 기준)
              </p>
              <div className="mt-5">
                <NewCycleButton studentId={id} nextCycle={1} primary />
              </div>
            </div>
          )}

          <CycleCards
            studentId={id}
            studentName={student.name}
            cycles={cycles.map<CycleInfo>((cyc) => {
              const cycleStart = addDays(start, (cyc - 1) * 28);
              return {
                cycle: cyc,
                defaultStart: cycleStart,
                defaultEnd: addDays(cycleStart, 27),
                weekProgress: weekCountByCycle[cyc] || 0,
              };
            })}
            initialOverrides={overrides}
          />
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
