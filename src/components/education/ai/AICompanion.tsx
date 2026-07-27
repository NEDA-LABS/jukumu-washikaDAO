'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import QuickActions from './QuickActions';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  WifiIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

interface AICompanionProps {
  lessonId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function AICompanion({ lessonId, isOpen, onClose }: AICompanionProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(
    async (
      text: string,
      action?: 'chat' | 'explain_more' | 'another_example' | 'my_situation',
    ) => {
      if (!text.trim() && !action) return;

      const userMessage = text.trim() || action || '';
      const userEntry: ChatEntry = { role: 'user', content: userMessage };
      setMessages((prev) => [...prev, userEntry]);
      setInput('');
      setError(null);
      setStreaming(true);

      try {
        const chatHistory = [...messages, userEntry].map(({ role, content }) => ({
          role,
          content,
        }));

        const res = await fetch('/api/education/ai/companion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lesson_id: lessonId,
            message: userMessage,
            chat_history: chatHistory,
            action: action ?? 'chat',
          }),
        });

        if (res.status === 429) {
          setError(t('edu.err.rateLimit'));
          setStreaming(false);
          return;
        }

        if (!res.ok) {
          setError(t('edu.err.retry'));
          setStreaming(false);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (event.type === 'delta') {
                assistantContent += event.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      } catch {
        setError('Hakuna mtandao. Angalia muunganisho wako.');
      } finally {
        setStreaming(false);
      }
    },
    [lessonId, messages],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (streaming || !input.trim()) return;
    sendMessage(input);
  };

  const handleQuickAction = (
    action: 'explain_more' | 'another_example' | 'my_situation',
  ) => {
    if (streaming) return;
    const labels: Record<string, string> = {
      explain_more: 'Eleza zaidi',
      another_example: 'Nipe mfano mwingine',
      my_situation: 'Nisaidie kwa hali yangu',
    };
    sendMessage(labels[action], action);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 bg-background/80 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:static lg:inset-auto lg:z-auto flex flex-col bg-background border-t lg:border-t-0 lg:border-l border-border h-[70vh] lg:h-full lg:w-96">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-foreground font-medium text-sm">Msaidizi wa AI</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground text-sm">
                Habari! Niko tayari kukusaidia na somo hili.
              </p>
              <QuickActions onAction={handleQuickAction} disabled={streaming} />
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}
          {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-blue-500/15 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error.includes('mtandao') ? (
              <WifiIcon className="w-4 h-4 shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
            )}
            {error}
          </div>
        )}

        {/* Quick actions (when messages exist) */}
        {messages.length > 0 && !streaming && (
          <div className="px-4 pb-2">
            <QuickActions onAction={handleQuickAction} disabled={streaming} />
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Andika swali lako..."
              disabled={streaming}
              className="flex-1 bg-muted border border-border text-foreground rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
