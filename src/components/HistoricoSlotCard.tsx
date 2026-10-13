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

/** Botón "Ver libreto" + contenido expandible (solo lectura, libretos_chunks ordenado created_at, id -- no chunk_index). */
const VerLibretoButton = ({ chunkIds, size = "sm" }: { chunkIds: string[]; size?: "sm" | "md" }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  const toggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (content !== null) return;
    setLoading(true);
    const { data } = await supabase.from("libretos_chunks").select("content").in("id", chunkIds);
    setContent((data || []).map((d) => d.content as string).join(" "));
    setLoading(false);
  };

  return (
    <div className={size === "sm" ? "mt-1" : "mt-3 pt-3 border-t"}>
      <Button type="button" variant="outline" size="sm" className={size === "sm" ? "w-full h-6 text-[10px]" : "w-full"} onClick={toggle}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : open ? "Ocultar libreto" : "Ver libreto"}
      </Button>
      {open && content && (
        <p className={size === "sm" ? "text-[10px] text-muted-foreground mt-1 line-clamp-6 whitespace-pre-wrap" : "text-sm text-foreground mt-2 whitespace-pre-wrap"}>
          {content}
        </p>
      )}
    </div>
  );
};

/**
 * Fila del histórico para un slot sin guest en la agenda -- solo lectura.
 * variant "week": mismo Card/tamaño/tipografía que GuestSlotCard de
 * WeeklyCalendar (p-3 min-h-[110px]), para ocupar la misma celda de la
 * cuadrícula sin romper el layout. variant "day": mismo peso visual que
 * la tarjeta grande de DayView (p-6), sin los módulos de IA/confirmación
 * que no aplican a una fila histórica.
 */
export const HistoricoSlotCard = ({ row, variant = "week", label }: { row: HistoricoRow; variant?: "week" | "day"; label?: string }) => {
  if (variant === "day") {
    return (
      <Card className="p-6 bg-muted/20 border-dashed">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary">
              {label || "Histórico"}
              <span className="text-sm font-normal text-muted-foreground ml-2">· Histórico</span>
            </h3>
            <HistoricoBadge estado={row.estado_emision} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-foreground flex items-baseline gap-2 min-w-0 w-full">
              <span className="truncate" title={row.guest_name}>{row.guest_name}</span>
              {row.cargo && (
                <span className="text-sm font-normal text-muted-foreground truncate shrink-0 max-w-[45%]" title={row.cargo}>
                  ({row.cargo})
                </span>
              )}
            </h4>
          </div>
          {row.tema && (
            <div>
              <span className="text-xs text-muted-foreground">Tema</span>
              <p className="text-base text-foreground mt-1 line-clamp-2">{row.tema}</p>
            </div>
          )}
          {row.perfil && (
            <div>
              <span className="text-xs text-muted-foreground">Perfil</span>
              <p className="text-sm text-foreground mt-1">{row.perfil}</p>
            </div>
          )}
          {row.tiene_libreto && row.libreto_chunk_ids && row.libreto_chunk_ids.length > 0 && (
            <VerLibretoButton chunkIds={row.libreto_chunk_ids} size="md" />
          )}
        </div>
      </Card>
    );
  }

  // variant "week": clona exactamente el Card de GuestSlotCard (mismo
  // padding/alto mínimo/tipografía) -- mismas clases, para que ocupe la
  // celda de la cuadrícula como si fuera una tarjeta de invitado normal.
  return (
    <Card className="p-3 min-h-[110px] bg-muted/20 border-dashed w-full min-w-0">
      <div className="space-y-2">
        <div className="min-w-0 w-full">
          <h4 className="font-semibold text-sm leading-snug line-clamp-2" title={row.guest_name}>{row.guest_name}</h4>
          {row.cargo && (
            <p className="text-[10px] text-muted-foreground truncate" title={row.cargo}>{row.cargo}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{row.tema}</p>
        <div className="pt-2 border-t border-muted flex flex-row flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-amber-500/10 text-amber-700">Histórico</span>
          <HistoricoBadge estado={row.estado_emision} />
        </div>
        {row.tiene_libreto && row.libreto_chunk_ids && row.libreto_chunk_ids.length > 0 && (
          <VerLibretoButton chunkIds={row.libreto_chunk_ids} />
        )}
      </div>
    </Card>
  );
};
