import { supabase } from "@/integrations/supabase/client";

export interface BlacklistRule {
  id: string;
  text: string;
  created_at: string;
}

export async function fetchBlacklistRules(): Promise<BlacklistRule[]> {
  const { data, error } = await (supabase as any)
    .from("blacklist_rules")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as BlacklistRule[];
}

export async function addBlacklistRule(text: string) {
  const { error } = await (supabase as any).from("blacklist_rules").insert({ text: text.trim() });
  if (error) throw error;
}

export async function removeBlacklistRule(id: string) {
  const { error } = await (supabase as any).from("blacklist_rules").delete().eq("id", id);
  if (error) throw error;
}
