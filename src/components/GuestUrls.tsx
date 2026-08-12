import { useCallback, useEffect, useState } from "react";
import { Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchGuestUrls, GuestUrlRow } from "@/lib/guestAttachments";

interface GuestUrlsProps {
  guestId?: string | null;
  hour?: number | null;
  readOnly?: boolean;
  compact?: boolean;
}

const isValidUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

export const GuestUrls = ({ guestId, hour, readOnly = false, compact = false }: GuestUrlsProps) => {
  const [urls, setUrls] = useState<GuestUrlRow[]>([]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const hourNumber = Number(hour) || 1;

  const load = useCallback(async () => {
    if (!guestId) return;
    try {
      setUrls(await fetchGuestUrls(guestId, hourNumber));
    } catch (error) {
      console.error("Error loading urls:", error);
    }
  }, [guestId, hourNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!guestId) return;
    const clean = url.trim();
    if (!isValidUrl(clean)) {
      toast.error("Ingresa un URL válido que empiece por http:// o https://");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("guest_urls").insert({
      guest_id: guestId,
      hour_number: hourNumber,
      url: clean,
      label: label.trim() || null,
    });
    setSaving(false);
    if (error) {
      console.error("Error saving url:", error);
      toast.error("No se pudo guardar el enlace");
      return;
    }
    setUrl("");
    setLabel("");
    toast.success("Enlace agregado");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("guest_urls").delete().eq("id", id);
    if (error) {
      console.error("Error deleting url:", error);
      toast.error("No se pudo eliminar el enlace");
      return;
    }
    setUrls((prev) => prev.filter((u) => u.id !== id));
  };

  if (!guestId) return null;

  return (
    <div className="space-y-2">
      <Label className={compact ? "text-xs font-medium flex items-center gap-1" : "text-base"}>
        <LinkIcon className="h-3 w-3" />
        Enlaces de referencia
      </Label>

      {!readOnly && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="https://..."
            className="h-8 flex-1 text-sm"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre (opcional)"
            className="h-8 text-sm sm:w-44"
          />
          <Button type="button" size="sm" className="h-8" onClick={handleAdd} disabled={saving}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {urls.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin enlaces de referencia.</p>
      ) : (
        <div className="space-y-1">
          {urls.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded bg-muted/50 p-2 text-sm">
              <LinkIcon className="h-4 w-4 shrink-0 text-primary" />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate hover:underline"
                title={item.url}
              >
                {item.label || item.url}
              </a>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
