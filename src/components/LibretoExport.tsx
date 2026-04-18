import React from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { Guest } from "@/types/guest";
import { toast } from "sonner";

interface LibretoExportProps {
  guests: Guest[];
  selectedDay: string;
  selectedDayDate?: string;
}

const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

const DAYS_ES: Record<string, string> = {
  monday: "LUNES",
  tuesday: "MARTES",
  wednesday: "MIÉRCOLES",
  thursday: "JUEVES",
};

const v = (val: string | null | undefined): string => val?.trim() || "[PENDIENTE]";

const getSocial = (guest: Guest | undefined, platform: string): string => {
  if (!guest?.social_networks) return "[PENDIENTE]";
  const sn = guest.social_networks as Record<string, string>;
  return sn[platform] || sn[platform.toLowerCase()] || "[PENDIENTE]";
};

const textRun = (text: string, opts?: { bold?: boolean; italics?: boolean; highlight?: boolean; size?: number }) =>
  new TextRun({
    text,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? 24,
    font: "Arial",
    ...(opts?.highlight ? { highlight: "yellow" } : {}),
  });

const emptyLine = () => new Paragraph({ children: [textRun("")] });

const heading = (text: string) =>
  new Paragraph({
    children: [textRun(text, { bold: true, size: 28 })],
    spacing: { before: 240, after: 120 },
  });

const bulletParagraph = (text: string) =>
  new Paragraph({
    children: [textRun(`• ${text}`)],
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
  });

const buildDateInfo = (dateStr?: string) => {
  if (!dateStr) return { dia: "[DIA]", mes: "[MES]", anio: "[AÑO]" };
  const d = new Date(dateStr + "T12:00:00");
  return {
    dia: String(d.getDate()),
    mes: MONTHS_ES[d.getMonth()],
    anio: String(d.getFullYear()),
  };
};

