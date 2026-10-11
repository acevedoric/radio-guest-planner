// FASE P: "cargo basura" importado de Excel (proposed_by === "excel_import")
// -- frases de promo/invitación pegadas por error en la celda de cargo, no
// un cargo real. Se trata como vacío en pantalla, en el payload de
// investigación y en la regla "la app manda" de ingest-libreto (ver
// supabase/functions/ingest-libreto/index.ts, misma lógica duplicada ahí
// por ser otro runtime).
const GARBAGE_CARGO_PHRASE_RE = /\b(quiero|invitar|invitarlos|invitarles|saluda|amigos de|despu[eé]s de|esta noche|buenas noches|a las|llamar|confirmar|pendiente)\b/i;
const GARBAGE_CARGO_TIME_RE = /\b\d{1,2}(:\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b|\b\d{1,2}\s*de\s*la\s*(noche|tarde|ma[ñn]ana)\b|\b\d{1,2}:\d{2}\b/i;
const CARGO_PROFESSION_RE = /\b(periodista|presentador|presentadora|actor|actriz|cantante|m[uú]sic[oa]|chef|m[eé]dic[oa]|abogad[oa]|comediante|escritor|escritora|astr[oó]nom[oa]|psic[oó]log[oa]|deportista|futbolista|ciclista|empresari[oa]|influencer|productor|productora|director|directora|docente|investigador|investigadora)\b/i;
const KNOWN_TEAM_FIRST_NAMES = new Set(["mauricio", "simon"]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function looksLikeGarbageCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const c = cargo.trim();
  if (!c) return false;
  if (KNOWN_TEAM_FIRST_NAMES.has(stripAccents(c))) return true;
  if (CARGO_PROFESSION_RE.test(c)) return false;
  if (GARBAGE_CARGO_PHRASE_RE.test(c)) return true;
  if (GARBAGE_CARGO_TIME_RE.test(c)) return true;
  if (c.length > 80) return true;
  return false;
}

/** Cargo del guest a mostrar, ignorando el basura de excel_import. */
export function effectiveGuestPosition(guest: { position?: string | null; proposed_by?: string | null }): string | null {
  if (guest.proposed_by === "excel_import" && looksLikeGarbageCargo(guest.position)) return null;
  return guest.position || null;
}
