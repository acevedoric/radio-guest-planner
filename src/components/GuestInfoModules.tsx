import { useState } from "react";
import { ChevronDown, FileText, Upload, Download, X, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Guest } from "@/types/guest";
import { cn } from "@/lib/utils";

interface GuestInfoModulesProps {
  guest: Guest;
  editMode: boolean;
  onGuestUpdate?: (updatedGuest: Partial<Guest>) => void;
}

interface ModuleConfig {
  key: keyof Guest;
  title: string;
  icon: string;
  hasDocument?: boolean;
}

const MODULES: ModuleConfig[] = [
  { key: "tema_principal", title: "TEMA PRINCIPAL", icon: "🎯", hasDocument: true },
  { key: "infancia_vida_privada", title: "INFANCIA Y VIDA PRIVADA", icon: "👶" },
  { key: "carrera_profesional", title: "CARRERA ARTÍSTICA O PROFESIONAL", icon: "🎭" },
  { key: "datos_curiosos", title: "DATOS CURIOSOS", icon: "✨" },
];

export const GuestInfoModules = ({ guest, editMode, onGuestUpdate }: GuestInfoModulesProps) => {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

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

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !guest.id) return;

    // Validate file type
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({ 
        title: "Archivo no válido", 
        description: "Solo se permiten archivos PDF o Word (.doc, .docx)", 
        variant: "destructive" 
      });
      return;
    }

    setUploading(true);
    
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${guest.id}-tema-principal.${fileExt}`;
      const filePath = `${guest.id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("guest-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("guest-documents")
        .getPublicUrl(filePath);

      // Update guest record
      const { error: updateError } = await supabase
        .from("guests")
        .update({
          tema_principal_documento_url: publicUrl,
          tema_principal_documento_nombre: file.name
        })
        .eq("id", guest.id);

      if (updateError) throw updateError;

      onGuestUpdate?.({
        tema_principal_documento_url: publicUrl,
        tema_principal_documento_nombre: file.name
      });

      toast({ title: "Documento subido", description: `${file.name} se subió correctamente` });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({ title: "Error", description: "No se pudo subir el documento", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentRemove = async () => {
    if (!guest.id || !guest.tema_principal_documento_url) return;

    try {
      const filePath = `${guest.id}/${guest.tema_principal_documento_nombre}`;
      
      await supabase.storage
        .from("guest-documents")
        .remove([filePath]);

      const { error } = await supabase
        .from("guests")
        .update({
          tema_principal_documento_url: null,
          tema_principal_documento_nombre: null
        })
        .eq("id", guest.id);

      if (error) throw error;

      onGuestUpdate?.({
        tema_principal_documento_url: null,
        tema_principal_documento_nombre: null
      });

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

  return (
    <div className="mt-4 space-y-2">
      {guest.n8n_updated_at && (
        <p className="text-xs text-muted-foreground mb-2">
          📡 Última actualización n8n: {new Date(guest.n8n_updated_at).toLocaleString()}
        </p>
      )}
      
      {MODULES.map((module) => (
        <Collapsible
          key={module.key}
          open={openModules[module.key]}
          onOpenChange={() => toggleModule(module.key)}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-3 h-auto bg-muted/50 hover:bg-muted"
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
                {getContent(module.key) || (
                  <span className="italic">Sin información disponible</span>
                )}
              </div>
            )}
            
            {/* Document upload for TEMA PRINCIPAL */}
            {module.hasDocument && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium mb-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Documento justificativo
                </p>
                
                {guest.tema_principal_documento_url ? (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">
                      {guest.tema_principal_documento_nombre}
                    </span>
                    <a
                      href={guest.tema_principal_documento_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    {editMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDocumentRemove}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : editMode ? (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
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
                  <span className="text-xs text-muted-foreground italic">
                    Sin documento adjunto
                  </span>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};
