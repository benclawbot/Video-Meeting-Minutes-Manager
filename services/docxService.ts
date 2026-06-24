import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign } from "docx";
import FileSaver from "file-saver";
import { AnalysisResult, MeetingDetails, DocxTemplateId } from "../types";
import { TEMPLATE_COLORS, TemplateColors } from "./docxColors";

const CELL_MARGINS = { top: 140, bottom: 140, left: 140, right: 140 };

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
    fonts: { body: "Georgia", heading: "Georgia", label: "Consolas" },
    borders: { style: BorderStyle.SINGLE, size: 4, color: TEMPLATE_COLORS.briefing.border },
    headerTransform: "uppercase",
    titleAlignment: "left",
    sectionHeaderBar: false,
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

const sectionLabel = (text: string, style: DocxStyle) =>
  new Paragraph({
    children: [new TextRun({ text, font: style.fonts.label, color: style.accent, size: 18, bold: true, characterSpacing: 120 })],
    spacing: { before: 320, after: 80 },
  });

const parseMarkdownToDocxElements = (text: string, style: DocxStyle) => {
  const contentOnly = text.split(/##\s*Transcription Résumée/i)[0];
  const lines = contentOnly.split("\n");
  const elements: Array<Paragraph | Table> = [];
  let i = 0;

  const tableBorder = { style: style.borders.style, size: style.borders.size, color: style.borders.color || style.border };

  const parseCells = (row: string) => {
    let r = row.trim();
    if (r.startsWith("|")) r = r.slice(1);
    if (r.endsWith("|")) r = r.slice(0, -1);
    return r.split("|").map(c => c.trim().replace(/^[\*\-]\s+/, ""));
  };

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

      rows.push(new TableRow({
        tableHeader: true,
        children: headerCells.map(cell => {
          const cellText = style.headerTransform === "uppercase"
            ? cell.toUpperCase()
            : style.headerTransform === "capitalize"
              ? cell.charAt(0).toUpperCase() + cell.slice(1)
              : cell;
          return new TableCell({
            children: [new Paragraph({
              children: renderFormattedText(cellText, style.fonts.body, style.headerText, 19, true),
              alignment: AlignmentType.LEFT,
              spacing: { before: 80, after: 80 },
            })],
            shading: { fill: style.headerBg, type: ShadingType.SOLID },
            borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
          });
        }),
      }));

      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        const cells = parseCells(lines[i]);
        if (cells.length > 0 && cells.some(c => c.trim() !== "")) {
          const rowIdx = rows.length;
          rows.push(new TableRow({
            children: cells.map(cell => new TableCell({
              children: [new Paragraph({
                children: renderFormattedText(cell, style.fonts.body, style.rowText, 20),
                alignment: AlignmentType.LEFT,
                spacing: { before: 80, after: 80 },
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

      elements.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, margins: { top: 320, bottom: 320 } }));
      continue;
    }

    if (lineTrimmed.startsWith("### ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("### ", ""), style.fonts.heading, style.subtitle, 23, true),
        spacing: { before: 200, after: 80 },
      }));
    } else if (lineTrimmed.startsWith("## ")) {
      const label = lineTrimmed.replace("## ", "");
      if (style.titleAlignment === "left") elements.push(sectionLabel(label.toUpperCase(), style));
      else elements.push(new Paragraph({
        children: renderFormattedText(label, style.fonts.heading, style.subtitle, 26, true),
        spacing: { before: 340, after: 140 },
        border: style.sectionHeaderBar ? {
          bottom: { color: style.subtitle, space: 4, style: BorderStyle.SINGLE, size: 6 },
          left: { color: style.accent, space: 4, style: BorderStyle.THICK, size: 18 },
        } : undefined,
      }));
    } else if (lineTrimmed.startsWith("# ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("# ", ""), style.fonts.heading, style.title, style.titleAlignment === "left" ? 44 : 40, true),
        spacing: { before: 100, after: 240 },
        alignment: style.titleAlignment === "left" ? AlignmentType.LEFT : AlignmentType.CENTER,
        border: style.titleAlignment === "left"
          ? { bottom: { color: style.title, space: 12, style: BorderStyle.SINGLE, size: 6 } }
          : { bottom: { color: style.title, space: 8, style: BorderStyle.THICK, size: 12 } },
      }));
    } else if (lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ")) {
      const level = Math.floor((lineRaw.match(/^\s*/)?.[0].length || 0) / 2);
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.substring(2), style.fonts.body, style.bodyText, 21, false),
        bullet: { level },
        indent: { left: 520 * (level + 1), hanging: 260 },
        spacing: { after: 90 },
      }));
    } else {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed, style.fonts.body, style.bodyText, 21, false),
        spacing: { after: 160 },
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
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
        children: parseMarkdownToDocxElements(result.minutes, style),
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
