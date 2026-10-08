import { toast } from "sonner";
import { Guest } from "@/types/guest";
import {
  WEBHOOK_URL_AGENDAR,
  buildCalendarPayload,
  isThirdHourShared,
  markSent,
  postWebhook,
  wasSent,
} from "@/lib/webhooks";
import { checkBlacklist } from "@/lib/blacklist";

/**
 * Cuando confirmed_blu y confirmed_pr quedan ambos en TRUE, agenda automáticamente
 * (mismo flujo que el botón "Agendar": Google Calendar + correo a PR e invitado).
 * Sólo se envía una vez por invitado (control en localStorage).
 */
export async function maybeSendConfirmationEmail(
  guest: Guest,
  changes: Partial<Pick<Guest, "confirmed_blu" | "confirmed_pr">>
) {
  const blu = changes.confirmed_blu ?? guest.confirmed_blu ?? false;
  const pr = changes.confirmed_pr ?? guest.confirmed_pr ?? false;

  if (!blu || !pr) return;
  if (wasSent("agendar", guest.id)) return;

  if (!guest.blacklist_override_by) {
    const matches = await checkBlacklist(guest.name).catch(() => []);
    if (matches.some((m) => m.match_type === "exact")) {
      toast.error(`${guest.name} está en la lista negra: no se agendó ni se envió confirmación.`);
      return;
    }
  }

  const shared = await isThirdHourShared(guest);
  const result = await postWebhook(WEBHOOK_URL_AGENDAR, buildCalendarPayload(guest, shared));

  if (result.ok) {
    markSent("agendar", guest.id);
    toast.success(`Cita agendada y notificada para ${guest.name}`);
  } else {
    toast.error(`No se pudo agendar automáticamente: ${result.message}`);
  }
}
