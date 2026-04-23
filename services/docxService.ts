import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign } from "docx";
import FileSaver from "file-saver";
import { AnalysisResult, MeetingDetails, DocxTemplateId } from "../types";
import { TEMPLATE_COLORS, TemplateColors } from "./docxColors";

const CELL_MARGINS = { top: 140, bottom: 140, left: 140, right: 140 };

interface DocxStyle extends TemplateColors {
  fonts: { body: string; heading: string };
  borders: { style: any; size: number; color?: string };
  headerTransform: "uppercase" | "capitalize" | "none";
  listBulletFont: boolean;
  sectionHeaderBar: boolean;
}

const DOCX_TEMPLATES: Record<DocxTemplateId, DocxStyle> = {
  corporate: {
    ...TEMPLATE_COLORS.corporate,
    fonts: { body: "Calibri", heading: "Calibri" },
    borders: { style: BorderStyle.SINGLE, size: 6, color: "1e3a8a" },
    headerTransform: "uppercase",
    listBulletFont: true,
    sectionHeaderBar: true,
  },
  modern: {
    ...TEMPLATE_COLORS.modern,
    fonts: { body: "Segoe UI", heading: "Segoe UI" },
    borders: { style: BorderStyle.SINGLE, size: 6, color: "059669" },
    headerTransform: "none",
    listBulletFont: false,
    sectionHeaderBar: true,
  },
  executive: {
    ...TEMPLATE_COLORS.executive,
    fonts: { body: "Georgia", heading: "Georgia" },
    borders: { style: BorderStyle.SINGLE, size: 6, color: "7c2d12" },
    headerTransform: "uppercase",
    listBulletFont: false,
    sectionHeaderBar: true,
  },
};

// ─── Text Renderer ───────────────────────────────────────────────────────────

const renderFormattedText = (text: string, font: string, color: string, size: number, baseBold = false) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.filter(p => p !== "").map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return new TextRun({ text: part.slice(2, -2), bold: true, size, color, font });
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return new TextRun({ text: part.slice(1, -1), italics: true, size, color, font });
    }
    return new TextRun({ text: part, bold: baseBold, size, color, font });
  });
};

// ─── Parser ───────────────────────────────────────────────────────────────────

const parseMarkdownToDocxElements = (text: string, style: DocxStyle) => {
  const contentOnly = text.split(/##\s*Transcription Résumée/i)[0];
  const lines = contentOnly.split("\n");
  const elements: ReturnType<typeof Paragraph>[] = [];
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
      const rows: ReturnType<typeof TableRow>[] = [];
      const headerCells = parseCells(lineTrimmed);

      rows.push(new TableRow({
        tableHeader: true,
        children: headerCells.map(cell => {
          let cellText = cell;
          if (style.headerTransform === "uppercase") cellText = cellText.toUpperCase();
          if (style.headerTransform === "capitalize") cellText = cellText.charAt(0).toUpperCase() + cellText.slice(1);
          return new TableCell({
            children: [new Paragraph({
              children: renderFormattedText(cellText, style.fonts.body, style.headerText, 20, true),
              alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 },
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
                children: renderFormattedText(cell, style.fonts.body, style.rowText, 22),
                alignment: AlignmentType.LEFT, spacing: { before: 100, after: 100 },
              })],
              shading: rowIdx % 2 === 0 ? { fill: style.rowEvenBg, type: ShadingType.SOLID } : undefined,
              borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder },
              margins: CELL_MARGINS,
              verticalAlign: VerticalAlign.TOP,
            })),
          }));
        }
        i++;
      }

      elements.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, margins: { top: 400, bottom: 400 } }));
      continue;
    }

    if (lineTrimmed.startsWith("### ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("### ", ""), style.fonts.heading, style.subtitle, 24, true),
        spacing: { before: 240, after: 120 },
      }));
    } else if (lineTrimmed.startsWith("## ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("## ", ""), style.fonts.heading, style.subtitle, 26, true),
        spacing: { before: 360, after: 160 },
        border: {
          bottom: { color: style.subtitle, space: 4, style: BorderStyle.SINGLE, size: 6 },
          left: { color: style.accent, space: 4, style: BorderStyle.THICK, size: 18 },
        },
      }));
    } else if (lineTrimmed.startsWith("# ")) {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.replace("# ", ""), style.fonts.heading, style.title, 40, true),
        spacing: { before: 200, after: 200 },
        alignment: AlignmentType.CENTER,
        border: { bottom: { color: style.title, space: 8, style: BorderStyle.THICK, size: 12 } },
      }));
    } else if (lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ")) {
      const level = Math.floor((lineRaw.match(/^\s*/)?.[0].length || 0) / 2);
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed.substring(2), style.fonts.body, style.bodyText, 22, false),
        bullet: { level },
        indent: { left: 720 * (level + 1), hanging: 360 },
        spacing: { after: 120 },
      }));
    } else {
      elements.push(new Paragraph({
        children: renderFormattedText(lineTrimmed, style.fonts.body, style.bodyText, 22, false),
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }
    i++;
  }

  return elements;
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const generateAndDownloadDocx = async (
  result: AnalysisResult,
  details: MeetingDetails,
  templateId: DocxTemplateId = "corporate"
) => {
  const [year, month, day] = details.date.split("-");
  const formattedDate = `${day}-${month}-${year}`;
  const safeTitle = details.title.replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${safeTitle} - ${formattedDate}.docx`;
  const style = DOCX_TEMPLATES[templateId];

  try {
    const doc = new Document({
      background: { color: "FFFFFF" },
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [...parseMarkdownToDocxElements(result.minutes, style)],
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
