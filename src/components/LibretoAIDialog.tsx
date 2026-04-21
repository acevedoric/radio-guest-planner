import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, FileDown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

interface LibretoAIDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string; // yyyy-MM-dd
  dayKey: string; // monday|tuesday|wednesday|thursday
}

export const LibretoAIDialog = ({ open, onOpenChange, date, dayKey }: LibretoAIDialogProps) => {
  const [periodista, setPeriodista] = useState("");
  const [lanzamiento, setLanzamiento] = useState("");
  const [canciones90s, setCanciones90s] = useState("");
  const [loading, setLoading] = useState(false);
  const [libreto, setLibreto] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setLibreto("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-libreto", {
        body: { date, periodista, lanzamiento, canciones90s },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let msg = error.message;
        try {
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (body?.error) msg = body.error;
        } catch {}
        toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setLibreto(data?.libreto || "");
      toast.success("Libreto generado");
    } catch (e: any) {
      toast.error(e?.message || "Error generando libreto");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(libreto);
    toast.success("Copiado al portapapeles");
  };

  const handleDownloadDocx = async () => {
    const paragraphs = libreto.split("\n").map((line) => {
      const isHeading = /^#{1,3}\s/.test(line);
      const clean = line.replace(/^#{1,3}\s/, "").replace(/\*\*/g, "");
      return new Paragraph({
        heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
        children: [new TextRun({ text: clean, bold: isHeading || /\*\*/.test(line) })],
      });
    });
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `libreto-${date}.docx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generar libreto IA — {date}
          </DialogTitle>
        </DialogHeader>

        {!libreto && (
          <div className="space-y-3 py-2">
            <div>
              <Label>Periodista de Voces y Sonidos</Label>
              <Input value={periodista} onChange={(e) => setPeriodista(e.target.value)} placeholder="Ej: Luis Carlos Vélez" />
            </div>
            <div>
              <Label>Lanzamiento musical (artista — canción)</Label>
              <Input value={lanzamiento} onChange={(e) => setLanzamiento(e.target.value)} placeholder="Ej: Karol G — Si antes te hubiera conocido" />
            </div>
            {dayKey === "wednesday" && (
              <div>
                <Label>Canciones 90s (opcional)</Label>
                <Textarea value={canciones90s} onChange={(e) => setCanciones90s(e.target.value)} rows={3} placeholder="Anglo / Español / Tropical / Salsa" />
              </div>
            )}
          </div>
        )}

        {libreto && (
          <Textarea
            value={libreto}
            onChange={(e) => setLibreto(e.target.value)}
            className="flex-1 min-h-[400px] font-mono text-xs"
          />
        )}

        <DialogFooter className="flex-row gap-2 justify-between sm:justify-between">
          {libreto ? (
            <>
              <Button variant="outline" onClick={() => setLibreto("")}>Volver</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  <Copy className="w-4 h-4" /> Copiar
                </Button>
                <Button onClick={handleDownloadDocx} className="gap-2">
                  <FileDown className="w-4 h-4" /> Descargar .docx
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={handleGenerate} disabled={loading} className="gap-2 ml-auto">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generar libreto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
