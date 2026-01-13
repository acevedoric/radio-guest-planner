import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, User } from "lucide-react";
import { Guest } from "@/types/guest";
import { Button } from "@/components/ui/button";
import { ContactLink } from "./ContactLink";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SocialNetworkLink } from "./SocialNetworkLink";

interface DayViewProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onAddGuest: (day: string, slot: number) => void;
  selectedDay: string;
  onDayChange: (day: string) => void;
  editMode: boolean;
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
  live: { label: "EN VIVO", className: "bg-green-500 text-white" },
  recorded: { label: "GRABADO", className: "bg-red-500 text-white" },
  to_record: { label: "A GRABAR", className: "bg-yellow-500 text-white" },
  postponed: { label: "APLAZADO", className: "bg-gray-500 text-white" },
  proposed: { label: "PROPUESTO", className: "bg-blue-500 text-white" },
};

export const DayView = ({ guests, onGuestClick, onAddGuest, selectedDay, onDayChange, editMode }: DayViewProps) => {
  const getGuestForSlot = (slot: number) => {
    return guests.find(g => g.day_of_week === selectedDay && g.time_slot === slot);
  };

  const currentDayLabel = DAYS.find(d => d.value === selectedDay)?.label || "Día";

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
              className={`p-6 transition-all ${
                editMode ? "hover:shadow-lg cursor-pointer" : "cursor-default"
              } ${
                guest ? "bg-card" : "border-dashed hover:border-primary"
              }`}
              onClick={() => editMode && (guest ? onGuestClick(guest) : onAddGuest(selectedDay, slot))}
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

                  {/* Checkboxes de confirmación */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="text-xs text-muted-foreground font-semibold mb-2">Estado de Confirmación</div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`proposed-${guest.id}`}
                          checked={guest.recording_status === 'proposed'}
                          onCheckedChange={(checked) => handleCheckboxChange(guest, 'proposed', checked as boolean)}
                          disabled={!editMode}
                        />
                        <label
                          htmlFor={`proposed-${guest.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          PROPUESTO
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`blu-${guest.id}`}
                          checked={guest.confirmed_blu || false}
                          onCheckedChange={(checked) => handleCheckboxChange(guest, 'blu', checked as boolean)}
                          disabled={!editMode}
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
