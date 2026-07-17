import { Card } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Plus, Phone, Mail, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Guest } from "@/types/guest";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";

interface WeeklyCalendarProps {
  guests: Guest[];
  allGuests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number, weekDate?: string, slotOrder?: number) => void;
  selectedWeek: Date;
  onMoveGuest?: (guestId: string, newDay: string, newSlot: number, newWeekDate: string, targetGuestId?: string) => Promise<void>;
  editMode: boolean;
  onRecordingGuestClick?: (guest: Guest) => void;
}

const DAYS = [
  { key: "monday", label: "Lunes", offset: 0 },
  { key: "tuesday", label: "Martes", offset: 1 },
  { key: "wednesday", label: "Miércoles", offset: 2 },
  { key: "thursday", label: "Jueves", offset: 3 },
];

const TIME_SLOTS = [
  { slot: 1, label: "1ra Hora" },
  { slot: 2, label: "2da Hora" },
  { slot: 3, label: "3ra Hora" },
];

const statusCardStyles: Record<string, string> = {
  live: "bg-green-500/20 border-l-4 border-green-500",
  recorded: "bg-red-500/20 border-l-4 border-red-500",
  to_record: "bg-yellow-500/20 border-l-4 border-yellow-500",
  postponed: "bg-gray-500/20 border-l-4 border-gray-500",
  proposed: "bg-blue-500/20 border-l-4 border-blue-500",
};