const buildTuesdayDoc = (h1: Guest | undefined, h2: Guest | undefined, h3: Guest | undefined, dateInfo: { dia: string; mes: string; anio: string }): Paragraph[] => {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(new Paragraph({
    children: [textRun(`MARTES ${dateInfo.dia} DE ${dateInfo.mes} DE ${dateInfo.anio}`, { bold: true, size: 32 })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 240 },
  }));

  // === PRIMERA HORA ===
  paragraphs.push(heading("1. PRIMERA HORA, EN VIVO:"));
  paragraphs.push(new Paragraph({
    children: [
      textRun("Programa con: ", {}),
      textRun(v(h1?.name), { bold: true }),
      textRun(` – `, {}),
      textRun(v(h1?.position), { bold: true }),
    ],
  }));
  paragraphs.push(new Paragraph({ children: [textRun("En la casa: Mauricio Quintero.")] }));
  paragraphs.push(emptyLine());

  // Social
  paragraphs.push(new Paragraph({
    children: [
      textRun("TW: ", {}),
      textRun(getSocial(h1, "twitter"), { bold: true }),
    ],
  }));
  paragraphs.push(new Paragraph({
    children: [
      textRun("IG: ", {}),
      textRun(getSocial(h1, "instagram"), { bold: true }),
    ],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [
      textRun("CONTENIDO: ", { bold: true }),
      textRun("Recorrido por sus inicios, su infancia, sus logros y sus futuros proyectos."),
    ],
  }));
  paragraphs.push(emptyLine());

  // Segments
  paragraphs.push(new Paragraph({
    children: [textRun("1. Canción.", {}), textRun(" " + v(h1?.h1_canciones), { italics: true })],
  }));

  paragraphs.push(new Paragraph({
    children: [textRun("2. Primer segmento: ", {}), textRun("Bienvenida.", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.tema_principal)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Infancia y vida personal", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.infancia_vida_privada)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("4. Canción.")],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("5. Segundo segmento: ", {}), textRun("Carrera", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.carrera_profesional)));
  paragraphs.push(emptyLine());

  // Avance segunda hora + Encuesta
  paragraphs.push(new Paragraph({
    children: [textRun("6. Avance segunda hora. ", {}), textRun("Pregunta para el invitado que nos recuerde el tema de la segunda hora. A propósito del tema de esta noche, cuéntenos:")],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun(v(h1?.encuesta_pregunta), { highlight: true })],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("Sí / No")],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("HT: ", { bold: true }), textRun(`Sus opiniones con el: ${v(h1?.encuesta_hashtag) || "#PuertaAlUniversoBlaBlaBLU"}`)],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("7. Canción.")] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("8. Tercer segmento: ", {}), textRun("Datos curiosos", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.datos_curiosos)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("9. Cuarto segmento: ", {}), textRun("Proyectos 2026 y despedida.", { bold: true })],
  }));
  paragraphs.push(new Paragraph({ children: [textRun("10. Canción.")] }));
  paragraphs.push(emptyLine());

  if (h1?.h1_canciones) {
    paragraphs.push(new Paragraph({ children: [textRun("Canciones en stock:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h1.h1_canciones)] }));
    paragraphs.push(emptyLine());
  }

  // === SEGUNDA HORA ===
  paragraphs.push(heading("2. SEGUNDA HORA, EN VIVO:"));
  paragraphs.push(new Paragraph({ children: [textRun("En la casa: ", { bold: true }), textRun("Mauricio Quintero.")] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Tema: ", { bold: true }), textRun(v(h2?.topic))],
  }));

  paragraphs.push(new Paragraph({
    children: [textRun("Contexto: ", { bold: true }), textRun("Bienvenidos a la segunda hora de BBB.")],
  }));
  paragraphs.push(emptyLine());

  // Puerta al Universo intro
  paragraphs.push(new Paragraph({
    children: [textRun("Todas las noches de los martes, de aquí hasta que el tiempo y el espacio nos lo permitan, se abre una nueva puerta en Bla, Bla, BLU.")],
  }));
  paragraphs.push(emptyLine());
  paragraphs.push(new Paragraph({
    children: [textRun("Invitamos a todos los navegantes de Bla, Bla, BLU para que pasen a bordo, se abrochen sus cinturones porque vamos a iniciar un hermoso viaje hacia el espacio.")],
  }));
  paragraphs.push(emptyLine());
  paragraphs.push(new Paragraph({
    children: [textRun("En BBB tenemos el placer de presentarles: Puerta al universo con nuestro astrónomo Germán Puerta.")],
  }));
  paragraphs.push(emptyLine());

  // H2 Guest info
  paragraphs.push(new Paragraph({
    children: [textRun("Invitado: ", { bold: true }), textRun(v(h2?.name))],
  }));
  if (h2?.h2_info_personal) {
    paragraphs.push(new Paragraph({ children: [textRun(h2.h2_info_personal)] }));
  }
  paragraphs.push(emptyLine());

  // H2 social
  paragraphs.push(new Paragraph({
    children: [textRun("X: "), textRun(getSocial(h2, "twitter"))],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("IG: "), textRun(getSocial(h2, "instagram"))],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Responsable: ", { bold: true }), textRun("Mauricio Quintero")],
  }));
  paragraphs.push(emptyLine());

  // Encuesta repeat
  paragraphs.push(new Paragraph({
    children: [textRun(v(h1?.encuesta_pregunta), { highlight: true })],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("Sí / No")],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("HT: ", { bold: true }), textRun(`Sus opiniones con el: ${v(h1?.encuesta_hashtag) || "#PuertaAlUniversoBlaBlaBLU"}`)],
  }));
  paragraphs.push(emptyLine());

  // H2 segments
  paragraphs.push(new Paragraph({ children: [textRun("1. Cortinilla Una puerta al universo")] }));
  paragraphs.push(new Paragraph({ children: [textRun("2. Avance de lo que hablaremos en esta segunda hora")] }));
  paragraphs.push(new Paragraph({
    children: [textRun("3. Primer segmento. "), textRun(v(h2?.topic))],
  }));
  paragraphs.push(emptyLine());

  if (h2?.h2_preguntas_sugeridas) {
    paragraphs.push(new Paragraph({
      children: [textRun("PREGUNTAS SUGERIDAS SEGÚN EL TEMA A TRATAR", { bold: true })],
    }));
    paragraphs.push(new Paragraph({ children: [textRun(h2.h2_preguntas_sugeridas)] }));
    paragraphs.push(emptyLine());
  }

  // Avance tercera hora
  paragraphs.push(new Paragraph({
    children: [
      textRun("Mauricio", { bold: true }),
      textRun(` – Vamos a tener una actualización de las noticias más importantes de Colombia y el mundo en Voces y sonidos, y al regreso, ${h3 ? `les tengo a ${v(h3.name)} quien nos estará hablando de ${v(h3.topic)}` : '[PENDIENTE]'}, en minutos, aquí, en BBB.`),
    ],
  }));
  paragraphs.push(emptyLine());

  if (h2?.h2_canciones) {
    paragraphs.push(new Paragraph({ children: [textRun("Canciones en stock:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h2.h2_canciones)] }));
    paragraphs.push(emptyLine());
  }

  // === TERCERA HORA ===
  paragraphs.push(heading("3. TERCERA HORA:"));
  paragraphs.push(new Paragraph({ children: [textRun("En la casa: Mauricio Quintero.", { bold: true })] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("1. Canción.")] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Invitado: ", { bold: true }), textRun(v(h3?.name))],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("Tema: ", { bold: true }), textRun(v(h3?.topic))],
  }));
  paragraphs.push(emptyLine());

  if (h3?.h3_datos_personales) {
    paragraphs.push(new Paragraph({
      children: [textRun("Info: ", { bold: true }), textRun(h3.h3_datos_personales)],
    }));
    paragraphs.push(emptyLine());
  }

  if (h3?.h3_comunicado_prensa) {
    paragraphs.push(new Paragraph({
      children: [textRun(h3.h3_comunicado_prensa)],
    }));
    paragraphs.push(emptyLine());
  }

  if (h3?.h3_canciones) {
    paragraphs.push(new Paragraph({ children: [textRun("Canciones en stock:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h3.h3_canciones)] }));
  }

  return paragraphs;
};

const buildThursdayDoc = (h1: Guest | undefined, h2: Guest | undefined, h3: Guest | undefined, dateInfo: { dia: string; mes: string; anio: string }, dayLabel: string = "JUEVES", isThursdayTBT: boolean = true): Paragraph[] => {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(new Paragraph({
    children: [textRun(`${dayLabel} ${dateInfo.dia} DE ${dateInfo.mes} DE ${dateInfo.anio}`, { bold: true, size: 32 })],
    spacing: { after: 240 },
  }));

  // === PRIMERA HORA ===
  paragraphs.push(heading("1. PRIMERA HORA, EN VIVO:"));
  paragraphs.push(new Paragraph({
    children: [
      textRun("Programa con: "),
      textRun(v(h1?.name), { bold: true }),
      textRun(" – "),
      textRun(v(h1?.position), { bold: true }),
    ],
  }));
  paragraphs.push(new Paragraph({ children: [textRun("En la casa: Mauricio Quintero.")] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("TW: "), textRun(getSocial(h1, "twitter"), { bold: true })],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("IG: "), textRun(getSocial(h1, "instagram"), { bold: true })],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("CONTENIDO: ", { bold: true }), textRun("Recorrido por sus inicios, su infancia, sus logros y sus futuros proyectos.")],
  }));
  paragraphs.push(emptyLine());

  // Clips de comediante (Thursday)
  paragraphs.push(new Paragraph({ children: [textRun("1. Clip 1 COMEDIANTE")] }));
  paragraphs.push(new Paragraph({
    children: [textRun("2. Primer segmento: "), textRun("Bienvenida", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.tema_principal)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("Infancia y vida personal", { bold: true })] }));
  paragraphs.push(bulletParagraph(v(h1?.infancia_vida_privada)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("3. Clip 2 COMEDIANTE")] }));
  paragraphs.push(new Paragraph({
    children: [textRun("4. Segundo segmento: "), textRun("Carrera", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.carrera_profesional)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("5. Clip 3 COMEDIANTE")] }));

  // Avance + Encuesta
  paragraphs.push(new Paragraph({
    children: [textRun("6. Avance segunda hora. "), textRun("Pregunta para el invitado, tema de la segunda hora.")],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("A propósito del tema de esta noche, cuéntenos: "), textRun(v(h1?.encuesta_pregunta), { highlight: true })],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("Sí / No")],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun(`Sus opiniones con el: ${v(h1?.encuesta_hashtag) || "#tbtBlaBlaBLU"}`)],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("7. Tercer segmento: "), textRun("Datos curiosos", { bold: true })],
  }));
  paragraphs.push(bulletParagraph(v(h1?.datos_curiosos)));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("8. Clip 4 COMEDIANTE")] }));
  paragraphs.push(new Paragraph({
    children: [textRun("9. Tercer segmento: "), textRun("Proyectos 2026 y despedida", { bold: true })],
  }));
  paragraphs.push(emptyLine());

  if (h1?.h1_canciones) {
    paragraphs.push(new Paragraph({ children: [textRun("Clips de comediante:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h1.h1_canciones)] }));
    paragraphs.push(emptyLine());
  }

  // === SEGUNDA HORA (TBT) ===
  paragraphs.push(heading("2. SEGUNDA HORA, EN VIVO:"));
  paragraphs.push(new Paragraph({ children: [textRun("En la casa: Mauricio Quintero.")] }));
  paragraphs.push(new Paragraph({
    children: [textRun("Tema: ", { bold: true }), textRun(isThursdayTBT ? "#tbt" : v(h2?.topic))],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Contexto: ", { bold: true }), textRun(v(h2?.h2_contexto))],
  }));
  paragraphs.push(emptyLine());

  if (isThursdayTBT) {
    paragraphs.push(new Paragraph({
      children: [textRun("Jueves de TBT, jueves para recordar, hablaremos sobre " + v(h2?.topic))],
    }));
    paragraphs.push(emptyLine());
  }

  paragraphs.push(new Paragraph({
    children: [textRun("Invitado: ", { bold: true }), textRun(v(h2?.name) + (h2?.position ? ` – ${h2.position}` : ""))],
  }));

  paragraphs.push(new Paragraph({
    children: [textRun("TW: "), textRun(getSocial(h2, "twitter"))],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("IG: "), textRun(getSocial(h2, "instagram"))],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Responsable: ", { bold: true }), textRun("Mauricio Quintero")],
  }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("HT: ", { bold: true }), textRun(`Sus opiniones con el: ${v(h1?.encuesta_hashtag) || "#tbtBlaBlaBLU"}`)],
  }));
  paragraphs.push(emptyLine());

  if (h2?.h2_info_personal) {
    paragraphs.push(new Paragraph({ children: [textRun(h2.h2_info_personal)] }));
    paragraphs.push(emptyLine());
  }

  if (h2?.h2_preguntas_sugeridas) {
    paragraphs.push(new Paragraph({ children: [textRun("PREGUNTAS SUGERIDAS:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h2.h2_preguntas_sugeridas)] }));
    paragraphs.push(emptyLine());
  }

  // H2 segments with canciones
  const segmentos = ["1. Canción.", "2. Avance", "3. Primer segmento.", "4. Canción.", "5. Segundo segmento.", "6. Canción.", "7. Tercer segmento.", "8. Canción.", "9. Cuarto segmento.", "10. Canción."];
  segmentos.forEach(s => {
    paragraphs.push(new Paragraph({ children: [textRun(s)] }));
  });
  paragraphs.push(emptyLine());

  if (h2?.h2_canciones) {
    paragraphs.push(new Paragraph({ children: [textRun("Canciones en stock:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h2.h2_canciones)] }));
    paragraphs.push(emptyLine());
  }

  // Avance tercera hora
  paragraphs.push(new Paragraph({
    children: [
      textRun("Mauricio", { bold: true }),
      textRun(` – Vamos a tener una actualización de las noticias más importantes de Colombia y el mundo en Voces y sonidos, y al regreso, ${h3 ? `les tengo a ${v(h3.name)} quien nos estará hablando de ${v(h3.topic)}` : '[PENDIENTE]'}, en minutos, aquí, en BBB.`),
    ],
  }));
  paragraphs.push(emptyLine());

  // === TERCERA HORA ===
  paragraphs.push(heading("3. TERCERA HORA:"));
  paragraphs.push(new Paragraph({ children: [textRun("En la casa: Mauricio Quintero.", { bold: true })] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({ children: [textRun("1. Canción.")] }));
  paragraphs.push(emptyLine());

  paragraphs.push(new Paragraph({
    children: [textRun("Invitado: ", { bold: true }), textRun(v(h3?.name))],
  }));
  paragraphs.push(new Paragraph({
    children: [textRun("Tema: ", { bold: true }), textRun(v(h3?.topic))],
  }));
  paragraphs.push(emptyLine());

  if (h3?.h3_datos_personales) {
    paragraphs.push(new Paragraph({
      children: [textRun("Info: ", { bold: true }), textRun(h3.h3_datos_personales)],
    }));
    paragraphs.push(emptyLine());
  }

  if (h3?.h3_comunicado_prensa) {
    paragraphs.push(new Paragraph({ children: [textRun(h3.h3_comunicado_prensa)] }));
    paragraphs.push(emptyLine());
  }

  if (h3?.h3_canciones) {
    paragraphs.push(new Paragraph({ children: [textRun("Canciones en stock:", { bold: true })] }));
    paragraphs.push(new Paragraph({ children: [textRun(h3.h3_canciones)] }));
  }

  return paragraphs;
};

// Export build functions for reuse in LibretoView
export { buildTuesdayDoc, buildThursdayDoc, buildDateInfo, DAYS_ES as DAYS_ES_EXPORT };

export const generateLibretoBlob = async (guests: Guest[], selectedDay: string, selectedDayDate?: string): Promise<{ blob: Blob; fileName: string } | null> => {
  const h1 = guests.find(g => g.day_of_week === selectedDay && g.time_slot === 1);
  const h2 = guests.find(g => g.day_of_week === selectedDay && g.time_slot === 2);
  const h3 = guests.find(g => g.day_of_week === selectedDay && g.time_slot === 3);

  if (!h1 && !h2 && !h3) return null;

  const dateInfo = buildDateInfo(selectedDayDate);
  const dayLabel = DAYS_ES[selectedDay];

  const paragraphs = selectedDay === "tuesday"
    ? buildTuesdayDoc(h1, h2, h3, dateInfo)
    : buildThursdayDoc(h1, h2, h3, dateInfo, dayLabel, selectedDay === "thursday");

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 24 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${dayLabel}_${dateInfo.dia}_DE_${dateInfo.mes}_DE_${dateInfo.anio}.docx`;
  return { blob, fileName };
};

export const LibretoExport: React.FC<LibretoExportProps> = ({ guests, selectedDay, selectedDayDate }) => {
  const validDays = ["monday", "tuesday", "wednesday", "thursday"];
  if (!validDays.includes(selectedDay)) return null;

  const handleExport = async () => {
    try {
      const result = await generateLibretoBlob(guests, selectedDay, selectedDayDate);
      if (!result) {
        toast.error("No hay invitados programados para exportar");
        return;
      }
      saveAs(result.blob, result.fileName);
      toast.success("Libreto exportado correctamente");
    } catch (error) {
      console.error("Error exporting libreto:", error);
      toast.error("Error al exportar el libreto");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-2"
    >
      <FileDown className="w-4 h-4" />
      Exportar Libreto
    </Button>
  );
};
