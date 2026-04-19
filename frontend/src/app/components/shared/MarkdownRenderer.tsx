import { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Replace LaTeX delimiters before marked processes the text
function renderLatex(text: string): string {
  // Block math: $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `$$${tex}$$`;
    }
  });
  // Inline math: $...$
  text = text.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `$${tex}$`;
    }
  });
  return text;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    try {
      const withLatex = renderLatex(content);
      return marked(withLatex, { breaks: true }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-body ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        lineHeight: 1.8,
        color: '#2C3E50',
        fontSize: 14,
      }}
    />
  );
}
