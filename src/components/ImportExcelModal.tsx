import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Guest } from "@/types/guest";
import {
  parseWorkbook,
  mergeWithExisting,
  inferYearFromFilename,
  type PreviewRow,
} from "@/lib/excelImport";

interface Props {
  onImported?: () => void;
}

const DAY_LABEL: Record<string, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mié",
  thursday: "Jue",
};

const ACTION_COLOR: Record<PreviewRow["action"], string> = {
  insert: "bg-green-500/15 text-green-700 border-green-500/40",
  update: "bg-blue-500/15 text-blue-700 border-blue-500/40",
  skip: "bg-muted text-muted-foreground border-border",
  conflict: "bg-red-500/15 text-red-700 border-red-500/40",
};

export function ImportExcelModal({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setFileName(file.name);
    const detected = inferYearFromFilename(file.name);
    setYear(detected);
    try {
      const parsed = await parseWorkbook(file, detected);
      if (parsed.length === 0) {
        toast.warning("No se detectaron invitados en el archivo");
        setRows([]);
        return;
      }
      // Fetch existing guests for affected weeks
      const weeks = Array.from(new Set(parsed.map((p) => p.week_date)));
      const { data } = await supabase
        .from("guests")
        .select("*")
        .in("week_date", weeks);
      const merged = mergeWithExisting(parsed, (data || []) as Guest[]);
      setRows(merged);
    } catch (e: any) {
      console.error(e);
      toast.error("Error al leer el Excel: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const reparseWithYear = async (newYear: number) => {
    if (!inputRef.current?.files?.[0]) return;
    setYear(newYear);
    setBusy(true);
    try {
      const parsed = await parseWorkbook(inputRef.current.files[0], newYear);
      const weeks = Array.from(new Set(parsed.map((p) => p.week_date)));
      const { data } = await supabase.from("guests").select("*").in("week_date", weeks);
      const merged = mergeWithExisting(parsed, (data || []) as Guest[]);
      setRows(merged);
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = (i: number) => {
    setRows((rs) =>
      rs ? rs.map((r, idx) => (idx === i ? { ...r, selected: !r.selected } : r)) : rs,
    );
  };

  const toggleAll = (val: boolean) => {
    setRows((rs) => (rs ? rs.map((r) => ({ ...r, selected: val && r.action !== "skip" })) : rs));
  };

  const doImport = async () => {
    if (!rows) return;
    const selected = rows.filter((r) => r.selected && r.action !== "skip");
    if (selected.length === 0) {
      toast.info("No hay filas seleccionadas");
      return;
    }
    setBusy(true);
    let created = 0;
    let updated = 0;
    let failed = 0;
    for (const r of selected) {
      const payload: any = {
        name: r.name || "(sin nombre)",
        topic: r.topic || "",
        recording_status: r.recording_status,
        day_of_week: r.day_of_week,
        time_slot: r.time_slot,
        week_date: r.week_date,
        phone: r.phone,
        press_contact: r.press_contact,
      };
      if (r.action === "update" && r.existingId) {
        const { error } = await supabase.from("guests").update(payload).eq("id", r.existingId);
        if (error) failed++;
        else updated++;
      } else {
        const { error } = await supabase.from("guests").insert([payload]);
        if (error) failed++;
        else created++;
      }
    }
    setBusy(false);
    toast.success(`${created} creados, ${updated} actualizados${failed ? `, ${failed} fallidos` : ""}`);
    onImported?.();
    setOpen(false);
    reset();
  };

  const counts = rows
    ? rows.reduce(
        (acc, r) => {
          acc[r.action]++;
          if (r.selected) acc.selected++;
          return acc;
        },
        { insert: 0, update: 0, skip: 0, conflict: 0, selected: 0 },
      )
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Importar desde Excel">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar invitados desde Excel</DialogTitle>
          <DialogDescription>
            Carga un calendario .xlsx con el formato Bla Bla BLU (hoja por mes, semanas en grilla).
          </DialogDescription>
        </DialogHeader>

        {!rows && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed rounded-lg">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="max-w-sm"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}

        {rows && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{fileName}</span>
              <div className="flex items-center gap-2">
                <Label htmlFor="year">Año:</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10);
                    if (!isNaN(y) && y > 2000 && y < 2100) reparseWithYear(y);
                  }}
                  className="w-24"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <Badge className={ACTION_COLOR.insert}>{counts!.insert} crear</Badge>
                <Badge className={ACTION_COLOR.update}>{counts!.update} actualizar</Badge>
                <Badge className={ACTION_COLOR.skip}>{counts!.skip} omitir</Badge>
                <Badge className={ACTION_COLOR.conflict}>{counts!.conflict} conflicto</Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Seleccionar todo</Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Ninguno</Button>
              <span>{counts!.selected} seleccionadas</span>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 w-8"></th>
                    <th className="p-2">Hoja</th>
                    <th className="p-2">Semana</th>
                    <th className="p-2">Día</th>
                    <th className="p-2">Hora</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Tema</th>
                    <th className="p-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-muted/40">
                      <td className="p-2">
                        <Checkbox
                          checked={r.selected}
                          disabled={r.action === "skip"}
                          onCheckedChange={() => toggleRow(i)}
                        />
                      </td>
                      <td className="p-2">{r.sheet}</td>
                      <td className="p-2 font-mono">{r.week_date}</td>
                      <td className="p-2">{DAY_LABEL[r.day_of_week] || r.day_of_week}</td>
                      <td className="p-2">{r.time_slot}ª</td>
                      <td className="p-2">{r.recording_status}</td>
                      <td className="p-2 max-w-[180px] truncate" title={r.name}>{r.name || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="p-2 max-w-[260px] truncate" title={r.topic}>{r.topic}</td>
                      <td className="p-2">
                        <Badge className={ACTION_COLOR[r.action]} variant="outline">
                          {r.action}
                        </Badge>
                        {r.reason && <div className="text-[10px] text-muted-foreground mt-1">{r.reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="ghost" onClick={reset} disabled={busy}>Cargar otro</Button>
              <Button onClick={doImport} disabled={busy || counts!.selected === 0}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {counts!.selected}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
