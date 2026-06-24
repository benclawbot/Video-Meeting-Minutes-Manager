import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign } from "docx";
import FileSaver from "file-saver";
import { AnalysisResult, MeetingDetails, DocxTemplateId } from "../types";
import { TEMPLATE_COLORS, TemplateColors } from "./docxColors";

const CELL_MARGINS = { top: 80, bottom: 80, left: 100, right: 100 };

type HeaderTransform = "uppercase" | "capitalize" | "none";
type TitleAlignment = "center" | "left";

interface DocxStyle extends TemplateColors {
  fonts: { body: string; heading: string; label: string };
  borders: { style: any; size: number; color?: string };
  headerTransform: HeaderTransform;
  titleAlignment: TitleAlignment;
  sectionHeaderBar: boolean;
}

const DOCX_TEMPLATES: Record<DocxTemplateId, DocxStyle> = {
  corporate: {
    ...TEMPLATE_COLORS.corporate,
    fonts: { body: "Calibri", heading: "Calibri", label: "Consolas" },
    borders: { style: BorderStyle.SINGLE, size: 6, color: TEMPLATE_COLORS.corporate.border },
    headerTransform: "uppercase",
    titleAlignment: "center",
    sectionHeaderBar: true,
  },
  modern: {
    ...TEMPLATE_COLORS.modern,
    fonts: { body: "Segoe UI", heading: "Segoe UI", label: "Consolas" },
    borders: { style: BorderStyle.SINGLE, size: 6, color: TEMPLATE_COLORS.modern.border },
    headerTransform: "none",
    titleAlignment: "center",
    sectionHeaderBar: true,
  },
  executive: {
    ...TEMPLATE_COLORS.executive,
    fonts: { body: "Georgia", heading: "Georgia", label: "Consolas" },
    borders: { style: BorderStyle.SINGLE, size: 6, color: TEMPLATE_COLORS.executive.border },
    headerTransform: "uppercase",
    titleAlignment: "center",
    sectionHeaderBar: true,
  },
  briefing: {
    ...TEMPLATE_COLORS.briefing,
    fonts: { body: "Aptos", heading: "Georgia", label: "Aptos" },
    borders: { style: BorderStyle.SINGLE, size: 4, color: TEMPLATE_COLORS.briefing.border },
    headerTransform: "none",
    titleAlignment: "left",
    sectionHeaderBar: true,
  },
};

const renderFormattedText = (text: string, font: string, color: string, size: number, baseBold = false) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.filter(p => p !== "").map(part => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return new TextRun({ text: part.slice(2, -2), bold: true, size, color, font });
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return new TextRun({ text: part.slice(1, -1), italics: true, size, color, font });
    }
    return new TextRun({ text: part, bold: baseBold, size, color, font });
  });
};

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const parseCells = (row: string) => {
  let r = row.trim();
  if (r.startsWith("|")) r = r.slice(1);
  if (r.endsWith("|")) r = r.slice(0, -1);
  return r.split("|").map(c => c.trim().replace(/^[\*\-]\s+/, ""));
};

const getColumnWidths = (headers: string[]) => {
  const normalized = headers.map(normalize).join("|");
  if (normalized.includes("action") && (normalized.includes("responsable") || normalized.includes("owner"))) {
    return [38, 18, 15, 13, 16];
  }
  if (normalized.includes("date") && normalized.includes("participant") && normalized.includes("objectif")) {
    return [28, 34, 38];
  }
  return headers.map(() => Math.floor(100 / Math.max(headers.length, 1)));
};

const findSection = (text: string, heading: string) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`##\\s+${escaped}[\\s\\S]*?(?=\\n##\\s+|$)`, "i"));
  return match?.[0] || "";
};

const firstParagraphFromSection = (section: string) => section
  .split("\n")
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*"))[0] || "À confirmer";

const bulletsFromSection = (section: string, limit = 4) => section
  .split("\n")
  .map(line => line.trim())
  .filter(line => line.startsWith("-") || line.startsWith("*"))
  .map(line => line.replace(/^[\-*]\s+/, ""))
  .slice(0, limit);

