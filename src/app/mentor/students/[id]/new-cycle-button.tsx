"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCycleButton({
  studentId,
  nextCycle,
  primary,
}: {
  studentId: string;
  nextCycle: number;
  primary?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      // 레포트 화면으로 이동하지 않고 이 페이지에 머문 채 월차만 만든다.
      // weekly GET 은 해당 (학생, 월차, 1주차) row 가 없으면 빈 row 를 생성한다.
      const res = await fetch(
        `/api/reports/weekly?student_id=${studentId}&cycle=${nextCycle}&week=1`,
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "월차를 시작하지 못했습니다.");
        return;
      }
      router.refresh(); // 새 월차 카드가 아래에 추가된다
    } catch {
      alert("월차를 시작하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const label =
    nextCycle === 1 ? "코칭 1개월차 시작" : `다음 사이클 시작 (코칭 ${nextCycle}개월차)`;

  if (primary) {
    return (
      <button onClick={start} disabled={loading} className="btn-gradient rounded-xl font-semibold px-6 py-3">
        {loading ? "준비 중..." : `${label} →`}
      </button>
    );
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="text-sm rounded-xl border border-indigo/25 bg-gradient-to-r from-indigo/8 to-fuchsia/8 hover:from-indigo/15 hover:to-fuchsia/15 text-indigo font-semibold px-4 py-2 transition"
    >
      + {loading ? "준비 중..." : label}
    </button>
  );
}
