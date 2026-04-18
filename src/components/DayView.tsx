import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, User, Newspaper, Mail, MessageCircle, BookOpen } from "lucide-react";
import { CancionesSection, EncuestaSection, ContextoH2Section, AvanceSection } from "./LibretoSections";
import { Guest } from "@/types/guest";
import { Button } from "@/components/ui/button";
import { ContactLink } from "./ContactLink";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SocialNetworkLink } from "./SocialNetworkLink";
import { GuestInfoModules } from "./GuestInfoModules";
import { LibretoExport } from "./LibretoExport";
import { LibretoView } from "./LibretoView";
import { parse, addDays, format } from "date-fns";

interface DayViewProps {
  guests: Guest[];
  allGuests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number) => void;
  selectedDay: string;
  onDayChange: (day: string) => void;
  editMode: boolean;
  onGuestUpdate?: (updatedGuest: Partial<Guest> & { id?: string }) => void;
  selectedDayDate?: string;
  onRecordingGuestClick?: (guest: Guest) => void;
}

const DAYS = [
  { value: "monday", label: "Lunes", offset: 0 },
  { value: "tuesday", label: "Martes", offset: 1 },
  { value: "wednesday", label: "Miércoles", offset: 2 },
  { value: "thursday", label: "Jueves", offset: 3 },
];

const TIME_SLOTS = [
  { slot: 1, label: "1ra hora" },
  { slot: 2, label: "2da hora" },
  { slot: 3, label: "3ra hora" },
];

const statusConfig = {
  live: { label: "EN VIVO", className: "bg-green-500 text-white" },
  recorded: { label: "GRABADO", className: "bg-red-500 text-white" },
  to_record: { label: "A GRABAR", className: "bg-yellow-500 text-white" },
  postponed: { label: "APLAZADO", className: "bg-gray-500 text-white" },
  proposed: { label: "PROPUESTO", className: "bg-blue-500 text-white" },
};

const formatDateSpanish = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
};

const SLOT_HOURS: Record<number, string> = {
  1: '10:00 p.m.',
  2: '11:00 p.m.',
  3: '12:00 a.m.',
};

const buildGuestMessageLines = (guest: Guest, selectedDayDate?: string) => {
  const fechaEmision = formatDateSpanish(selectedDayDate);
  const horaEmision = SLOT_HOURS[guest.time_slot];
  const isRecording = guest.recording_status === 'to_record' || guest.recording_status === 'recorded';
  const fechaGrabacion = isRecording && guest.scheduled_date ? formatDateSpanish(guest.scheduled_date) : '';

  return [
    `Hola, qué tal ${guest.name},`,
    '',
    'Te confirmamos tu participación en Bla Bla Blu.',
    '',
    fechaEmision ? `📅 Fecha de emisión: ${fechaEmision}` : '',
    horaEmision ? `🕙 Hora: ${horaEmision}` : '',
    fechaGrabacion ? '' : '',
    fechaGrabacion
      ? `📹 Grabación: ${fechaGrabacion}${guest.scheduled_time ? ` a las ${guest.scheduled_time}` : ''}`
      : '',
    '',
    guest.topic ? `Tema: ${guest.topic}` : '',
    '',
    '¡Te esperamos!',
    'Equipo Bla Bla Blu',
  ].filter((line, idx, arr) => {
    // keep empty strings only if surrounded by content (avoid double blanks)
    if (line !== '') return true;
    return arr[idx - 1] !== '';
  });
};

const buildGuestMailto = (guest: Guest, selectedDayDate?: string) => {
  const subject = encodeURIComponent(`Confirmación de entrevista - ${guest.name}`);
  const body = buildGuestMessageLines(guest, selectedDayDate).join('\n');
  return `mailto:${guest.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
};

const buildGuestWhatsApp = (guest: Guest, selectedDayDate?: string) => {
  const clean = (guest.phone || '').replace(/\s|-|\(|\)/g, '');
  const text = encodeURIComponent(buildGuestMessageLines(guest, selectedDayDate).join('\n'));
  return `https://wa.me/${clean}?text=${text}`;
};

