import { Shell } from "@/components/Shell";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session?.role !== "mentor") redirect("/");
  return (
    <Shell
      role="mentor"
      who={session.mentorName || "멘토"}
      nav={[{ href: "/mentor", label: "내 학생" }]}
    >
      {children}
    </Shell>
  );
}
