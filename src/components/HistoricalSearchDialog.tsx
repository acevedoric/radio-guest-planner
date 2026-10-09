import { useState } from "react";
import { Copy, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Guest } from "@/types/guest";

interface HistoricalResult {
  id: string;
  guest_name: string | null;
  guest_role: string | null;
  year: number | null;
  day_of_week: string | null;
  hour_number: number | null;
  content: string | null;
  source_file: string | null;
  rank: number | null;
}

interface AppGuestResult {
  id: string;
  name: string | null;
  position: string | null;
  topic: string | null;
  day_of_week: string | null;
  time_slot: number | null;
  week_date: string | null;
  scheduled_date: string | null;
  rank: number | null;
}

const DAY_LABEL: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
};
const DAY_OFFSETS: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };

/** Fecha de emisión (YYYY-MM-DD) a partir de week_date + day_of_week. */
const emissionDate = (weekDate: string | null, dayOfWeek: string | null): string | null => {
  if (!weekDate || !dayOfWeek || DAY_OFFSETS[dayOfWeek] === undefined) return null;
  const base = new Date(weekDate + "T00:00:00");
  base.setDate(base.getDate() + DAY_OFFSETS[dayOfWeek]);
  return base.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  const [appResults, setAppResults] = useState<AppGuestResult[] | null>(null);
  const [historicalResults, setHistoricalResults] = useState<HistoricalResult[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    const [appRes, histRes] = await Promise.all([
      (supabase as any).rpc("buscar_invitados_app", { query_text: q, max_results: 10 }),
      (supabase as any).rpc("buscar_invitado", { query_text: q, max_results: 10 }),
    ]);
    setLoading(false);
    if (appRes.error) console.error("Error searching app guests:", appRes.error);
    if (histRes.error) console.error("Error searching historical scripts:", histRes.error);
    if (appRes.error && histRes.error) {
      toast.error("No se pudo realizar la búsqueda");
    }
    setAppResults((appRes.data || []) as AppGuestResult[]);
    setHistoricalResults((histRes.data || []) as HistoricalResult[]);
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

  const maxHistRank = Math.max(1e-6, ...(historicalResults || []).map((r) => r.rank || 0));

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
            placeholder="Nombre, tema, palabra clave..."
          />
          <Button onClick={runSearch} disabled={loading || query.trim().length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {appResults !== null && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Invitados en la app</h3>
            {appResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin coincidencias en los invitados de la app.</p>
            ) : (
              <div className="space-y-2">
                {appResults.map((r) => {
                  const fecha = emissionDate(r.week_date, r.day_of_week);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={opening === r.id}
                      onClick={() => handleOpenGuest(r.id)}
                      className="w-full text-left rounded-md border bg-card p-3 space-y-1 hover:border-primary/50 transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm">{r.name || "Sin nombre"}</p>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          {[
                            fecha,
                            r.day_of_week ? DAY_LABEL[r.day_of_week] || r.day_of_week : null,
                            r.time_slot ? `Hora ${r.time_slot}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      {(r.position || r.topic) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[r.position, r.topic].filter(Boolean).join(" — ")}
                        </p>
                      )}
                      {opening === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Histórico de libretos</h3>
          {historicalResults !== null && historicalResults.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No se encontraron coincidencias en los libretos históricos.
            </p>
          )}

          {(historicalResults || []).map((r) => {
            const pct = Math.round(((r.rank || 0) / maxHistRank) * 100);
            const preview = (r.content || "").slice(0, 200);
            return (
              <div key={r.id} className="rounded-md border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{r.guest_name || "Sin nombre"}</p>
                    {r.guest_role && <p className="text-xs text-muted-foreground">{r.guest_role}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    {[r.year, r.day_of_week, r.hour_number ? `Hora ${r.hour_number}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {highlight(preview, query)}
                  {(r.content || "").length > 200 ? "…" : ""}
                </p>

                <div className="flex items-center gap-2">
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
                      await navigator.clipboard.writeText(r.content || "");
                      toast.success("Contenido copiado al portapapeles");
                    } catch {
                      toast.error("No se pudo copiar el contenido");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Usar como referencia
                </Button>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
