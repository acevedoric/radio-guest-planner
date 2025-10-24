import { Card } from "@/components/ui/card";
import { Guest } from "@/types/guest";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek } from "date-fns";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core";
import { useState } from "react";

interface MonthViewProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  selectedMonth: Date;
  onDayClick: (day: Date) => void;
  onMoveGuest?: (guestId: string, newDay: string, newSlot: number, targetGuestId?: string) => Promise<void>;
}

export const MonthView = ({ guests, onGuestClick, selectedMonth, onDayClick, onMoveGuest }: MonthViewProps) => {
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
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
    const [_, dayStr, newSlotStr] = over.id.toString().split('-');
    const newSlot = parseInt(newSlotStr);
    
    const targetGuest = getGuestForSlot(
      calendarDays.find(d => format(d, "yyyy-MM-dd") === dayStr) || new Date(), 
      newSlot
    );
    
    await onMoveGuest(guestId, dayStr, newSlot, targetGuest?.id);
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                {/* Day number */}
                <div className="text-sm font-semibold text-foreground">
                  {format(day, "d")}
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
                        getStatusColor={getStatusColor}
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
  getStatusColor: (status: Guest["recording_status"]) => string;
}

const SlotCard = ({ guest, day, slot, onGuestClick, getStatusColor }: SlotCardProps) => {
  const slotId = `${format(day, "yyyy-MM-dd")}-${slot}`;
  
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slotId,
  });

  // Always call useDraggable hook (Rules of Hooks - must be called unconditionally)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `guest-${guest?.id || `empty-${slotId}`}`,
    disabled: !guest, // Disable dragging when there's no guest
  });

  if (guest) {
    return (
      <div ref={setDropRef}>
        <div
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className={`text-xs p-1 rounded cursor-grab active:cursor-grabbing transition-all ${
            getStatusColor(guest.recording_status)
          } ${isDragging ? "opacity-50" : ""} ${isOver ? "ring-2 ring-primary" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onGuestClick(guest);
          }}
        >
          <div className="font-semibold truncate">{guest.name}</div>
          <div className="truncate opacity-90">{guest.topic}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setDropRef}
      className={`text-xs p-1 rounded border border-dashed transition-all ${
        isOver 
          ? "border-primary bg-primary/10 border-2" 
          : "border-muted-foreground/30 bg-muted/10"
      }`}
    >
      <div className="text-muted-foreground/60 text-center">—</div>
    </div>
  );
};
