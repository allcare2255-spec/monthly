import Link from "next/link";
import { getSession } from "@/lib/session";
import { listReviewSetsByMentor } from "@/lib/review/store";
import { ReviewStatusBadge } from "./status-badge";

export const dynamic = "force-dynamic";

export default async function ReviewListPage() {
  const session = await getSession();
  if (!session) return null;

  const sets = session.mentorId ? await listReviewSetsByMentor(session.mentorId) : [];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-indigo font-semibold">
            Review
          </div>
          <h1 className="text-4xl font-extrabold text-gradient mt-2">복습 출제·관리</h1>
          <p className="text-ink/55 mt-2 text-sm">
            자료(사진/PDF)를 올리면 AI가 복습 테스트를 만들어 줍니다. 코드/링크를 학생에게 전달하세요.
          </p>
        </div>
        <Link
          href="/mentor/review/new"
          className="btn-gradient rounded-xl px-5 py-3 font-semibold whitespace-nowrap"
        >
          + 새 복습 출제
        </Link>
      </div>

      {!session.mentorId && (
        <div className="rounded-2xl bg-gradient-to-br from-sunset/10 to-rose/10 border border-sunset/30 p-6 text-sm text-ink/80">
          관리자 계정은 출제 목록이 없습니다. 멘토 계정으로 로그인해 출제하세요.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(sets as any[]).map((s) => (
          <Link
            key={s.id}
            href={`/mentor/review/${s.id}`}
            className="group relative overflow-hidden rounded-2xl bg-white border border-ink/5 p-5 hover:shadow-xl hover:shadow-indigo/15 hover:-translate-y-0.5 transition"
          >
            <div className="text-lg font-extrabold text-ink line-clamp-2">{s.title}</div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <ReviewStatusBadge status={s.status} />
              {s.student?.name && (
                <span className="bg-fuchsia/10 text-fuchsia rounded-full px-2.5 py-1 font-semibold">
                  {s.student.name}
                </span>
              )}
              {s.subject && (
                <span className="bg-ink/5 text-ink/60 rounded-full px-2.5 py-1">{s.subject}</span>
              )}
            </div>
            <div className="text-xs text-ink/40 mt-3">
              {s.created_at ? new Date(s.created_at).toLocaleString("ko-KR") : ""}
            </div>
          </Link>
        ))}
        {session.mentorId && (sets as any[]).length === 0 && (
          <p className="col-span-full text-center text-ink/40 py-16 text-sm">
            아직 출제한 복습이 없습니다. 우측 상단 “+ 새 복습 출제”로 시작하세요.
          </p>
        )}
      </div>
    </div>
  );
}
