import { getServiceClient } from "@/lib/supabase";
import { StudentsView } from "./students-view";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const supabase = getServiceClient();
  const [{ data: students }, { data: mentors }] = await Promise.all([
    supabase
      .from("coaching_students")
      .select("*, mentor:coaching_mentors(name, mentor_code)")
      .order("created_at", { ascending: false }),
    supabase.from("coaching_mentors").select("id, name").order("name"),
  ]);

  return (
    <StudentsView
      initialStudents={(students as any[]) || []}
      mentors={(mentors as any[]) || []}
    />
  );
}
