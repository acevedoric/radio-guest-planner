import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Music, Plus } from "lucide-react";
import { toast } from "sonner";

interface CancionRow {
  cancion_id: string;
  titulo: string;
  artista: string | null;
  catalogo: string;
  genero: string;
  es_cortinilla: boolean;
  veces_usada: number;
  ultima_vez: string | null;
}

const CATALOGO_OPTIONS = [
  { value: "todos", label: "Todos los catálogos" },
  { value: "90s", label: "90s" },
  { value: "en_vivo", label: "En vivo" },
  { value: "otros", label: "Otros" },
];

const GENERO_OPTIONS = [
  { value: "todos", label: "Todos los géneros" },
  { value: "anglo", label: "Anglo" },
  { value: "español", label: "Español" },
  { value: "tropical", label: "Tropical" },
  { value: "salsa", label: "Salsa" },
  { value: "otro", label: "Otro" },
];

const CancionesCatalogo = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [catalogo, setCatalogo] = useState("todos");
  const [genero, setGenero] = useState("todos");
  const [results, setResults] = useState<CancionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitulo, setNewTitulo] = useState("");
  const [newArtista, setNewArtista] = useState("");
  const [newCatalogo, setNewCatalogo] = useState("otros");
  const [newGenero, setNewGenero] = useState("otro");
  const [newCortinilla, setNewCortinilla] = useState(false);
  const [saving, setSaving] = useState(false);

  const buscar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("buscar_cancion", {
        p_texto: query,
        p_catalogo: catalogo === "todos" ? null : catalogo,
      });
      if (error) throw error;
      let rows = (data || []) as CancionRow[];
      if (genero !== "todos") rows = rows.filter((r) => r.genero === genero);
      setResults(rows);
    } catch (err) {
      console.error("Error buscando canciones:", err);
      toast.error("Error al buscar canciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, catalogo, genero]);

  const agregarCancion = async () => {
    if (!newTitulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_cancion", {
        p_titulo: newTitulo.trim(),
        p_artista: newArtista.trim() || null,
        p_anio: null,
        p_catalogo: newCatalogo,
        p_es_cortinilla: newCortinilla,
        p_genero: newGenero,
      });
      if (error) throw error;
      toast.success("Canción agregada");
      setNewTitulo("");
      setNewArtista("");
      setNewCatalogo("otros");
      setNewGenero("otro");
      setNewCortinilla(false);
      setShowAdd(false);
      buscar();
    } catch (err) {
      console.error("Error agregando canción:", err);
      toast.error("Error al agregar canción");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <Music className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Catálogo de canciones</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por título o artista..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Select value={catalogo} onValueChange={setCatalogo}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATALOGO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={genero} onValueChange={setGenero}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GENERO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowAdd((s) => !s)}>
            <Plus className="w-4 h-4 mr-1" /> Agregar canción
          </Button>
        </div>

        {showAdd && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Título" value={newTitulo} onChange={(e) => setNewTitulo(e.target.value)} />
              <Input placeholder="Artista" value={newArtista} onChange={(e) => setNewArtista(e.target.value)} />
              <Select value={newCatalogo} onValueChange={setNewCatalogo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATALOGO_OPTIONS.filter((o) => o.value !== "todos").map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newGenero} onValueChange={setNewGenero}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENERO_OPTIONS.filter((o) => o.value !== "todos").map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="cortinilla" checked={newCortinilla} onCheckedChange={(c) => setNewCortinilla(c as boolean)} />
              <label htmlFor="cortinilla" className="text-sm cursor-pointer">Es cortinilla/jingle</label>
            </div>
            <Button onClick={agregarCancion} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        )}

        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">Título</th>
                <th className="text-left p-2">Artista</th>
                <th className="text-left p-2">Catálogo</th>
                <th className="text-left p-2">Género</th>
                <th className="text-left p-2">Última vez</th>
                <th className="text-left p-2">Veces</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Cargando...</td></tr>
              )}
              {!loading && results.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sin resultados</td></tr>
              )}
              {!loading && results.map((r) => (
                <tr key={r.cancion_id} className="border-t">
                  <td className="p-2 font-medium">{r.titulo}{r.es_cortinilla && <span className="ml-1 text-[10px] text-muted-foreground">(cortinilla)</span>}</td>
                  <td className="p-2 text-muted-foreground">{r.artista || "—"}</td>
                  <td className="p-2">{r.catalogo}</td>
                  <td className="p-2">{r.genero}</td>
                  <td className="p-2 text-muted-foreground">{r.ultima_vez || "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.veces_usada}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CancionesCatalogo;
