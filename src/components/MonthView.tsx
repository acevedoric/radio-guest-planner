import { Card } from "@/components/ui/card";
import { Guest } from "@/types/guest";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek } from "date-fns";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { GuestTooltip } from "./GuestTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const getScheduledRecordingsUrgency = (day: Date): { count: number; colorClasses: string; urgencyLevel: string } => {
    const dayStr = format(day, "yyyy-MM-dd");
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    // Calcular la diferencia en días
    const targetDate = new Date(day);
    targetDate.setHours(0, 0, 0, 0);
    const diffInMs = targetDate.getTime() - today.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    // Filtrar invitados con grabaciones pendientes
    const scheduledGuests = guests.filter(g => 
      g.scheduled_date === dayStr &&
      (g.recording_status === "to_record" || 
       g.recording_status === "postponed" || 
       g.recording_status === "proposed")
    );
    
    const count = scheduledGuests.length;
    
    if (count === 0) {
      return { count: 0, colorClasses: "", urgencyLevel: "" };
    }
    
    // Determinar color según urgencia
    let colorClasses = "";
    let urgencyLevel = "";
    
    if (diffInDays < 0) {
      // Fecha pasada - GRIS
      colorClasses = "bg-gray-400 hover:bg-gray-500";
      urgencyLevel = "Fecha vencida";
    } else if (diffInDays <= 1) {
      // Hoy o mañana - ROJO CRÍTICO
      colorClasses = "bg-red-600 hover:bg-red-700";
      urgencyLevel = diffInDays === 0 ? "¡HOY!" : "Mañana";
    } else if (diffInDays <= 5) {
      // 2-5 días - NARANJA URGENTE
      colorClasses = "bg-orange-500 hover:bg-orange-600";
      urgencyLevel = `En ${diffInDays} días`;
    } else if (diffInDays <= 14) {
      // 6-14 días - AMARILLO MODERADO
      colorClasses = "bg-yellow-500 hover:bg-yellow-600";
      urgencyLevel = `En ${diffInDays} días`;
    } else {
      // 15+ días - AZUL PLANIFICADO
      colorClasses = "bg-blue-500 hover:bg-blue-600";
      urgencyLevel = `En ${diffInDays} días`;
    }
    
    return { count, colorClasses, urgencyLevel };
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
                  
                  {/* Indicador de grabaciones pendientes con colores por urgencia */}
                  {(() => {
                    const { count, colorClasses, urgencyLevel } = getScheduledRecordingsUrgency(day);
                    return count > 0 ? (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${colorClasses} text-white text-xs font-semibold cursor-pointer transition-all hover:scale-105 shadow-sm`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onScheduledDateClick(day);
                        }}
                        title={`${count} grabación(es) pendiente(s) - ${urgencyLevel}`}
                      >
                        <span>📹</span>
                        <span>{count}</span>
                      </div>
                    ) : null;
                  })()}
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
      
      toast.success("Estado actualizado");
    } catch (error) {
      console.error('Error updating guest:', error);
      toast.error("Error al actualizar");
    }
  };
  
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
            {guest.position && (
              <div className="text-[10px] text-white/70 truncate">{guest.position}</div>
            )}
            <div className="truncate opacity-90">{guest.topic}</div>
            
            {/* Checkboxes de confirmación */}
            <div className="mt-2 pt-2 border-t border-white/20 space-y-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`proposed-${guest.id}-${slot}`}
                  checked={guest.recording_status === 'proposed'}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'proposed', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3 bg-white"
                />
                <label
                  htmlFor={`proposed-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  PROPUESTO
                </label>
              </div>
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`blu-${guest.id}-${slot}`}
                  checked={guest.confirmed_blu || false}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'blu', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3 bg-white"
                />
                <label
                  htmlFor={`blu-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  CONF. BLU
                </label>
              </div>
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`pr-${guest.id}-${slot}`}
                  checked={guest.confirmed_pr || false}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'pr', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3 bg-white"
                />
                <label
                  htmlFor={`pr-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  CONF. PR
                </label>
              </div>
            </div>
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
