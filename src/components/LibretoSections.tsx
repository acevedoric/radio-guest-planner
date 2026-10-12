import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, BarChart3, FileText, Megaphone, Sparkles, Loader2 } from "lucide-react";
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

const DAY_OFFSET: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };

/** Fecha real de emisión del guest (week_date + offset del día), o hoy si no hay datos. */
function guestFecha(guest: Guest, selectedDay: string): string {
  if (guest.scheduled_date) return guest.scheduled_date;
  if (guest.week_date && selectedDay in DAY_OFFSET) {
    const d = new Date(guest.week_date + "T12:00:00");
    d.setDate(d.getDate() + DAY_OFFSET[selectedDay]);
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

const CANTANTE_RE = /cantante|m[uú]sic[oa]|cantautor|dj\b/i;

const GENERO_OPTIONS: { value: string; label: string }[] = [
  { value: "anglo", label: "Anglo" },
  { value: "español", label: "Español" },
  { value: "tropical", label: "Tropical" },
  { value: "salsa", label: "Salsa" },
];

/** Botón que pide una sugerencia (RPC) y la agrega como nueva línea al campo. */
const SugerirButton = ({
  label,
  onPick,
}: {
  label: string;
  onPick: () => Promise<{ titulo: string; artista: string | null } | null>;
}) => {
  const [loading, setLoading] = useState(false);
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const pick = await onPick();
      if (!pick) {
        toast.message("Sin sugerencias disponibles (revisa el catálogo o el filtro de género)");
        return;
      }
      toast.success(`Sugerida: ${pick.titulo}${pick.artista ? " — " + pick.artista : ""}`);
    } catch (err) {
      console.error("Error sugiriendo canción:", err);
      toast.error("Error al sugerir canción");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {label}
    </Button>
  );
};

interface CancionesSectionProps {
  guest: Guest;
  slot: number;
  selectedDay: string;
  editMode: boolean;
}

const CANCIONES_FIELD_MAP: Record<number, keyof Guest> = {
  1: 'h1_canciones',
  2: 'h2_canciones',
  3: 'h3_canciones',
};

export const CancionesSection = ({ guest, slot, selectedDay, editMode }: CancionesSectionProps) => {
  const field = CANCIONES_FIELD_MAP[slot];
  // Hooks nunca después de un return condicional -- se declara siempre,
  // aunque el valor inicial no se use si el componente termina en null.
  const [value, setValue] = useState((field && guest[field] as string) || '');

  if (!guest.id || !field) return null;

  const isClips = selectedDay === 'thursday' && slot === 1;
  const isWednesdayH2 = selectedDay === 'wednesday' && slot === 2;
  const label = isClips ? "Clips de comediante" : "Canciones en stock";
  const icon = <Music className="w-4 h-4 text-primary" />;
  const placeholder = isClips
    ? "Listar clips de comediante para este segmento..."
    : "Listar canciones sugeridas y criterios de selección...";

  const appendLine = async (pick: { titulo: string; artista: string | null } | null) => {
    if (!pick || !guest.id) return pick;
    const line = pick.artista ? `${pick.titulo} - ${pick.artista}` : pick.titulo;
    const next = value ? `${value}\n${line}` : line;
    setValue(next);
    const { error } = await supabase.from('guests').update({ [field]: next } as any).eq('id', guest.id);
    if (error) {
      console.error('Error guardando cancion sugerida:', error);
      toast.error('No se pudo guardar la sugerencia');
    }
    return pick;
  };

  const sugerirPorGenero = async (genero: string | null) => {
    const { data, error } = await supabase.rpc('sugerir_canciones', {
      p_fecha: guestFecha(guest, selectedDay),
      p_day_of_week: selectedDay,
      p_hour_number: slot,
      p_genero: genero,
      p_limite: 10,
    });
    if (error) throw error;
    const candidatas = (data || []).filter((c: any) => !c.es_firma);
    if (!candidatas.length) return null;
    const pick = candidatas[Math.floor(Math.random() * candidatas.length)];
    return appendLine({ titulo: pick.titulo, artista: pick.artista });
  };

  const sugerirH1 = async () => {
    const esCantante = !isClips && CANTANTE_RE.test(guest.position || '');
    if (esCantante && guest.name) {
      const { data, error } = await supabase.rpc('buscar_cancion', { p_texto: guest.name });
      if (error) throw error;
      if (data && data.length) {
        const pick = data[0];
        return appendLine({ titulo: pick.titulo, artista: pick.artista });
      }
      // sin canción propia encontrada -- cae a versión en vivo, igual que un no-cantante.
    }
    const { data, error } = await supabase.rpc('buscar_cancion', { p_texto: '', p_catalogo: 'en_vivo' });
    if (error) throw error;
    if (!data || !data.length) return null;
    const pick = data[Math.floor(Math.random() * data.length)];
    return appendLine({ titulo: pick.titulo, artista: pick.artista });
  };

  return (
    <div className="pt-3 border-t space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">{label}</span>
        </div>
        {editMode && !isClips && (
          <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {slot === 1 ? (
              <SugerirButton label="Sugerir" onPick={sugerirH1} />
            ) : isWednesdayH2 ? (
              GENERO_OPTIONS.map((g) => (
                <SugerirButton key={g.value} label={g.label} onPick={() => sugerirPorGenero(g.value)} />
              ))
            ) : (
              <SugerirButton label="Sugerir" onPick={() => sugerirPorGenero(null)} />
            )}
          </div>
        )}
      </div>
      <LibretoField
        guestId={guest.id}
        field={field}
        value={value}
        placeholder={placeholder}
        editMode={editMode}
        onSaved={(_f, v) => setValue(v)}
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
