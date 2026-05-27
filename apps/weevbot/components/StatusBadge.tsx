import type { ConversationStatus } from '@/lib/supabase';

const CONFIG: Record<ConversationStatus, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  paused: { label: 'Pausado', className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  waiting: { label: 'Aguardando', className: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
};

export default function StatusBadge({ status }: { status: ConversationStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.waiting;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}
