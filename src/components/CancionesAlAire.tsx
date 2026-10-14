import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, X, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Uso = { id: string; estado: string; canciones: { titulo: string; artista: string | null } | null };

/** Confirmación de canciones al aire para una hora de una fecha de emisión
 * de hoy o pasada: "Sonó al aire" (todas emitidas), "No sonó" por canción
 * y "Cambiar por…" (la original queda no_emitida y la real, emitida). */
export const CancionesAlAire = ({ guestId, slot, fecha, refreshKey }: { guestId: string; slot: number; fecha: string; refreshKey?: string }) => {
  const [usos, setUsos] = useState<Uso[]>([]);
  const [loading, setLoading] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const esPasadaOHoy = fecha <= format(new Date(), "yyyy-MM-dd");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("canciones_uso")
      .select("id, estado, canciones(titulo, artista)")
      .eq("guest_id", guestId)
      .eq("hour_number", slot)
      .order("created_at")
      .order("id");
    if (error) console.error("Error cargando canciones al aire:", error);
    setUsos((data as unknown as Uso[]) || []);
  }, [guestId, slot]);

  useEffect(() => {
    if (esPasadaOHoy) cargar();
  }, [cargar, esPasadaOHoy, refreshKey]);

  if (!esPasadaOHoy || usos.length === 0) return null;

  const marcar = async (ids: string[], estado: "emitida" | "no_emitida") => {
    setLoading(true);
    const { error } = await supabase.from("canciones_uso").update({ estado }).in("id", ids);
    setLoading(false);
    if (error) return toast.error("No se pudo actualizar la canción");
    await cargar();
  };

  const cambiar = async (id: string) => {
    const [titulo, ...resto] = texto.split(" - ");
    if (!titulo.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("cambiar_cancion_uso", { p_uso_id: id, p_titulo: titulo.trim(), p_artista: resto.join(" - ").trim() || null });
    setLoading(false);
    if (error) return toast.error("No se pudo cambiar la canción");
    setCambiando(null);
    setTexto("");
    await cargar();
  };

  const icono = (estado: string) =>
    estado === "emitida" ? <Check className="h-3.5 w-3.5 text-primary" aria-label="Emitida" />
    : estado === "no_emitida" ? <X className="h-3.5 w-3.5 text-destructive" aria-label="No emitida" />
    : <Circle className="h-3 w-3 text-muted-foreground" aria-label="Programada" />;

  return (
    <div className="mt-2 space-y-1 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">CANCIONES AL AIRE</span>
        <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => marcar(usos.filter((u) => u.estado !== "no_emitida").map((u) => u.id), "emitida")}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓ Sonó al aire"}
        </Button>
      </div>
      {usos.map((u) => (
        <div key={u.id} className="text-sm">
          <div className="flex items-center gap-2">
            {icono(u.estado)}
            <span className={u.estado === "no_emitida" ? "line-through text-muted-foreground flex-1" : "flex-1"}>
              {u.canciones?.titulo}{u.canciones?.artista ? ` - ${u.canciones.artista}` : ""}
            </span>
            {u.estado !== "no_emitida" && (
              <>
                <Button size="sm" variant="destructive" className="h-6 px-2 text-[11px]" disabled={loading} onClick={() => marcar([u.id], "no_emitida")}>✗ No sonó</Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={loading} onClick={() => { setCambiando(u.id); setTexto(""); }}>Cambiar por…</Button>
              </>
            )}
          </div>
          {cambiando === u.id && (
            <div className="mt-1 flex gap-2">
              <Input autoFocus className="h-7 text-xs" placeholder="Título - Artista" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && cambiar(u.id)} />
              <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => cambiar(u.id)}>Guardar</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCambiando(null)}>Cancelar</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
