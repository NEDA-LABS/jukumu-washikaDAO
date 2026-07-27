'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface LessonContentProps {
  content: string;
  language?: string;
}

export default function LessonContent({ content, language }: LessonContentProps) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div
      lang={language}
      className="prose prose-invert prose-sm max-w-none
        prose-headings:text-foreground prose-headings:font-semibold
        prose-p:text-foreground/80 prose-p:leading-relaxed
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground
        prose-ul:text-foreground/80 prose-ol:text-foreground/80
        prose-li:marker:text-primary
        prose-code:text-orange-300 prose-code:bg-border prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-muted prose-pre:border prose-pre:border-border
        prose-blockquote:border-orange-500/50 prose-blockquote:text-muted-foreground
        prose-hr:border-border
        prose-table:text-foreground/80
        prose-th:text-foreground prose-th:border-border
        prose-td:border-border"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
