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
    // weekly 1주차로 이동 — GET 요청이 row 없으면 자동 생성
    router.push(`/mentor/students/${studentId}/weekly?cycle=${nextCycle}&week=1`);
  }

  const label =
    nextCycle === 1 ? "첫 번째 사이클 시작" : `다음 사이클 시작 (#${nextCycle})`;

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
