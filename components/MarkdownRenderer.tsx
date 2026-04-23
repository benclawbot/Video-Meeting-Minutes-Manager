import React from 'react';
import { DocxTemplateId } from '../types';
import { TEMPLATE_COLORS, TemplateColors } from '../services/docxColors';

interface MarkdownRendererProps {
  content: string;
  template: DocxTemplateId;
}

const hexToStyle = (hex: string): React.CSSProperties => ({
  color: `#${hex}`,
});

const hexToBgStyle = (hex: string): React.CSSProperties => ({
  backgroundColor: `#${hex}`,
});

const THEMES: Record<DocxTemplateId, {
  page: string;
  h1: string;
  h2: string;
  h3: string;
  p: string;
  liItem: string;
  table: {
    container: string;
    table: string;
    thead: string;
    th: string;
    tbody: string;
    tr: string;
    trEven: string;
    td: string;
  };
  styles: TemplateColors;
}> = {
  corporate: {
    page: "bg-white shadow-xl w-full max-w-[21cm] mx-auto p-12 min-h-[29.7cm] font-sans",
    h1: "text-4xl font-bold mb-8 pb-4 text-center border-b-2",
    h2: "text-xl font-bold mt-8 mb-4 uppercase tracking-wide pb-1 border-b",
    h3: "text-lg font-semibold mt-6 mb-3",
    p: "mb-4 leading-relaxed text-justify",
    liItem: "flex items-start mb-2",
    table: {
      container: "my-6 rounded-sm overflow-hidden border",
      table: "w-full text-left text-sm border-collapse",
      thead: "text-white",
      th: "px-4 py-3 text-xs font-bold uppercase tracking-wider border-r last:border-r-0 border-b",
      tbody: "bg-white",
      tr: "border-b last:border-b-0",
      trEven: "",
      td: "px-4 py-3 border-r last:border-r-0 align-top",
    },
    styles: TEMPLATE_COLORS.corporate,
  },
  modern: {
    page: "bg-[#F8FDFB] shadow-2xl w-full max-w-[21cm] mx-auto p-12 min-h-[29.7cm] font-sans",
    h1: "text-4xl font-bold mb-10 tracking-tight text-center",
    h2: "text-2xl font-bold mt-10 mb-4 flex items-center",
    h3: "text-lg font-semibold mt-6 mb-2",
    p: "mb-5 leading-relaxed",
    liItem: "flex items-start mb-3",
    table: {
      container: "my-8 rounded-lg overflow-hidden shadow-lg",
      table: "w-full text-left text-sm",
      thead: "text-white",
      th: "px-6 py-3 text-xs font-bold tracking-wider",
      tbody: "bg-white",
      tr: "border-b last:border-0",
      trEven: "",
      td: "px-6 py-3 align-top",
    },
    styles: TEMPLATE_COLORS.modern,
  },
  executive: {
    page: "bg-[#FAFAF8] shadow-2xl w-full max-w-[21cm] mx-auto p-12 min-h-[29.7cm] font-serif",
    h1: "text-4xl font-extrabold mb-8 pb-4 text-center border-b-2",
    h2: "text-xl font-bold mt-8 mb-4 uppercase tracking-wide pb-1 border-b",
    h3: "text-lg font-semibold mt-6 mb-2",
    p: "mb-4 leading-relaxed text-justify",
    liItem: "flex items-start mb-2",
    table: {
      container: "my-6 rounded overflow-hidden border shadow",
      table: "w-full text-left text-sm border-collapse",
      thead: "text-white",
      th: "px-4 py-3 text-xs font-bold uppercase tracking-wider border-r last:border-r-0 border-b",
      tbody: "bg-white",
      tr: "border-b last:border-b-0",
      trEven: "",
      td: "px-4 py-3 border-r last:border-r-0 align-top",
    },
    styles: TEMPLATE_COLORS.executive,
  },
};

