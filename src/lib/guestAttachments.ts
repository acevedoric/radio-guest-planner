import { supabase } from "@/integrations/supabase/client";

export const GUEST_DOCS_BUCKET = "guest-documents";

export interface GuestDocumentRow {
  id: string;
  guest_id: string;
  hour_number: number | null;
  file_name: string;
  file_url: string; // storage path
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
}

export interface GuestUrlRow {
  id: string;
  guest_id: string;
  hour_number: number | null;
  url: string;
  label: string | null;
  created_at: string | null;
}

export async function fetchGuestDocuments(guestId: string, hour?: number) {
  let query = (supabase as any)
    .from("guest_documents")
    .select("*")
    .eq("guest_id", guestId)
    .order("uploaded_at", { ascending: false });
  if (hour) query = query.eq("hour_number", hour);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as GuestDocumentRow[];
}

export async function fetchGuestUrls(guestId: string, hour?: number) {
  let query = (supabase as any)
    .from("guest_urls")
    .select("*")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: true });
  if (hour) query = query.eq("hour_number", hour);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as GuestUrlRow[];
}

/** Signed URL for a stored document path (default 1 hour). */
export async function getSignedDocumentUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(GUEST_DOCS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

/** Documents + reference urls of an hour, ready for the n8n payload. */
export async function buildAttachmentsPayload(guestId: string, hour: number) {
  const [docs, urls] = await Promise.all([
    fetchGuestDocuments(guestId, hour).catch(() => [] as GuestDocumentRow[]),
    fetchGuestUrls(guestId, hour).catch(() => [] as GuestUrlRow[]),
  ]);

  const documents = await Promise.all(
    docs.map(async (d) => ({
      file_name: d.file_name,
      file_url: (await getSignedDocumentUrl(d.file_url, 60 * 60 * 24).catch(() => null)) || "",
      file_type: d.file_type,
    }))
  );

  return {
    documents: documents.filter((d) => d.file_url),
    reference_urls: urls.map((u) => u.url),
  };
}
