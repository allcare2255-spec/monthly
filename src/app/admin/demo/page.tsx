import { loadDemoLinks, loadDemoStats, type DemoLink, type DemoStats } from "@/lib/demo/aggregate";
import { DemoView } from "./demo-view";

export const dynamic = "force-dynamic";

/** 체험 페이지(/demo) 개인 링크 발급 + 방문 집계 — 관리자 전용. */
export default async function AdminDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: raw } = await searchParams;
  const days = raw === "all" ? null : Number(raw) || 30;

  let stats: DemoStats | null = null;
  let links: DemoLink[] = [];
  let err = "";
  try {
    [stats, links] = await Promise.all([loadDemoStats(days), loadDemoLinks()]);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  if (!stats) {
    const missing = /demo_events|demo_links|does not exist|schema cache/i.test(err);
    return (
      <div className="space-y-4">
        <h1 className="text-gradient text-3xl font-extrabold">개인 링크 &amp; 집계</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {missing ? (
            <>
              <div className="font-bold">아직 기록 테이블이 만들어지지 않았어요.</div>
              <div className="mt-1.5 leading-relaxed">
                Supabase 대시보드 &gt; SQL Editor 에서{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
                  supabase/migrations/20260918_demo_events.sql
                </code>{" "}
                내용을 붙여넣고 RUN 한 뒤 새로고침해주세요.
              </div>
            </>
          ) : (
            <>불러오지 못했어요: {err}</>
          )}
        </div>
      </div>
    );
  }

  return <DemoView stats={stats} links={links} days={days} />;
}