const BULLET_STYLES: Record<DocxTemplateId, React.CSSProperties> = {
  corporate: { backgroundColor: `#${TEMPLATE_COLORS.corporate.accent}` },
  modern: { backgroundColor: `#${TEMPLATE_COLORS.modern.accent}` },
  executive: { backgroundColor: `#${TEMPLATE_COLORS.executive.accent}` },
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, template }) => {
  const theme = THEMES[template];
  const colors = theme.styles;

  const parseMarkdown = (text: string) => {
    if (!text) return null;

    const filteredContent = text.split(/##\s*Transcription Résumée/i)[0];
    const lines = filteredContent.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    const parseCells = (row: string) => {
      let r = row.trim();
      if (r.startsWith("|")) r = r.slice(1);
      if (r.endsWith("|")) r = r.slice(0, -1);
      return r.split("|").map(c => c.trim().replace(/^[\*\-]\s+/, ""));
    };

    const renderFormatting = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return parts.filter(p => p).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          return <strong key={i} style={hexToStyle(colors.subtitle)}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      });
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "") {
        elements.push(<div key={`empty-${i}`} className="h-4" />);
        i++;
        continue;
      }

      const hasPipes = trimmed.includes("|");
      const nextLine = lines[i + 1]?.trim() || "";
      const isSeparator = nextLine.includes("|") && nextLine.includes("---");

      if (hasPipes && isSeparator) {
        const rows: string[][] = [];
        rows.push(parseCells(line));
        i += 2;
        while (i < lines.length && lines[i].trim().includes("|")) {
          const cells = parseCells(lines[i]);
          if (cells.length > 0) rows.push(cells);
          i++;
        }

        elements.push(
          <div
            key={`table-${i}`}
            className={theme.table.container}
            style={{ borderColor: `#${colors.border}` }}
          >
            <table className={theme.table.table}>
              <thead
                className={theme.table.thead}
                style={hexToBgStyle(colors.headerBg)}
              >
                <tr style={{ borderColor: `#${colors.border}` }}>
                  {rows[0]?.map((cell, idx) => (
                    <th
                      key={idx}
                      className={theme.table.th}
                      style={{
                        borderColor: `#${colors.border}`,
                        ...hexToStyle(colors.headerText),
                      }}
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={theme.table.tbody}>
                {rows.slice(1).map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`${theme.table.tr} ${rowIdx % 2 === 1 ? theme.table.trEven : ""}`}
                    style={{
                      backgroundColor: rowIdx % 2 === 1 ? `#${colors.rowEvenBg}` : "transparent",
                      borderColor: `#${colors.border}`,
                    }}
                  >
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={theme.table.td}
                        style={{
                          borderColor: `#${colors.border}`,
                          ...hexToStyle(colors.rowText),
                        }}
                      >
                        {renderFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className={theme.h3} style={hexToStyle(colors.subtitle)}>
            {line.replace("### ", "")}
          </h3>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2
            key={i}
            className={theme.h2}
            style={{
              color: `#${colors.subtitle}`,
              borderColor: `#${colors.subtitle}`,
              paddingLeft: "0.75rem",
              borderLeftWidth: "3px",
              borderLeftStyle: "solid",
              borderLeftColor: `#${colors.accent}`,
            }}
          >
            {line.replace("## ", "")}
          </h2>
        );
      } else if (line.startsWith("# ")) {
        elements.push(
          <h1
            key={i}
            className={theme.h1}
            style={{
              color: `#${colors.title}`,
              borderColor: `#${colors.title}`,
            }}
          >
            {line.replace("# ", "")}
          </h1>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const contentStr = trimmed.substring(2);
        const level = Math.floor((line.match(/^\s*/)?.[0].length || 0) / 2);
        elements.push(
          <div key={i} className={theme.liItem} style={{ marginLeft: `${level * 1.5}rem` }}>
            <span style={BULLET_STYLES[template]} className="mr-2 mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0" />
            <span style={hexToStyle(colors.bodyText)}>{renderFormatting(contentStr)}</span>
          </div>
        );
      } else {
        elements.push(
          <p key={i} className={theme.p} style={hexToStyle(colors.bodyText)}>
            {renderFormatting(trimmed)}
          </p>
        );
      }
      i++;
    }
    return elements;
  };

  return <div className={theme.page}>{parseMarkdown(content)}</div>;
};