const buildPRMailto = (guest: Guest, selectedDayDate?: string) => {
  const subject = encodeURIComponent(`Confirmación de entrevista - ${guest.name}`);
  const fecha = formatDateSpanish(selectedDayDate);
  const cargo = guest.position ? ` (${guest.position})` : '';
  const lines = [
    `Estimado/a ${guest.press_contact || 'Contacto de Prensa'},`,
    '',
    `Le escribimos para confirmar la participación de ${guest.name}${cargo} en nuestro programa.`,
    '',
    guest.topic ? `Tema: ${guest.topic}` : '',
    fecha ? `Fecha: ${fecha}` : '',
    '',
    'Quedamos atentos a su confirmación.',
    '',
    'Saludos cordiales.',
  ].filter(Boolean);
  return `mailto:${guest.press_email}?subject=${subject}&body=${encodeURIComponent(lines.join('\n'))}`;
};

export const DayView = ({ guests, allGuests, onGuestClick, onAddGuest, selectedDay, onDayChange, editMode, onGuestUpdate, selectedDayDate, onRecordingGuestClick }: DayViewProps) => {
  const [showLibreto, setShowLibreto] = useState(false);

  const getGuestForSlot = (slot: number) => {
    return guests.find(g => g.day_of_week === selectedDay && g.time_slot === slot);
  };

  const currentDayLabel = DAYS.find(d => d.value === selectedDay)?.label || "Día";

  // Get recordings scheduled for this day
  const scheduledRecordings = selectedDayDate
    ? allGuests
        .filter(g =>
          g.scheduled_date === selectedDayDate &&
          (g.recording_status === "to_record" || g.recording_status === "postponed" || g.recording_status === "proposed")
        )
        .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
    : [];

  const handleCheckboxChange = async (guest: Guest, type: 'proposed' | 'blu' | 'pr', checked: boolean) => {
    if (!guest.id) return;
    
    try {
      let updateData: Partial<Guest> = {};
      
      if (type === 'proposed') {
        updateData.recording_status = checked ? 'proposed' : 'to_record';
      } else if (type === 'blu') {
        updateData.confirmed_blu = checked;
      } else if (type === 'pr') {
        updateData.confirmed_pr = checked;
      }
      
      const { error } = await supabase
        .from('guests')
        .update(updateData)
        .eq('id', guest.id);
      
      if (error) throw error;
      
      toast.success("Estado actualizado correctamente");
    } catch (error) {
      console.error('Error updating guest:', error);
      toast.error("Error al actualizar el estado");
    }
  };

  return (
    <div className="space-y-6">
      {/* Day Selector + Libreto Buttons */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2">
          {DAYS.map((day) => {
            let dayNumber = "";
            if (selectedDayDate) {
              const mondayDate = parse(selectedDayDate, "yyyy-MM-dd", new Date());
              const currentDayOffset = DAYS.find(d => d.value === selectedDay)?.offset || 0;
              const mondayBase = addDays(mondayDate, -currentDayOffset);
              const thisDayDate = addDays(mondayBase, day.offset);
              dayNumber = ` ${format(thisDayDate, 'd')}`;
            }
            return (
              <Button
                key={day.value}
                variant={selectedDay === day.value ? "default" : "outline"}
                onClick={() => onDayChange(day.value)}
                className="min-w-[100px]"
              >
                {day.label}{dayNumber}
              </Button>
            );
          })}
        </div>
        {["monday", "tuesday", "wednesday", "thursday"].includes(selectedDay) && (
          <div className="flex gap-2">
            <Button
              variant={showLibreto ? "default" : "outline"}
              size="sm"
              onClick={() => setShowLibreto(!showLibreto)}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {showLibreto ? "Ocultar Libreto" : "Ver Libreto"}
            </Button>
            <LibretoExport guests={guests} selectedDay={selectedDay} selectedDayDate={selectedDayDate} />
          </div>
        )}
      </div>

      {/* TITULARES */}
      <Card className="p-4 bg-muted/50 border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Titulares</h3>
        </div>
        <div className="space-y-2">
          {TIME_SLOTS.map(({ slot, label }) => {
            const guest = getGuestForSlot(slot);
            return (
              <div key={slot} className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-muted-foreground min-w-[70px]">{label}:</span>
                {guest ? (
                  <span className="text-foreground">
                    <span className="font-medium">{guest.name}</span>
                    {guest.position && <span className="text-muted-foreground"> ({guest.position})</span>}
                    {guest.topic && <span className="text-muted-foreground"> — {guest.topic}</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Sin invitado</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Libreto interactivo (Martes/Jueves) - toggled */}
      {showLibreto && ["monday", "tuesday", "wednesday", "thursday"].includes(selectedDay) && (
        <LibretoView
          guests={guests}
          selectedDay={selectedDay}
          selectedDayDate={selectedDayDate}
          editMode={editMode}
          onGuestUpdate={onGuestUpdate}
        />
      )}

      {/* Recording banner */}
      {scheduledRecordings.length > 0 && (
        <div className="space-y-2">
          {scheduledRecordings.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-all"
              onClick={() => onRecordingGuestClick?.(g)}
            >
              <span className="text-red-600 dark:text-red-400 font-bold text-sm">● REC</span>
              <span className="text-sm text-foreground font-medium">
                Grabación programada: {g.name}
                {g.scheduled_time && ` - ${g.scheduled_time}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Time Slots */}
      <div className="space-y-4">
        {TIME_SLOTS.map(({ slot, label }) => {
          const guest = getGuestForSlot(slot);

          return (
            <React.Fragment key={slot}>
            {/* Encuesta del día entre Hora 1 y Hora 2 */}
            {slot === 2 && (
              <EncuestaSection guest={getGuestForSlot(1)} selectedDay={selectedDay} editMode={editMode} />
            )}
            <Card
              key={slot}
              className={`p-6 transition-all ${
                editMode ? "hover:shadow-lg cursor-pointer" : "cursor-default"
              } ${
                guest ? "bg-card" : "border-dashed hover:border-primary"
              }`}
              onClick={() => !guest && editMode && onAddGuest(selectedDay, slot)}
            >
              {guest ? (
                <div className="space-y-4">
                  {/* Header with time and status */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-primary">{label}</h3>
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig[guest.recording_status].className}>
                        {statusConfig[guest.recording_status].label}
                      </Badge>
                      {editMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGuestClick(guest);
                          }}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Guest name and position */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Invitado</span>
                    </div>
                    <h4 className="text-xl font-bold text-foreground">
                      {guest.name}
                      {guest.position && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({guest.position})
                        </span>
                      )}
                    </h4>
                  </div>

                  {/* Topic */}
                  <div>
                    <span className="text-xs text-muted-foreground">Tema</span>
                    <p className="text-base text-foreground mt-1">{guest.topic}</p>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    {guest.phone && <ContactLink type="phone" value={guest.phone} />}
                    {guest.email && <ContactLink type="email" value={guest.email} />}
                    {guest.social_networks && Object.keys(guest.social_networks).length > 0 && (
                      <div className="flex items-start gap-2">
                        <Globe className="w-4 h-4 text-primary mt-1" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Redes Sociales</span>
                          <div className="text-sm space-y-1">
                            {Object.entries(guest.social_networks).map(([platform, value]) => (
                              <SocialNetworkLink 
                                key={platform} 
                                platform={platform} 
                                username={String(value)} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Módulos de información */}
                  {(slot === 1 || slot === 2 || slot === 3) && (
                    <GuestInfoModules
                      guest={guest}
                      editMode={editMode}
                      slot={slot}
                      onGuestUpdate={(updates) => {
                        onGuestUpdate?.({ ...updates, id: guest.id });
                      }}
                    />
                  )}

                  {/* Contexto H2 (Puerta al Universo / #TBT) */}
                  {slot === 2 && (
                    <ContextoH2Section guest={guest} selectedDay={selectedDay} editMode={editMode} />
                  )}

                  {/* Canciones / Clips */}
                  <CancionesSection guest={guest} slot={slot} selectedDay={selectedDay} editMode={editMode} />

                  {/* Avance siguiente hora */}
                  <AvanceSection guest={guest} slot={slot} selectedDay={selectedDay} editMode={editMode} />

                  {/* Additional Info - Prensa */}
                  {(guest.press_contact || guest.press_phone || guest.press_email || guest.program_type || guest.notes) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      {guest.press_contact && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Contacto de Prensa</span>
                          <span className="text-sm text-foreground">{guest.press_contact}</span>
                        </div>
                      )}
                      {guest.press_phone && (
                        <ContactLink type="phone" value={guest.press_phone} label="Tel. Prensa" />
                      )}
                      {guest.press_email && (
                        <ContactLink type="email" value={guest.press_email} label="Correo Prensa" />
                      )}
                      {guest.program_type && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Tipo de Programa</span>
                          <span className="text-sm text-foreground">{guest.program_type}</span>
                        </div>
                      )}
                      {guest.notes && (
                        <div className="md:col-span-2">
                          <span className="text-xs text-muted-foreground block">Notas</span>
                          <p className="text-sm text-foreground mt-1">{guest.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Checkboxes de confirmación */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground font-semibold">Estado de Confirmación</span>
                      {guest.proposed_by && (
                        <span className="text-xs text-muted-foreground" title={`Propuesto por: ${guest.proposed_by}`}>
                          · 📋 {guest.proposed_by}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`blu-${guest.id}`}
                          checked={guest.confirmed_blu || false}
                          onCheckedChange={(checked) => handleCheckboxChange(guest, 'blu', checked as boolean)}
                          disabled={!editMode}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label
                          htmlFor={`blu-${guest.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          CONFIRMADO BLU
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`pr-${guest.id}`}
                          checked={guest.confirmed_pr || false}
                          onCheckedChange={(checked) => handleCheckboxChange(guest, 'pr', checked as boolean)}
                          disabled={!editMode}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label
                          htmlFor={`pr-${guest.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          CONFIRMADO PR
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Botones de contacto */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Contactar Invitado */}
                      {(guest.email || guest.phone) && (
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground font-semibold">Contactar Invitado</span>
                          <div className="flex gap-2">
                            {guest.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = buildGuestMailto(guest, selectedDayDate);
                                }}
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Enviar Correo
                              </Button>
                            )}
                            {guest.phone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(buildGuestWhatsApp(guest, selectedDayDate), "_blank");
                                }}
                              >
                                <MessageCircle className="w-3 h-3 mr-1" />
                                Enviar WhatsApp
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Contactar PR */}
                      {(guest.press_contact || guest.press_phone || guest.press_email) && (
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground font-semibold">Contactar PR</span>
                          <div className="flex gap-2">
                            {guest.press_email && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = buildPRMailto(guest, selectedDayDate);
                                }}
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Correo PR
                              </Button>
                            )}
                            {guest.press_phone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const clean = guest.press_phone!.replace(/\s|-|\(|\)/g, "");
                                  window.open(`https://wa.me/${clean}`, "_blank");
                                }}
                              >
                                <MessageCircle className="w-3 h-3 mr-1" />
                                WhatsApp PR
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">{label}</p>
                  <p className="text-sm text-primary">+ Agregar Invitado</p>
                </div>
              )}
            </Card>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
