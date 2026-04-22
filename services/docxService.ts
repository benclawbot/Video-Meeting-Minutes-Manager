import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign } from "docx";
import FileSaver from "file-saver";
import { AnalysisResult, MeetingDetails, DocxTemplateId } from "../types";

interface TemplateStyle {
  id: DocxTemplateId;
  name: string;
  fonts: {
    body: string;
    heading: string;
  };
  colors: {
    headerBg: string;
    headerText: string;
    rowText: string;
    border: string;
    title: string;
    subtitle: string;
    rowEvenBg: string;
  };
  borders: {
    style: any;
    size: number;
    color?: string; // override if specific
  };
  headerTransform: 'uppercase' | 'capitalize' | 'none';
}

const TEMPLATES: Record<DocxTemplateId, TemplateStyle> = {
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    fonts: { body: "Calibri", heading: "Calibri" },
    colors: {
      headerBg: "1e293b", // slate-800
      headerText: "FFFFFF",
      rowText: "000000",
      border: "1e293b",   // bold dark border matching header
      title: "1e293b",
      subtitle: "1e293b", // h2 = same dark for readability
      rowEvenBg: "f1f5f9" // zebra (slate-100)
    },
    borders: { style: BorderStyle.SINGLE, size: 6, color: "1e293b" },
    headerTransform: 'uppercase'
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    fonts: { body: "Segoe UI", heading: "Segoe UI" },
    colors: {
      headerBg: "0c4a6e", // sky-900
      headerText: "FFFFFF",
      rowText: "0f172a",   // near-black for readability
      border: "0c4a6e",   // bold border matching header
      title: "0ea5e9",
      subtitle: "0c4a6e",  // h2 = dark for readability
      rowEvenBg: "f0f9ff"  // zebra (sky-50)
    },
    borders: { style: BorderStyle.SINGLE, size: 6, color: "0c4a6e" },
    headerTransform: 'none'
  },
  executive: {
    id: 'executive',
    name: 'Classic Executive',
    fonts: { body: "Calibri", heading: "Calibri" },
    colors: {
      headerBg: "1e3a5f", // bleu marine
      headerText: "FFFFFF",
      rowText: "000000",
      border: "1e3a5f",  // bold border matching header
      title: "1e3a5f",
      subtitle: "1e3a5f", // h2 = same dark for readability
      rowEvenBg: "f0f4f8" // zebra
    },
    borders: { style: BorderStyle.SINGLE, size: 6, color: "1e3a5f" },
    headerTransform: 'uppercase'
  }
};

const CELL_MARGINS = {
  top: 140,
  bottom: 140,
  left: 140,
  right: 140,
};

// Enhanced Text Renderer to handle Markdown formatting (Bold & Italic)
const renderFormattedText = (text: string, font: string, color: string, size: number, baseBold: boolean = false) => {
  // Regex to match **bold** or *italic*
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const parts = text.split(regex);
  
  return parts.filter(part => part !== '').map((part) => {
    let content = part;
    let isBold = baseBold;
    let isItalic = false;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      content = part.substring(2, part.length - 2);
      isBold = true;
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      content = part.substring(1, part.length - 1);
      isItalic = true;
    }

    return new TextRun({ 
      text: content, 
      bold: isBold, 
      italics: isItalic,
      size: size, 
      color: color,
      font: font
    });
  });
};

