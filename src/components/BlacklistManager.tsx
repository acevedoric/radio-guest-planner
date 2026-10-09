import { useEffect, useState } from "react";
import { Ban, Loader2, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  addToBlacklist,
  fetchBlacklist,
  removeFromBlacklist,
  BLACKLIST_CATEGORY_LABEL,
  BlacklistCategory,
  BlacklistRow,
} from "@/lib/blacklist";
import { addBlacklistRule, fetchBlacklistRules, removeBlacklistRule, BlacklistRule } from "@/lib/blacklistRules";

export function BlacklistManager() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<BlacklistCategory | "">("");
  const [pendingDelete, setPendingDelete] = useState<BlacklistRow | null>(null);

  const [rules, setRules] = useState<BlacklistRule[]>([]);
  const [newRule, setNewRule] = useState("");
  const [savingRule, setSavingRule] = useState(false);
  const [pendingDeleteRule, setPendingDeleteRule] = useState<BlacklistRule | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [bl, r] = await Promise.all([fetchBlacklist(), fetchBlacklistRules()]);
      setRows(bl);
      setRules(r);
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
      await addToBlacklist(name, reason, category || null);
      setName("");
      setReason("");
      setCategory("");
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

  const handleAddRule = async () => {
    if (!newRule.trim()) return;
    setSavingRule(true);
    try {
      await addBlacklistRule(newRule);
      setNewRule("");
      toast.success("Regla agregada");
      load();
    } catch (error) {
      console.error("Error adding blacklist rule:", error);
      toast.error("No se pudo agregar la regla");
    } finally {
      setSavingRule(false);
    }
  };

  const handleRemoveRule = async (rule: BlacklistRule) => {
    try {
      await removeBlacklistRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success("Regla eliminada");
    } catch (error) {
      console.error("Error removing blacklist rule:", error);
      toast.error("No se pudo eliminar la regla");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Lista negra">
          <Ban className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Lista negra</DialogTitle>
          <DialogDescription>
            Invitados que no deben programarse. Al escribir un nombre al crear/editar un invitado se
            avisa si coincide.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-700">Reglas editoriales</p>
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-start gap-2 text-sm">
              <p className="flex-1">{rule.text}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                onClick={() => setPendingDeleteRule(rule)}
                title="Quitar regla"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="Nueva regla editorial..."
              disabled={savingRule}
              className="h-8"
            />
            <Button type="button" size="sm" onClick={handleAddRule} disabled={savingRule} className="h-8">
              {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border rounded-md p-3">
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
          <div className="space-y-1">
            <Label htmlFor="bl-category">Categoría (opcional)</Label>
            <Select value={category} onValueChange={(v: any) => setCategory(v)} disabled={saving}>
              <SelectTrigger id="bl-category">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BLACKLIST_CATEGORY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" onClick={handleAdd} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-md">
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
                    <p className="text-[10px] text-muted-foreground">
                      {row.category ? BLACKLIST_CATEGORY_LABEL[row.category] : "Sin categoría"}
                      {row.created_at ? ` · ${format(parseISO(row.created_at), "dd/MM/yyyy")}` : ""}
                    </p>
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

      <AlertDialog open={!!pendingDeleteRule} onOpenChange={(o) => !o && setPendingDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta regla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la regla «{pendingDeleteRule?.text}» de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteRule) handleRemoveRule(pendingDeleteRule);
                setPendingDeleteRule(null);
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
