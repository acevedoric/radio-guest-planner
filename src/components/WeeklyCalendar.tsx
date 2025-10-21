import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Guest } from "@/types/guest";

interface WeeklyCalendarProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number) => void;
  selectedWeek: Date;
}

const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
];

const TIME_SLOTS = [
  { slot: 1, label: "1ra Hora" },
  { slot: 2, label: "2da Hora" },
  { slot: 3, label: "3ra Hora" },
];

const statusConfig = {
  live: { label: "En Vivo", className: "bg-status-live text-white" },
  recorded: { label: "Grabado", className: "bg-status-recorded text-white" },
  no_recording: { label: "Sin Grabación", className: "bg-status-none text-white" },
  cancelled: { label: "Cancelado", className: "bg-status-cancelled text-white" },
};

export const WeeklyCalendar = ({ guests, onGuestClick, onAddGuest, selectedWeek }: WeeklyCalendarProps) => {
  const getGuestForSlot = (day: string, slot: number) => {
    return guests.find(g => g.day_of_week === day && g.time_slot === slot);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="font-semibold text-sm text-muted-foreground">Horario</div>
          {DAYS.map(day => (
            <div key={day.key} className="font-semibold text-center text-foreground">
              {day.label}
            </div>
          ))}
        </div>

        {/* Time Slots Grid */}
        {TIME_SLOTS.map(timeSlot => (
          <div key={timeSlot.slot} className="grid grid-cols-5 gap-4 mb-4">
            <div className="flex items-center font-medium text-muted-foreground">
              {timeSlot.label}
            </div>
            {DAYS.map(day => {
              const guest = getGuestForSlot(day.key, timeSlot.slot);
              
              return (
                <Card
                  key={`${day.key}-${timeSlot.slot}`}
                  className={cn(
                    "p-4 min-h-[120px] transition-all hover:shadow-md cursor-pointer",
                    guest ? "bg-card" : "bg-muted/30 border-dashed"
                  )}
                  onClick={() => guest ? onGuestClick(guest) : onAddGuest(day.key, timeSlot.slot)}
                >
                  {guest ? (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm line-clamp-1">{guest.name}</h4>
                        <Badge className={cn("text-xs", statusConfig[guest.recording_status].className)}>
                          {statusConfig[guest.recording_status].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{guest.topic}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {guest.phone && <Phone className="w-3 h-3" />}
                        {guest.email && <Mail className="w-3 h-3" />}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
