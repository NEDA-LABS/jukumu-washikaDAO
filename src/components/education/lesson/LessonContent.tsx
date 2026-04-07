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
        prose-headings:text-white prose-headings:font-semibold
        prose-p:text-white/80 prose-p:leading-relaxed
        prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white
        prose-ul:text-white/80 prose-ol:text-white/80
        prose-li:marker:text-orange-400
        prose-code:text-orange-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
        prose-blockquote:border-orange-500/50 prose-blockquote:text-white/60
        prose-hr:border-white/10
        prose-table:text-white/80
        prose-th:text-white prose-th:border-white/10
        prose-td:border-white/10"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
