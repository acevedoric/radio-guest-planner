import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Guest } from "@/types/guest";

interface GuestDetailModalProps {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (guest: Guest) => void;
  onDelete?: (guestId: string) => void;
}

export const GuestDetailModal = ({ guest, isOpen, onClose, onSave, onDelete }: GuestDetailModalProps) => {
  const [formData, setFormData] = useState<Guest>({
    name: "",
    topic: "",
    recording_status: "no_recording",
    day_of_week: "monday",
    time_slot: 1,
    week_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (guest) {
      setFormData(guest);
    }
  }, [guest]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.topic.trim()) {
      toast.error("Nombre y tema son requeridos");
      return;
    }

    onSave(formData);
    onClose();
  };

  const handleDelete = () => {
    if (guest?.id && onDelete) {
      if (confirm("¿Estás seguro de eliminar este invitado?")) {
        onDelete(guest.id);
        onClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{guest?.id ? "Editar Invitado" : "Nuevo Invitado"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del invitado"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recording_status">Estado *</Label>
              <Select
                value={formData.recording_status}
                onValueChange={(value: any) => setFormData({ ...formData, recording_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">En Vivo</SelectItem>
                  <SelectItem value="recorded">Grabado</SelectItem>
                  <SelectItem value="no_recording">Sin Grabación</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Tema a Tratar *</Label>
            <Textarea
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="Descripción del tema"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+56 9 1234 5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="invitado@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="program_type">Tipo de Programa</Label>
            <Input
              id="program_type"
              value={formData.program_type || ""}
              onChange={(e) => setFormData({ ...formData, program_type: e.target.value })}
              placeholder="Ej: Entrevista, Panel, Musical"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="press_contact">Contacto de Prensa</Label>
            <Input
              id="press_contact"
              value={formData.press_contact || ""}
              onChange={(e) => setFormData({ ...formData, press_contact: e.target.value })}
              placeholder="Nombre y contacto del representante"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional relevante"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            {guest?.id && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary-glow">
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
