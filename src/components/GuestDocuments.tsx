import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, FileAudio, Image as ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const MAX_SIZE = 25 * 1024 * 1024;

const DOC_EXT = ["pdf", "docx", "doc", "txt"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "heic"];
const AUDIO_EXT = ["mp3", "m4a", "wav", "ogg"];
const ALLOWED_EXT = [...DOC_EXT, ...IMAGE_EXT, ...AUDIO_EXT];

const ACCEPT = ALLOWED_EXT.map((e) => `.${e}`).join(",");

const getExt = (name: string) => (name.split(".").pop() || "").toLowerCase();

type Kind = "document" | "image" | "audio";

const getKind = (doc: { file_name: string; file_type?: string | null }): Kind => {
  const type = (doc.file_type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  const ext = getExt(doc.file_name);
  if (IMAGE_EXT.includes(ext)) return "image";
  if (AUDIO_EXT.includes(ext)) return "audio";
  return "document";
};

const formatSize = (bytes?: number | null) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
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
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<GuestDocumentRow | null>(null);
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

  // Signed URLs for image thumbnails
  useEffect(() => {
    let cancelled = false;
    const images = docs.filter((d) => getKind(d) === "image");
    if (images.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        images.map(async (d) => {
          try {
            const url = await getSignedDocumentUrl(d.file_url);
            return [d.id, url || ""] as const;
          } catch {
            return [d.id, ""] as const;
          }
        })
      );
      if (cancelled) return;
      setThumbs((prev) => {
        const next = { ...prev };
        entries.forEach(([id, url]) => {
          if (url) next[id] = url;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [docs]);

  const uploadFiles = async (files: File[]) => {
    if (!guestId || files.length === 0) return;

    const valid: File[] = [];
    for (const file of files) {
      const ext = getExt(file.name);
      if (!ALLOWED_EXT.includes(ext)) {
        toast.error(`${file.name}: formato no permitido. Se aceptan PDF, Word, TXT, imágenes y audios.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} pesa ${formatSize(file.size)}. El máximo permitido es 25 MB.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: valid.length });

    const hourNumber = Number(fixedHour || hour) || 1;
    let okCount = 0;

    for (const file of valid) {
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${guestId}/${hourNumber}/${Date.now()}_${safeName}`;
        const mime = file.type || MIME_BY_EXT[getExt(file.name)] || "application/octet-stream";

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: mime });
        if (uploadError) throw uploadError;

        const { error: insertError } = await (supabase as any).from("guest_documents").insert({
          guest_id: guestId,
          hour_number: hourNumber,
          file_name: file.name,
          file_url: path,
          file_type: mime,
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
    if (okCount > 0) toast.success(`${okCount} archivo(s) subido(s)`);
    loadDocs();
  };

  const handleOpen = async (doc: GuestDocumentRow) => {
    try {
      const signed = await getSignedDocumentUrl(doc.file_url);
      if (signed) window.open(signed, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
      toast.error("No se pudo abrir el archivo");
    }
  };

  const handleDelete = async (doc: GuestDocumentRow) => {
    try {
      await supabase.storage.from(BUCKET).remove([doc.file_url]);
      const { error } = await (supabase as any).from("guest_documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Archivo eliminado");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("No se pudo eliminar el archivo");
    }
  };

  if (!guestId) {
    return (
      <div className="space-y-2">
        <Label>Archivos</Label>
        <p className="text-xs text-muted-foreground italic">
          Guarda el invitado para poder adjuntar archivos.
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
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        uploadFiles(Array.from(e.target.files || []));
        e.target.value = "";
      }}
    />
  );

  const renderIcon = (doc: GuestDocumentRow) => {
    const kind = getKind(doc);
    if (kind === "image") {
      const thumb = thumbs[doc.id];
      return thumb ? (
        <img
          src={thumb}
          alt={doc.file_name}
          className="h-8 w-8 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
      );
    }
    if (kind === "audio") return <FileAudio className="h-4 w-4 shrink-0 text-primary" />;
    return <FileText className="h-4 w-4 shrink-0 text-primary" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className={compact ? "text-xs font-medium flex items-center gap-1" : "text-base"}>
          <FileText className="h-3 w-3" />
          Archivos adjuntos
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
              <span className="text-xs">
                PDF, Word, TXT, imágenes y audios · varios a la vez · máx. 25 MB por archivo
              </span>
            </>
          )}
        </div>
      )}
      {fileInput}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando archivos...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin archivos adjuntos.</p>
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
                    {renderIcon(doc)}
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
                        onClick={() => setPendingDelete(doc)}
                        title="Eliminar archivo"
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{pendingDelete?.file_name}» de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
