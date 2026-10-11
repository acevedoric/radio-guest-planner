import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { HistoricoRow } from "@/types/historico";

export const HistoricoBadge = ({ estado }: { estado: HistoricoRow["estado_emision"] }) => {
  if (estado === "emitido") {
    return <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-green-500/10 text-green-700">Al aire ✓</span>;
  }
  if (estado === "planeado_no_emitido") {
    return <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-gray-400/20 text-gray-600">No emitido</span>;
  }
  return null;
};

/** Botón "Ver libreto" + contenido expandible (solo lectura, no libretos_chunks.chunk_index -- ordenado created_at, id ya en la RPC). */
const VerLibretoButton = ({ chunkIds }: { chunkIds: string[] }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (content !== null) return;
    setLoading(true);
    const { data } = await supabase
      .from("libretos_chunks")
      .select("content")
      .in("id", chunkIds);
    setContent((data || []).map((d) => d.content as string).join(" "));
    setLoading(false);
  };

  return (
    <div className="mt-1">
      <Button type="button" variant="outline" size="sm" className="w-full h-6 text-[10px]" onClick={toggle}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : open ? "Ocultar libreto" : "Ver libreto"}
      </Button>
      {open && content && (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-6 whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
};

/** Fila del histórico para un slot sin guest en la agenda -- solo lectura. */
export const HistoricoSlotCard = ({ row }: { row: HistoricoRow }) => {
  return (
    <Card className="p-3 min-h-[110px] bg-muted/20 border-dashed">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            <h4 className="font-semibold text-sm truncate">{row.guest_name}</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-amber-500/10 text-amber-700">Histórico</span>
            <HistoricoBadge estado={row.estado_emision} />
          </div>
        </div>
        {row.cargo && <p className="text-xs text-muted-foreground truncate">{row.cargo}</p>}
        {row.tema && <p className="text-xs text-muted-foreground line-clamp-2">{row.tema}</p>}
        {row.tiene_libreto && row.libreto_chunk_ids && row.libreto_chunk_ids.length > 0 && (
          <VerLibretoButton chunkIds={row.libreto_chunk_ids} />
        )}
      </div>
    </Card>
  );
};
