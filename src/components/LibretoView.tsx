import React, { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertTriangle, Printer } from "lucide-react";
import { Guest } from "@/types/guest";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LibretoViewProps {
  guests: Guest[];
  selectedDay: string;
  selectedDayDate?: string;
  editMode: boolean;
  onGuestUpdate?: (updatedGuest: Partial<Guest> & { id?: string }) => void;
}

const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

const DAYS_ES: Record<string, string> = {
  monday: "LUNES",
  tuesday: "MARTES",
  wednesday: "MIÉRCOLES",
  thursday: "JUEVES",
};

// ── Inline editable field ──────────────────────────────────────────
interface InlineFieldProps {
  guestId?: string;
  field: keyof Guest;
  value: string | null | undefined;
  label: string;
  editMode: boolean;
  multiline?: boolean;
  onSaved?: (field: string, value: string) => void;
}

const InlineField = ({ guestId, field, value, label, editMode, multiline = false, onSaved }: InlineFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const isPending = !value?.trim();

  const handleSave = useCallback(async () => {
    setEditing(false);
    if (!guestId || localValue === (value || "")) return;
    try {
      const { error } = await supabase
        .from("guests")
        .update({ [field]: localValue || null } as any)
        .eq("id", guestId);
      if (error) throw error;
      onSaved?.(field as string, localValue);
    } catch (err) {
      console.error("Error saving:", err);
      toast.error("Error al guardar");
    }
  }, [guestId, field, localValue, value, onSaved]);

  if (editing && editMode && guestId) {
    const Component = multiline ? Textarea : Input;
    return (
      <Component
        autoFocus
        value={localValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Escape") { setLocalValue(value || ""); setEditing(false); } }}
        className={`text-base ${multiline ? "min-h-[80px]" : ""} print:hidden`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
    );
  }

  if (isPending) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium bg-amber-200/80 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200 ${editMode ? "cursor-pointer hover:bg-amber-300/80 dark:hover:bg-amber-500/50" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (editMode && guestId) { setLocalValue(""); setEditing(true); }
        }}
        title={editMode ? `Clic para completar: ${label}` : `Pendiente: ${label}`}
      >
        <AlertTriangle className="w-3 h-3" />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`text-foreground whitespace-pre-wrap ${editMode ? "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (editMode && guestId) { setLocalValue(value || ""); setEditing(true); }
      }}
    >
      {value}
    </span>
  );
};

// ── Social helper ──────────────────────────────────────────────────
const getSocial = (guest: Guest | undefined, platform: string): string | null => {
  if (!guest?.social_networks) return null;
  const sn = guest.social_networks as Record<string, string>;
  return sn[platform] || sn[platform.toLowerCase()] || null;
};

// ── Section wrapper ────────────────────────────────────────────────
const HourSection = ({ title, defaultOpen = false, open: openProp, onOpenChange, children }: { title: string; defaultOpen?: boolean; open?: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 px-4 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors print:bg-transparent">
        {open ? <ChevronDown className="w-5 h-5 text-primary print:hidden" /> : <ChevronRight className="w-5 h-5 text-primary print:hidden" />}
        <h2 className="text-lg font-bold text-primary uppercase tracking-wider">{title}</h2>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4 pb-2 px-2 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

// ── Line helpers ───────────────────────────────────────────────────
const Line = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-base leading-relaxed ${className}`}>{children}</p>
);

const Bold = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-bold">{children}</strong>
);

const Spacer = () => <div className="h-2" />;

