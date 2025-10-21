import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Globe, User } from "lucide-react";
import { Guest } from "@/types/guest";
import { Button } from "@/components/ui/button";

interface DayViewProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number) => void;
  selectedDay: string;
  onDayChange: (day: string) => void;
}

const DAYS = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
];

const TIME_SLOTS = [
  { slot: 1, label: "1ra hora" },
  { slot: 2, label: "2da hora" },
  { slot: 3, label: "3ra hora" },
];

const statusConfig = {
  live: { label: "En Vivo", className: "bg-status-live text-white" },
  recorded: { label: "Grabado", className: "bg-status-recorded text-white" },
  no_recording: { label: "Sin Grabación", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", className: "bg-status-cancelled text-white" },
};

export const DayView = ({ guests, onGuestClick, onAddGuest, selectedDay, onDayChange }: DayViewProps) => {
  const getGuestForSlot = (slot: number) => {
    return guests.find(g => g.day_of_week === selectedDay && g.time_slot === slot);
  };

  const currentDayLabel = DAYS.find(d => d.value === selectedDay)?.label || "Día";

  return (
    <div className="space-y-6">
      {/* Day Selector */}
      <div className="flex gap-2 justify-center">
        {DAYS.map((day) => (
          <Button
            key={day.value}
            variant={selectedDay === day.value ? "default" : "outline"}
            onClick={() => onDayChange(day.value)}
            className="min-w-[100px]"
          >
            {day.label}
          </Button>
        ))}
      </div>

      {/* Day Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{currentDayLabel}</h2>
      </div>

      {/* Time Slots */}
      <div className="space-y-4">
        {TIME_SLOTS.map(({ slot, label }) => {
          const guest = getGuestForSlot(slot);

          return (
            <Card
              key={slot}
              className={`p-6 transition-all hover:shadow-lg ${
                guest ? "cursor-pointer bg-card" : "border-dashed cursor-pointer hover:border-primary"
              }`}
              onClick={() => guest ? onGuestClick(guest) : onAddGuest(selectedDay, slot)}
            >
              {guest ? (
                <div className="space-y-4">
                  {/* Header with time and status */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-primary">{label}</h3>
                    <Badge className={statusConfig[guest.recording_status].className}>
                      {statusConfig[guest.recording_status].label}
                    </Badge>
                  </div>

                  {/* Guest name */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Invitado</span>
                    </div>
                    <h4 className="text-xl font-bold text-foreground">{guest.name}</h4>
                  </div>

                  {/* Topic */}
                  <div>
                    <span className="text-xs text-muted-foreground">Tema</span>
                    <p className="text-base text-foreground mt-1">{guest.topic}</p>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    {guest.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-primary mt-1" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Teléfono</span>
                          <span className="text-sm text-foreground">{guest.phone}</span>
                        </div>
                      </div>
                    )}
                    {guest.email && (
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-primary mt-1" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Email</span>
                          <span className="text-sm text-foreground break-all">{guest.email}</span>
                        </div>
                      </div>
                    )}
                    {guest.social_networks && Object.keys(guest.social_networks).length > 0 && (
                      <div className="flex items-start gap-2">
                        <Globe className="w-4 h-4 text-primary mt-1" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Redes Sociales</span>
                          <div className="text-sm text-foreground">
                            {Object.entries(guest.social_networks).map(([platform, value]) => (
                              <div key={platform} className="truncate">
                                {platform}: {String(value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Info */}
                  {(guest.press_contact || guest.program_type || guest.notes) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      {guest.press_contact && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Contacto de Prensa</span>
                          <span className="text-sm text-foreground">{guest.press_contact}</span>
                        </div>
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
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">{label}</p>
                  <p className="text-sm text-primary">+ Agregar Invitado</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
