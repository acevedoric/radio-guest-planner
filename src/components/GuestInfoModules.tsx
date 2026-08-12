import { useState } from "react";
import { ChevronDown, FileText, Upload, X, Loader2, Sparkles, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Guest } from "@/types/guest";
import { cn } from "@/lib/utils";
import React from "react";

/** Renders inline markdown: **bold** and *italic* */
function renderInline(text: string, keyPrefix: string = ""): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={`${keyPrefix}${i}`}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={`${keyPrefix}${i}`}>{part}</React.Fragment>;
  });
}

/** Renders markdown text with headers, bold, italic, and lists */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(<ul key={`ul-${result.length}`} className="list-disc pl-5 my-1 space-y-0.5">{listItems}</ul>);
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      result.push(<p key={`h3-${i}`} className="font-semibold text-sm mt-2 mb-0.5">{renderInline(trimmed.slice(4), `h3-${i}-`)}</p>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      result.push(<p key={`h2-${i}`} className="font-bold text-base mt-2 mb-0.5">{renderInline(trimmed.slice(3), `h2-${i}-`)}</p>);
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(<li key={`li-${i}`}>{renderInline(trimmed.slice(2), `li-${i}-`)}</li>);
      return;
    }

    flushList();
    result.push(<p key={`p-${i}`} className="my-0.5">{renderInline(trimmed, `p-${i}-`)}</p>);
  });

  flushList();
  return result;
}

interface ModuleConfig {
  key: keyof Guest;
  title: string;
  icon: string;
  hasDocument?: boolean;
}

const MODULES_SLOT_1: ModuleConfig[] = [
  { key: "tema_principal", title: "TEMA PRINCIPAL", icon: "🎯", hasDocument: true },
  { key: "infancia_vida_privada", title: "INFANCIA Y VIDA PRIVADA", icon: "👶" },
  { key: "carrera_profesional", title: "CARRERA ARTÍSTICA O PROFESIONAL", icon: "🎭" },
  { key: "datos_curiosos", title: "DATOS CURIOSOS", icon: "💡" },
];

const MODULES_SLOT_2: ModuleConfig[] = [
  { key: "h2_info_personal", title: "INFORMACIÓN PERSONAL", icon: "📋", hasDocument: true },
  { key: "h2_preguntas_sugeridas", title: "PREGUNTAS SUGERIDAS", icon: "❓", hasDocument: true },
];

const MODULES_SLOT_3: ModuleConfig[] = [
  { key: "h3_datos_personales", title: "DATOS PERSONALES", icon: "📋", hasDocument: true },
  { key: "h3_comunicado_prensa", title: "COMUNICADO DE PRENSA", icon: "📰", hasDocument: true },
];

interface SlotDocConfig {
  urlKey: keyof Guest;
  nameKey: keyof Guest;
  linkKey: keyof Guest;
  n8nTimestampKey: keyof Guest;
  aiFields: string[];
}

const SLOT_CONFIG: Record<number, SlotDocConfig> = {
  1: {
    urlKey: "tema_principal_documento_url",
    nameKey: "tema_principal_documento_nombre",
    linkKey: "tema_principal" as keyof Guest, // slot 1 doesn't use link_info
    n8nTimestampKey: "n8n_updated_at",
    aiFields: ["tema_principal", "infancia_vida_privada", "carrera_profesional", "datos_curiosos", "n8n_updated_at"],
  },
  2: {
    urlKey: "h2_documento_url",
    nameKey: "h2_documento_nombre",
    linkKey: "h2_link_info",
    n8nTimestampKey: "h2_n8n_updated_at",
    aiFields: ["h2_info_personal", "h2_preguntas_sugeridas", "h2_n8n_updated_at"],
  },
  3: {
    urlKey: "h3_documento_url",
    nameKey: "h3_documento_nombre",
    linkKey: "h3_link_info",
    n8nTimestampKey: "h3_n8n_updated_at",
    aiFields: ["h3_datos_personales", "h3_comunicado_prensa", "h3_n8n_updated_at"],
  },
};

interface GuestInfoModulesProps {
  guest: Guest;
  editMode: boolean;
  onGuestUpdate?: (updatedGuest: Partial<Guest>) => void;
  slot?: number;
}

