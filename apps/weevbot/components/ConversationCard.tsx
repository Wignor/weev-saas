import type { Conversation } from '@/lib/supabase';
import StatusBadge from './StatusBadge';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

interface Props {
  conversation: Conversation;
  selected: boolean;
  onClick: () => void;
}

export default function ConversationCard({ conversation, selected, onClick }: Props) {
  const name = conversation.push_name || conversation.id;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors ${
        selected ? 'bg-slate-700/60 border-l-2 border-l-emerald-500' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-white truncate max-w-[140px]">{name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={conversation.status} />
          <span className="text-xs text-slate-500">{timeAgo(conversation.last_message_at)}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 truncate">{conversation.last_message || '—'}</p>
    </button>
  );
}
