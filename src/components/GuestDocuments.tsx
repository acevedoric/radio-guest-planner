import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "guest-documents";

interface GuestDocument {
  id: string;
  guest_id: string;
  hour_number: number | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
}

interface GuestDocumentsProps {
  guestId?: string | null;
  defaultHour?: number | null;
  readOnly?: boolean;
}

const formatSize = (bytes?: number | null) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const pathFromUrl = (url: string) => {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : url;
};

export const GuestDocuments = ({ guestId, defaultHour, readOnly = false }: GuestDocumentsProps) => {
  const [docs, setDocs] = useState<GuestDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hour, setHour] = useState<string>(String(defaultHour || 1));
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHour(String(defaultHour || 1));
  }, [defaultHour]);

  const loadDocs = useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("guest_documents")
      .select("*")
      .eq("guest_id", guestId)
      .order("uploaded_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("Error loading documents:", error);
      return;
    }
    setDocs((data || []) as GuestDocument[]);
  }, [guestId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const uploadFiles = async (files: File[]) => {
    if (!guestId || files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const hourNumber = Number(hour) || 1;
    let okCount = 0;

    for (const file of files) {
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${guestId}/${hourNumber}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

        const { error: insertError } = await (supabase as any).from("guest_documents").insert({
          guest_id: guestId,
          hour_number: hourNumber,
          file_name: file.name,
          file_url: pub.publicUrl,
          file_type: file.type || null,
          file_size: file.size,
        });
        if (insertError) throw insertError;

        okCount += 1;
      } catch (error) {
        console.error("Error uploading file:", file.name, error);
        toast.error(`No se pudo subir ${file.name}`);
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (okCount > 0) toast.success(`${okCount} documento(s) subido(s)`);
    loadDocs();
  };

  const handleDelete = async (doc: GuestDocument) => {
    try {
      await supabase.storage.from(BUCKET).remove([pathFromUrl(doc.file_url)]);
      const { error } = await (supabase as any).from("guest_documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Documento eliminado");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("No se pudo eliminar el documento");
    }
  };

  if (!guestId) {
    return (
      <div className="space-y-2">
        <Label>Documentos</Label>
        <p className="text-xs text-muted-foreground italic">
          Guarda el invitado para poder adjuntar documentos.
        </p>
      </div>
    );
  }

  const groups = [1, 2, 3].map((h) => ({
    hour: h,
    items: docs.filter((d) => (d.hour_number || 1) === h),
  }));
  const others = docs.filter((d) => ![1, 2, 3].includes(d.hour_number || 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-base">Documentos</Label>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Subir a:</span>
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hora 1</SelectItem>
                <SelectItem value="2">Hora 2</SelectItem>
                <SelectItem value="3">Hora 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            uploadFiles(Array.from(e.dataTransfer.files || []));
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed p-4 text-sm text-muted-foreground cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/5" : "hover:border-primary/50"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>
                Subiendo {progress.done}/{progress.total}...
              </span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span>Arrastra archivos aquí o haz clic para seleccionar</span>
              <span className="text-xs">PDF, Word, imágenes, cualquier tipo · varios a la vez</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              uploadFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando documentos...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin documentos adjuntos.</p>
      ) : (
        <div className="space-y-3">
          {[...groups, { hour: 0, items: others }]
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.hour} className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {group.hour === 0 ? "Sin hora" : `Hora ${group.hour}`}
                </p>
                {group.items.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 rounded bg-muted/50 p-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate hover:underline"
                    >
                      {doc.file_name}
                    </a>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {doc.file_type || "—"} · {formatSize(doc.file_size)}
                      {doc.uploaded_at ? ` · ${format(parseISO(doc.uploaded_at), "dd/MM/yyyy")}` : ""}
                    </span>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
