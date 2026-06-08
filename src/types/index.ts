export type Mentor = {
  id: string;
  name: string;
  mentor_code: string;
  created_at: string;
};

export type Student = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  phone: string | null;
  parent_phone: string | null;
  high_school: string | null;
  mentor_id: string | null;
  coaching_start_date: string | null;
  coaching_ended: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachingCycle = {
  id: string;
  student_id: string;
  cycle_number: number;
  start_date: string | null;
  end_date: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type DayStatus = "submitted" | "missed" | "paused";

export type DayData = {
  date: string;                  // "2026-05-27"
  wake_up_time: string | null;   // "06:30"
  study_minutes: number | null;
  memo: string | null;
  status: DayStatus;
};

export type WeeklyReport = {
  id: string;
  student_id: string;
  cycle_number: number;
  week_number: number;           // 1~4
  start_date: string;
  end_date: string;
  day_data: DayData[];           // 7개
  good_points: string | null;
  improvement_points: string | null;
  next_week_actions: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyReport = {
  id: string;
  student_id: string;
  cycle_number: number;
  month_summary: string | null;
  next_month_direction: string | null;
  created_at: string;
  updated_at: string;
};

export type Session = {
  role: "admin" | "mentor";
  mentorId?: string;
  mentorName?: string;
};
