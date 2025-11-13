export interface Guest {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  social_networks?: any;
  topic: string;
  recording_status: "live" | "recorded" | "to_record" | "postponed" | "proposed";
  program_type?: string | null;
  press_contact?: string | null;
  press_phone?: string | null;
  notes?: string | null;
  day_of_week: string;
  time_slot: number;
  week_date: string;
  scheduled_date?: string | null;
  confirmed_blu?: boolean;
  confirmed_pr?: boolean;
}
