import { useState, useEffect } from "react";
import { format, parseISO, startOfWeek, getDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Guest } from "@/types/guest";
import { ContactLink } from "./ContactLink";
import { SocialNetworkLink, getSocialPlatformOptions } from "./SocialNetworkLink";
import { AutocompleteInput } from "./AutocompleteInput";
import { GuestDocuments } from "./GuestDocuments";
import { useGuestAutocomplete } from "@/hooks/useGuestAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import { WEBHOOK_URL_AGENDAR, buildCalendarPayload, markSent, postWebhook, wasSent } from "@/lib/webhooks";

interface GuestDetailModalProps {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (guest: Guest) => Promise<boolean>;
  onDelete?: (guestId: string) => void;
  readOnly?: boolean;
}

export const GuestDetailModal = ({ guest, isOpen, onClose, onSave, onDelete, readOnly = false }: GuestDetailModalProps) => {
  const [formData, setFormData] = useState<Guest>({
    name: "",
    position: "",
    topic: "",
    recording_status: "proposed",
    day_of_week: "monday",
    time_slot: 1,
    week_date: format(new Date(), "yyyy-MM-dd"),
    scheduled_date: null,
    scheduled_time: null,
  });

  const [socialNetworks, setSocialNetworks] = useState<{twitter: string, instagram: string}>({
    twitter: "",
    instagram: ""
  });
  const [customFields, setCustomFields] = useState<{[key: string]: string}>({});
  const [proposedHour, setProposedHour] = useState<string>("");
  const [emissionDate, setEmissionDate] = useState<string>("");
  const [agendarLoading, setAgendarLoading] = useState(false);
  const [agendado, setAgendado] = useState(false);

  useEffect(() => {
    setAgendado(wasSent("agendar", guest?.id));
  }, [guest?.id, isOpen]);

  const canAgendar =
    formData.recording_status === "live"
      ? Boolean(formData.week_date && formData.day_of_week && formData.time_slot)
      : Boolean(formData.scheduled_date && formData.scheduled_time);

  const handleAgendar = async () => {
    setAgendarLoading(true);
    const result = await postWebhook(WEBHOOK_URL_AGENDAR, buildCalendarPayload(formData));
    setAgendarLoading(false);

    if (result.ok) {
      markSent("agendar", guest?.id);
      setAgendado(true);
      toast.success("Evento creado en Google Calendar");
    } else {
      toast.error(result.message || "No se pudo agendar el evento");
    }
  };



  const {
    guestSuggestions,
    pressSuggestions,
    showGuestSuggestions,
    showPressSuggestions,
    searchGuests,
    searchPress,
    dismissGuestSuggestions,
    dismissPressSuggestions,
  } = useGuestAutocomplete();

  useEffect(() => {
    if (guest) {
      setFormData(guest);
      
      // Cargar redes sociales
      if (guest.social_networks && typeof guest.social_networks === 'object') {
        const { twitter = "", instagram = "", ...rest } = guest.social_networks as any;
        setSocialNetworks({ twitter, instagram });
        setCustomFields(rest);
      } else {
        setSocialNetworks({ twitter: "", instagram: "" });
        setCustomFields({});
      }
    } else {
      // Reset cuando no hay guest (nuevo invitado)
      setFormData({
        name: "",
        position: "",
        topic: "",
        recording_status: "proposed",
        day_of_week: "monday",
        time_slot: 1,
        week_date: format(new Date(), "yyyy-MM-dd"),
        scheduled_date: null,
        scheduled_time: null,
      });
      setSocialNetworks({ twitter: "", instagram: "" });
      setCustomFields({});
    }
    setProposedHour(guest?.time_slot ? String(guest.time_slot) : "");
    // Reconstruir la fecha de emisión a partir de week_date + day_of_week
    if (guest?.week_date && guest?.day_of_week) {
      const offsets: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };
      const offset = offsets[guest.day_of_week];
      if (offset !== undefined) {
        const base = parseISO(guest.week_date);
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
        setEmissionDate(format(d, "yyyy-MM-dd"));
      } else {
        setEmissionDate("");
      }
    } else {
      setEmissionDate("");
    }
  }, [guest]);



  const handleAssignProposed = async () => {
    const targetDate = emissionDate || formData.scheduled_date;
    if (!targetDate) {
      toast.error("Selecciona la fecha de emisión (o la de grabación)");
      return;
    }
    if (!proposedHour) {
      toast.error("Selecciona la hora (1ra, 2da o 3ra)");
      return;
    }
    const date = parseISO(targetDate);
    const dayIdx = getDay(date); // 0=Sun..6=Sat
    const dayMap: Record<number, string> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
    };
    const dayName = dayMap[dayIdx];
    if (!dayName) {
      toast.error("La fecha de emisión debe caer entre lunes y jueves");
      return;
    }
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekDate = format(weekStart, "yyyy-MM-dd");

    // Verificar que el slot de emisión no esté ocupado
    let q = supabase
      .from("guests")
      .select("id, name, time_slot, slot_order")
      .eq("week_date", weekDate)
      .eq("day_of_week", dayName);
    if (formData.id) q = q.neq("id", formData.id);
    const { data: dayGuests, error } = await q;
    if (error) {
      toast.error("No se pudo verificar la disponibilidad del slot");
      return;
    }
    const slotOrder = formData.slot_order ?? 1;
    const occupant = (dayGuests || []).find(
      (g) => g.time_slot === Number(proposedHour) && (g.slot_order ?? 1) === slotOrder
    );
    if (occupant) {
      const taken = new Set((dayGuests || []).filter((g) => (g.slot_order ?? 1) === 1).map((g) => g.time_slot));
      const free = [1, 2, 3].filter((h) => !taken.has(h));
      const hourLabels: Record<number, string> = { 1: "1ra", 2: "2da", 3: "3ra" };
      const freeMsg = free.length
        ? ` Horas libres: ${free.map((h) => hourLabels[h]).join(", ")}.`
        : " No hay horas libres ese día (puedes usar co-invitado en 3ra hora).";
      toast.error(`${hourLabels[Number(proposedHour)]} hora ya está ocupada por ${occupant.name}.${freeMsg}`);
      return;
    }

    setFormData({
      ...formData,
      week_date: weekDate,
      day_of_week: dayName,
      time_slot: Number(proposedHour),
    });
    setEmissionDate(targetDate);
    const hourLabel = proposedHour === "1" ? "1ra" : proposedHour === "2" ? "2da" : "3ra";
    toast.success(`Slot asignado: ${dayName} · ${hourLabel} hora. Pulsa Guardar para confirmar.`);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.topic.trim()) {
      toast.error("Nombre y tema son requeridos");
      return;
    }

    // Solo los estados distintos de PROPUESTO exigen slot de emisión
    if (formData.recording_status !== "proposed") {
      if (!formData.week_date || !formData.day_of_week || formData.time_slot == null) {
        toast.error("Para este estado debes asignar el slot de emisión (día y hora)");
        return;
      }
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("El correo del invitado no es válido");
      return;
    }


    // Combinar todas las redes sociales
    const allSocialNetworks = {
      ...socialNetworks,
      ...customFields
    };

    // Eliminar campos vacíos
    const cleanedSocialNetworks = Object.fromEntries(
      Object.entries(allSocialNetworks).filter(([_, value]) => value.trim() !== "")
    );

    // Auto-set proposed_by for new guests
    let finalData: Guest = {
      ...formData,
      social_networks: Object.keys(cleanedSocialNetworks).length > 0 ? cleanedSocialNetworks : null,
    };

    // Un propuesto sin fecha de emisión se guarda sin slot (queda solo en la bandeja)
    if (formData.recording_status === "proposed" && !emissionDate) {
      finalData = { ...finalData, week_date: null, day_of_week: null, time_slot: null };
    }


    if (!formData.id && !formData.proposed_by) {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        finalData.proposed_by = user.email || user.id;
      }
    }

    const success = await onSave(finalData);
    if (success) onClose();
  };

  const handleDelete = () => {
    if (guest?.id && onDelete) {
      onDelete(guest.id);
    }
  };

  // Get available platforms for the dropdown (exclude already used ones)
  const getAvailablePlatforms = () => {
    const allPlatforms = getSocialPlatformOptions();
    return allPlatforms.filter(p => !customFields.hasOwnProperty(p.value));
  };

  const handleAddSocialNetwork = (platform: string) => {
    setCustomFields({...customFields, [platform]: ""});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Ver Invitado" : (guest?.id ? "Editar Invitado" : "Nuevo Invitado")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              {readOnly ? (
                <Input
                  id="name"
                  value={formData.name}
                  disabled
                />
              ) : (
                <AutocompleteInput
                  id="name"
                  value={formData.name}
                  onChange={(val) => {
                    setFormData({ ...formData, name: val });
                    searchGuests(val);
                  }}
                  suggestions={guestSuggestions.map((g) => ({
                    label: g.name,
                    sublabel: g.position || undefined,
                  }))}
                  showSuggestions={showGuestSuggestions}
                  onDismiss={dismissGuestSuggestions}
                  onSelect={(i) => {
                    const g = guestSuggestions[i];
                    setFormData((prev) => ({
                      ...prev,
                      name: g.name,
                      position: prev.position || g.position || "",
                      phone: prev.phone || g.phone || "",
                    }));
                    // Apply social networks if empty
                    if (g.social_networks && typeof g.social_networks === "object") {
                      const { twitter = "", instagram = "", ...rest } = g.social_networks as any;
                      setSocialNetworks((prev) => ({
                        twitter: prev.twitter || twitter,
                        instagram: prev.instagram || instagram,
                      }));
                      setCustomFields((prev) => {
                        const merged = { ...prev };
                        for (const [k, v] of Object.entries(rest)) {
                          if (!merged[k]) merged[k] = v as string;
                        }
                        return merged;
                      });
                    }
                    dismissGuestSuggestions();
                  }}
                  placeholder="Nombre del invitado"
                  required
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Cargo / Profesión</Label>
              <Input
                id="position"
                value={formData.position || ""}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Ej: CEO, Periodista, Abogado"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recording_status">Estado *</Label>
              <Select
                value={formData.recording_status}
                onValueChange={(value: any) => {
                  // No se borra la fecha/hora de grabación al cambiar de estado:
                  // queda como registro de cuándo se grabó o se propuso grabar.
                  setFormData({ ...formData, recording_status: value });
                }}

                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">EN VIVO</SelectItem>
                  <SelectItem value="recorded">GRABADO</SelectItem>
                  <SelectItem value="to_record">A GRABAR</SelectItem>
                  <SelectItem value="postponed">APLAZADO</SelectItem>
                  <SelectItem value="proposed">PROPUESTO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono del Invitado</Label>
              {readOnly && formData.phone ? (
                <ContactLink type="phone" value={formData.phone} />
              ) : (
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+56 9 1234 5678"
                  disabled={readOnly}
                />
              )}
            </div>
          </div>

          {/* Bloque 1: fecha y hora de GRABACIÓN */}
          {["to_record", "proposed", "postponed"].includes(formData.recording_status) && (
          <div className="rounded-md border p-3 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Fecha y hora de grabación
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">
                  {formData.recording_status === "postponed" ? "Fecha de aplazamiento" : "Fecha de grabación"}
                </Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date || ""}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  disabled={readOnly}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled_time">Hora de grabación</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  value={formData.scheduled_time || ""}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  disabled={readOnly}
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cuándo se graba el invitado (opcional). No cambia el slot de emisión.
            </p>
          </div>
          )}


          {/* Bloque 2: slot de EMISIÓN */}
          <div className="rounded-md border p-3 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Slot de emisión
            </Label>
            <p className="text-xs text-muted-foreground">
              {formData.week_date && formData.day_of_week && formData.time_slot
                ? `Actual: ${formData.day_of_week} · ${formData.time_slot}ª hora (semana del ${formData.week_date})`
                : "Sin slot de emisión asignado"}
            </p>
            {!readOnly && (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="emission_date">Fecha de emisión</Label>
                    <Input
                      id="emission_date"
                      type="date"
                      value={emissionDate}
                      onChange={(e) => setEmissionDate(e.target.value)}
                      disabled={readOnly}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposed_hour">Hora de emisión</Label>
                    <Select value={proposedHour} onValueChange={setProposedHour} disabled={readOnly}>
                      <SelectTrigger id="proposed_hour">
                        <SelectValue placeholder="Selecciona hora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1ra hora</SelectItem>
                        <SelectItem value="2">2da hora</SelectItem>
                        <SelectItem value="3">3ra hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAssignProposed}
                    disabled={readOnly || (!emissionDate && !formData.scheduled_date) || !proposedHour}
                  >
                    ASIGNAR
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cuándo sale al aire (lunes a jueves). Si la dejas vacía, ASIGNAR usa la fecha de grabación.
                  Un invitado PROPUESTO puede guardarse sin fecha de emisión ni de grabación.
                </p>
              </>
            )}
          </div>





          <div className="space-y-2">
            <Label htmlFor="topic">Tema a Tratar *</Label>
            <Textarea
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="Descripción del tema"
              rows={3}
              required
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest_email">Correo del Invitado</Label>
            {readOnly && formData.email ? (
              <ContactLink type="email" value={formData.email} />
            ) : (
              <Input
                id="guest_email"
                type="email"
                maxLength={255}
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                placeholder="invitado@correo.com"
                disabled={readOnly}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Recibirá la invitación del calendario y la confirmación al agendar.
            </p>
          </div>

          {/* Nueva sección de redes sociales */}
          <div className="space-y-4">
            <Label>Redes Sociales</Label>
            
            {/* Twitter/X */}
            <div className="flex items-center gap-2">
              <Label htmlFor="twitter" className="w-24 text-right">Twitter/X</Label>
              {readOnly && socialNetworks.twitter ? (
                <SocialNetworkLink platform="twitter" username={socialNetworks.twitter} />
              ) : (
                <Input
                  id="twitter"
                  value={socialNetworks.twitter}
                  onChange={(e) => setSocialNetworks({...socialNetworks, twitter: e.target.value})}
                  placeholder="@usuario"
                  disabled={readOnly}
                />
              )}
            </div>

            {/* Instagram */}
            <div className="flex items-center gap-2">
              <Label htmlFor="instagram" className="w-24 text-right">Instagram</Label>
              {readOnly && socialNetworks.instagram ? (
                <SocialNetworkLink platform="instagram" username={socialNetworks.instagram} />
              ) : (
                <Input
                  id="instagram"
                  value={socialNetworks.instagram}
                  onChange={(e) => setSocialNetworks({...socialNetworks, instagram: e.target.value})}
                  placeholder="@usuario"
                  disabled={readOnly}
                />
              )}
            </div>

            {/* Campos personalizados (Facebook, YouTube, LinkedIn, Pinterest) */}
            {Object.entries(customFields).map(([platform, value]) => (
              <div key={platform} className="flex items-center gap-2">
                <Label className="w-24 text-right capitalize">{platform}</Label>
                {readOnly && value ? (
                  <SocialNetworkLink platform={platform} username={value} />
                ) : (
                  <>
                    <Input
                      value={value}
                      onChange={(e) => setCustomFields({...customFields, [platform]: e.target.value})}
                      placeholder={`@usuario de ${platform}`}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newFields = {...customFields};
                          delete newFields[platform];
                          setCustomFields(newFields);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Menú desplegable para agregar red social */}
            {!readOnly && getAvailablePlatforms().length > 0 && (
              <Select onValueChange={handleAddSocialNetwork}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="+ Agregar red social..." />
                </SelectTrigger>
                <SelectContent>
                  {getAvailablePlatforms().map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="press_contact">Contacto de Prensa</Label>
            {readOnly ? (
              <Input
                id="press_contact"
                value={formData.press_contact || ""}
                disabled
              />
            ) : (
              <AutocompleteInput
                id="press_contact"
                value={formData.press_contact || ""}
                onChange={(val) => {
                  setFormData({ ...formData, press_contact: val });
                  searchPress(val);
                }}
                suggestions={pressSuggestions.map((p) => ({
                  label: p.press_contact,
                  sublabel: p.press_email || p.press_phone || undefined,
                }))}
                showSuggestions={showPressSuggestions}
                onDismiss={dismissPressSuggestions}
                onSelect={(i) => {
                  const p = pressSuggestions[i];
                  setFormData((prev) => ({
                    ...prev,
                    press_contact: p.press_contact,
                    press_phone: prev.press_phone || p.press_phone || "",
                    press_email: prev.press_email || p.press_email || "",
                  }));
                  dismissPressSuggestions();
                }}
                placeholder="Nombre del contacto"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="press_phone">Teléfono de Prensa</Label>
              {readOnly && formData.press_phone ? (
                <ContactLink type="phone" value={formData.press_phone} />
              ) : (
                <Input
                  id="press_phone"
                  type="tel"
                  value={formData.press_phone || ""}
                  onChange={(e) => setFormData({ ...formData, press_phone: e.target.value })}
                  placeholder="+57 1 234 5678"
                  disabled={readOnly}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="press_email">Correo de Prensa</Label>
              {readOnly && formData.press_email ? (
                <ContactLink type="email" value={formData.press_email} />
              ) : (
                <Input
                  id="press_email"
                  type="email"
                  value={formData.press_email || ""}
                  onChange={(e) => setFormData({ ...formData, press_email: e.target.value })}
                  placeholder="prensa@ejemplo.com"
                  disabled={readOnly}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional relevante"
              rows={3}
              disabled={readOnly}
            />
          </div>

          <div className="border-t pt-4">
            <GuestDocuments
              guestId={guest?.id}
              defaultHour={formData.time_slot || 1}
              readOnly={readOnly}
            />
          </div>

          {guest?.id && !readOnly && canAgendar && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleAgendar}
                disabled={agendarLoading || agendado}
                className="w-full"
              >
                {agendarLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Agendando...
                  </>
                ) : agendado ? (
                  "✅ Agendado"
                ) : (
                  "📅 Agendar"
                )}
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!readOnly && guest?.id && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="mr-auto">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar invitado?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. El invitado será eliminado permanentemente de la base de datos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {readOnly ? "Cerrar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit" className="bg-primary hover:bg-primary-glow">
                Guardar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
