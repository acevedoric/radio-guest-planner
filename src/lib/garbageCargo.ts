// FASE P: "cargo basura" importado de Excel (proposed_by === "excel_import")
// -- frases de promo/invitación pegadas por error en la celda de cargo, no
// un cargo real. Se trata como vacío en pantalla, en el payload de
// investigación y en la regla "la app manda" de ingest-libreto (ver
// supabase/functions/ingest-libreto/index.ts, misma lógica duplicada ahí
// por ser otro runtime).
const GARBAGE_CARGO_RE = /\b(quiero|invitar|invitarlos|invitarles|despu[eé]s|esta noche|buenas noches|acomp[aá]ñ|escuchen|los espero|les espero|amigos de|esta tarde|hoy a las|a las \d)\b/i;

export function looksLikeGarbageCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const c = cargo.trim();
  if (!c) return false;
  if (c.length > 40) return true;
  if (/^[a-záéíóúñ]/.test(c) && c.split(/\s+/).filter(Boolean).length > 3) return true;
  if (GARBAGE_CARGO_RE.test(c)) return true;
  return false;
}

/** Cargo del guest a mostrar, ignorando el basura de excel_import. */
export function effectiveGuestPosition(guest: { position?: string | null; proposed_by?: string | null }): string | null {
  if (guest.proposed_by === "excel_import" && looksLikeGarbageCargo(guest.position)) return null;
  return guest.position || null;
}
