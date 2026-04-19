import { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function renderLatex(text: string): { text: string; placeholders: string[] } {
  const placeholders: string[] = [];

  // Block math: $$...$$ → placeholder
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    try {
      const html = katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      const idx = placeholders.length;
      placeholders.push(html);
      return `\x00MATH${idx}\x00`;
    } catch {
      return `$$${tex}$$`;
    }
  });

  // Inline math: $...$ → placeholder
  text = text.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    try {
      const html = katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      const idx = placeholders.length;
      placeholders.push(html);
      return `\x00MATH${idx}\x00`;
    } catch {
      return `$${tex}$`;
    }
  });

  return { text, placeholders };
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    try {
      const { text: withPlaceholders, placeholders } = renderLatex(content);
      let rendered = marked(withPlaceholders, { breaks: true }) as string;
      // Restore placeholders back to KaTeX HTML
      rendered = rendered.replace(/\x00MATH(\d+)\x00/g, (_, idx) => placeholders[parseInt(idx)]);
      return rendered;
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
