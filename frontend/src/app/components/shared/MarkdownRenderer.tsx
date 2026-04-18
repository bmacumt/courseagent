import { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    try {
      return marked(content, { breaks: true }) as string;
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