import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Sparkles, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Guest } from "@/types/guest";
import { cn } from "@/lib/utils";
import { GuestDocuments } from "./GuestDocuments";
import { GuestUrls } from "./GuestUrls";
import { buildAttachmentsPayload } from "@/lib/guestAttachments";
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

/** Tiempo máximo en pending antes de considerar que n8n no respondió. */
const RESEARCH_TIMEOUT_MS = 10 * 60 * 1000;

interface GuestInfoModulesProps {
  guest: Guest;
  editMode: boolean;
  onGuestUpdate?: (updatedGuest: Partial<Guest>) => void;
  slot?: number;
}

export const GuestInfoModules = ({ guest, editMode, onGuestUpdate, slot = 1 }: GuestInfoModulesProps) => {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const hour = `H${slot}` as "H1" | "H2" | "H3";
  const [research, setResearch] = useState<Pick<Guest, "research_status" | "research_hour" | "research_error" | "research_updated_at">>({
    research_status: guest.research_status,
    research_hour: guest.research_hour,
    research_error: guest.research_error,
    research_updated_at: guest.research_updated_at,
  });
  const [pendingTimedOut, setPendingTimedOut] = useState(false);

  const modules = slot === 1 ? MODULES_SLOT_1 : slot === 2 ? MODULES_SLOT_2 : MODULES_SLOT_3;
  const config = SLOT_CONFIG[slot];

  useEffect(() => {
    setResearch({
      research_status: guest.research_status,
      research_hour: guest.research_hour,
      research_error: guest.research_error,
      research_updated_at: guest.research_updated_at,
    });
  }, [guest.id, guest.research_status, guest.research_hour, guest.research_error, guest.research_updated_at]);

  const isThisHour = research.research_hour === hour;
  const rawPending = isThisHour && research.research_status === "pending";

  // Un pending de más de 10 minutos (según research_updated_at) se trata como error
  useEffect(() => {
    setPendingTimedOut(false);
    if (!rawPending) return;
    const startedAt = research.research_updated_at ? new Date(research.research_updated_at).getTime() : NaN;
    const remaining = Number.isNaN(startedAt) ? 0 : startedAt + RESEARCH_TIMEOUT_MS - Date.now();
    if (remaining <= 0) {
      setPendingTimedOut(true);
      return;
    }
    const timer = setTimeout(() => setPendingTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, [rawPending, research.research_updated_at]);

  const researchPending = rawPending && !pendingTimedOut;
  const researchError = isThisHour && (research.research_status === "error" || (rawPending && pendingTimedOut));
  const researchErrorMessage = rawPending && pendingTimedOut
    ? "Sin respuesta de n8n"
    : research.research_error || "n8n reportó un error";

  // Mientras la investigación de esta hora está pendiente, escuchar la fila del invitado
  useEffect(() => {
    if (!guest.id || !researchPending) return;
    const guestId = guest.id;
    let handled = false;

    const applyResearchRow = (row: Partial<Guest>) => {
      if (handled || row.research_hour !== hour) return;
      if (row.research_status !== "done" && row.research_status !== "error") return;
      handled = true;

      const updates: Partial<Guest> = {
        research_status: row.research_status,
        research_hour: row.research_hour,
        research_error: row.research_error ?? null,
        research_updated_at: row.research_updated_at ?? null,
      };
      for (const field of config.aiFields) {
        (updates as Record<string, unknown>)[field] = (row as Record<string, unknown>)[field];
      }
      setResearch(updates);
      setEditingContent({});
      onGuestUpdate?.(updates);

      if (row.research_status === "done") {
        toast({ title: "✅ Información actualizada", description: "Los datos de IA se cargaron correctamente" });
      } else {
        toast({ title: "Error en la investigación", description: row.research_error || "n8n reportó un error", variant: "destructive" });
      }
    };

    const channel = supabase
      .channel(`guest-research-${guestId}-${hour}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "guests", filter: `id=eq.${guestId}` },
        (payload) => applyResearchRow(payload.new as Partial<Guest>)
      )
      .subscribe((status) => {
        // Si n8n respondió antes de que la suscripción estuviera lista, leer el estado actual
        if (status !== "SUBSCRIBED") return;
        supabase
          .from("guests")
          .select(["research_status", "research_hour", "research_error", "research_updated_at", ...config.aiFields].join(", "))
          .eq("id", guestId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) applyResearchRow(data as unknown as Partial<Guest>);
          });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guest.id, researchPending, hour]);

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


  const getContent = (key: keyof Guest): string => {
    if (editingContent[key] !== undefined) return editingContent[key];
    return (guest[key] as string) || "";
  };

  const handleTriggerAI = async () => {
    if (!guest.id || !guest.name) {
      toast({ title: "Error", description: "El invitado debe tener nombre para buscar información", variant: "destructive" });
      return;
    }
    if (researchPending) return;

    // pending de inmediato; el resultado llega por Realtime cuando n8n llame al callback
    setResearch({ research_status: "pending", research_hour: hour, research_error: null, research_updated_at: new Date().toISOString() });
    toast({ title: "Buscando...", description: "Solicitando información con IA..." });

    const failRequest = (message: string) => {
      setResearch({ research_status: "error", research_hour: hour, research_error: message });
      toast({ title: "Error", description: message, variant: "destructive" });
    };

    try {
      // Los documentos se construyen en el backend desde guest_documents
      const { reference_urls } = await buildAttachmentsPayload(guest.id, slot);
      const legacyLink = slot !== 1 ? ((guest[config.linkKey] as string | null) || null) : null;
      const allUrls = legacyLink ? [legacyLink, ...reference_urls] : reference_urls;

      // La edge function responde en cuanto deja el invitado en pending; no espera a n8n
      supabase.functions
        .invoke('trigger-n8n-scraping', {
          body: {
            guest_id: guest.id,
            name: guest.name,
            position: guest.position || '',
            topic: guest.topic || '',
            hour_number: slot,
            reference_urls: allUrls,
            slot,
          }
        })
        .then(({ error }) => {
          if (error) {
            console.error("Error triggering AI:", error);
            failRequest("No se pudo solicitar la información");
          }
        });
    } catch (error) {
      console.error("Error triggering AI:", error);
      failRequest("No se pudo solicitar la información");
    }
  };

  const n8nTimestamp = guest[config.n8nTimestampKey] as string | null;
  const linkInfo = slot !== 1 ? (guest[config.linkKey] as string | null) || "" : "";

  return (
    <div className="mt-4 space-y-2">
      {n8nTimestamp && (
        <p className="text-xs text-muted-foreground mb-2">
          🤖 Actualizado por IA: {new Date(n8nTimestamp).toLocaleString()}
        </p>
      )}

      {researchPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          Investigando con IA… los datos aparecerán aquí cuando estén listos.
        </p>
      )}

      {researchError && (
        <p className="flex items-start gap-2 text-xs text-destructive mb-2">
          <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>Error en la investigación: {researchErrorMessage}</span>
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
              disabled={researchPending}
              title={researchPending ? "Investigación en curso" : "Generar con IA"}
              className="h-10 w-10 p-0 hover:bg-primary/10"
            >
              {researchPending ? (
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
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};