const parseMarkdownToDocxElements = (text: string, style: TemplateStyle) => {
  // Safe split to remove transcript if present
  const contentOnly = text.split(/##\s*Transcription Résumée/i)[0];

  const lines = contentOnly.split('\n');
  const elements = [];
  let i = 0;

  const tableBorderStyle = { 
    style: style.borders.style, 
    size: style.borders.size, 
    color: style.borders.color || style.colors.border 
  };

  const parseCells = (row: string) => {
    let cleanRow = row.trim();
    if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1);
    if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1);
    return cleanRow.split('|').map(c => {
       // Clean up leading bullets in table cells if present (common LLM artifact)
       return c.trim().replace(/^[\*\-]\s+/, '');
    });
  };

  while (i < lines.length) {
    const lineRaw = lines[i];
    const lineTrimmed = lineRaw.trim();
    if (!lineTrimmed) {
      i++;
      continue;
    }

    // Table Detection
    const hasPipes = lineTrimmed.includes('|');
    const nextLine = lines[i + 1]?.trim() || '';
    const isSeparator = nextLine.includes('|') && nextLine.includes('---');

    if (hasPipes && isSeparator) {
      const rows = [];
      const headerCells = parseCells(lineTrimmed);
      
      rows.push(new TableRow({
        tableHeader: true, 
        children: headerCells.map(cell => {
            let text = cell;
            if (style.headerTransform === 'uppercase') text = text.toUpperCase();
            if (style.headerTransform === 'capitalize') text = text.charAt(0).toUpperCase() + text.slice(1);

            return new TableCell({
            children: [new Paragraph({ 
                children: renderFormattedText(text, style.fonts.body, style.colors.headerText, 20, true),
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 100 }
            })],
            shading: { fill: style.colors.headerBg, type: ShadingType.SOLID },
            borders: { 
                top: tableBorderStyle, 
                bottom: tableBorderStyle, 
                left: tableBorderStyle, 
                right: tableBorderStyle 
            },
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER
            });
        })
      }));

      i += 2; 

      while (i < lines.length && lines[i].trim().includes('|')) {
        const cells = parseCells(lines[i]);
        // Skip separator rows (|---|---|) — they have all-empty cells
        if (cells.length > 0 && cells.some(c => c.trim() !== '')) {
          const rowIdx = rows.length; // 0 = header already pushed, 1 = first data row
          // First data row gets zebra shading (matches web renderer)
          const isEven = rowIdx % 2 === 0;
          rows.push(new TableRow({
            children: cells.map(cell => new TableCell({
              children: [new Paragraph({
                children: renderFormattedText(cell, style.fonts.body, style.colors.rowText, 22),
                alignment: AlignmentType.LEFT,
                spacing: { before: 100, after: 100 }
              })],
              shading: isEven ? { fill: style.colors.rowEvenBg, type: ShadingType.SOLID } : undefined,
              borders: {
                top: tableBorderStyle,
                bottom: tableBorderStyle,
                left: tableBorderStyle,
                right: tableBorderStyle
              },
              margins: CELL_MARGINS,
              verticalAlign: VerticalAlign.TOP
            }))
          }));
        }
        i++;
      }

      elements.push(new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: { top: 400, bottom: 400 }
      }));
      continue;
    }

    // Headings & Text
    if (lineTrimmed.startsWith('### ')) {
      elements.push(new Paragraph({ 
        children: renderFormattedText(lineTrimmed.replace('### ', ''), style.fonts.heading, style.colors.subtitle, 24, true),
        spacing: { before: 240, after: 120 } 
      }));
    } else if (lineTrimmed.startsWith('## ')) {
      elements.push(new Paragraph({ 
        children: renderFormattedText(lineTrimmed.replace('## ', ''), style.fonts.heading, style.colors.subtitle, 28, true),
        spacing: { before: 400, after: 200 },
        border: { bottom: { color: style.colors.border, space: 4, style: BorderStyle.SINGLE, size: 4 } }
      }));
    } else if (lineTrimmed.startsWith('# ')) {
      elements.push(new Paragraph({ 
        children: renderFormattedText(lineTrimmed.replace('# ', ''), style.fonts.heading, style.colors.title, 36, true),
        spacing: { before: 400, after: 400 },
        alignment: AlignmentType.CENTER
      }));
    } 
    // Lists
    else if (lineTrimmed.startsWith('- ') || lineTrimmed.startsWith('* ')) {
      const leadingSpaces = lineRaw.match(/^\s*/)?.[0].length || 0;
      const level = Math.floor(leadingSpaces / 2);
      elements.push(new Paragraph({ 
        children: renderFormattedText(lineTrimmed.substring(2), style.fonts.body, style.colors.rowText, 22, false), 
        bullet: { level },
        indent: { left: 720 * (level + 1), hanging: 360 },
        spacing: { after: 120 } 
      }));
    } 
    else {
      elements.push(new Paragraph({ 
        children: renderFormattedText(lineTrimmed, style.fonts.body, style.colors.rowText, 22, false), 
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED
      }));
    }
    i++;
  }

  return elements;
};

export const generateAndDownloadDocx = async (result: AnalysisResult, details: MeetingDetails, templateId: DocxTemplateId = 'corporate') => {
  const [year, month, day] = details.date.split('-');
  const formattedDate = `${day}-${month}-${year}`;
  
  const safeTitle = details.title.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${safeTitle} - ${formattedDate}.docx`;

  const style = TEMPLATES[templateId];

  try {
    const doc = new Document({
      background: { color: "FFFFFF" }, // Always white paper
      sections: [{
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
        },
        children: [
          ...parseMarkdownToDocxElements(result.minutes, style)
        ]
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    FileSaver.saveAs(blob, filename);
    return true;
  } catch (error) {
    console.error("DOCX Export Error:", error);
    return false;
  }
};