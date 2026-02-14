import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import FileSaver from "file-saver";
import { AnalysisResult, MeetingDetails } from "../types";

/**
 * Parses simple markdown-like text into DOCX Paragraphs
 */
const parseMarkdownToDocx = (text: string) => {
  const lines = text.split('\n');
  const paragraphs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        text: line.replace('### ', ''),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }));
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }));
    } else if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Handle bold text in list items (simple split)
      const cleanLine = line.substring(2);
      const parts = cleanLine.split('**');
      const children = parts.map((part, index) => 
        new TextRun({
          text: part,
          bold: index % 2 === 1
        })
      );
      
      paragraphs.push(new Paragraph({
        children: children,
        bullet: { level: 0 }
      }));
    } else {
      // Regular Paragraph with bold support
      const parts = line.split('**');
      const children = parts.map((part, index) => 
        new TextRun({
          text: part,
          bold: index % 2 === 1
        })
      );

      paragraphs.push(new Paragraph({
        children: children,
        spacing: { after: 120 }
      }));
    }
  }

  return paragraphs;
};

/**
 * Creates a standard document structure
 */
const createDocument = (title: string, date: string, sectionTitle: string, content: string): Document => {
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `Date: ${date}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: sectionTitle,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 }
        }),
        ...parseMarkdownToDocx(content)
      ]
    }]
  });
};

export const generateAndDownloadDocx = async (result: AnalysisResult, details: MeetingDetails) => {
  const cleanTitle = details.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  try {
    const doc = createDocument(details.title, details.date, "Compte Rendu", result.minutes);
    const blob = await Packer.toBlob(doc);
    FileSaver.saveAs(blob, `${cleanTitle}_compte_rendu.docx`);
    return true;
  } catch (error) {
    console.error("Error generating DOCX:", error);
    return false;
  }
};