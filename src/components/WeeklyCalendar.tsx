import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Phone, Mail, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Guest } from "@/types/guest";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WeeklyCalendarProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number) => void;
  selectedWeek: Date;
  onMoveGuest?: (guestId: string, newDay: string, newSlot: number, newWeekDate: string, targetGuestId?: string) => Promise<void>;
  editMode: boolean;
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
  live: { label: "EN VIVO", className: "bg-green-500 text-white" },
  recorded: { label: "GRABADO", className: "bg-red-500 text-white" },
  to_record: { label: "A GRABAR", className: "bg-yellow-500 text-white" },
  postponed: { label: "APLAZADO", className: "bg-gray-500 text-white" },
  proposed: { label: "PROPUESTO", className: "bg-blue-500 text-white" },
};

export const WeeklyCalendar = ({ guests, onGuestClick, onAddGuest, selectedWeek, onMoveGuest, editMode }: WeeklyCalendarProps) => {
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const getGuestForSlot = (day: string, slot: number) => {
    return guests.find(g => g.day_of_week === day && g.time_slot === slot);
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
    const [_, newDay, newSlotStr] = over.id.toString().split('-');
    const newSlot = parseInt(newSlotStr);
    
    const targetGuest = getGuestForSlot(newDay, newSlot);
    const newWeekDate = selectedWeek.toISOString().split('T')[0];
    
    await onMoveGuest(guestId, newDay, newSlot, newWeekDate, targetGuest?.id);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "150px repeat(4, 1fr)" }}>
          <div className="font-semibold text-sm text-muted-foreground">Horario</div>
          {DAYS.map(day => (
            <div key={day.key} className="font-semibold text-center text-foreground">
              {day.label}
            </div>
          ))}
        </div>

        {/* Time Slots Grid */}
        {TIME_SLOTS.map(timeSlot => (
          <div key={timeSlot.slot} className="grid gap-4 mb-4" style={{ gridTemplateColumns: "150px repeat(4, 1fr)" }}>
            <div className="flex items-center font-medium text-muted-foreground">
              {timeSlot.label}
            </div>
            {DAYS.map(day => {
              const guest = getGuestForSlot(day.key, timeSlot.slot);
              
              return (
                <GuestSlotCard
                  key={`${day.key}-${timeSlot.slot}`}
                  day={day.key}
                  slot={timeSlot.slot}
                  guest={guest}
                  onGuestClick={onGuestClick}
                  onAddGuest={onAddGuest}
                  editMode={editMode}
                />
              );
            })}
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeGuest && (
          <Card className="p-4 min-h-[140px] shadow-lg cursor-grabbing">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm line-clamp-1">{activeGuest.name}</h4>
                <Badge className={cn("text-xs", statusConfig[activeGuest.recording_status].className)}>
                  {statusConfig[activeGuest.recording_status].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{activeGuest.topic}</p>
            </div>
          </Card>
        )}
      </DragOverlay>
      </div>
    </DndContext>
  );
};

interface GuestSlotCardProps {
  day: string;
  slot: number;
  guest: Guest | undefined;
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number) => void;
  editMode: boolean;
}

const GuestSlotCard = ({ day, slot, guest, onGuestClick, onAddGuest, editMode }: GuestSlotCardProps) => {
  const slotId = `slot-${day}-${slot}`;
  
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slotId,
  });

  // Always call useDraggable hook (Rules of Hooks - must be called unconditionally)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `guest-${guest?.id || `empty-${slotId}`}`,
    disabled: !guest || !editMode, // Disable dragging when there's no guest or not in edit mode
  });

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

  if (guest) {
    return (
      <div ref={setDropRef}>
        <Card
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className={cn(
            "p-4 min-h-[140px] transition-all bg-card",
            editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            isDragging && "opacity-50",
            isOver && "ring-2 ring-primary shadow-lg"
          )}
          onClick={() => onGuestClick(guest)}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm line-clamp-1">{guest.name}</h4>
              <Badge className={cn("text-xs", statusConfig[guest.recording_status].className)}>
                {statusConfig[guest.recording_status].label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{guest.topic}</p>
            {guest.phone && (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="w-3 h-3 text-primary" />
                <span className="text-foreground">{guest.phone}</span>
              </div>
            )}
            <div className="flex gap-2 text-xs text-muted-foreground">
              {guest.email && <Mail className="w-3 h-3 text-primary" />}
              {guest.social_networks && Object.keys(guest.social_networks).length > 0 && <Globe className="w-3 h-3 text-primary" />}
            </div>
            {/* Checkboxes de confirmación */}
            <div className="pt-2 border-t border-muted space-y-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`proposed-week-${guest.id}-${slot}`}
                  checked={guest.recording_status === 'proposed'}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'proposed', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3"
                />
                <label
                  htmlFor={`proposed-week-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  PROPUESTO
                </label>
              </div>
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`blu-week-${guest.id}-${slot}`}
                  checked={guest.confirmed_blu || false}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'blu', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3"
                />
                <label
                  htmlFor={`blu-week-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  CONF. BLU
                </label>
              </div>
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`pr-week-${guest.id}-${slot}`}
                  checked={guest.confirmed_pr || false}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'pr', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3"
                />
                <label
                  htmlFor={`pr-week-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  CONF. PR
                </label>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div ref={setDropRef}>
      <Card
        className={cn(
          "p-4 min-h-[140px] transition-all bg-muted/30 border-dashed",
          editMode ? "cursor-pointer hover:shadow-md" : "cursor-default",
          isOver && "border-primary bg-primary/10 border-2"
        )}
        onClick={() => editMode && onAddGuest(day, slot)}
      >
        <div className="flex items-center justify-center h-full">
          <Button variant="ghost" size="sm" className="text-muted-foreground pointer-events-none">
            <Plus className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
      </Card>
    </div>
  );
};
