// ERP(skymate2)에서 멘토 업력을 가져온다.
// ERP와 대시보드는 서로 다른 Supabase 프로젝트를 쓰기 때문에 DB를 직접 보지 않고
// ERP의 /api/mentor-experience 엔드포인트를 호출한다. 계산 로직은 ERP 한 곳에만 있다.
//
// 두 시스템에 공통 키가 없어 현재는 멘토 "이름"으로 대조한다.
// ERP에 없는 이름이거나 동명이인이면 null을 돌려주고 화면에서는 조용히 감춘다.

export type MentorExperience = {
  name: string;
  experienceMonths: number;
  asOf: string;
};

export async function fetchMentorExperience(name: string): Promise<MentorExperience | null> {
  const base = process.env.ERP_API_BASE;
  const key = process.env.ERP_API_KEY;
  if (!base || !key || !name) return null;

  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/api/mentor-experience?name=${encodeURIComponent(name)}`,
      // ERP가 느리거나 죽어 있어도 대시보드가 같이 멈추지 않도록 5초에서 끊는다
      { headers: { "x-api-key": key }, cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) {
      // 404(ERP에 없는 멘토)·409(동명이인)는 정상적인 결과이므로 경고만 남긴다
      console.warn(`[erpExperience] ${name}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (typeof data?.experienceMonths !== "number") return null;
    return { name: data.name, experienceMonths: data.experienceMonths, asOf: data.asOf };
  } catch (e) {
    console.error("[erpExperience]", e);
    return null;
  }
}
