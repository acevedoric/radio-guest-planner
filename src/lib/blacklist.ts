import { supabase } from "@/integrations/supabase/client";

export interface BlacklistMatch {
  id: string;
  name: string;
  reason: string | null;
  match_type: "exact" | "approximate";
  similarity: number;
}

export type BlacklistCategory = "actores" | "coaches_influencers_periodistas" | "comediantes";

export const BLACKLIST_CATEGORY_LABEL: Record<BlacklistCategory, string> = {
  actores: "Actores",
  coaches_influencers_periodistas: "Coaches / influencers / periodistas",
  comediantes: "Comediantes",
};

export interface BlacklistRow {
  id: string;
  name: string;
  reason: string | null;
  category: BlacklistCategory | null;
  created_at: string;
  created_by: string | null;
}

/** Coincidencias exactas y aproximadas (tolerante a tildes y errores menores). */
export async function checkBlacklist(name: string): Promise<BlacklistMatch[]> {
  const trimmed = (name || "").trim();
  if (!trimmed) return [];
  const { data, error } = await (supabase.rpc as any)("check_blacklist", { p_name: trimmed });
  if (error) throw error;
  return (data || []) as BlacklistMatch[];
}

export async function fetchBlacklist(): Promise<BlacklistRow[]> {
  const { data, error } = await (supabase as any)
    .from("blacklist")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as BlacklistRow[];
}

export async function addToBlacklist(name: string, reason: string | null, category: BlacklistCategory | null = null) {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await (supabase as any).from("blacklist").insert({
    name: name.trim(),
    reason: reason?.trim() || null,
    category,
    created_by: session?.user?.id ?? null,
  });
  if (error) throw error;
}

export async function removeFromBlacklist(id: string) {
  const { error } = await (supabase as any).from("blacklist").delete().eq("id", id);
  if (error) throw error;
}
