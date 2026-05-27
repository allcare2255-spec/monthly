import { Shell } from "@/components/Shell";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <Shell
      role="admin"
      who="총괄 관리자"
      nav={[
        { href: "/admin", label: "대시보드" },
        { href: "/admin/mentors", label: "멘토 관리" },
        { href: "/admin/students", label: "학생 관리" },
      ]}
    >
      {children}
    </Shell>
  );
}
