import React from 'react';
import { DocxTemplateId } from '../types';

interface MarkdownRendererProps {
  content: string;
  template: DocxTemplateId;
}

const THEMES = {
  corporate: {
    page: "bg-white shadow-xl w-full max-w-[21cm] mx-auto p-12 min-h-[29.7cm] font-sans text-black", // Enforced Black
    h1: "text-3xl font-bold text-black mb-8 pb-4 border-b border-slate-300",
    h2: "text-xl font-bold text-black mt-8 mb-4 uppercase tracking-wide border-b border-slate-200 pb-1",
    h3: "text-lg font-semibold text-black mt-6 mb-3",
    p: "text-black mb-4 leading-relaxed text-justify",
    liItem: "flex items-start mb-2",
    liMarker: "text-slate-500 mr-2 mt-1.5 text-[0.6em] •",
    liText: "text-black",
    strong: "font-bold text-black",
    table: {
      container: "my-6 rounded-sm overflow-hidden border border-slate-300",
      table: "w-full text-left text-sm border-collapse",
      thead: "bg-slate-200 text-black", 
      th: "px-4 py-2 font-semibold border-r border-slate-300 last:border-r-0",
      tbody: "bg-white",
      tr: "border-b border-slate-200 last:border-b-0",
      td: "px-4 py-2 border-r border-slate-200 last:border-r-0 align-top text-black"
    }
  },
  modern: {
    page: "bg-white shadow-2xl w-full max-w-[21cm] mx-auto p-12 min-h-[29.7cm] font-sans text-slate-800",
    h1: "text-4xl font-bold text-sky-500 mb-10 tracking-tight",
    h2: "text-2xl font-bold text-sky-600 mt-10 mb-4 flex items-center before:content-[''] before:w-1.5 before:h-6 before:bg-sky-500 before:mr-3 before:rounded-full",
    h3: "text-lg font-semibold text-sky-500 mt-6 mb-2",
    p: "text-slate-600 mb-5 leading-relaxed",
    liItem: "flex items-start mb-3",
    liMarker: "w-1.5 h-1.5 bg-sky-500 rounded-full mr-3 mt-2 shrink-0", // custom dot
    liText: "text-slate-600",
    strong: "font-semibold text-sky-600",
    table: {
      container: "my-8 rounded-lg overflow-hidden shadow-lg ring-1 ring-slate-100",
      table: "w-full text-left text-sm",
      thead: "bg-sky-500 text-white",
      th: "px-6 py-3 text-xs font-bold uppercase tracking-wider",
      tbody: "bg-white",
      tr: "hover:bg-sky-50/50 transition-colors border-b border-slate-100 last:border-0",
      td: "px-6 py-3 text-slate-600 align-top"
    }
  }
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, template }) => {
  const theme = THEMES[template];

  const parseMarkdown = (text: string) => {
    if (!text) return null;

    // Filter out transcript section for the preview as well
    const filteredContent = text.split(/##\s*Transcription Résumée/i)[0];
    const lines = filteredContent.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const parseCells = (row: string) => {
      let cleanRow = row.trim();
      if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1);
      if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1);
      return cleanRow.split('|').map(c => c.trim());
    };

    const renderFormatting = (text: string) => {
      // Split by bold (**...**) or italic (*...*)
      const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
      const parts = text.split(regex);
      
      return parts.filter(p => p).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
           return <strong key={i} className={theme.strong}>{part.slice(2, -2)}</strong>;
        } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
           return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        return part;
      });
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        elements.push(<div key={`empty-${i}`} className="h-4"></div>);
        i++;
        continue;
      }

      // Table Detection
      const hasPipes = trimmed.includes('|');
      const nextLine = lines[i + 1]?.trim() || '';
      const isSeparator = nextLine.includes('|') && nextLine.includes('---');

      if (hasPipes && isSeparator) {
        const rows: string[][] = [];
        rows.push(parseCells(line));
        i += 2; 

        while (i < lines.length && lines[i].trim().includes('|')) {
          const cells = parseCells(lines[i]);
          if (cells.length > 0) rows.push(cells);
          i++;
        }
        
        elements.push(
          <div key={`table-${i}`} className={theme.table.container}>
            <table className={theme.table.table}>
              <thead className={theme.table.thead}>
                <tr>
                  {rows[0]?.map((cell, idx) => (
                    <th key={idx} className={theme.table.th}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={theme.table.tbody}>
                {rows.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx} className={theme.table.tr}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className={theme.table.td}>{renderFormatting(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className={theme.h3}>{line.replace('### ', '')}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className={theme.h2}>{line.replace('## ', '')}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className={theme.h1}>{line.replace('# ', '')}</h1>);
      } 
      // List Items
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
        const level = Math.floor(leadingSpaces / 2);
        const contentStr = trimmed.substring(2);
        
        // For custom markers, we use flexbox instead of standard list-style
        elements.push(
          <div key={i} className={theme.liItem} style={{ marginLeft: `${level * 1.5}rem` }}>
             {/* Render custom marker based on theme logic */}
             {template === 'corporate' ? (
                <span className={theme.liMarker}>●</span>
             ) : (
                <div className={theme.liMarker}></div>
             )}
            <span className={theme.liText}>
              {renderFormatting(contentStr)}
            </span>
          </div>
        );
      } else {
        elements.push(<p key={i} className={theme.p}>{renderFormatting(line)}</p>);
      }
      i++;
    }
    return elements;
  };

  return (
    <div className={theme.page}>
      {parseMarkdown(content)}
    </div>
  );
};