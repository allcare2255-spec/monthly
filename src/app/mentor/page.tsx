import Link from "next/link";
import { getSession } from "@/lib/session";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CARD_GRADIENTS = [
  "from-indigo/15 via-violet/10 to-fuchsia/15",
  "from-fuchsia/15 via-rose/10 to-sunset/15",
  "from-violet/15 via-fuchsia/10 to-rose/15",
  "from-indigo/15 via-fuchsia/10 to-rose/15",
];

export default async function MentorHomePage() {
  const session = await getSession();
  if (!session?.mentorId) return null;
  const supabase = getServiceClient();
  const { data: students } = await supabase
    .from("coaching_students")
    .select("*")
    .eq("mentor_id", session.mentorId)
    .order("created_at", { ascending: false });

  const all = (students || []) as any[];
  const active = all.filter((s) => !s.coaching_ended);
  const ended = all.filter((s) => s.coaching_ended);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
          My Students
        </div>
        <h1 className="text-4xl font-extrabold text-gradient mt-2">내 담당 학생</h1>
        <p className="text-ink/55 mt-2 text-sm">
          학생을 선택하면 주간/월간 레포트 작성 화면으로 이동합니다
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {active.map((s: any, i: number) => (
          <Link
            key={s.id}
            href={`/mentor/students/${s.id}`}
            className="group relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 hover:shadow-xl hover:shadow-indigo/15 hover:-translate-y-0.5 transition"
          >
            <div className={`absolute -right-10 -top-10 w-36 h-36 rounded-full bg-gradient-to-br ${CARD_GRADIENTS[i % 4]} blur-2xl group-hover:scale-125 transition duration-500`} />
            <div className="relative">
              <div className="text-2xl font-extrabold text-ink">{s.name}</div>
              <div className="text-sm text-ink/55 mt-1">
                {s.high_school || "학교 미입력"}
                {s.age ? ` · ${s.age}세` : ""}
              </div>
              {s.coaching_start_date && (
                <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold bg-gradient-to-r from-indigo/10 to-fuchsia/10 text-indigo rounded-full px-2.5 py-1 border border-indigo/15">
                  코칭 시작 · {s.coaching_start_date}
                </div>
              )}
            </div>
          </Link>
        ))}
        {active.length === 0 && (
          <p className="col-span-full text-center text-ink/40 py-16 text-sm">
            배정된 학생이 없습니다. 관리자에게 문의해주세요.
          </p>
        )}
      </div>

      {/* [수정 7] 코칭 종료 학생 — 활성 학생과 시각적으로 구분 */}
      {ended.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-ink/55 uppercase tracking-[0.15em]">코칭 종료 학생</h2>
            <span className="text-xs text-ink/40">({ended.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ended.map((s: any) => (
              <Link
                key={s.id}
                href={`/mentor/students/${s.id}`}
                className="group relative overflow-hidden rounded-2xl bg-ink/[0.03] border border-ink/10 p-5 grayscale-[0.4] hover:grayscale-0 hover:shadow-md transition"
              >
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-extrabold text-ink/60">{s.name}</div>
                    <span className="text-[10px] font-bold rounded-full bg-ink/10 text-ink/50 px-2 py-0.5">
                      코칭 종료
                    </span>
                  </div>
                  <div className="text-sm text-ink/45 mt-1">
                    {s.high_school || "학교 미입력"}
                    {s.age ? ` · ${s.age}세` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
