import * as XLSX from "xlsx";
import { format, startOfWeek, addDays } from "date-fns";
import type { Guest } from "@/types/guest";

// Sheet-name → month index (0-based). Accepts ENERO, ENE, etc.
const MONTHS: Record<string, number> = {
  ENERO: 0, ENE: 0,
  FEBRERO: 1, FEB: 1,
  MARZO: 2, MAR: 2,
  ABRIL: 3, ABR: 3,
  MAYO: 4, MAY: 4,
  JUNIO: 5, JUN: 5,
  JULIO: 6, JUL: 6,
  AGOSTO: 7, AGO: 7,
  SEPTIEMBRE: 8, SEPT: 8, SEP: 8,
  OCTUBRE: 9, OCT: 9,
  NOVIEMBRE: 10, NOV: 10,
  DICIEMBRE: 11, DIC: 11,
};

const DAY_COLS: Array<{ idx: number; day: Guest["day_of_week"] }> = [
  { idx: 2, day: "monday" as any },
  { idx: 3, day: "tuesday" as any },
  { idx: 4, day: "wednesday" as any },
  { idx: 5, day: "thursday" as any },
];

const SKIP_TEXTS = [
  "NO HAY PROGRAMA",
  "NO HAY GRABACIÓN",
  "NO HAY GRABACION",
];

export type ImportAction = "insert" | "update" | "skip" | "conflict";

export interface ParsedRow {
  sheet: string;
  week_date: string; // yyyy-MM-dd (Mon)
  day_of_week: string; // monday..thursday
  time_slot: 1 | 2 | 3;
  recording_status: Guest["recording_status"];
  name: string;
  topic: string;
  phone: string | null;
  press_contact: string | null;
  raw: string;
}

export interface PreviewRow extends ParsedRow {
  action: ImportAction;
  reason?: string;
  existingId?: string;
  selected: boolean;
}

function sheetMonthIndex(sheet: string): number | null {
  const k = sheet.trim().toUpperCase().replace(/\s+\d{4}$/, "");
  return k in MONTHS ? MONTHS[k] : null;
}

function parsePhone(text: string): string | null {
  const m = text.match(/\+?57[\s-]?\d{3}[\s-]?\d{6,7}|\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/);
  return m ? m[0].trim() : null;
}

function parsePress(text: string): string | null {
  // text in parens containing "Prensa" or "PR" or "Jefe"
  const m = text.match(/\(([^)]*(?:Prensa|prensa|PR|Jefe|jefe|Manager|manager)[^)]*)\)/);
  if (m) return m[1].trim();
  return null;
}

function parseCell(raw: string): { name: string; topic: string; phone: string | null; press: string | null } {
  const txt = raw.replace(/\r/g, "").trim();
  let name = "";
  let topic = "";

  const invMatch = txt.match(/Invitad[oa]s?:\s*([^\n]+(?:\n(?![A-ZÁÉÍÓÚ]\w+:)[^\n]+)*)/i);
  const temaMatch = txt.match(/Tema:\s*([^\n]+(?:\n(?![A-ZÁÉÍÓÚ]\w+:)[^\n]+)*)/i);
  const contactoMatch = txt.match(/Contacto:?\s*([^\n]+(?:\n(?![A-ZÁÉÍÓÚ]\w+:)[^\n]+)*)/i);

  if (invMatch) name = invMatch[1].trim().replace(/\s+/g, " ");
  if (temaMatch) topic = temaMatch[1].trim().replace(/\s+/g, " ");

  if (!name && !temaMatch) {
    // Free-form: use first line as topic-ish, leave name empty
    topic = txt;
  } else if (!topic) {
    // Use whole text minus invitado line
    topic = txt.replace(invMatch?.[0] || "", "").trim();
  }

  const phoneSource = contactoMatch?.[1] || txt;
  const phone = parsePhone(phoneSource);
  const press = parsePress(phoneSource) || parsePress(txt);

  return { name, topic, phone, press };
}

function detectStatus(label: string, slotNum: 1 | 2 | 3): Guest["recording_status"] {
  const L = label.toUpperCase();
  if (L.includes("GRABA") && !L.includes("GRABADO")) return "to_record";
  if (slotNum === 3) return "recorded";
  return "live";
}

interface WeekHeader {
  rowIdx: number;
  days: Record<string, number>; // day_of_week → day-of-month number
}

function parseHeader(row: any[]): WeekHeader["days"] | null {
  const days: Record<string, number> = {};
  let found = 0;
  for (const { idx, day } of DAY_COLS) {
    const v = row[idx];
    if (typeof v === "string") {
      const m = v.match(/(\d{1,2})/);
      if (m) {
        days[day as string] = parseInt(m[1], 10);
        found++;
      }
    }
  }
  return found >= 2 ? days : null;
}

function getSlotNumber(label: string): 1 | 2 | 3 | null {
  const L = label.toLowerCase();
  if (L.includes("1ra hora") || L.includes("1ª hora") || L.includes("primera hora")) return 1;
  if (L.includes("2da hora") || L.includes("2ª hora") || L.includes("segunda hora")) return 2;
  if (L.includes("3ra hora") || L.includes("3ª hora") || L.includes("tercera hora")) return 3;
  return null;
}

