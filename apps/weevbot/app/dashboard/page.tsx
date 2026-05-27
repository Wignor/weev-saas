'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bot, Users, PauseCircle, RefreshCw, Settings, MessageSquare, Save, CheckCircle } from 'lucide-react';
import type { Conversation, Message, Setting } from '@/lib/db';
import ConversationCard from '@/components/ConversationCard';
import MessageBubble from '@/components/MessageBubble';
import StatusBadge from '@/components/StatusBadge';

type Tab = 'conversations' | 'settings';

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    if (res.ok) setConversations(await res.json());
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      setSelectedConv(data.conversation);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data: Setting[] = await res.json();
      setSettings(data);
      const vals: Record<string, string> = {};
      data.forEach(s => { vals[s.key] = s.value; });
      setSettingValues(vals);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadSettings();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations, loadSettings]);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);
    const interval = setInterval(() => loadMessages(selected), 4000);
    return () => clearInterval(interval);
  }, [selected, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selected) return;
    const updated = conversations.find(c => c.id === selected);
    if (updated) setSelectedConv(updated);
  }, [conversations, selected]);

  async function togglePause() {
    if (!selected || !selectedConv) return;
    setLoadingAction(true);
    const action = selectedConv.status === 'paused' ? 'resume' : 'pause';
    await fetch(`/api/conversations/${selected}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    await Promise.all([loadConversations(), loadMessages(selected)]);
    setLoadingAction(false);
  }

  async function saveSetting(key: string) {
    setSavingKey(key);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: settingValues[key] }),
    });
    setSavingKey(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  const stats = {
    total: conversations.length,
    active: conversations.filter(c => c.status === 'active').length,
    paused: conversations.filter(c => c.status === 'paused').length,
  };

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return c.id.includes(q) || (c.push_name?.toLowerCase().includes(q)) || (c.last_message?.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="text-emerald-400" size={22} />
          <span className="font-bold text-white text-lg">WeevBot</span>
        </div>
        <div className="flex items-center gap-6">
          <Stat icon={<Users size={14} />} label="Total" value={stats.total} />
          <Stat icon={<div className="w-2 h-2 rounded-full bg-emerald-400" />} label="Ativos" value={stats.active} color="text-emerald-400" />
          <Stat icon={<PauseCircle size={14} />} label="Pausados" value={stats.paused} color="text-amber-400" />
          <button onClick={loadConversations} className="text-slate-400 hover:text-white transition-colors" title="Atualizar">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 flex gap-1 shrink-0">
        <TabBtn active={tab === 'conversations'} onClick={() => setTab('conversations')} icon={<MessageSquare size={14} />} label="Conversas" />
        <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings size={14} />} label="Configurações" />
      </div>

      {tab === 'conversations' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
            <div className="px-3 py-2 border-b border-slate-700">
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">Nenhuma conversa ainda</p>
              )}
              {filtered.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  selected={selected === conv.id}
                  onClick={() => setSelected(conv.id)}
                />
              ))}
            </div>
          </aside>

          {/* Main panel */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Bot size={48} className="text-slate-700" />
                <p>Selecione uma conversa</p>
              </div>
            ) : (
              <>
                <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold text-white">
                      {(selectedConv?.push_name || selected).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{selectedConv?.push_name || selected}</p>
                      <p className="text-xs text-slate-400">{selected}</p>
                    </div>
                    {selectedConv && <StatusBadge status={selectedConv.status} />}
                  </div>
                  <button
                    onClick={togglePause}
                    disabled={loadingAction}
                    className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      selectedConv?.status === 'paused'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {selectedConv?.status === 'paused' ? 'Retomar IA' : 'Pausar IA'}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {messages.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-8">Nenhuma mensagem</p>
                  )}
                  {messages.map(m => <MessageBubble key={m.id} message={m} />)}
                  <div ref={bottomRef} />
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {tab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-white font-semibold text-lg mb-6">Configurações do Agente</h2>
            {settings.length === 0 && (
              <p className="text-slate-400 text-sm">Nenhuma configuração disponível.</p>
            )}
            {settings.map(setting => (
              <SettingCard
                key={setting.key}
                setting={setting}
                value={settingValues[setting.key] ?? ''}
                onChange={v => setSettingValues(prev => ({ ...prev, [setting.key]: v }))}
                onSave={() => saveSetting(setting.key)}
                saving={savingKey === setting.key}
                saved={savedKey === setting.key}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-400'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}{label}
    </button>
  );
}

function SettingCard({
  setting, value, onChange, onSave, saving, saved,
}: {
  setting: Setting;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const isLong = setting.key === 'system_prompt' || setting.key === 'welcome_message';
  const isSecret = setting.key === 'openai_api_key';

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-start mb-1">
        <label className="text-white text-sm font-medium">{setting.label}</label>
        <button
          onClick={onSave}
          disabled={saving}
          className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            saved ? 'bg-emerald-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
          }`}
        >
          {saved ? <><CheckCircle size={12} /> Salvo</> : saving ? 'Salvando...' : <><Save size={12} /> Salvar</>}
        </button>
      </div>
      <p className="text-slate-400 text-xs mb-2">{setting.description}</p>
      {isLong ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={5}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 resize-y"
        />
      ) : isSecret ? (
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 pr-20 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowSecret(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1"
          >
            {showSecret ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value, color = 'text-slate-300' }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
