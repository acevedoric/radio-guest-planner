import { toast } from "sonner";
import { Guest } from "@/types/guest";
import { WEBHOOK_URL_CONFIRMACION, buildGuestPayload, markSent, postWebhook, wasSent } from "@/lib/webhooks";

/**
 * Dispara el correo al PR cuando confirmed_blu y confirmed_pr quedan ambos en TRUE.
 * Sólo se envía una vez por invitado (control en localStorage).
 */
export async function maybeSendConfirmationEmail(
  guest: Guest,
  changes: Partial<Pick<Guest, "confirmed_blu" | "confirmed_pr">>
) {
  const blu = changes.confirmed_blu ?? guest.confirmed_blu ?? false;
  const pr = changes.confirmed_pr ?? guest.confirmed_pr ?? false;

  if (!blu || !pr) return;
  if (wasSent("confirmacion", guest.id)) return;

  if (!guest.press_email) {
    toast.warning("No hay email del PR registrado — correo no enviado.");
    return;
  }

  const result = await postWebhook(WEBHOOK_URL_CONFIRMACION, buildGuestPayload(guest));

  if (result.ok) {
    markSent("confirmacion", guest.id);
    toast.success(`Correo de confirmación enviado a ${guest.press_contact || guest.press_email}`);
  } else {
    toast.error(`No se pudo enviar el correo de confirmación: ${result.message}`);
  }
}