// ── Main component ─────────────────────────────────────────────────
export const LibretoView: React.FC<LibretoViewProps> = ({ guests, selectedDay, selectedDayDate, editMode, onGuestUpdate }) => {
  const [h1Open, setH1Open] = useState(false);
  const [h2Open, setH2Open] = useState(false);
  const [h3Open, setH3Open] = useState(false);
  const validDays = ["monday", "tuesday", "wednesday", "thursday"];
  if (!validDays.includes(selectedDay)) return null;

  const h1 = guests.find(g => g.day_of_week === selectedDay && g.time_slot === 1);
  const h2 = guests.find(g => g.day_of_week === selectedDay && g.time_slot === 2);
  const h3 = guests.find(g => g.day_of_week === selectedDay && g.time_slot === 3);

  if (!h1 && !h2 && !h3) return null;

  const dateInfo = selectedDayDate
    ? (() => {
        const d = new Date(selectedDayDate + "T12:00:00");
        return { dia: String(d.getDate()), mes: MONTHS_ES[d.getMonth()], anio: String(d.getFullYear()) };
      })()
    : { dia: "[DIA]", mes: "[MES]", anio: "[AÑO]" };

  const dayLabel = DAYS_ES[selectedDay];

  const handleFieldSaved = (guestId: string | undefined) => (field: string, value: string) => {
    if (guestId) {
      onGuestUpdate?.({ id: guestId, [field]: value });
    }
  };

  const F = (guest: Guest | undefined, field: keyof Guest, label: string, multiline = false) => (
    <InlineField
      guestId={guest?.id}
      field={field}
      value={guest?.[field] as string}
      label={label}
      editMode={editMode}
      multiline={multiline}
      onSaved={handleFieldSaved(guest?.id)}
    />
  );

  const handlePrint = () => {
    setH1Open(true);
    setH2Open(true);
    setH3Open(true);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const isTuesday = selectedDay === "tuesday";
  const isThursday = selectedDay === "thursday";
  const isMonOrWed = selectedDay === "monday" || selectedDay === "wednesday";

  return (
    <Card className="libreto-view p-6 bg-amber-50/30 dark:bg-amber-950/10 border-primary/20 space-y-6 text-base">
      {/* Header */}
      <div className="flex items-center justify-between print:justify-center">
        <h1 className="text-xl font-bold text-primary">
          {dayLabel} {dateInfo.dia} DE {dateInfo.mes} DE {dateInfo.anio}
        </h1>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 print:hidden">
          <Printer className="w-4 h-4" />
          Imprimir Libreto
        </Button>
      </div>

      {/* ═══ PRIMERA HORA ═══ */}
      <HourSection title="1. Primera Hora, en vivo" open={h1Open} onOpenChange={setH1Open}>
        <Line>
          <Bold>Programa con: </Bold>
          {F(h1, "name", "INVITADO")} – {F(h1, "position", "Cargo")}
        </Line>
        <Line>En la casa: Mauricio Quintero.</Line>
        <Spacer />

        <Line>TW: <Bold>{getSocial(h1, "twitter") || <InlineField guestId={h1?.id} field="social_networks" value={null} label="twitter" editMode={false} />}</Bold></Line>
        <Line>IG: <Bold>{getSocial(h1, "instagram") || <InlineField guestId={h1?.id} field="social_networks" value={null} label="instagram" editMode={false} />}</Bold></Line>
        <Spacer />

        <Line><Bold>CONTENIDO: </Bold>Recorrido por sus inicios, su infancia, sus logros y sus futuros proyectos.</Line>
        <Spacer />

        {/* Segments */}
        <Line>{(isTuesday || isMonOrWed) ? "1. Canción." : "1. Clip 1 COMEDIANTE"} {h1?.h1_canciones && <span className="text-muted-foreground italic text-sm"> — {h1.h1_canciones}</span>}</Line>
        <Line>2. Primer segmento: <Bold>Bienvenida.</Bold></Line>
        <div className="pl-4 border-l-2 border-primary/20">
          {F(h1, "tema_principal", "TEMA PRINCIPAL", true)}
        </div>
        <Spacer />

        <Line><Bold>Infancia y vida personal</Bold></Line>
        <div className="pl-4 border-l-2 border-primary/20">
          {F(h1, "infancia_vida_privada", "INFANCIA Y VIDA PRIVADA", true)}
        </div>
        <Spacer />

        <Line>{isTuesday ? "4. Canción." : "3. Clip 2 COMEDIANTE"}</Line>
        <Spacer />

        <Line>{isTuesday ? "5" : "4"}. Segundo segmento: <Bold>Carrera</Bold></Line>
        <div className="pl-4 border-l-2 border-primary/20">
          {F(h1, "carrera_profesional", "CARRERA ARTÍSTICA O PROFESIONAL", true)}
        </div>
        <Spacer />

        {!isTuesday && <Line>5. Clip 3 COMEDIANTE</Line>}

        {/* Avance + Encuesta */}
        <Line>{isTuesday ? "6" : "6"}. Avance segunda hora. Pregunta para el invitado que nos recuerde el tema de la segunda hora. A propósito del tema de esta noche, cuéntenos:</Line>
        <div className="pl-4 border-l-2 border-amber-400/40 bg-amber-100/30 dark:bg-amber-900/10 p-2 rounded">
          {F(h1, "encuesta_pregunta", "PREGUNTA DE LA ENCUESTA")}
          <Line className="text-sm">Sí / No</Line>
          <Line className="text-sm"><Bold>HT: </Bold>Sus opiniones con el: {F(h1, "encuesta_hashtag", isTuesday ? "#PuertaAlUniversoBlaBlaBLU" : "#tbtBlaBlaBLU")}</Line>
        </div>
        <Spacer />

        <Line>{isTuesday ? "7. Canción." : ""}</Line>

        <Line>{isTuesday ? "8" : "7"}. Tercer segmento: <Bold>Datos curiosos</Bold></Line>
        <div className="pl-4 border-l-2 border-primary/20">
          {F(h1, "datos_curiosos", "DATOS CURIOSOS", true)}
        </div>
        <Spacer />

        {!isTuesday && <Line>8. Clip 4 COMEDIANTE</Line>}
        <Line>{isTuesday ? "9" : "9"}. {isTuesday ? "Cuarto" : "Tercer"} segmento: <Bold>Proyectos 2026 y despedida.</Bold></Line>
        {isTuesday && <Line>10. Canción.</Line>}

        {h1?.h1_canciones && (
          <>
            <Spacer />
            <Line><Bold>{isTuesday ? "Canciones en stock:" : "Clips de comediante:"}</Bold></Line>
            <div className="pl-4 border-l-2 border-primary/20">
              {F(h1, "h1_canciones", isTuesday ? "CANCIONES" : "CLIPS", true)}
            </div>
          </>
        )}

        {/* Avance H2 */}
        {h1?.avance_h2 && (
          <>
            <Spacer />
            <Line><Bold>Avance 2da hora:</Bold></Line>
            <div className="pl-4">{F(h1, "avance_h2", "AVANCE H2", true)}</div>
          </>
        )}
      </HourSection>

      {/* ═══ SEGUNDA HORA ═══ */}
      <HourSection title={`2. Segunda Hora, en vivo${isTuesday ? " — Puerta al Universo" : isThursday ? " — #TBT" : ""}`} open={h2Open} onOpenChange={setH2Open}>
        <Line>En la casa: <Bold>Mauricio Quintero.</Bold></Line>
        <Line><Bold>Tema: </Bold>{isThursday ? "#tbt" : F(h2, "topic", "TEMA SEGUNDA HORA")}</Line>
        <Spacer />

        {isTuesday && (
          <>
            <Line>Todas las noches de los martes, de aquí hasta que el tiempo y el espacio nos lo permitan, se abre una nueva puerta en Bla, Bla, BLU.</Line>
            <Spacer />
            <Line>Invitamos a todos los navegantes de Bla, Bla, BLU para que pasen a bordo, se abrochen sus cinturones porque vamos a iniciar un hermoso viaje hacia el espacio.</Line>
            <Spacer />
            <Line>En BBB tenemos el placer de presentarles: Puerta al universo con nuestro astrónomo Germán Puerta.</Line>
          </>
        )}
        {isThursday && (
          <>
            <Line><Bold>Contexto: </Bold>{F(h2, "h2_contexto", "CONTEXTO #TBT", true)}</Line>
            <Spacer />
            <Line>Jueves de TBT, jueves para recordar, hablaremos sobre {F(h2, "topic", "TEMA SEGUNDA HORA")}</Line>
          </>
        )}
        {isMonOrWed && (
          <>
            <Line><Bold>Contexto: </Bold>{F(h2, "h2_contexto", "CONTEXTO SEGUNDA HORA", true)}</Line>
          </>
        )}
        <Spacer />

        <Line><Bold>Invitado: </Bold>{F(h2, "name", "INVITADO SEGUNDA HORA")}{h2?.position ? ` – ${h2.position}` : ""}</Line>

        {h2?.h2_info_personal && (
          <div className="pl-4 border-l-2 border-primary/20">
            {F(h2, "h2_info_personal", "INFO PERSONAL H2", true)}
          </div>
        )}
        <Spacer />

        <Line>X: {getSocial(h2, "twitter") || "—"}</Line>
        <Line>IG: {getSocial(h2, "instagram") || "—"}</Line>
        <Spacer />

        <Line><Bold>Responsable: </Bold>Mauricio Quintero</Line>
        <Spacer />

        {/* Repeat encuesta */}
        <div className="pl-4 border-l-2 border-amber-400/40 bg-amber-100/30 dark:bg-amber-900/10 p-2 rounded">
          {F(h1, "encuesta_pregunta", "PREGUNTA DE LA ENCUESTA")}
          <Line className="text-sm">Sí / No</Line>
          <Line className="text-sm"><Bold>HT: </Bold>Sus opiniones con el: {h1?.encuesta_hashtag || (isTuesday ? "#PuertaAlUniversoBlaBlaBLU" : "#tbtBlaBlaBLU")}</Line>
        </div>
        <Spacer />

        {h2?.h2_preguntas_sugeridas && (
          <>
            <Line><Bold>PREGUNTAS SUGERIDAS SEGÚN EL TEMA A TRATAR</Bold></Line>
            <div className="pl-4 border-l-2 border-primary/20">
              {F(h2, "h2_preguntas_sugeridas", "PREGUNTAS SUGERIDAS", true)}
            </div>
            <Spacer />
          </>
        )}

        {/* Segments */}
        {isTuesday ? (
          <>
            <Line>1. Cortinilla Una puerta al universo</Line>
            <Line>2. Avance de lo que hablaremos en esta segunda hora</Line>
            <Line>3. Primer segmento. {F(h2, "topic", "TEMA")}</Line>
          </>
        ) : (
          <>
            {["1. Canción.", "2. Avance", "3. Primer segmento.", "4. Canción.", "5. Segundo segmento.", "6. Canción.", "7. Tercer segmento.", "8. Canción.", "9. Cuarto segmento.", "10. Canción."].map((s, i) => (
              <Line key={i}>{s}</Line>
            ))}
          </>
        )}
        <Spacer />

        {/* Avance tercera hora */}
        <div className="bg-muted/30 p-3 rounded-lg">
          <Line>
            <Bold>Mauricio</Bold> – Vamos a tener una actualización de las noticias más importantes de Colombia y el mundo en Voces y sonidos, y al regreso,{" "}
            {h3 ? (
              <>les tengo a {F(h3, "name", "INVITADO TERCERA HORA")} quien nos estará hablando de {F(h3, "topic", "TEMA TERCERA HORA")}</>
            ) : (
              <InlineField guestId={undefined} field="name" value={null} label="INVITADO TERCERA HORA" editMode={false} />
            )}
            , en minutos, aquí, en BBB.
          </Line>
        </div>
        <Spacer />

        {h2?.h2_canciones && (
          <>
            <Line><Bold>Canciones en stock:</Bold></Line>
            <div className="pl-4 border-l-2 border-primary/20">
              {F(h2, "h2_canciones", "CANCIONES H2", true)}
            </div>
          </>
        )}

        {h2?.avance_h3 && (
          <>
            <Spacer />
            <Line><Bold>Avance 3ra hora:</Bold></Line>
            <div className="pl-4">{F(h2, "avance_h3", "AVANCE H3", true)}</div>
          </>
        )}
      </HourSection>

      {/* ═══ TERCERA HORA ═══ */}
      <HourSection title="3. Tercera Hora" open={h3Open} onOpenChange={setH3Open}>
        <Line>En la casa: <Bold>Mauricio Quintero.</Bold></Line>
        <Spacer />
        <Line>1. Canción.</Line>
        <Spacer />

        <Line><Bold>Invitado: </Bold>{F(h3, "name", "INVITADO TERCERA HORA")}</Line>
        <Line><Bold>Tema: </Bold>{F(h3, "topic", "TEMA TERCERA HORA")}</Line>
        <Spacer />

        {(h3?.h3_datos_personales || editMode) && (
          <>
            <Line><Bold>Información del invitado:</Bold></Line>
            <div className="pl-4 border-l-2 border-primary/20">
              {F(h3, "h3_datos_personales", "DATOS PERSONALES", true)}
            </div>
            <Spacer />
          </>
        )}

        {(h3?.h3_comunicado_prensa || editMode) && (
          <>
            <Line><Bold>Comunicado de prensa:</Bold></Line>
            <div className="pl-4 border-l-2 border-primary/20">
              {F(h3, "h3_comunicado_prensa", "COMUNICADO DE PRENSA", true)}
            </div>
            <Spacer />
          </>
        )}

        {h3?.h3_canciones && (
          <>
            <Line><Bold>Canciones en stock:</Bold></Line>
            <div className="pl-4 border-l-2 border-primary/20">
              {F(h3, "h3_canciones", "CANCIONES H3", true)}
            </div>
          </>
        )}
      </HourSection>
    </Card>
  );
};
