import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  GUEST_DOCS_BUCKET as BUCKET,
  GuestDocumentRow,
  fetchGuestDocuments,
  getSignedDocumentUrl,
} from "@/lib/guestAttachments";

interface GuestDocumentsProps {
  guestId?: string | null;
  /** Fixed hour: hides the hour selector and only shows that hour's documents. */
  hour?: number | null;
  /** Default hour when the selector is shown. */
  defaultHour?: number | null;
  readOnly?: boolean;
  compact?: boolean;
}

const formatSize = (bytes?: number | null) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const GuestDocuments = ({
  guestId,
  hour: fixedHour,
  defaultHour,
  readOnly = false,
  compact = false,
}: GuestDocumentsProps) => {
  const [docs, setDocs] = useState<GuestDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hour, setHour] = useState<string>(String(fixedHour || defaultHour || 1));
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHour(String(fixedHour || defaultHour || 1));
  }, [fixedHour, defaultHour]);

  const loadDocs = useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    try {
      setDocs(await fetchGuestDocuments(guestId, fixedHour ? Number(fixedHour) : undefined));
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  }, [guestId, fixedHour]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const uploadFiles = async (files: File[]) => {
    if (!guestId || files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const hourNumber = Number(fixedHour || hour) || 1;
    let okCount = 0;

    for (const file of files) {
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${guestId}/${hourNumber}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw uploadError;

        const { error: insertError } = await (supabase as any).from("guest_documents").insert({
          guest_id: guestId,
          hour_number: hourNumber,
          file_name: file.name,
          file_url: path,
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

  const handleOpen = async (doc: GuestDocumentRow) => {
    try {
      const signed = await getSignedDocumentUrl(doc.file_url);
      if (signed) window.open(signed, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
      toast.error("No se pudo abrir el documento");
    }
  };

  const handleDelete = async (doc: GuestDocumentRow) => {
    try {
      await supabase.storage.from(BUCKET).remove([doc.file_url]);
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

  const groups = fixedHour
    ? [{ hour: Number(fixedHour), items: docs }]
    : [
        ...[1, 2, 3].map((h) => ({ hour: h, items: docs.filter((d) => (d.hour_number || 1) === h) })),
        { hour: 0, items: docs.filter((d) => ![1, 2, 3].includes(d.hour_number || 1)) },
      ];

  const fileInput = (
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
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className={compact ? "text-xs font-medium flex items-center gap-1" : "text-base"}>
          <FileText className="h-3 w-3" />
          Documentos adjuntos
        </Label>
        <div className="flex items-center gap-2">
          {!readOnly && !fixedHour && (
            <>
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
            </>
          )}
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              title="Agregar archivos"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
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
        </div>
      )}
      {fileInput}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando documentos...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin documentos adjuntos.</p>
      ) : (
        <div className="space-y-3">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.hour} className="space-y-1">
                {!fixedHour && (
                  <p className="text-xs font-semibold text-muted-foreground">
                    {group.hour === 0 ? "Sin hora" : `Hora ${group.hour}`}
                  </p>
                )}
                {group.items.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 rounded bg-muted/50 p-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <button
                      type="button"
                      onClick={() => handleOpen(doc)}
                      className="flex-1 truncate text-left hover:underline"
                    >
                      {doc.file_name}
                    </button>
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
