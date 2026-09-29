import { Guest } from "@/types/guest";

/**
 * URLs de los workflows de n8n.
 * Reemplazar por las URLs reales de producción.
 */
export const WEBHOOK_URL_AGENDAR = "https://ctv.app.n8n.cloud/webhook/bbb-calendar";
export const WEBHOOK_URL_CONFIRMACION = "{{WEBHOOK_URL_CONFIRMACION}}";

const isPlaceholder = (url: string) => url.startsWith("{{");

export interface WebhookResult {
  ok: boolean;
  message?: string;
}

export async function postWebhook(url: string, payload: unknown): Promise<WebhookResult> {
  if (isPlaceholder(url)) {
    return { ok: false, message: "El webhook de n8n aún no está configurado" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text?.slice(0, 200) || `Error ${res.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Error de red" };
  }
}

/** Payload del webhook de confirmación (correo al PR) */
export function buildGuestPayload(guest: Guest) {
  return {
    guest_name: guest.name,
    guest_position: guest.position ?? null,
    guest_topic: guest.topic ?? null,
    guest_email: guest.email ?? null,
    press_contact: guest.press_contact ?? null,
    press_email: guest.press_email ?? null,
    scheduled_date: guest.scheduled_date ?? null,
    scheduled_time: guest.scheduled_time ?? null,
    hour_number: guest.time_slot ?? null,
    day_of_week: guest.day_of_week ?? null,
  };
}

/* ---------- Payload del webhook de Google Calendar ---------- */

/** Hora de emisión en vivo de cada hora del programa (HH:mm). */
const LIVE_HOUR_TIMES: Record<number, string> = { 1: "22:00", 2: "23:00", 3: "00:00" };
const DAY_OFFSETS: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };
const EVENT_DURATION_MINUTES = 60;

/** Fecha del programa (YYYY-MM-DD) a partir de week_date + day_of_week. */
function programDate(guest: Guest): string | null {
  if (!guest.week_date || !guest.day_of_week) return null;
  const offset = DAY_OFFSETS[guest.day_of_week];
  if (offset === undefined) return null;
  const [y, m, d] = guest.week_date.split("-").map(Number);
  const date = new Date(y, m - 1, d + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Payload para el workflow de n8n que crea el evento en Google Calendar.
 * Para la hora 3 en vivo se envía event_time "00:00" con la fecha del programa:
 * n8n se encarga de sumar el día.
 */
export function buildCalendarPayload(guest: Guest) {
  const isLive = guest.recording_status === "live";
  const hour = guest.time_slot ?? null;

  return {
    event_type: isLive ? "vivo" : "grabacion",
    hour_number: hour,
    guest_name: guest.name,
    topic: guest.topic ?? null,
    event_date: isLive ? programDate(guest) : guest.scheduled_date ?? null,
    event_time: isLive
      ? (hour ? LIVE_HOUR_TIMES[hour] ?? null : null)
      : guest.scheduled_time?.slice(0, 5) ?? null,
    duration_minutes: EVENT_DURATION_MINUTES,
    guest_email: guest.email ?? null,
    pr_email: guest.press_email ?? null,
  };
}

/* ---------- Control anti-duplicados (localStorage) ---------- */

const key = (kind: string, guestId: string) => `blu-webhook:${kind}:${guestId}`;

export function wasSent(kind: "agendar" | "confirmacion", guestId?: string | null): boolean {
  if (!guestId) return false;
  try {
    return localStorage.getItem(key(kind, guestId)) === "1";
  } catch {
    return false;
  }
}

export function markSent(kind: "agendar" | "confirmacion", guestId?: string | null) {
  if (!guestId) return;
  try {
    localStorage.setItem(key(kind, guestId), "1");
  } catch {
    /* noop */
  }
}
