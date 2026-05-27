import type { Message } from '@/lib/supabase';

const ROLE_CONFIG = {
  user: {
    label: 'Cliente',
    bubble: 'bg-slate-700 text-slate-100',
    wrapper: 'justify-start',
  },
  assistant: {
    label: 'IA',
    bubble: 'bg-emerald-600 text-white',
    wrapper: 'justify-end',
  },
  human: {
    label: 'Atendente',
    bubble: 'bg-amber-600 text-white',
    wrapper: 'justify-end',
  },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message }: { message: Message }) {
  const config = ROLE_CONFIG[message.role];
  return (
    <div className={`flex ${config.wrapper} mb-3`}>
      <div className="max-w-[75%]">
        <p className={`text-[10px] mb-0.5 text-slate-400 ${message.role !== 'user' ? 'text-right' : ''}`}>
          {config.label}
        </p>
        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${config.bubble}`}>
          {message.content}
        </div>
        <p className={`text-[10px] mt-0.5 text-slate-500 ${message.role !== 'user' ? 'text-right' : ''}`}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
