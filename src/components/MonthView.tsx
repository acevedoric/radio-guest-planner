import { Card } from "@/components/ui/card";
import { Guest } from "@/types/guest";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfWeek, endOfWeek, isBefore, startOfDay } from "date-fns";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { GuestTooltip } from "./GuestTooltip";
import { SocialNetworkLink } from "./SocialNetworkLink";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maybeSendConfirmationEmail } from "@/hooks/useConfirmationWebhook";

interface MonthViewProps {
  guests: Guest[];
  allGuests: Guest[];
  onGuestClick: (guest: Guest) => void;
  selectedMonth: Date;
  onDayClick: (day: Date) => void;
  onScheduledDateClick: (day: Date) => void;
  onAddGuest: (day: string, slot: number, weekDate: string, slotOrder?: number) => void;
  onMoveGuest?: (guestId: string, newDay: string, newSlot: number, newWeekDate: string, targetGuestId?: string) => Promise<void>;
  editMode: boolean;
  onRecordingGuestClick?: (guest: Guest) => void;
}

export const MonthView = ({ guests, allGuests, onGuestClick, selectedMonth, onDayClick, onScheduledDateClick, onAddGuest, onMoveGuest, editMode, onRecordingGuestClick }: MonthViewProps) => {
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
  const today = startOfDay(new Date());

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
      g.time_slot === slot &&
      (g.slot_order ?? 1) === 1
    );
  };

  const getCoGuestForSlot = (day: Date, slot: number): Guest | undefined => {
    if (slot !== 3) return undefined;
    const dayOfWeekMap: Record<number, string> = {
      1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday"
    };
    const dayOfWeekKey = dayOfWeekMap[day.getDay()];
    if (!dayOfWeekKey) return undefined;
    const weekStart = startOfWeek(day, { weekStartsOn: 1 });
    const weekDateStr = format(weekStart, "yyyy-MM-dd");
    return guests.find(g =>
      g.week_date === weekDateStr &&
      g.day_of_week === dayOfWeekKey &&
      g.time_slot === slot &&
      (g.slot_order ?? 1) === 2
    );
  };

  const getScheduledRecordingsForDay = (day: Date): Guest[] => {
    const dayStr = format(day, "yyyy-MM-dd");
    return allGuests
      .filter(g =>
        g.scheduled_date === dayStr &&
        (g.recording_status === "to_record" ||
         g.recording_status === "postponed")
      )
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  };

  const getProposedForDay = (day: Date): Guest[] => {
    const dayStr = format(day, "yyyy-MM-dd");
    return allGuests
      .filter(g =>
        g.scheduled_date === dayStr &&
        g.recording_status === "proposed"
      )
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  };

  // Grabaciones + propuestos unificados y ordenados cronológicamente
  const getStripsForDay = (day: Date): Guest[] => {
    return [...getScheduledRecordingsForDay(day), ...getProposedForDay(day)]
      .sort((a, b) => {
        const ta = a.scheduled_time || '99:99';
        const tb = b.scheduled_time || '99:99';
        return ta.localeCompare(tb);
      });
  };


  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === selectedMonth.getMonth();
  };

  const isWorkDay = (day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 4;
  };

  const isPastDay = (day: Date) => {
    return isBefore(startOfDay(day), today);
  };

  const getStatusColor = (status: Guest["recording_status"]) => {
    const colors = {
      live: "bg-green-500/20 border-l-2 border-green-500 text-green-700 dark:text-green-400",
      recorded: "bg-red-500/20 border-l-2 border-red-500 text-red-700 dark:text-red-400",
      to_record: "bg-yellow-500/20 border-l-2 border-yellow-500 text-yellow-700 dark:text-yellow-400",
      postponed: "bg-gray-500/20 border-l-2 border-gray-500 text-gray-700 dark:text-gray-400",
      proposed: "bg-blue-500/20 border-l-2 border-blue-500 text-blue-700 dark:text-blue-400"
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
    const parts = over.id.toString().split('-');
    const newDayOfWeek = parts[4];
    const newSlot = parseInt(parts[5]);
    
    const targetDay = calendarDays.find(
      d => format(d, "yyyy-MM-dd") === `${parts[1]}-${parts[2]}-${parts[3]}`
    );
    
    if (!targetDay) return;
    
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
        {(() => {
          const workDays = calendarDays.filter(day => isWorkDay(day));
          const rows: Date[][] = [];
          for (let i = 0; i < workDays.length; i += 4) {
            rows.push(workDays.slice(i, i + 4));
          }
          
          return rows.map((row, rowIndex) => {
            const maxStrips = Math.max(0, ...row.map(day => getStripsForDay(day).length));
            const hasAnyBadge = maxStrips > 0;
            const badgeRowHeight = hasAnyBadge ? 24 : 0;
            const stripsHeight = maxStrips * 20;
            const recordingSectionMinHeight = badgeRowHeight + stripsHeight + (maxStrips > 0 ? 4 : 0);

            
            return row.map((day, colIndex) => {
              const isInMonth = isCurrentMonth(day);
              const past = isPastDay(day);
              const scheduledRecordings = getScheduledRecordingsForDay(day);
              const proposedGuests = getProposedForDay(day);

              return (
                <Card
                  key={`${rowIndex}-${colIndex}`}
                  className={`min-h-[140px] p-2 transition-all ${
                    !isInMonth ? "opacity-30 bg-muted/30" : ""
                  } ${
                    past && isInMonth ? "opacity-70" : ""
                  } ${
                    isInMonth ? "cursor-pointer hover:shadow-md hover:border-primary" : ""
                  }`}
                  onClick={() => {
                    if (isInMonth) {
                      onDayClick(day);
                    }
                  }}
                >
                  <div className="space-y-2">
                    {/* Day number and badges - fixed height section */}
                    <div style={{ minHeight: `${recordingSectionMinHeight}px` }}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-sm font-semibold text-foreground">
                          {format(day, "d")}
                        </div>

                        <div className="flex items-center gap-1">
                          {proposedGuests.length > 0 && (
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer transition-all hover:scale-105 shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRecordingGuestClick?.(proposedGuests[0]);
                              }}
                              title={`${proposedGuests.length} propuesto(s)`}
                            >
                              <span className="text-[10px]">●</span>
                              <span>PROPUESTO</span>
                              {proposedGuests.length > 1 && <span>{proposedGuests.length}</span>}
                            </div>
                          )}

                          {scheduledRecordings.length > 0 && (
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer transition-all hover:scale-105 shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScheduledDateClick(day);
                              }}
                              title={`${scheduledRecordings.length} grabación(es) pendiente(s)`}
                            >
                              <span className="text-[10px]">●</span>
                              <span>REC</span>
                              {scheduledRecordings.length > 1 && <span>{scheduledRecordings.length}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recording strips */}
                      {scheduledRecordings.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          {scheduledRecordings.map((g) => (
                            <div
                              key={g.id}
                              className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 truncate cursor-pointer hover:bg-red-500/20 border-l-2 border-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRecordingGuestClick?.(g);
                              }}
                              title={`Grabación: ${g.scheduled_time ? g.scheduled_time.slice(0, 5) + ' ' : ''}${g.name}`}
                            >
                              🔴 {g.scheduled_time && <span className="font-semibold">{g.scheduled_time.slice(0, 5)} </span>}{g.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Proposed strips */}
                      {proposedGuests.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          {proposedGuests.map((g) => (
                            <div
                              key={g.id}
                              className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 truncate cursor-pointer hover:bg-blue-500/20 border-l-2 border-blue-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRecordingGuestClick?.(g);
                              }}
                              title={`Propuesto: ${g.scheduled_time ? g.scheduled_time.slice(0, 5) + ' ' : ''}${g.name}`}
                            >
                              🔵 {g.scheduled_time && <span className="font-semibold">{g.scheduled_time.slice(0, 5)} </span>}{g.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>


                    {/* Guest slots - now aligned across the row */}
                    <div className="space-y-1">
                      {[1, 2, 3].map((slot) => {
                        const guest = getGuestForSlot(day, slot);
                        const coGuest = getCoGuestForSlot(day, slot);

                        return (
                          <SlotCard
                            key={slot}
                            guest={guest}
                            coGuest={coGuest}
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
            });
          });
        })()}
      </div>
      <DragOverlay>
        {activeGuest && (
          <div className={`text-xs p-1 rounded shadow-lg cursor-grabbing ${getStatusColor(activeGuest.recording_status)}`}>
            <div className="font-semibold truncate">{activeGuest.name}</div>
            <div className="truncate opacity-70">{activeGuest.topic}</div>
          </div>
        )}
      </DragOverlay>
      </div>
    </DndContext>
  );
};

interface SlotCardProps {
  guest: Guest | undefined;
  coGuest?: Guest | undefined;
  day: Date;
  slot: number;
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number, weekDate: string, slotOrder?: number) => void;
  getStatusColor: (status: Guest["recording_status"]) => string;
  editMode: boolean;
}

const SlotCard = ({ guest, coGuest, day, slot, onGuestClick, onAddGuest, getStatusColor, editMode }: SlotCardProps) => {
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

      await maybeSendConfirmationEmail(guest, updateData);
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

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `guest-${guest?.id || `empty-${slotId}`}`,
    disabled: !guest || !editMode,
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
              <div className="text-[10px] opacity-70 truncate">{guest.position}</div>
            )}
            <div className="truncate opacity-90">{guest.topic}</div>
            {guest.social_networks && Object.keys(guest.social_networks).length > 0 && (
              <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                {Object.entries(guest.social_networks as Record<string, string>)
                  .filter(([, v]) => v)
                  .map(([platform, value]) => (
                    <SocialNetworkLink
                      key={platform}
                      platform={platform}
                      username={String(value)}
                      compact
                      iconSize={12}
                    />
                  ))}
              </div>
            )}
            
            {/* Checkboxes de confirmación */}
            <div className="mt-2 pt-2 border-t border-muted flex flex-row flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              {guest.proposed_by && (
                <div className="text-[8px] opacity-60 truncate mb-1 w-full" title={`Propuesto por: ${guest.proposed_by}`}>
                  📋 {guest.proposed_by}
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={`blu-${guest.id}-${slot}`}
                  checked={guest.confirmed_blu || false}
                  onCheckedChange={(checked) => handleCheckboxChange(guest, 'blu', checked as boolean)}
                  disabled={!editMode}
                  className="h-3 w-3"
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
                  className="h-3 w-3"
                />
                <label
                  htmlFor={`pr-${guest.id}-${slot}`}
                  className="text-[10px] font-medium leading-none cursor-pointer"
                >
                  CONF. PR
                </label>
              </div>
            </div>
            {slot === 3 && coGuest && (
              <div
                className={`mt-1 pt-1 border-t border-muted rounded ${getStatusColor(coGuest.recording_status)} px-1`}
                onClick={(e) => {
                  e.stopPropagation();
                  onGuestClick(coGuest);
                }}
                title="Co-invitado"
              >
                <div className="text-[8px] uppercase opacity-60 font-semibold">Co-inv.</div>
                <div className="font-semibold truncate">{coGuest.name}</div>
                {coGuest.topic && <div className="truncate opacity-80 text-[10px]">{coGuest.topic}</div>}
              </div>
            )}
            {slot === 3 && !coGuest && editMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const dayOfWeek = dayOfWeekMap[day.getDay()];
                  const weekStart = startOfWeek(day, { weekStartsOn: 1 });
                  const weekDate = format(weekStart, "yyyy-MM-dd");
                  if (dayOfWeek) onAddGuest(dayOfWeek, 3, weekDate, 2);
                }}
                className="mt-1 w-full text-[9px] text-primary border border-dashed border-primary/40 rounded py-0.5 hover:bg-primary/10"
              >
                + Co-invitado
              </button>
            )}
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
