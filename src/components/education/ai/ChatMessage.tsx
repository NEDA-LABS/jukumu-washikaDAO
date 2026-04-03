'use client';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isAssistant = role === 'assistant';

  return (
    <div
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isAssistant
            ? 'bg-blue-500/15 text-white/90 rounded-bl-sm'
            : 'bg-white/10 text-white/90 rounded-br-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  );
}
