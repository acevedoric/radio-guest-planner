import { useEffect, useState } from "react";
import { Ban, Loader2, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addToBlacklist, fetchBlacklist, removeFromBlacklist, BlacklistRow } from "@/lib/blacklist";

export function BlacklistManager() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [pendingDelete, setPendingDelete] = useState<BlacklistRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchBlacklist());
    } catch (error) {
      console.error("Error loading blacklist:", error);
      toast.error("No se pudo cargar la lista negra");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSaving(true);
    try {
      await addToBlacklist(name, reason);
      setName("");
      setReason("");
      toast.success("Agregado a la lista negra");
      load();
    } catch (error) {
      console.error("Error adding to blacklist:", error);
      toast.error("No se pudo agregar");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: BlacklistRow) => {
    try {
      await removeFromBlacklist(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Eliminado de la lista negra");
    } catch (error) {
      console.error("Error removing from blacklist:", error);
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Lista negra">
          <Ban className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lista negra</DialogTitle>
          <DialogDescription>
            Invitados que no deben programarse. Al escribir un nombre al crear/editar un invitado se
            avisa si coincide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 border rounded-md p-3">
          <div className="space-y-1">
            <Label htmlFor="bl-name">Nombre</Label>
            <Input
              id="bl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bl-reason">Motivo (opcional)</Label>
            <Input
              id="bl-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: no conversa rico, nos ha dejado plantados..."
              disabled={saving}
            />
          </div>
          <Button type="button" size="sm" onClick={handleAdd} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar
          </Button>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          {loading ? (
            <p className="p-3 text-xs text-muted-foreground">Cargando...</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground italic">La lista negra está vacía.</p>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <div key={row.id} className="flex items-start gap-2 p-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{row.name}</p>
                    {row.reason && <p className="text-xs text-muted-foreground">{row.reason}</p>}
                    {row.created_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(row.created_at), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                    onClick={() => setPendingDelete(row)}
                    title="Quitar de la lista negra"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar de la lista negra?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{pendingDelete?.name}» de la lista negra de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) handleRemove(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
