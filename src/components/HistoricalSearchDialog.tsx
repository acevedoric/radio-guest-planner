import { useRef, useState } from "react";
import { Copy, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Guest } from "@/types/guest";
import { isQuestion, AiAnswerWithLinks, stripQuotes } from "@/components/FilterBar";

type ResultSource = "app" | "historico" | "libreto";
type ResultGroup = ResultSource | "mencion";

interface AppGuestResult {
  id: string;
  name: string | null;
  guest_position: string | null;
  topic: string | null;
  day_of_week: string | null;
  time_slot: number | null;
  week_date: string | null;
  scheduled_date: string | null;
  tier: number | null;
  rank: number | null;
  source: ResultSource;
  snippet: string | null;
  guest_id?: string | null;
  tiene_historico?: boolean | null;
  tipo?: string | null;
}

const SOURCE_LABEL: Record<ResultGroup, string> = {
  app: "Agenda",
  historico: "Histórico",
  libreto: "Libreto",
  mencion: "Menciones",
};
const GROUP_ORDER: ResultGroup[] = ["app", "historico", "libreto", "mencion"];

const groupFor = (r: AppGuestResult): ResultGroup =>
  r.source === "libreto" && r.tipo === "mencion" ? "mencion" : r.source;

// buscar_invitados_rank devuelve day_of_week en español para las 4 fuentes.
const DAY_LABEL: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  "miércoles": "Miércoles",
  jueves: "Jueves",
};

/** buscar_invitados_rank ya devuelve la fecha REAL en scheduled_date para
 * las 4 fuentes (incluida agenda, vía el enlace desde histórico) -- no
 * hace falta recalcularla acá. */
const resolveDate = (r: AppGuestResult): Date | null => {
  if (r.scheduled_date) return new Date(r.scheduled_date + "T12:00:00");
  return null;
};

const highlight = (text: string, query: string) => {
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return text;
  const lowered = terms.map((t) => t.toLowerCase());
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  return text.split(re).map((part, i) =>
    lowered.includes(part.toLowerCase()) ? (
      <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

interface HistoricalSearchDialogProps {
  onGuestClick?: (guest: Guest) => void;
}

export const HistoricalSearchDialog = ({ onGuestClick }: HistoricalSearchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AppGuestResult[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const questionMode = query.trim().length >= 3 && isQuestion(query);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async () => {
    const q = stripQuotes(query.trim());
    if (q.length < 2) return;

    if (isQuestion(q)) {
      setAiLoading(true);
      setAiAnswer(null);
      setResults(null);
      try {
        const { data, error } = await supabase.functions.invoke("chat-guests", { body: { question: q } });
        if (error) throw error;
        setAiAnswer(data?.answer || "Sin respuesta");
      } catch (e) {
        console.error("AI chat error:", e);
        setAiAnswer("Error al consultar la IA. Intenta de nuevo.");
      } finally {
        setAiLoading(false);
      }
      return;
    }

    setLoading(true);
    setAiAnswer(null);
    const { data, error } = await (supabase as any).rpc("buscar_invitados_rank", { query_text: q, max_results: 60 });
    setLoading(false);
    if (error) {
      console.error("Error searching:", error);
      toast.error("No se pudo realizar la búsqueda");
    }
    setResults((data || []) as AppGuestResult[]);
  };

  const handleOpenGuest = async (id: string) => {
    setOpening(id);
    try {
      const { data, error } = await supabase.from("guests").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (data) {
        onGuestClick?.(data as Guest);
        setOpen(false);
      }
    } catch (error) {
      console.error("Error loading guest:", error);
      toast.error("No se pudo abrir el invitado");
    } finally {
      setOpening(null);
    }
  };

  const maxRank = Math.max(1e-6, ...(results || []).map((r) => r.rank || 0));

  // La dedup "+ histórico" y la distinción propio/mención ya las resuelve
  // la RPC (tiene_historico, tipo) -- solo se agrupa por fuente, igual que
  // el buscador superior (FilterBar), para que ambos den el mismo resultado.
  const visibleResults = results || [];
  const resultsByGroup = GROUP_ORDER.map((group) => ({
    group,
    items: visibleResults.filter((r) => groupFor(r) === group),
  })).filter((g) => g.items.length > 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" title="Buscar en libretos históricos">
          <Search className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Buscar en libretos históricos</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Nombre, tema, palabra clave o pregunta (¿cuántos...?)..."
          />
          <Button onClick={runSearch} disabled={loading || aiLoading || query.trim().length < 2}>
            {loading || aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : questionMode ? <Sparkles className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {(aiAnswer || aiLoading) && (
          <div className="mt-4 rounded-md border bg-primary/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Respuesta IA</span>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Pensando...
              </div>
            ) : (
              <AiAnswerWithLinks
                text={aiAnswer || ""}
                onNavigate={(weekDate, dayOfWeek) => {
                  const date = new Date(weekDate + "T12:00:00");
                  const monday = startOfWeek(date, { weekStartsOn: 1 });
                  // La navegación real la maneja Index.tsx a través de onGuestClick
                  // con fecha/semana; aquí solo cerramos el panel.
                  setOpen(false);
                }}
              />
            )}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {results !== null && visibleResults.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">Sin coincidencias.</p>
          )}

          {resultsByGroup.map(({ group, items }) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {SOURCE_LABEL[group]} ({items.length})
              </p>
              {items.map((r) => {
                const date = resolveDate(r);
                const dateLabel = date ? format(date, "d 'de' MMMM yyyy", { locale: es }) : "Sin fecha";
                const dayLabel = r.day_of_week ? DAY_LABEL[r.day_of_week] || r.day_of_week : null;
                const hasHistorico = r.tiene_historico === true;
                const isMencion = group === "mencion";
                const clickable = r.source === "app";
                const pct = (r.source === "libreto") ? Math.round(((r.rank || 0) / maxRank) * 100) : null;
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {isMencion ? `Mencionado en el libreto de ${r.name || "Sin nombre"}` : (r.name || "Sin nombre")}
                        </p>
                        {hasHistorico && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-amber-500/10 text-amber-700">+ histórico</span>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        {[dateLabel, dayLabel, r.time_slot ? `Hora ${r.time_slot}` : null].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {!isMencion && (r.guest_position || r.topic) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[r.guest_position, r.topic].filter(Boolean).join(" — ")}
                      </p>
                    )}
                    {r.snippet && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{highlight(r.snippet, query)}</p>
                    )}
                    {opening === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </>
                );
                return (
                  <div key={`${r.source}-${r.id}`} className="rounded-md border bg-card p-3 space-y-1">
                    {clickable ? (
                      <button
                        type="button"
                        disabled={opening === r.id}
                        onClick={() => handleOpenGuest(r.id)}
                        className="w-full text-left space-y-1 disabled:opacity-60"
                      >
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                    {(r.source === "libreto") && pct !== null && (
                      <>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(r.snippet || "");
                              toast.success("Contenido copiado al portapapeles");
                            } catch {
                              toast.error("No se pudo copiar el contenido");
                            }
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Usar como referencia
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
