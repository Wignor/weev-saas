'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bot, Settings, MessageSquare, Send, Zap, LayoutGrid, Inbox,
  Phone, Clock, Plus, Trash2, CheckCircle, Save, RefreshCw,
  PauseCircle, PlayCircle, X, Menu, ChevronLeft,
} from 'lucide-react';
import type { Conversation, Message, Setting, QuickReply } from '@/lib/db';

type Tab = 'inbox' | 'settings';
type View = 'chat' | 'kanban';
type StatusFilter = 'all' | 'active' | 'paused' | 'waiting';

// ─── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_BG = [
  'bg-emerald-600','bg-blue-600','bg-violet-600',
  'bg-rose-600','bg-amber-600','bg-cyan-600',
];
function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm'|'md'|'lg' }) {
  const i = name.charCodeAt(0) % AVATAR_BG.length;
  const s = size==='lg' ? 'w-14 h-14 text-xl' : size==='md' ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  return (
    <div className={`${s} ${AVATAR_BG[i]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string|null }) {
  if (status==='active')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/70 text-emerald-400 border border-emerald-700/50 whitespace-nowrap">IA Ativa</span>;
  if (status==='paused')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/70 text-amber-400 border border-amber-700/50 whitespace-nowrap">Atendente</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 whitespace-nowrap">Aguardando</span>;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: Message }) {
  const isRight = msg.role === 'assistant' || msg.role === 'human';
  const bubble =
    msg.role==='assistant' ? 'bg-emerald-700/80' :
    msg.role==='human'     ? 'bg-blue-700/80' : 'bg-slate-700';
  const label = msg.role==='assistant' ? 'IA' : msg.role==='human' ? 'Atendente' : undefined;
  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    : '';
  return (
    <div className={`flex ${isRight?'justify-end':'justify-start'} gap-1.5`}>
      {!isRight && <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 mt-1">👤</div>}
      <div className={`max-w-[72%] flex flex-col ${isRight?'items-end':'items-start'}`}>
        {label && <span className="text-xs text-slate-400 mb-0.5 px-1">{label}</span>}
        <div className={`${bubble} rounded-2xl ${isRight?'rounded-tr-sm':'rounded-tl-sm'} px-4 py-2.5 text-sm text-white whitespace-pre-wrap break-words`}>
          {msg.content}
        </div>
        <span className="text-xs text-slate-600 mt-0.5 px-1">{time}</span>
      </div>
    </div>
  );
}

// ─── Conversation list item (with inline pause/resume) ────────────────────────

function ConvItem({
  conv, selected, onClick, onTogglePause, toggling,
}: {
  conv: Conversation; selected: boolean; onClick: () => void;
  onTogglePause: () => void; toggling: boolean;
}) {
  const name = conv.push_name || conv.id;
  const time = conv.last_message_at
    ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    : '';
  return (
    <div className={`flex items-start gap-2 px-3 py-3 border-b border-slate-700/50 transition-colors cursor-pointer ${
      selected ? 'bg-emerald-900/30 border-l-2 border-l-emerald-500' : 'hover:bg-slate-700/30'
    }`}>
      <div onClick={onClick} className="flex items-start gap-2 flex-1 min-w-0">
        <Avatar name={name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-medium text-white truncate">{conv.push_name || 'Sem nome'}</span>
            <span className="text-xs text-slate-500 shrink-0">{time}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusBadge status={conv.status} />
          </div>
          {conv.last_message && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message}</p>
          )}
        </div>
      </div>
      {/* Inline pause/resume button */}
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePause(); }}
        disabled={toggling}
        title={conv.status==='paused' ? 'Retomar IA' : 'Pausar IA'}
        className={`mt-1 p-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0 ${
          conv.status==='paused'
            ? 'text-emerald-400 hover:bg-emerald-900/50'
            : 'text-amber-400 hover:bg-amber-900/50'
        }`}
      >
        {conv.status==='paused' ? <PlayCircle size={15}/> : <PauseCircle size={15}/>}
      </button>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanCol({label,convs,accent,onSelect}:{
  label:string; convs:Conversation[];
  accent:{dot:string;border:string;text:string;bg:string};
  onSelect:(id:string)=>void;
}) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 ${accent.bg} border ${accent.border}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${accent.dot}`}/>
          <span className={`text-sm font-medium ${accent.text}`}>{label}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${accent.bg} ${accent.text} border ${accent.border}`}>{convs.length}</span>
      </div>
      <div className="space-y-2 overflow-y-auto">
        {convs.length===0 && <p className="text-center text-slate-600 text-xs py-6">Vazio</p>}
        {convs.map(c=>(
          <button key={c.id} onClick={()=>onSelect(c.id)}
            className="w-full bg-slate-800 hover:bg-slate-700/60 border border-slate-700 rounded-xl p-3 text-left transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar name={c.push_name||c.id}/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.push_name||'Sem nome'}</p>
                <p className="text-xs text-slate-500 truncate">{c.id}</p>
              </div>
            </div>
            {c.last_message && <p className="text-xs text-slate-400 truncate">{c.last_message}</p>}
            {c.last_message_at && (
              <p className="text-xs text-slate-600 mt-1">
                {new Date(c.last_message_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Settings card ────────────────────────────────────────────────────────────

function SettingCard({setting,value,onChange,onSave,saving,saved}:{
  setting:Setting; value:string; onChange:(v:string)=>void;
  onSave:()=>void; saving:boolean; saved:boolean;
}) {
  const [show,setShow]=useState(false);
  const isLong = setting.key==='system_prompt'||setting.key==='welcome_message';
  const isSecret = setting.key==='openai_api_key';
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-start mb-1">
        <label className="text-white text-sm font-medium">{setting.label}</label>
        <button onClick={onSave} disabled={saving}
          className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            saved?'bg-emerald-600 text-white':'bg-slate-600 hover:bg-slate-500 text-slate-200'
          }`}>
          {saved?<><CheckCircle size={12}/> Salvo</>:saving?'Salvando…':<><Save size={12}/> Salvar</>}
        </button>
      </div>
      <p className="text-slate-400 text-xs mb-2">{setting.description}</p>
      {isLong ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)} rows={5}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 resize-y"/>
      ) : isSecret ? (
        <div className="relative">
          <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)}
            className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 pr-20 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"/>
          <button type="button" onClick={()=>setShow(v=>!v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1">
            {show?'Ocultar':'Mostrar'}
          </button>
        </div>
      ) : (
        <input type="text" value={value} onChange={e=>onChange(e.target.value)}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"/>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tab,setTab]=useState<Tab>('inbox');
  const [view,setView]=useState<View>('chat');
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [quickReplies,setQuickReplies]=useState<QuickReply[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [selectedConv,setSelectedConv]=useState<Conversation|null>(null);
  const [replyText,setReplyText]=useState('');
  const [sending,setSending]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState<StatusFilter>('all');
  const [settings,setSettings]=useState<Setting[]>([]);
  const [settingValues,setSettingValues]=useState<Record<string,string>>({});
  const [savingKey,setSavingKey]=useState<string|null>(null);
  const [savedKey,setSavedKey]=useState<string|null>(null);
  const [togglingPause,setTogglingPause]=useState<string|null>(null);
  const [newQr,setNewQr]=useState({title:'',content:''});
  const [sseError,setSseError]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const replyRef=useRef<HTMLTextAreaElement>(null);

  const loadConversations=useCallback(async()=>{
    const r=await fetch('/api/conversations'); if(r.ok) setConversations(await r.json());
  },[]);
  const loadMessages=useCallback(async(id:string)=>{
    const r=await fetch(`/api/conversations/${id}`);
    if(r.ok){const d=await r.json();setMessages(d.messages??[]);setSelectedConv(d.conversation??null);}
  },[]);
  const loadSettings=useCallback(async()=>{
    const r=await fetch('/api/settings');
    if(r.ok){const d:Setting[]=await r.json();setSettings(d);const v:Record<string,string>={};d.forEach(s=>{v[s.key]=s.value??'';});setSettingValues(v);}
  },[]);
  const loadQuickReplies=useCallback(async()=>{
    const r=await fetch('/api/quick-replies'); if(r.ok) setQuickReplies(await r.json());
  },[]);

  // SSE for real-time, fallback to polling
  useEffect(()=>{
    loadConversations();loadSettings();loadQuickReplies();
    let fb:ReturnType<typeof setInterval>|null=null;
    const es=new EventSource('/api/events');
    es.onmessage=(e)=>{try{const{type,data}=JSON.parse(e.data);if(type==='conversations')setConversations(data);}catch{}};
    es.onerror=()=>{setSseError(true);es.close();fb=setInterval(loadConversations,5000);};
    return()=>{es.close();if(fb)clearInterval(fb);};
  },[loadConversations,loadSettings,loadQuickReplies]);

  useEffect(()=>{if(!selected)return;loadMessages(selected);const t=setInterval(()=>loadMessages(selected),3000);return()=>clearInterval(t);},[selected,loadMessages]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);
  useEffect(()=>{if(!selected)return;const u=conversations.find(c=>c.id===selected);if(u)setSelectedConv(u);},[conversations,selected]);

  async function sendReply(){
    if(!replyText.trim()||!selected||sending)return;
    setSending(true);
    try{
      await fetch('/api/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,text:replyText.trim()})});
      setReplyText('');setShowQR(false);await loadMessages(selected);
    }finally{setSending(false);}
  }

  async function togglePause(convId:string,conv:Conversation){
    setTogglingPause(convId);
    const action=conv.status==='paused'?'resume':'pause';
    await fetch(`/api/conversations/${convId}/pause`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    await loadConversations();
    if(convId===selected)await loadMessages(convId);
    setTogglingPause(null);
  }

  async function saveSetting(key:string){
    setSavingKey(key);
    await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:settingValues[key]})});
    setSavingKey(null);setSavedKey(key);setTimeout(()=>setSavedKey(null),2000);
  }
  async function addQuickReply(){
    if(!newQr.title.trim()||!newQr.content.trim())return;
    await fetch('/api/quick-replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newQr)});
    setNewQr({title:'',content:''});await loadQuickReplies();
  }
  async function removeQuickReply(id:number){
    await fetch(`/api/quick-replies/${id}`,{method:'DELETE'});
    setQuickReplies(p=>p.filter(q=>q.id!==id));
  }

  const stats={
    total:conversations.length,
    active:conversations.filter(c=>c.status==='active').length,
    paused:conversations.filter(c=>c.status==='paused').length,
  };
  const filtered=conversations.filter(c=>{
    if(statusFilter!=='all'&&c.status!==statusFilter)return false;
    if(!search)return true;
    const q=search.toLowerCase();
    return c.id.includes(q)||c.push_name?.toLowerCase().includes(q)||c.last_message?.toLowerCase().includes(q);
  });

  // On mobile: opening a conversation closes the sidebar
  function openConversation(id:string){
    setSelected(id);
    if(window.innerWidth<768)setSidebarOpen(false);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          {/* Mobile hamburger / sidebar toggle */}
          <button onClick={()=>setSidebarOpen(v=>!v)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            {sidebarOpen?<ChevronLeft size={18}/>:<Menu size={18}/>}
          </button>
          <div className="w-7 h-7 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Bot size={16}/>
          </div>
          <span className="font-bold text-white hidden sm:block">WeevBot CRM</span>
          {sseError&&<span className="text-xs text-amber-400 flex items-center gap-1"><RefreshCw size={10}/> polling</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-xs">
            <StatChip label="Total" value={stats.total}/>
            <StatChip label="IA" value={stats.active} color="text-emerald-400" dot="bg-emerald-400"/>
            <StatChip label="Humano" value={stats.paused} color="text-amber-400" dot="bg-amber-400"/>
          </div>
          <div className="flex items-center gap-1 bg-slate-700/60 rounded-xl p-1">
            <NavBtn active={tab==='inbox'} onClick={()=>setTab('inbox')} icon={<MessageSquare size={13}/>} label="Inbox"/>
            <NavBtn active={tab==='settings'} onClick={()=>setTab('settings')} icon={<Settings size={13}/>} label="Config"/>
          </div>
        </div>
      </header>

      {/* ── INBOX ── */}
      {tab==='inbox'&&(
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center gap-2 shrink-0">
            {/* Desktop sidebar toggle */}
            <button onClick={()=>setSidebarOpen(v=>!v)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title={sidebarOpen?'Minimizar painel':'Expandir painel'}>
              {sidebarOpen?<ChevronLeft size={16}/>:<Menu size={16}/>}
            </button>
            <div className="flex items-center gap-0.5 bg-slate-700/60 rounded-lg p-0.5 shrink-0">
              <ViewBtn active={view==='chat'} onClick={()=>setView('chat')} icon={<Inbox size={12}/>} label="Chat"/>
              <ViewBtn active={view==='kanban'} onClick={()=>setView('kanban')} icon={<LayoutGrid size={12}/>} label="Kanban"/>
            </div>
            <input type="text" placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500"/>
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {(['all','active','paused'] as StatusFilter[]).map(f=>(
                <FilterPill key={f} active={statusFilter===f} onClick={()=>setStatusFilter(f)}
                  label={{all:'Todos',active:'IA',paused:'Humano',waiting:'Aguard.'}[f]}/>
              ))}
            </div>
          </div>

          {/* CHAT VIEW */}
          {view==='chat'&&(
            <div className="flex flex-1 overflow-hidden relative">

              {/* Sidebar — collapsible */}
              <aside className={`
                ${sidebarOpen?'w-72 min-w-[18rem]':'w-0 min-w-0 overflow-hidden'}
                bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 overflow-y-auto
                transition-all duration-200 ease-in-out
                absolute lg:relative z-20 h-full
                ${sidebarOpen?'left-0':'-left-full lg:left-0'}
              `}>
                {sidebarOpen&&(
                  <>
                    {filtered.length===0
                      ? <p className="text-center text-slate-500 text-sm py-12">Nenhuma conversa</p>
                      : filtered.map(conv=>(
                        <ConvItem
                          key={conv.id} conv={conv} selected={selected===conv.id}
                          onClick={()=>openConversation(conv.id)}
                          onTogglePause={()=>togglePause(conv.id,conv)}
                          toggling={togglingPause===conv.id}
                        />
                      ))
                    }
                  </>
                )}
              </aside>

              {/* Overlay for mobile sidebar */}
              {sidebarOpen&&(
                <div className="lg:hidden absolute inset-0 z-10 bg-black/40"
                  onClick={()=>setSidebarOpen(false)}/>
              )}

              {/* Chat main */}
              <main className="flex-1 flex flex-col overflow-hidden">
                {!selected?(
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                    <MessageSquare size={48} strokeWidth={1}/>
                    <p className="text-sm">Selecione uma conversa</p>
                  </div>
                ):(
                  <>
                    {/* Chat header */}
                    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        {/* Mobile: back button */}
                        <button onClick={()=>setSidebarOpen(true)}
                          className="lg:hidden p-1 text-slate-400 hover:text-white">
                          <ChevronLeft size={18}/>
                        </button>
                        <Avatar name={selectedConv?.push_name||selected} size="md"/>
                        <div>
                          <p className="font-semibold text-sm">{selectedConv?.push_name||'Sem nome'}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Phone size={10}/> {selected}
                          </p>
                        </div>
                        <StatusBadge status={selectedConv?.status}/>
                      </div>
                      <button
                        onClick={()=>selectedConv&&togglePause(selected,selectedConv)}
                        disabled={togglingPause===selected}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                          selectedConv?.status==='paused'
                            ?'bg-emerald-700 hover:bg-emerald-600'
                            :'bg-amber-700 hover:bg-amber-600'
                        }`}>
                        {selectedConv?.status==='paused'
                          ?<><PlayCircle size={13}/> Retomar IA</>
                          :<><PauseCircle size={13}/> Pausar IA</>}
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-900">
                      {messages.length===0&&<p className="text-center text-slate-600 text-sm py-10">Nenhuma mensagem</p>}
                      {messages.map(m=><MsgBubble key={m.id} msg={m}/>)}
                      <div ref={bottomRef}/>
                    </div>

                    {/* Quick replies panel */}
                    {showQR&&(
                      <div className="border-t border-slate-700 bg-slate-800/90 px-3 py-2.5 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Zap size={11} className="text-amber-400"/> Respostas rápidas
                          </span>
                          <button onClick={()=>setShowQR(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                        </div>
                        {quickReplies.length===0
                          ? <p className="text-xs text-slate-500">Nenhuma resposta rápida. Adicione em Configurações.</p>
                          : <div className="flex flex-wrap gap-2">
                              {quickReplies.map(qr=>(
                                <button key={qr.id}
                                  onClick={()=>{setReplyText(qr.content);setShowQR(false);replyRef.current?.focus();}}
                                  className="text-xs bg-slate-700 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-colors">
                                  {qr.title}
                                </button>
                              ))}
                            </div>
                        }
                      </div>
                    )}

                    {/* Reply box */}
                    <div className="border-t border-slate-700 bg-slate-800 px-3 py-3 flex items-end gap-2 shrink-0">
                      <button onClick={()=>setShowQR(v=>!v)} title="Respostas rápidas"
                        className={`p-2 rounded-lg transition-colors shrink-0 ${showQR?'bg-amber-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                        <Zap size={17}/>
                      </button>
                      <textarea ref={replyRef} value={replyText} onChange={e=>setReplyText(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();sendReply();}}}
                        placeholder="Responder como atendente… (Ctrl+Enter)"
                        rows={2}
                        className="flex-1 bg-slate-700 text-sm text-white placeholder-slate-400 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-emerald-500 resize-none"/>
                      <button onClick={sendReply} disabled={sending||!replyText.trim()}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0">
                        <Send size={17}/>
                      </button>
                    </div>
                  </>
                )}
              </main>

              {/* Contact info panel — hidden on small screens */}
              {selected&&selectedConv&&(
                <aside className="hidden xl:flex w-56 bg-slate-800 border-l border-slate-700 flex-col shrink-0 overflow-y-auto">
                  <div className="p-5 border-b border-slate-700 flex flex-col items-center gap-3 text-center">
                    <Avatar name={selectedConv.push_name||selected} size="lg"/>
                    <div>
                      <p className="font-semibold text-sm">{selectedConv.push_name||'Sem nome'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{selected}</p>
                    </div>
                    <StatusBadge status={selectedConv.status}/>
                  </div>
                  <div className="p-4 space-y-3 text-xs border-b border-slate-700">
                    <InfoRow icon={<Clock size={12}/>} label="Último contato"
                      value={selectedConv.last_message_at?new Date(selectedConv.last_message_at).toLocaleString('pt-BR'):'—'}/>
                  </div>
                  <div className="p-4">
                    <button onClick={()=>togglePause(selected,selectedConv)} disabled={togglingPause===selected}
                      className={`w-full text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                        selectedConv.status==='paused'?'bg-emerald-700/60 hover:bg-emerald-700 text-emerald-300':'bg-amber-700/60 hover:bg-amber-700 text-amber-300'
                      }`}>
                      {selectedConv.status==='paused'?<><PlayCircle size={12}/> Retomar IA</>:<><PauseCircle size={12}/> Pausar IA</>}
                    </button>
                  </div>
                </aside>
              )}
            </div>
          )}

          {/* KANBAN VIEW */}
          {view==='kanban'&&(
            <div className="flex-1 overflow-auto">
              <div className="flex gap-4 p-5 min-h-full">
                <KanbanCol label="IA Ativa" convs={filtered.filter(c=>c.status==='active')}
                  accent={{dot:'bg-emerald-400',border:'border-emerald-700/50',text:'text-emerald-400',bg:'bg-emerald-900/30'}}
                  onSelect={id=>{setSelected(id);setView('chat');}}/>
                <KanbanCol label="Atendente" convs={filtered.filter(c=>c.status==='paused')}
                  accent={{dot:'bg-amber-400',border:'border-amber-700/50',text:'text-amber-400',bg:'bg-amber-900/30'}}
                  onSelect={id=>{setSelected(id);setView('chat');}}/>
                <KanbanCol label="Aguardando" convs={filtered.filter(c=>c.status==='waiting')}
                  accent={{dot:'bg-slate-400',border:'border-slate-600/50',text:'text-slate-400',bg:'bg-slate-700/30'}}
                  onSelect={id=>{setSelected(id);setView('chat');}}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab==='settings'&&(
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-10">
            <section>
              <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
                <Settings size={16} className="text-slate-400"/> Configurações do Agente
              </h2>
              <div className="space-y-3">
                {settings.map(s=>(
                  <SettingCard key={s.key} setting={s} value={settingValues[s.key]??''}
                    onChange={v=>setSettingValues(p=>({...p,[s.key]:v}))}
                    onSave={()=>saveSetting(s.key)} saving={savingKey===s.key} saved={savedKey===s.key}/>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
                <Zap size={16} className="text-amber-400"/> Respostas Rápidas
              </h2>
              <div className="space-y-3">
                {quickReplies.length===0&&<p className="text-slate-500 text-sm">Nenhuma resposta rápida cadastrada.</p>}
                {quickReplies.map(qr=>(
                  <div key={qr.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{qr.title}</p>
                      <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap line-clamp-3">{qr.content}</p>
                    </div>
                    <button onClick={()=>removeQuickReply(qr.id)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <p className="text-sm font-medium text-white flex items-center gap-1.5"><Plus size={14} className="text-emerald-400"/> Nova resposta rápida</p>
                  <input type="text" placeholder="Título (ex: Horário de atendimento)" value={newQr.title}
                    onChange={e=>setNewQr(p=>({...p,title:e.target.value}))}
                    className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"/>
                  <textarea placeholder="Texto que será enviado ao cliente…" value={newQr.content}
                    onChange={e=>setNewQr(p=>({...p,content:e.target.value}))} rows={4}
                    className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500 resize-none"/>
                  <button onClick={addQuickReply} disabled={!newQr.title.trim()||!newQr.content.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <Plus size={14}/> Adicionar
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatChip({label,value,color='text-slate-300',dot}:{label:string;value:number;color?:string;dot?:string}){
  return(
    <div className="flex items-center gap-1.5">
      {dot&&<span className={`w-1.5 h-1.5 rounded-full ${dot}`}/>}
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
function NavBtn({active,onClick,icon,label}:{active:boolean;onClick:()=>void;icon:React.ReactNode;label:string}){
  return(
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${active?'bg-emerald-600 text-white':'text-slate-400 hover:text-white'}`}>
      {icon}{label}
    </button>
  );
}
function ViewBtn({active,onClick,icon,label}:{active:boolean;onClick:()=>void;icon:React.ReactNode;label:string}){
  return(
    <button onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${active?'bg-slate-600 text-white':'text-slate-400 hover:text-white'}`}>
      {icon}{label}
    </button>
  );
}
function FilterPill({active,onClick,label}:{active:boolean;onClick:()=>void;label:string}){
  return(
    <button onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${active?'bg-emerald-700 text-emerald-200':'text-slate-400 hover:text-white bg-slate-700/40'}`}>
      {label}
    </button>
  );
}
function InfoRow({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){
  return(
    <div>
      <p className="text-xs text-slate-500 flex items-center gap-1 mb-0.5">{icon} {label}</p>
      <p className="text-xs text-slate-300 break-words">{value}</p>
    </div>
  );
}
