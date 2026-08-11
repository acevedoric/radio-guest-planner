import { useState } from "react";
import { Copy, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React from "react";
import { supabase } from "@/integrations/supabase/client";

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

const highlight = (text: string, query: string) => {
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  return text.split(re).map((part, i) =>
    re.test(part) && terms.some((t) => part.toLowerCase() === t.toLowerCase()) ? (
      <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

export const HistoricalSearchDialog = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HistoricalResult[] | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("buscar_invitado", {
      query_text: q,
      max_results: 10,
    });
    setLoading(false);
    if (error) {
      console.error("Error searching historical scripts:", error);
      toast.error("No se pudo realizar la búsqueda");
      setResults([]);
      return;
    }
    setResults((data || []) as HistoricalResult[]);
  };

  const maxRank = Math.max(1e-6, ...(results || []).map((r) => r.rank || 0));

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

        <div className="mt-4 space-y-3">
          {results && results.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No se encontraron coincidencias en los libretos históricos.
            </p>
          )}

          {(results || []).map((r) => {
            const pct = Math.round(((r.rank || 0) / maxRank) * 100);
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
