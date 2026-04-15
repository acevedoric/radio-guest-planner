import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Music, BarChart3, FileText, Megaphone } from "lucide-react";
import { Guest } from "@/types/guest";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LibretoFieldProps {
  guestId: string;
  field: keyof Guest;
  value: string;
  placeholder: string;
  editMode: boolean;
  multiline?: boolean;
  onSaved?: (field: string, value: string) => void;
}

const LibretoField = ({ guestId, field, value, placeholder, editMode, multiline = true, onSaved }: LibretoFieldProps) => {
  const [localValue, setLocalValue] = useState(value);

  const handleSave = async () => {
    if (localValue === value) return;
    try {
      const { error } = await supabase
        .from('guests')
        .update({ [field]: localValue || null } as any)
        .eq('id', guestId);
      if (error) throw error;
      onSaved?.(field as string, localValue);
    } catch (error) {
      console.error('Error saving field:', error);
      toast.error("Error al guardar");
    }
  };

  if (!editMode) {
    return localValue ? (
      <p className="text-sm text-foreground whitespace-pre-wrap">{localValue}</p>
    ) : (
      <p className="text-sm text-muted-foreground italic">Sin contenido</p>
    );
  }

  if (multiline) {
    return (
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        placeholder={placeholder}
        className="min-h-[60px] text-sm"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      placeholder={placeholder}
      className="text-sm"
      onClick={(e) => e.stopPropagation()}
    />
  );
};

interface CancionesSectionProps {
  guest: Guest;
  slot: number;
  selectedDay: string;
  editMode: boolean;
}

export const CancionesSection = ({ guest, slot, selectedDay, editMode }: CancionesSectionProps) => {
  const isTuesdayOrThursday = selectedDay === 'tuesday' || selectedDay === 'thursday';
  if (!isTuesdayOrThursday) return null;
  if (!guest.id) return null;

  const fieldMap: Record<number, keyof Guest> = {
    1: 'h1_canciones',
    2: 'h2_canciones',
    3: 'h3_canciones',
  };
  const field = fieldMap[slot];
  if (!field) return null;

  const isClips = selectedDay === 'thursday' && slot === 1;
  const label = isClips ? "Clips de comediante" : "Canciones en stock";
  const icon = <Music className="w-4 h-4 text-primary" />;
  const placeholder = isClips
    ? "Listar clips de comediante para este segmento..."
    : "Listar canciones sugeridas y criterios de selección...";

  return (
    <div className="pt-3 border-t space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{label}</span>
      </div>
      <LibretoField
        guestId={guest.id}
        field={field}
        value={(guest[field] as string) || ''}
        placeholder={placeholder}
        editMode={editMode}
      />
    </div>
  );
};

interface EncuestaSectionProps {
  guest: Guest | undefined;
  selectedDay: string;
  editMode: boolean;
}

export const EncuestaSection = ({ guest, selectedDay, editMode }: EncuestaSectionProps) => {
  const isTuesdayOrThursday = selectedDay === 'tuesday' || selectedDay === 'thursday';
  if (!isTuesdayOrThursday || !guest?.id) return null;

  const defaultHashtag = selectedDay === 'tuesday'
    ? '#PuertaAlUniversoBlaBlaBLU'
    : '#tbtBlaBlaBLU';

  return (
    <Card className="p-4 bg-muted/50 border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Encuesta del día</h3>
      </div>
      <div className="space-y-3">
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Pregunta</span>
          <LibretoField
            guestId={guest.id}
            field="encuesta_pregunta"
            value={guest.encuesta_pregunta || ''}
            placeholder="Escribir la pregunta de la encuesta del día..."
            editMode={editMode}
            multiline={false}
          />
        </div>
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Hashtag</span>
          <LibretoField
            guestId={guest.id}
            field="encuesta_hashtag"
            value={guest.encuesta_hashtag || defaultHashtag}
            placeholder={defaultHashtag}
            editMode={editMode}
            multiline={false}
          />
        </div>
      </div>
    </Card>
  );
};

interface ContextoH2SectionProps {
  guest: Guest;
  selectedDay: string;
  editMode: boolean;
}

export const ContextoH2Section = ({ guest, selectedDay, editMode }: ContextoH2SectionProps) => {
  const isTuesdayOrThursday = selectedDay === 'tuesday' || selectedDay === 'thursday';
  if (!isTuesdayOrThursday || !guest.id) return null;

  const sectionTitle = selectedDay === 'tuesday' ? 'Puerta al Universo' : '#TBT';
  const placeholder = selectedDay === 'tuesday'
    ? 'Contexto astronómico o temático para Puerta al Universo...'
    : 'Contexto de recuerdo o nostalgia para el segmento #TBT...';

  return (
    <div className="pt-3 border-t space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
          Contexto: {sectionTitle}
        </span>
      </div>
      <LibretoField
        guestId={guest.id}
        field="h2_contexto"
        value={guest.h2_contexto || ''}
        placeholder={placeholder}
        editMode={editMode}
      />
    </div>
  );
};

interface AvanceSectionProps {
  guest: Guest;
  slot: number;
  selectedDay: string;
  editMode: boolean;
}

export const AvanceSection = ({ guest, slot, selectedDay, editMode }: AvanceSectionProps) => {
  const isTuesdayOrThursday = selectedDay === 'tuesday' || selectedDay === 'thursday';
  if (!isTuesdayOrThursday || !guest.id) return null;
  if (slot !== 1 && slot !== 2) return null;

  const field: keyof Guest = slot === 1 ? 'avance_h2' : 'avance_h3';
  const nextHour = slot === 1 ? '2da' : '3ra';
  const placeholder = `Texto de transición hacia la ${nextHour} hora...`;

  return (
    <div className="pt-3 border-t space-y-2">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
          Avance {nextHour} hora
        </span>
      </div>
      <LibretoField
        guestId={guest.id}
        field={field}
        value={(guest[field] as string) || ''}
        placeholder={placeholder}
        editMode={editMode}
      />
    </div>
  );
};