export const WeeklyCalendar = ({ guests, allGuests, onGuestClick, onAddGuest, selectedWeek, onMoveGuest, editMode, onRecordingGuestClick }: WeeklyCalendarProps) => {
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const getGuestForSlot = (day: string, slot: number) => {
    return guests.find(g => g.day_of_week === day && g.time_slot === slot && (g.slot_order ?? 1) === 1);
  };

  const getCoGuestForSlot = (day: string, slot: number) => {
    if (slot !== 3) return undefined;
    return guests.find(g => g.day_of_week === day && g.time_slot === slot && (g.slot_order ?? 1) === 2);
  };

  const getRecordingsForDay = (dayOffset: number): Guest[] => {
    const dayDate = addDays(selectedWeek, dayOffset);
    const dayStr = format(dayDate, "yyyy-MM-dd");
    return allGuests
      .filter(g =>
        g.scheduled_date === dayStr &&
        (g.recording_status === "to_record" || g.recording_status === "postponed")
      )
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  };

  const getProposedForDay = (dayOffset: number): Guest[] => {
    const dayDate = addDays(selectedWeek, dayOffset);
    const dayStr = format(dayDate, "yyyy-MM-dd");
    return allGuests
      .filter(g =>
        g.scheduled_date === dayStr &&
        g.recording_status === "proposed"
      )
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
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
    const newWeekDate = format(selectedWeek, "yyyy-MM-dd");
    
    await onMoveGuest(guestId, newDay, newSlot, newWeekDate, targetGuest?.id);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {DAYS.map(day => (
            <div key={day.key} className="font-semibold text-center text-foreground">
              {day.label} {format(addDays(selectedWeek, day.offset), 'd')}
            </div>
          ))}
        </div>

        {/* Recording strips per day */}
        <div className="grid gap-4 mb-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {DAYS.map(day => {
            const recordings = getRecordingsForDay(day.offset);
            const proposed = getProposedForDay(day.offset);
            if (recordings.length === 0 && proposed.length === 0) return <div key={day.key} />;
            return (
              <div key={day.key} className="space-y-0.5">
                {recordings.map((g) => (
                  <div
                    key={g.id}
                    className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 truncate cursor-pointer hover:bg-red-500/20 border-l-2 border-red-500"
                    onClick={() => onRecordingGuestClick?.(g)}
                    title={`Grabación: ${g.name}`}
                  >
                    🔴 Grab: {g.name}
                  </div>
                ))}
                {proposed.map((g) => (
                  <div
                    key={g.id}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 truncate cursor-pointer hover:bg-blue-500/20 border-l-2 border-blue-500"
                    onClick={() => onRecordingGuestClick?.(g)}
                    title={`Propuesto: ${g.name}`}
                  >
                    🔵 Prop: {g.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Time Slots Grid */}
        {TIME_SLOTS.map(timeSlot => (
          <div key={timeSlot.slot} className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {DAYS.map(day => {
              const guest = getGuestForSlot(day.key, timeSlot.slot);
              const coGuest = getCoGuestForSlot(day.key, timeSlot.slot);

              return (
                <GuestSlotCard
                  key={`${day.key}-${timeSlot.slot}`}
                  day={day.key}
                  slot={timeSlot.slot}
                  guest={guest}
                  coGuest={coGuest}
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
          <Card className={cn("p-4 min-h-[140px] shadow-lg cursor-grabbing", statusCardStyles[activeGuest.recording_status])}>
            <div className="space-y-2">
              <div>
                <h4 className="font-semibold text-sm line-clamp-1">{activeGuest.name}</h4>
                {activeGuest.position && (
                  <span className="text-[10px] text-muted-foreground">({activeGuest.position})</span>
                )}
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
  coGuest?: Guest | undefined;
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number, weekDate?: string, slotOrder?: number) => void;
  editMode: boolean;
}

const GuestSlotCard = ({ day, slot, guest, coGuest, onGuestClick, onAddGuest, editMode }: GuestSlotCardProps) => {
  const slotId = `slot-${day}-${slot}`;

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slotId,
  });

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `guest-${guest?.id || `empty-${slotId}`}`,
    disabled: !guest || !editMode,
  });

  const handleCheckboxChange = async (guest: Guest, type: 'blu' | 'pr', checked: boolean) => {
    if (!guest.id) return;

    try {
      let updateData: Partial<Guest> = {};

      if (type === 'blu') {
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

  const renderCoGuestMini = (g: Guest) => (
    <div
      className={cn(
        "mt-2 pt-2 border-t border-muted cursor-pointer",
        "rounded p-1 -mx-1",
        statusCardStyles[g.recording_status]
      )}
      onClick={(e) => {
        e.stopPropagation();
        onGuestClick(g);
      }}
      title="Co-invitado"
    >
      <div className="text-[9px] font-semibold text-muted-foreground uppercase mb-0.5">Co-invitado</div>
      <h4 className="font-semibold text-xs line-clamp-1">{g.name}</h4>
      {g.position && (
        <span className="text-[10px] text-muted-foreground">({g.position})</span>
      )}
      {g.topic && <p className="text-[10px] text-muted-foreground line-clamp-2">{g.topic}</p>}
      <div className="flex items-center gap-3 pt-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center space-x-1">
          <Checkbox
            id={`blu-week-co-${g.id}`}
            checked={g.confirmed_blu || false}
            onCheckedChange={(checked) => handleCheckboxChange(g, 'blu', checked as boolean)}
            disabled={!editMode}
            className="h-3 w-3"
          />
          <label htmlFor={`blu-week-co-${g.id}`} className="text-[9px] font-medium cursor-pointer">BLU</label>
        </div>
        <div className="flex items-center space-x-1">
          <Checkbox
            id={`pr-week-co-${g.id}`}
            checked={g.confirmed_pr || false}
            onCheckedChange={(checked) => handleCheckboxChange(g, 'pr', checked as boolean)}
            disabled={!editMode}
            className="h-3 w-3"
          />
          <label htmlFor={`pr-week-co-${g.id}`} className="text-[9px] font-medium cursor-pointer">PR</label>
        </div>
      </div>
    </div>
  );

  if (guest) {
    return (
      <div ref={setDropRef}>
        <Card
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className={cn(
            "p-4 min-h-[140px] transition-all",
            statusCardStyles[guest.recording_status],
            editMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            isDragging && "opacity-50",
            isOver && "ring-2 ring-primary shadow-lg"
          )}
          onClick={() => onGuestClick(guest)}
        >
          <div className="space-y-2">
            <div>
              <h4 className="font-semibold text-sm line-clamp-1">{guest.name}</h4>
              {guest.position && (
                <span className="text-[10px] text-muted-foreground">({guest.position})</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{guest.topic}</p>
            {guest.phone && (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="w-3 h-3 text-primary" />
                <span className="text-foreground">{guest.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {guest.email && <Mail className="w-3 h-3 text-primary" />}
              {guest.social_networks && Object.keys(guest.social_networks).length > 0 && (
                <div className="flex items-center gap-1.5">
                  {Object.entries(guest.social_networks as Record<string, string>)
                    .filter(([, v]) => v)
                    .map(([platform, value]) => (
                      <SocialNetworkLink
                        key={platform}
                        platform={platform}
                        username={String(value)}
                        compact
                        iconSize={14}
                      />
                    ))}
                </div>
              )}
            </div>
            {/* Checkboxes de confirmación */}
            <div className="pt-2 border-t border-muted flex flex-row flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
              {guest.proposed_by && (
                <div className="text-[9px] text-muted-foreground truncate mb-1 w-full" title={`Propuesto por: ${guest.proposed_by}`}>
                  📋 {guest.proposed_by}
                </div>
              )}
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
            {slot === 3 && coGuest && renderCoGuestMini(coGuest)}
            {slot === 3 && !coGuest && editMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddGuest(day, 3, undefined, 2);
                }}
                className="mt-2 w-full text-[10px] text-primary border border-dashed border-primary/40 rounded py-1 hover:bg-primary/10"
              >
                + Co-invitado
              </button>
            )}
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