const createKeyInfoCard = (text: string, details: MeetingDetails, style: DocxStyle) => {
  const summary = findSection(text, "Résumé exécutif") || findSection(text, "Executive summary");
  const participants = findSection(text, "Participants");
  const objective = firstParagraphFromSection(summary);
  const participantText = bulletsFromSection(participants, 5).join("\n") || "À confirmer";
  const formattedDate = details.date ? new Date(details.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "À confirmer";

  const makeCell = (label: string, value: string, width: number) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 180, bottom: 180, left: 180, right: 180 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: style.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: style.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: style.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: style.border },
    },
    shading: { fill: style.rowEvenBg, type: ShadingType.SOLID },
    children: [
      new Paragraph({
        children: [new TextRun({ text: label, font: style.fonts.body, color: style.accent, bold: true, size: 18 })],
        spacing: { after: 80 },
      }),
      ...value.split("\n").slice(0, 5).map(line => new Paragraph({
        children: [new TextRun({ text: line, font: style.fonts.body, color: style.bodyText, size: 18 })],
        spacing: { after: 35 },
      })),
    ],
  });

  return new Table({
    rows: [new TableRow({ children: [makeCell("Date", formattedDate, 24), makeCell("Participants", participantText, 36), makeCell("Objectif", objective, 40)] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 260, bottom: 300 },
  });
};

const sectionTitle = (text: string, style: DocxStyle) => new Paragraph({
  children: [new TextRun({ text, font: style.fonts.heading, color: style.subtitle, size: 28, bold: true })],
  spacing: { before: 260, after: 120 },
  border: { bottom: { color: style.border, space: 8, style: BorderStyle.SINGLE, size: 4 } },
});

const shouldSkipBriefingSection = (label: string, style: DocxStyle) => {
  if (style.titleAlignment !== "left") return false;
  return ["participants"].includes(normalize(label));
};

const parseMarkdownToDocxElements = (text: string, style: DocxStyle, details: MeetingDetails) => {
  const contentOnly = text.split(/##\s*Transcription Résumée/i)[0];
  const lines = contentOnly.split("\n");
  const elements: Array<Paragraph | Table> = [];
  let i = 0;
  let insertedKeyInfo = false;

  const tableBorder = { style: style.borders.style, size: style.borders.size, color: style.borders.color || style.border };

  while (i < lines.length) {
    const lineRaw = lines[i];
    const lineTrimmed = lineRaw.trim();
    if (!lineTrimmed) { i++; continue; }

    const hasPipes = lineTrimmed.includes("|");
    const nextLine = lines[i + 1]?.trim() || "";
    const isSeparator = nextLine.includes("|") && nextLine.includes("---");

    if (hasPipes && isSeparator) {
      const rows: TableRow[] = [];
      const headerCells = parseCells(lineTrimmed);
      const widths = getColumnWidths(headerCells);

      rows.push(new TableRow({
        tableHeader: true,
        children: headerCells.map((cell, idx) => new TableCell({
          width: { size: widths[idx] || 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: renderFormattedText(style.headerTransform === "uppercase" ? cell.toUpperCase() : cell, style.fonts.body, style.headerText, 16, true),
            alignment: AlignmentType.LEFT,
            spacing: { before: 40, after: 40 },
          })],
          shading: { fill: style.headerBg, type: ShadingType.SOLID },
          borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
          margins: CELL_MARGINS,
          verticalAlign: VerticalAlign.CENTER,
        })),
      }));

      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        const cells = parseCells(lines[i]);
        if (cells.length > 0 && cells.some(c => c.trim() !== "")) {
          const rowIdx = rows.length;
          rows.push(new TableRow({
            children: cells.map((cell, idx) => new TableCell({
              width: { size: widths[idx] || 20, type: WidthType.PERCENTAGE },
              children: [new Paragraph({
                children: renderFormattedText(cell, style.fonts.body, style.rowText, 16),
                alignment: AlignmentType.LEFT,
                spacing: { before: 35, after: 35 },
              })],
              shading: { fill: rowIdx % 2 === 0 ? style.rowEvenBg : style.pageBg, type: ShadingType.SOLID },
              borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
              margins: CELL_MARGINS,
              verticalAlign: VerticalAlign.TOP,
            })),
          }));
        }
        i++;
      }

      elements.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, margins: { top: 240, bottom: 300 } }));
      continue;
    }

    if (lineTrimmed.startsWith("### ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("### ", ""), style.fonts.body, style.bodyText, 20, true),
        spacing: { before: 120, after: 50 },
      }));
    } else if (lineTrimmed.startsWith("## ")) {
      const label = lineTrimmed.replace("## ", "");
      if (shouldSkipBriefingSection(label, style)) {
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("## ")) i++;
        continue;
      }
      elements.push(style.titleAlignment === "left" ? sectionTitle(label, style) : new Paragraph({
        children: renderFormattedText(label, style.fonts.heading, style.subtitle, 26, true),
        spacing: { before: 340, after: 140 },
        border: style.sectionHeaderBar ? {
          bottom: { color: style.subtitle, space: 4, style: BorderStyle.SINGLE, size: 6 },
          left: { color: style.accent, space: 4, style: BorderStyle.THICK, size: 18 },
        } : undefined,
      }));
    } else if (lineTrimmed.startsWith("# ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("# ", ""), style.fonts.heading, style.title, style.titleAlignment === "left" ? 46 : 40, true),
        spacing: { before: 80, after: 180 },
        alignment: style.titleAlignment === "left" ? AlignmentType.LEFT : AlignmentType.CENTER,
      }));
      if (style.titleAlignment === "left" && !insertedKeyInfo) {
        elements.push(createKeyInfoCard(contentOnly, details, style));
        insertedKeyInfo = true;
      }
    } else if (lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ")) {
      const level = Math.floor((lineRaw.match(/^\s*/)?.[0].length || 0) / 2);
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.substring(2), style.fonts.body, style.bodyText, 19, false),
        bullet: { level },
        indent: { left: 420 * (level + 1), hanging: 220 },
        spacing: { after: 55 },
      }));
    } else {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed, style.fonts.body, style.bodyText, 19, false),
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }
    i++;
  }

  return elements;
};

export const generateAndDownloadDocx = async (
  result: AnalysisResult,
  details: MeetingDetails,
  templateId: DocxTemplateId = "briefing"
) => {
  const [year, month, day] = details.date.split("-");
  const formattedDate = `${day}-${month}-${year}`;
  const safeTitle = details.title.replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${safeTitle} - ${formattedDate}.docx`;
  const style = DOCX_TEMPLATES[templateId] || DOCX_TEMPLATES.briefing;

  try {
    const doc = new Document({
      background: { color: style.pageBg },
      sections: [{
        properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } },
        children: parseMarkdownToDocxElements(result.minutes, style, details),
      }],
    });
    const blob = await Packer.toBlob(doc);
    FileSaver.saveAs(blob, filename);
    return true;
  } catch (error) {
    console.error("DOCX Export Error:", error);
    return false;
  }
};