export const GuestInfoModules = ({ guest, editMode, onGuestUpdate, slot = 1 }: GuestInfoModulesProps) => {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const modules = slot === 1 ? MODULES_SLOT_1 : slot === 2 ? MODULES_SLOT_2 : MODULES_SLOT_3;
  const config = SLOT_CONFIG[slot];

  const toggleModule = (key: string) => {
    setOpenModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContentChange = (key: string, value: string) => {
    setEditingContent(prev => ({ ...prev, [key]: value }));
  };

  const handleContentSave = async (key: keyof Guest) => {
    if (!guest.id) return;
    const newValue = editingContent[key] ?? guest[key];
    try {
      const { error } = await supabase
        .from("guests")
        .update({ [key]: newValue })
        .eq("id", guest.id);
      if (error) throw error;
      onGuestUpdate?.({ [key]: newValue });
      toast({ title: "Guardado", description: "Contenido actualizado correctamente" });
    } catch (error) {
      console.error("Error saving content:", error);
      toast({ title: "Error", description: "No se pudo guardar el contenido", variant: "destructive" });
    }
  };

  const handleLinkSave = async (value: string) => {
    if (!guest.id || slot === 1) return;
    try {
      const { error } = await supabase
        .from("guests")
        .update({ [config.linkKey]: value || null })
        .eq("id", guest.id);
      if (error) throw error;
      onGuestUpdate?.({ [config.linkKey]: value || null });
      toast({ title: "Guardado", description: "Enlace actualizado" });
    } catch (error) {
      console.error("Error saving link:", error);
      toast({ title: "Error", description: "No se pudo guardar el enlace", variant: "destructive" });
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !guest.id) return;

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Archivo no válido", description: "Solo se permiten archivos PDF o Word (.doc, .docx)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const slotLabel = slot === 1 ? "tema-principal" : `h${slot}-doc`;
      const fileName = `${guest.id}-${slotLabel}.${fileExt}`;
      const filePath = `${guest.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("guest-documents")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("guests")
        .update({
          [config.urlKey]: filePath,
          [config.nameKey]: file.name
        })
        .eq("id", guest.id);
      if (updateError) throw updateError;

      onGuestUpdate?.({
        [config.urlKey]: filePath,
        [config.nameKey]: file.name
      });
      toast({ title: "Documento subido", description: `${file.name} se subió correctamente` });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({ title: "Error", description: "No se pudo subir el documento", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentDownload = async () => {
    const docUrl = guest[config.urlKey] as string | null;
    if (!docUrl) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("guest-documents")
        .createSignedUrl(docUrl, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("Error getting signed URL:", error);
      toast({ title: "Error", description: "No se pudo acceder al documento", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDocumentRemove = async () => {
    const docUrl = guest[config.urlKey] as string | null;
    if (!guest.id || !docUrl) return;
    try {
      await supabase.storage.from("guest-documents").remove([docUrl]);
      const { error } = await supabase
        .from("guests")
        .update({ [config.urlKey]: null, [config.nameKey]: null })
        .eq("id", guest.id);
      if (error) throw error;
      onGuestUpdate?.({ [config.urlKey]: null, [config.nameKey]: null });
      toast({ title: "Documento eliminado" });
    } catch (error) {
      console.error("Error removing document:", error);
      toast({ title: "Error", description: "No se pudo eliminar el documento", variant: "destructive" });
    }
  };

  const getContent = (key: keyof Guest): string => {
    if (editingContent[key] !== undefined) return editingContent[key];
    return (guest[key] as string) || "";
  };

  const handleTriggerAI = async () => {
    if (!guest.id || !guest.name) {
      toast({ title: "Error", description: "El invitado debe tener nombre para buscar información", variant: "destructive" });
      return;
    }

    setAiLoading(true);
    try {
      toast({ title: "Buscando...", description: `Solicitando información con IA...` });

      let document_url: string | null = null;
      const docUrlVal = guest[config.urlKey] as string | null;
      if (docUrlVal) {
        const { data: signedData } = await supabase.storage
          .from("guest-documents")
          .createSignedUrl(docUrlVal, 3600);
        document_url = signedData?.signedUrl || null;
      }

      const { data, error } = await supabase.functions.invoke('trigger-n8n-scraping', {
        body: {
          guest_id: guest.id,
          name: guest.name,
          position: guest.position || '',
          topic: guest.topic || '',
          document_url,
          document_name: (guest[config.nameKey] as string) || null,
          slot,
        }
      });

      if (error) throw error;

      if (data?.data_saved) {
        const selectFields = config.aiFields.join(", ");
        const { data: updatedGuest, error: fetchError } = await supabase
          .from("guests")
          .select(selectFields)
          .eq("id", guest.id)
          .single();

        if (!fetchError && updatedGuest) {
          onGuestUpdate?.(updatedGuest as unknown as Partial<Guest>);
          setEditingContent({});
          toast({ title: "✅ Información actualizada", description: "Los datos de IA se cargaron correctamente" });
        }
      } else {
        toast({ title: "Solicitud enviada", description: "La información se actualizará cuando esté lista" });
      }
    } catch (error) {
      console.error("Error triggering AI:", error);
      toast({ title: "Error", description: "No se pudo solicitar la información", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const n8nTimestamp = guest[config.n8nTimestampKey] as string | null;
  const docUrl = guest[config.urlKey] as string | null;
  const docName = guest[config.nameKey] as string | null;
  const linkInfo = slot !== 1 ? (guest[config.linkKey] as string | null) || "" : "";

  return (
    <div className="mt-4 space-y-2">
      {n8nTimestamp && (
        <p className="text-xs text-muted-foreground mb-2">
          🤖 Actualizado por IA: {new Date(n8nTimestamp).toLocaleString()}
        </p>
      )}

      {/* Link de información (solo slots 2 y 3) */}
      {slot !== 1 && (
        <div className="flex items-center gap-2 mb-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          {editMode ? (
            <Input
              type="url"
              placeholder="https://... enlace de información del invitado"
              defaultValue={linkInfo}
              onBlur={(e) => handleLinkSave(e.target.value)}
              className="h-8 text-sm"
            />
          ) : linkInfo ? (
            <a href={linkInfo} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
              {linkInfo}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground italic">Sin enlace de información</span>
          )}
        </div>
      )}

      {/* Documentos múltiples y enlaces de referencia (todas las horas) */}
      {guest.id && (
        <div className="mb-3 space-y-3 rounded-md border border-border/60 p-3">
          <GuestDocuments guestId={guest.id} hour={slot} readOnly={!editMode} compact />
          <GuestUrls guestId={guest.id} hour={slot} readOnly={!editMode} compact />
        </div>
      )}


      {modules.map((module) => (
        <Collapsible
          key={module.key}
          open={openModules[module.key]}
          onOpenChange={() => toggleModule(module.key)}
        >
          <div className="flex items-center gap-1">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex-1 justify-between p-3 h-auto bg-muted/50 hover:bg-muted"
              >
                <span className="flex items-center gap-2 font-medium text-sm">
                  <span>{module.icon}</span>
                  {module.title}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    openModules[module.key] && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleTriggerAI();
              }}
              disabled={aiLoading}
              title="Generar con IA"
              className="h-10 w-10 p-0 hover:bg-primary/10"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
            </Button>
          </div>

          <CollapsibleContent className="px-3 py-2 bg-background border border-t-0 rounded-b-md">
            {editMode ? (
              <div className="space-y-2">
                <Textarea
                  value={getContent(module.key)}
                  onChange={(e) => handleContentChange(module.key, e.target.value)}
                  onBlur={() => handleContentSave(module.key)}
                  placeholder={`Escribe información sobre ${module.title.toLowerCase()}...`}
                  className="min-h-[100px] text-sm"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {getContent(module.key) ? (
                  renderMarkdown(getContent(module.key))
                ) : (
                  <span className="italic">Sin información disponible</span>
                )}
              </div>
            )}

            {/* Document upload for TEMA PRINCIPAL (slot 1 only) */}
            {slot === 1 && module.hasDocument && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium mb-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Documento justificativo
                </p>
                {docUrl ? (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{docName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDocumentDownload}
                      disabled={downloading}
                      className="h-6 w-6 p-0 text-primary hover:text-primary"
                      title="Descargar documento"
                    >
                      {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    </Button>
                    {editMode && (
                      <Button variant="ghost" size="sm" onClick={handleDocumentRemove} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : editMode ? (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploading ? "Subiendo..." : "Subir documento (PDF/Word)"}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleDocumentUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Sin documento adjunto</span>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};
