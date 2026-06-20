import type { Session } from "@supabase/supabase-js";

/**
 * Returns the table/view to read from depending on auth state.
 * Anonymous users read from `guests_anon`, a view that hides sensitive
 * fields (phone, email, press contacts, internal notes).
 */
export const guestsReadFrom = (session: Session | null): "guests" | "guests_anon" =>
  session ? "guests" : "guests_anon";
