import { Card } from "@/components/ui/card";
import { Guest } from "@/types/guest";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek } from "date-fns";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { GuestTooltip } from "./GuestTooltip";

interface MonthViewProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  selectedMonth: Date;
  onDayClick: (day: Date) => void;
  onScheduledDateClick: (day: Date) => void;
  onAddGuest: (day: string, slot: number, weekDate: string) => void;
  onMoveGuest?: (guestId: string, newDay: string, newSlot: number, newWeekDate: string, targetGuestId?: string) => Promise<void>;
  editMode: boolean;
}

export const MonthView = ({ guests, onGuestClick, selectedMonth, onDayClick, onScheduledDateClick, onAddGuest, onMoveGuest, editMode }: MonthViewProps) => {
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );
  
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getGuestForSlot = (day: Date, slot: number): Guest | undefined => {
    const dayOfWeekMap: Record<number, string> = {
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday"
    };
    const dayOfWeekKey = dayOfWeekMap[day.getDay()];
    
    if (!dayOfWeekKey) return undefined;
    
    const weekStart = startOfWeek(day, { weekStartsOn: 1 });
    const weekDateStr = format(weekStart, "yyyy-MM-dd");
    
    return guests.find(g => 
      g.week_date === weekDateStr &&
      g.day_of_week === dayOfWeekKey &&
      g.time_slot === slot
    );
  };

  const getScheduledRecordings = (day: Date): number => {
    const dayStr = format(day, "yyyy-MM-dd");
    
    // Filtrar invitados que tienen scheduled_date igual a este día
    // Y que estén en estado de grabación pendiente
    const scheduledGuests = guests.filter(g => 
      g.scheduled_date === dayStr &&
      (g.recording_status === "to_record" || 
       g.recording_status === "postponed" || 
       g.recording_status === "proposed")
    );
    
    return scheduledGuests.length;
  };

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === selectedMonth.getMonth();
  };

  const isWorkDay = (day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 4; // Monday to Thursday
  };

  const getStatusColor = (status: Guest["recording_status"]) => {
    const colors = {
      live: "bg-green-500 hover:bg-green-600 text-white",
      recorded: "bg-red-500 hover:bg-red-600 text-white",
      to_record: "bg-yellow-500 hover:bg-yellow-600 text-white",
      postponed: "bg-gray-500 hover:bg-gray-600 text-white",
      proposed: "bg-blue-500 hover:bg-blue-600 text-white"
    };
    return colors[status] || "bg-card";
  };

  const handleDragStart = (event: DragEndEvent) => {
    const guestId = event.active.id.toString().replace('guest-', '');
    const guest = guests.find(g => g.id === guestId);
    setActiveGuest(guest || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveGuest(null);
    const { active, over } = event;
    
    if (!over || !onMoveGuest) return;
    
    const guestId = active.id.toString().replace('guest-', '');
    // Formato: slot-YYYY-MM-DD-dayOfWeek-slotNumber
    const parts = over.id.toString().split('-');
    const newDayOfWeek = parts[4]; // Extraer "monday", "tuesday", etc
    const newSlot = parseInt(parts[5]); // Extraer el número de slot
    
    // Encontrar el día completo para obtener su week_date
    const targetDay = calendarDays.find(
      d => format(d, "yyyy-MM-dd") === `${parts[1]}-${parts[2]}-${parts[3]}`
    );
    
    if (!targetDay) return;
    
    // Calcular el week_date correcto para ese día
    const weekStart = startOfWeek(targetDay, { weekStartsOn: 1 });
    const newWeekDate = format(weekStart, "yyyy-MM-dd");
    
    const targetGuest = getGuestForSlot(targetDay, newSlot);
    
    await onMoveGuest(guestId, newDayOfWeek, newSlot, newWeekDate, targetGuest?.id);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
      {/* Month Calendar Grid */}
      <div className="grid grid-cols-4 gap-2">
        {/* Day headers */}
        {["Lun", "Mar", "Mié", "Jue"].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.filter(day => isWorkDay(day)).map((day, index) => {
          const isInMonth = isCurrentMonth(day);
          const isWork = isWorkDay(day);

          return (
            <Card
              key={index}
              className={`min-h-[140px] p-2 transition-all ${
                !isInMonth ? "opacity-30 bg-muted/30" : ""
              } ${
                isWork && isInMonth ? "cursor-pointer hover:shadow-md hover:border-primary" : ""
              }`}
              onClick={() => {
                if (isWork && isInMonth) {
                  onDayClick(day);
                }
              }}
            >
              <div className="space-y-2">
                {/* Day number and scheduled recordings indicator */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">
                    {format(day, "d")}
                  </div>
                  
                  {/* Indicador de grabaciones pendientes */}
                  {getScheduledRecordings(day) > 0 && (
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer transition-all hover:scale-105"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduledDateClick(day);
                      }}
                      title={`${getScheduledRecordings(day)} grabación(es) pendiente(s)`}
                    >
                      <span>📹</span>
                      <span>{getScheduledRecordings(day)}</span>
                    </div>
                  )}
                </div>

                {/* Always show 3 slots */}
                <div className="space-y-1">
                  {[1, 2, 3].map((slot) => {
                    const guest = getGuestForSlot(day, slot);
                    
                    return (
                      <SlotCard
                        key={slot}
                        guest={guest}
                        day={day}
                        slot={slot}
                        onGuestClick={onGuestClick}
                        onAddGuest={onAddGuest}
                        getStatusColor={getStatusColor}
                        editMode={editMode}
                      />
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <DragOverlay>
        {activeGuest && (
          <div className={`text-xs p-1 rounded shadow-lg cursor-grabbing ${getStatusColor(activeGuest.recording_status)}`}>
            <div className="font-semibold truncate">{activeGuest.name}</div>
            <div className="truncate opacity-90">{activeGuest.topic}</div>
          </div>
        )}
      </DragOverlay>
      </div>
    </DndContext>
  );
};

interface SlotCardProps {
  guest: Guest | undefined;
  day: Date;
  slot: number;
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number, weekDate: string) => void;
  getStatusColor: (status: Guest["recording_status"]) => string;
  editMode: boolean;
}

const SlotCard = ({ guest, day, slot, onGuestClick, onAddGuest, getStatusColor, editMode }: SlotCardProps) => {
  const dayOfWeekMap: Record<number, string> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday"
  };
  const dayOfWeekKey = dayOfWeekMap[day.getDay()];
  const slotId = `slot-${format(day, "yyyy-MM-dd")}-${dayOfWeekKey}-${slot}`;
  
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slotId,
  });

  // Always call useDraggable hook (Rules of Hooks - must be called unconditionally)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `guest-${guest?.id || `empty-${slotId}`}`,
    disabled: !guest || !editMode, // Disable dragging when there's no guest or not in edit mode
  });

  if (guest) {
    return (
      <div ref={setDropRef}>
        <GuestTooltip guest={guest}>
          <div
            ref={setDragRef}
            {...listeners}
            {...attributes}
            className={`text-xs p-1 rounded transition-all ${
              editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            } ${getStatusColor(guest.recording_status)} ${isDragging ? "opacity-50" : ""} ${isOver ? "ring-2 ring-primary" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onGuestClick(guest);
            }}
          >
            <div className="font-semibold truncate">{guest.name}</div>
            <div className="truncate opacity-90">{guest.topic}</div>
          </div>
        </GuestTooltip>
      </div>
    );
  }

  return (
    <div
      ref={setDropRef}
      className={`text-xs p-1 rounded border border-dashed transition-all ${
        editMode ? "cursor-pointer hover:border-primary/50" : "cursor-default"
      } ${
        isOver 
          ? "border-primary bg-primary/10 border-2" 
          : "border-muted-foreground/30 bg-muted/10"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (editMode) {
          const dayOfWeekMap: Record<number, string> = {
            1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday"
          };
          const dayOfWeek = dayOfWeekMap[day.getDay()];
          const weekStart = startOfWeek(day, { weekStartsOn: 1 });
          const weekDate = format(weekStart, "yyyy-MM-dd");
          
          if (dayOfWeek) {
            onAddGuest(dayOfWeek, slot, weekDate);
          }
        }
      }}
    >
      <div className="text-muted-foreground/60 text-center">{editMode ? "+ Agregar" : "—"}</div>
    </div>
  );
};
