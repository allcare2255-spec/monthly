import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";
import { addDays, resolveCycleStart, todaySeoul, weeksSinceStart, type CycleAnchor } from "@/lib/dates";
import { NewCycleButton } from "./new-cycle-button";
import { CycleCards, type CycleInfo } from "./cycle-cards";
import { listReviewSetsByStudent } from "@/lib/review/store";
import { ensureToken, listSubmissionsByStudent } from "@/lib/consulting/store";
import { weekStateForStudent } from "@/lib/consulting/week";
import { ConsultingSection } from "./consulting-section";

export const dynamic = "force-dynamic";

export default async function StudentHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
  const supabase = getServiceClient();
  const { data: student } = await supabase
    .from("coaching_students")
    .select("id, name, grade, high_school, phone, parent_phone, coaching_start_date, mentor_id, mentor:coaching_mentors(name)")
    .eq("id", id)
    .maybeSingle();
  if (!student) return notFound();
  if (session.role !== "admin" && student.mentor_id !== session.mentorId) return notFound();
  const isAdmin = session.role === "admin";
  const start = student.coaching_start_date;

  // 학생별 독립 조회를 병렬 실행 (기존에는 순차 await 로 DB 라운드트립이 누적됐음)
  const [
    { data: weeklyRows },
    { data: monthlyRows },
    { data: cycleRows },
    { data: restartRows },
    reviewSets,
    consulting,
  ] = await Promise.all([
    // 사이클 목록 — weekly/monthly reports에 존재하는 모든 cycle_number
    supabase.from("coaching_weekly_reports").select("cycle_number, week_number").eq("student_id", id),
    supabase.from("coaching_monthly_reports").select("cycle_number").eq("student_id", id),
    // [수정 9] 월차별 날짜 오버라이드 / 메모
    supabase.from("coaching_cycles").select("cycle_number, start_date, end_date, memo").eq("student_id", id),
    // [변경 3] 재시작 앵커
    supabase.from("coaching_restarts").select("cycle_number, start_date").eq("student_id", id),
    // 이 학생에게 연결된 복습 세트
    listReviewSetsByStudent(id) as Promise<{
      id: string; code: string; title: string; subject: string | null; created_at: string;
    }[]>,
    // 컨설팅 폼 — 공개 링크 토큰 + 제출 내역 (마이그레이션 미적용 시에도 페이지가 죽지 않도록 방어)
    (async () => {
      try {
        const token = await ensureToken(id);
        const subs = await listSubmissionsByStudent(id);
        return { ready: true, token, subs };
      } catch {
        return {
          ready: false,
          token: null as string | null,
          subs: [] as Awaited<ReturnType<typeof listSubmissionsByStudent>>,
        };
      }
    })(),
  ]);

  const overrides: Record<number, { start_date: string | null; end_date: string | null; memo: string | null }> = {};
  (cycleRows || []).forEach((r) => {
    overrides[r.cycle_number] = { start_date: r.start_date, end_date: r.end_date, memo: r.memo };
  });

  const anchors: CycleAnchor[] = (restartRows || []).map((r) => ({
    cycle: r.cycle_number,
    start_date: r.start_date,
  }));

  const cycleSet = new Set<number>();
  (weeklyRows || []).forEach((r) => cycleSet.add(r.cycle_number));
  (monthlyRows || []).forEach((r) => cycleSet.add(r.cycle_number));
  const cycles = Array.from(cycleSet).sort((a, b) => a - b);
  const nextCycle = cycles.length ? Math.max(...cycles) + 1 : 1;

  // [수정 1] 첫 코칭 시작일 ~ 오늘(KST) 실제 날짜 기준 누적 주차
  const currentWeek = start ? weeksSinceStart(start, todaySeoul()) : 0;

  // 사이클별 week 진행 카운트 (몇 주차까지 시작됐는지)
  const weekCountByCycle: Record<number, number> = {};
  (weeklyRows || []).forEach((r) => {
    weekCountByCycle[r.cycle_number] = Math.max(
      weekCountByCycle[r.cycle_number] || 0,
      r.week_number,
    );
  });

  const consultingToken: string | null = consulting.token;
  const submissions = consulting.subs;
  const consultingReady = consulting.ready;

  const weekState = weekStateForStudent(start);
  const consultingCurrent =
    weekState.kind === "form"
      ? { state: "form" as const, week: weekState.week, formType: weekState.formType }
      : { state: "other" as const };

  return (
    <div className="space-y-8">
      <div>
        <Link href={isAdmin ? "/admin/students" : "/mentor"} className="text-sm text-ink/55 hover:text-indigo">
          ← {isAdmin ? "학생 관리" : "내 학생 목록"}
        </Link>
        {/* [수정 2] 이름 옆 학년 표시, 이름 아래 학교명 제거 */}
        <h1 className="text-4xl font-extrabold text-gradient mt-2">
          {student.name}
          {student.grade ? `(${student.grade})` : ""}
        </h1>
        {isAdmin && (student as any).mentor?.name && (
          <p className="text-ink/55 mt-2 text-sm">담당 {(student as any).mentor.name} 멘토</p>
        )}
      </div>

      <section className="rounded-2xl bg-white border border-ink/5 p-6 shadow-sm">
        <h2 className="text-base font-bold text-ink mb-4">학생 정보</h2>
        {/* [수정 2-3] 고등학교 / 학생 전화번호 / 첫 코칭 시작일 순 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info label="고등학교" value={student.high_school} />
          <Info label="학생 전화번호" value={student.phone} />
          <Info label="첫 코칭 시작일" value={student.coaching_start_date} />
          {isAdmin && <Info label="학부모 연락처" value={student.parent_phone} />}
        </div>
      </section>

      {/* 복습 — 이 학생용 출제/기록 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">복습 테스트</h2>
          <Link
            href={`/mentor/review/new?studentId=${id}`}
            className="btn-gradient rounded-xl px-4 py-2 text-sm font-semibold"
          >
            + 이 학생 복습 출제
          </Link>
        </div>
        {reviewSets.length === 0 ? (
          <p className="text-sm text-ink/45 py-5 text-center rounded-2xl bg-white border border-ink/5">
            아직 출제한 복습이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reviewSets.map((r) => (
              <Link
                key={r.id}
                href={`/mentor/review/${r.id}`}
                className="rounded-2xl bg-white border border-ink/5 p-4 hover:shadow-lg hover:shadow-indigo/10 transition"
              >
                <div className="font-bold text-ink line-clamp-1">{r.title}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  <span className="font-mono font-bold bg-indigo/10 text-indigo rounded-full px-2.5 py-1">{r.code}</span>
                  {r.subject && <span className="bg-ink/5 text-ink/60 rounded-full px-2.5 py-1">{r.subject}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 컨설팅 폼 — 학생 제출 링크 + 줌 컨설팅 prep */}
      {consultingReady && consultingToken ? (
        <ConsultingSection token={consultingToken} submissions={submissions} current={consultingCurrent} />
      ) : (
        <section className="rounded-2xl bg-gradient-to-br from-sunset/10 to-rose/10 border border-sunset/30 p-5 text-sm text-ink/75">
          컨설팅 제출 기능은 DB 마이그레이션(<code className="text-xs">20260615_consulting.sql</code>) 적용 후 사용할 수 있습니다.
        </section>
      )}

      {!start ? (
        <div className="rounded-2xl bg-gradient-to-br from-sunset/10 to-rose/10 border border-sunset/30 p-6 text-sm text-ink/80">
          이 학생은 아직 코칭 시작일이 등록되지 않아 레포트를 작성할 수 없습니다.
          관리자에게 시작일 등록을 요청해주세요.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              코칭 진행 <span className="text-ink/40">({currentWeek > 0 ? `${currentWeek}주차 진행 중` : "곧 시작"})</span>
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
            currentWeek={currentWeek}
            cycles={cycles.map<CycleInfo>((cyc) => {
              const cycleStart = resolveCycleStart(start, cyc, anchors);
              return {
                cycle: cyc,
                defaultStart: cycleStart,
                defaultEnd: addDays(cycleStart, 27),
                weekProgress: weekCountByCycle[cyc] || 0,
              };
            })}
            initialOverrides={overrides}
            today={todaySeoul()}
            monthlyDone={(monthlyRows || []).map((r) => r.cycle_number)}
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
