import { Guest } from "@/types/guest";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarPlus, User, Phone, Mail } from "lucide-react";

interface ProposedViewProps {
  guests: Guest[];
  onGuestClick: (guest: Guest) => void;
  onCreateNew: () => void;
  editMode: boolean;
}

export const ProposedView = ({ guests, onGuestClick, onCreateNew, editMode }: ProposedViewProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bandeja de Propuestos</h2>
          <p className="text-sm text-muted-foreground">
            Invitados propuestos sin fecha asignada ({guests.length})
          </p>
        </div>
        {editMode && (
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo propuesto
          </Button>
        )}
      </div>

      {guests.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No hay invitados propuestos sin fecha</p>
            {editMode && (
              <Button variant="outline" onClick={onCreateNew} className="gap-2 mt-2">
                <Plus className="h-4 w-4" />
                Crear el primero
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guests.map((guest) => (
            <Card
              key={guest.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500 bg-blue-500/5"
              onClick={() => onGuestClick(guest)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{guest.name || "(Sin nombre)"}</h3>
                    {guest.position && (
                      <p className="text-xs text-muted-foreground truncate">{guest.position}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-blue-500 text-white shrink-0">
                    PROPUESTO
                  </Badge>
                </div>

                {guest.topic && (
                  <p className="text-sm text-foreground/80 line-clamp-2">{guest.topic}</p>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
                  {guest.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {guest.phone}
                    </span>
                  )}
                  {guest.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" /> {guest.email}
                    </span>
                  )}
                </div>

                {guest.proposed_by && (
                  <p className="text-xs text-muted-foreground italic">
                    Propuesto por: {guest.proposed_by}
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGuestClick(guest);
                  }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  {editMode ? "Asignar fecha" : "Ver detalles"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
