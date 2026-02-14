import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

/**
 * A simple markdown renderer to avoid heavy dependencies for this specific use case.
 * In a production app, use react-markdown.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  
  // Basic parsing for headers, bold, list items, and paragraphs
  const parseMarkdown = (text: string) => {
    if (!text) return null;

    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();

      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-semibold text-slate-200 mt-6 mb-3">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-bold text-slate-100 mt-8 mb-4 border-b border-slate-700 pb-2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold text-white mt-4 mb-6">{line.replace('# ', '')}</h1>;
      }

      // List items
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        const content = trimmedLine.substring(2);
        // Handle bolding within lists
        const parts = content.split('**');
        return (
          <li key={index} className="ml-4 list-disc pl-1 mb-2 text-slate-300 marker:text-slate-500">
             {parts.map((part, i) => 
               i % 2 === 1 ? <strong key={i} className="text-slate-100 font-semibold">{part}</strong> : part
             )}
          </li>
        );
      }

      // Empty lines
      if (trimmedLine === '') {
        return <div key={index} className="h-2"></div>;
      }

      // Paragraphs with bold support
      const parts = line.split('**');
      return (
        <p key={index} className="mb-3 text-slate-300 leading-relaxed">
          {parts.map((part, i) => 
            i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-100">{part}</strong> : part
          )}
        </p>
      );
    });
  };

  return <div className="markdown-content">{parseMarkdown(content)}</div>;
};