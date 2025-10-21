export interface Guest {
  id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  social_networks?: any;
  topic: string;
  recording_status: "live" | "recorded" | "no_recording" | "cancelled";
  program_type?: string | null;
  press_contact?: string | null;
  notes?: string | null;
  day_of_week: string;
  time_slot: number;
  week_date: string;
}
