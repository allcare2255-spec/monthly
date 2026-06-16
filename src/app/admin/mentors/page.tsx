import { getServiceClient } from "@/lib/supabase";
import { MentorsView } from "./mentors-view";

export const dynamic = "force-dynamic";

export default async function AdminMentorsPage() {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("coaching_mentors")
    .select("id, name, mentor_code, unique_number, first_coaching_date, created_at")
    .order("name", { ascending: true });
  return <MentorsView initial={data || []} />;
}