export async function parseWorkbook(file: File, year: number): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: ParsedRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const monthIdx = sheetMonthIndex(sheetName);
    if (monthIdx === null) continue;
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

    let currentDays: Record<string, number> | null = null;
    let currentWeekDate: string | null = null;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const days = parseHeader(row);
      if (days) {
        currentDays = days;
        // week_date: Monday's date. Use the Monday column if present, else infer.
        let monDay = days["monday"];
        if (!monDay) {
          // pick any known day, compute Monday
          const entries = Object.entries(days);
          if (entries.length) {
            const dayMap: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4 };
            const [dn, dnum] = entries[0];
            // build a date for that day and find Monday
            const probe = new Date(year, monthIdx, dnum);
            // adjust if header day-of-week doesn't match (cross-month edge); trust label
            const targetDow = dayMap[dn];
            const probeDow = probe.getDay() === 0 ? 7 : probe.getDay();
            // shift to Monday
            const diffToMon = 1 - probeDow + (probeDow > 4 ? 7 : 0);
            // Simpler: just compute Monday using startOfWeek of probe, but cross-month days may shift
            const mon = startOfWeek(probe, { weekStartsOn: 1 });
            // Validate the labeled day matches by reconstructing
            const reconstructed = addDays(mon, targetDow - 1);
            if (reconstructed.getDate() === dnum) {
              currentWeekDate = format(mon, "yyyy-MM-dd");
            } else {
              // fallback: just use probe Monday
              currentWeekDate = format(mon, "yyyy-MM-dd");
            }
          }
        } else {
          // Monday is in this month
          const probe = new Date(year, monthIdx, monDay);
          // Handle cross-month: Monday's day-number might be from previous month if > 25 and header is start of month
          // The headers like "LUNES 29" within "MARZO" sheet referring to FEB 29 — but headers we saw were "LUNES 29" with first thursday being "JUEVES 1" → that means Monday is in previous month.
          // Detect: if subsequent thursday's day number is small (e.g., 1-4), Monday is in previous month.
          const thuDay = days["thursday"];
          if (thuDay && thuDay < monDay) {
            // Monday in previous month
            const prevMonthDate = new Date(year, monthIdx - 1, monDay);
            currentWeekDate = format(prevMonthDate, "yyyy-MM-dd");
          } else {
            currentWeekDate = format(probe, "yyyy-MM-dd");
          }
        }
        continue;
      }

      if (!currentDays || !currentWeekDate) continue;

      // Look for a slot label row (col B/C contain "1ra hora" etc.)
      const labelCellB = (row[1] || "").toString();
      // The slot label is usually in cols C..F (idx 2..5) duplicated, like "1ra hora lunes"
      // We use the existence of "Xra hora" tokens in any day col
      const slotLabels: number[] = [];
      for (const { idx } of DAY_COLS) {
        const v = (row[idx] || "").toString();
        const sn = getSlotNumber(v);
        if (sn) slotLabels.push(sn);
      }
      const slotFromB = getSlotNumber(labelCellB);
      let slot = slotLabels[0] || slotFromB;
      if (!slot) continue;

      // Data row is the next row
      const dataRow = rows[r + 1] || [];
      const tag = labelCellB.toUpperCase();

      for (const { idx, day } of DAY_COLS) {
        const cell = dataRow[idx];
        if (!cell) continue;
        const raw = cell.toString().trim();
        if (!raw) continue;
        if (SKIP_TEXTS.some((s) => raw.toUpperCase().includes(s))) continue;

        const status = detectStatus(tag, slot as 1 | 2 | 3);
        const parsed = parseCell(raw);
        const rec: ParsedRow = {
          sheet: sheetName,
          week_date: currentWeekDate,
          day_of_week: day as any,
          time_slot: slot as 1 | 2 | 3,
          recording_status: parsed.name ? status : "proposed",
          name: parsed.name,
          topic: parsed.topic,
          phone: parsed.phone,
          press_contact: parsed.press,
          raw,
        };
        out.push(rec);
      }

      r++; // skip the data row we just consumed
    }
  }

  return out;
}

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function mergeWithExisting(rows: ParsedRow[], existing: Guest[]): PreviewRow[] {
  return rows.map((r) => {
    const sameSlot = existing.find(
      (g) =>
        g.week_date === r.week_date &&
        g.day_of_week === r.day_of_week &&
        g.time_slot === r.time_slot,
    );
    if (!sameSlot) {
      return { ...r, action: "insert", selected: true };
    }
    const sameName = normalize(sameSlot.name) === normalize(r.name);
    if (sameName) {
      return { ...r, action: "skip", reason: "Ya existe (mismo nombre)", existingId: sameSlot.id, selected: false };
    }
    if (sameSlot.recording_status === "proposed") {
      return { ...r, action: "update", reason: "Sobrescribe pendiente", existingId: sameSlot.id, selected: true };
    }
    return {
      ...r,
      action: "conflict",
      reason: `Slot ocupado por ${sameSlot.name}`,
      existingId: sameSlot.id,
      selected: false,
    };
  });
}

export function inferYearFromFilename(name: string): number {
  const m = name.match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}
