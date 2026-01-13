import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Guest } from "@/types/guest";
import { ContactLink } from "./ContactLink";
import { SocialNetworkLink, getSocialPlatformOptions } from "./SocialNetworkLink";

interface GuestDetailModalProps {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (guest: Guest) => void;
  onDelete?: (guestId: string) => void;
  readOnly?: boolean;
}

export const GuestDetailModal = ({ guest, isOpen, onClose, onSave, onDelete, readOnly = false }: GuestDetailModalProps) => {
  const [formData, setFormData] = useState<Guest>({
    name: "",
    position: "",
    topic: "",
    recording_status: "proposed",
    day_of_week: "monday",
    time_slot: 1,
    week_date: new Date().toISOString().split('T')[0],
    scheduled_date: null,
  });

  const [socialNetworks, setSocialNetworks] = useState<{twitter: string, instagram: string}>({
    twitter: "",
    instagram: ""
  });
  const [customFields, setCustomFields] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (guest) {
      setFormData(guest);
      
      // Cargar redes sociales
      if (guest.social_networks && typeof guest.social_networks === 'object') {
        const { twitter = "", instagram = "", ...rest } = guest.social_networks as any;
        setSocialNetworks({ twitter, instagram });
        setCustomFields(rest);
      } else {
        setSocialNetworks({ twitter: "", instagram: "" });
        setCustomFields({});
      }
    } else {
      // Reset cuando no hay guest (nuevo invitado)
      setFormData({
        name: "",
        position: "",
        topic: "",
        recording_status: "proposed",
        day_of_week: "monday",
        time_slot: 1,
        week_date: new Date().toISOString().split('T')[0],
        scheduled_date: null,
      });
      setSocialNetworks({ twitter: "", instagram: "" });
      setCustomFields({});
    }
  }, [guest]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.topic.trim()) {
      toast.error("Nombre y tema son requeridos");
      return;
    }

    // Combinar todas las redes sociales
    const allSocialNetworks = {
      ...socialNetworks,
      ...customFields
    };

    // Eliminar campos vacíos
    const cleanedSocialNetworks = Object.fromEntries(
      Object.entries(allSocialNetworks).filter(([_, value]) => value.trim() !== "")
    );

    onSave({
      ...formData,
      social_networks: Object.keys(cleanedSocialNetworks).length > 0 ? cleanedSocialNetworks : null,
      email: null
    });
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

  // Get available platforms for the dropdown (exclude already used ones)
  const getAvailablePlatforms = () => {
    const allPlatforms = getSocialPlatformOptions();
    return allPlatforms.filter(p => !customFields.hasOwnProperty(p.value));
  };

  const handleAddSocialNetwork = (platform: string) => {
    setCustomFields({...customFields, [platform]: ""});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Ver Invitado" : (guest?.id ? "Editar Invitado" : "Nuevo Invitado")}</DialogTitle>
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
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Cargo / Profesión</Label>
              <Input
                id="position"
                value={formData.position || ""}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Ej: CEO, Periodista, Abogado"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recording_status">Estado *</Label>
              <Select
                value={formData.recording_status}
                onValueChange={(value: any) => {
                  setFormData({ 
                    ...formData, 
                    recording_status: value,
                    scheduled_date: (value === "live" || value === "recorded") 
                      ? null 
                      : formData.scheduled_date
                  });
                }}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">EN VIVO</SelectItem>
                  <SelectItem value="recorded">GRABADO</SelectItem>
                  <SelectItem value="to_record">A GRABAR</SelectItem>
                  <SelectItem value="postponed">APLAZADO</SelectItem>
                  <SelectItem value="proposed">PROPUESTO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono del Invitado</Label>
              {readOnly && formData.phone ? (
                <ContactLink type="phone" value={formData.phone} />
              ) : (
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+56 9 1234 5678"
                  disabled={readOnly}
                />
              )}
            </div>
          </div>

          {/* Campo condicional para fecha según estado */}
          {(formData.recording_status === "to_record" || 
            formData.recording_status === "postponed" || 
            formData.recording_status === "proposed") && (
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">
                {formData.recording_status === "to_record" && "Fecha para Grabar"}
                {formData.recording_status === "postponed" && "Fecha de Aplazamiento"}
                {formData.recording_status === "proposed" && "Fecha Propuesta"}
              </Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date || ""}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                disabled={readOnly}
                className="w-full"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="topic">Tema a Tratar *</Label>
            <Textarea
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="Descripción del tema"
              rows={3}
              required
              disabled={readOnly}
            />
          </div>

          {/* Nueva sección de redes sociales */}
          <div className="space-y-4">
            <Label>Redes Sociales</Label>
            
            {/* Twitter/X */}
            <div className="flex items-center gap-2">
              <Label htmlFor="twitter" className="w-24 text-right">Twitter/X</Label>
              {readOnly && socialNetworks.twitter ? (
                <SocialNetworkLink platform="twitter" username={socialNetworks.twitter} />
              ) : (
                <Input
                  id="twitter"
                  value={socialNetworks.twitter}
                  onChange={(e) => setSocialNetworks({...socialNetworks, twitter: e.target.value})}
                  placeholder="@usuario"
                  disabled={readOnly}
                />
              )}
            </div>

            {/* Instagram */}
            <div className="flex items-center gap-2">
              <Label htmlFor="instagram" className="w-24 text-right">Instagram</Label>
              {readOnly && socialNetworks.instagram ? (
                <SocialNetworkLink platform="instagram" username={socialNetworks.instagram} />
              ) : (
                <Input
                  id="instagram"
                  value={socialNetworks.instagram}
                  onChange={(e) => setSocialNetworks({...socialNetworks, instagram: e.target.value})}
                  placeholder="@usuario"
                  disabled={readOnly}
                />
              )}
            </div>

            {/* Campos personalizados (Facebook, YouTube, LinkedIn, Pinterest) */}
            {Object.entries(customFields).map(([platform, value]) => (
              <div key={platform} className="flex items-center gap-2">
                <Label className="w-24 text-right capitalize">{platform}</Label>
                {readOnly && value ? (
                  <SocialNetworkLink platform={platform} username={value} />
                ) : (
                  <>
                    <Input
                      value={value}
                      onChange={(e) => setCustomFields({...customFields, [platform]: e.target.value})}
                      placeholder={`@usuario de ${platform}`}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newFields = {...customFields};
                          delete newFields[platform];
                          setCustomFields(newFields);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Menú desplegable para agregar red social */}
            {!readOnly && getAvailablePlatforms().length > 0 && (
              <Select onValueChange={handleAddSocialNetwork}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="+ Agregar red social..." />
                </SelectTrigger>
                <SelectContent>
                  {getAvailablePlatforms().map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="press_contact">Contacto de Prensa</Label>
            <Input
              id="press_contact"
              value={formData.press_contact || ""}
              onChange={(e) => setFormData({ ...formData, press_contact: e.target.value })}
              placeholder="Nombre del contacto"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="press_phone">Número de Prensa</Label>
            {readOnly && formData.press_phone ? (
              <ContactLink type="phone" value={formData.press_phone} />
            ) : (
              <Input
                id="press_phone"
                type="tel"
                value={formData.press_phone || ""}
                onChange={(e) => setFormData({ ...formData, press_phone: e.target.value })}
                placeholder="+57 1 234 5678"
                disabled={readOnly}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional relevante"
              rows={3}
              disabled={readOnly}
            />
          </div>

          <DialogFooter className="gap-2">
            {!readOnly && guest?.id && onDelete && (
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
              {readOnly ? "Cerrar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit" className="bg-primary hover:bg-primary-glow">
                Guardar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
