import { Guest } from "@/types/guest";

/**
 * URLs de los workflows de n8n.
 * Reemplazar por las URLs reales de producción.
 */
export const WEBHOOK_URL_AGENDAR = "{{WEBHOOK_URL_AGENDAR}}";
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

/** Payload común para ambos webhooks */
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
