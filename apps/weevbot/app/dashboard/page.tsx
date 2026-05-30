'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bot, Settings, MessageSquare, Send, Zap, LayoutGrid, Inbox,
  Phone, Clock, Plus, Trash2, CheckCircle, Save, RefreshCw,
  PauseCircle, PlayCircle, X, Menu, ChevronLeft,
  Paperclip, Upload, Film, FileText, Image, Music, Library,
  ExternalLink, Download, LogOut, Megaphone, Info, AlertTriangle,
  Mic, Square,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Conversation, Message, Setting, QuickReply, MediaItem } from '@/lib/db';

type Tab = 'inbox' | 'settings' | 'broadcast';
type View = 'chat' | 'kanban';
type StatusFilter = 'all' | 'active' | 'paused' | 'waiting';

interface MetaTemplate { name: string; status: string; category: string; language: string; }
interface BroadcastResult { number: string; ok: boolean; error?: string; }

// ─── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_BG = [
  'bg-violet-600','bg-blue-600','bg-indigo-600',
  'bg-rose-600','bg-amber-600','bg-cyan-600',
];
function Avatar({ name, photoUrl, size = 'sm' }: { name: string; photoUrl?: string|null; size?: 'sm'|'md'|'lg' }) {
  const i = name.charCodeAt(0) % AVATAR_BG.length;
  const s = size==='lg' ? 'w-14 h-14 text-xl' : size==='md' ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name} className={`${s} rounded-full object-cover shrink-0`}
        onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
    );
  }
  return (
    <div className={`${s} ${AVATAR_BG[i]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string|null }) {
  if (status==='active')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/70 text-violet-400 border border-violet-700/50 whitespace-nowrap">IA Ativa</span>;
  if (status==='paused')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/70 text-amber-400 border border-amber-700/50 whitespace-nowrap">Atendente</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 whitespace-nowrap">Aguardando</span>;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function parseMedia(content: string) {
  const m = content.match(/^\[MEDIA:(\w+)(?::([^\]]*))?\]\s*([\s\S]+)/);
  if (!m) return null;
  return { type: m[1], name: m[2] || '', url: m[3].trim() };
}

function MediaBubble({ type, name, url }: { type: string; name: string; url: string }) {
  const icons: Record<string, React.ReactNode> = {
    video: <Film size={20} className="text-purple-300"/>,
    image: <Image size={20} className="text-blue-300"/>,
    document: <FileText size={20} className="text-red-300"/>,
    audio: <Music size={20} className="text-amber-300"/>,
  };
  const labels: Record<string, string> = {
    video:'Vídeo', image:'Imagem', document:'Documento', audio:'Áudio',
  };
  if (type === 'image') {
    return (
      <div className="flex flex-col gap-1">
        <img src={url} alt={name||'imagem'} className="rounded-xl max-w-[220px] max-h-[180px] object-cover cursor-pointer"
          onClick={()=>window.open(url,'_blank')}/>
        {name && <span className="text-xs text-slate-300 px-1">{name}</span>}
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2.5 transition-colors min-w-[160px]">
      {icons[type] ?? <FileText size={20} className="text-slate-300"/>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">{labels[type] ?? 'Arquivo'}</p>
        {name && <p className="text-xs text-slate-300 truncate max-w-[120px]">{name}</p>}
      </div>
      <ExternalLink size={13} className="text-slate-400 shrink-0"/>
    </a>
  );
}

function MsgBubble({ msg }: { msg: Message }) {
  const isRight = msg.role === 'assistant' || msg.role === 'human';
  const bubble =
    msg.role==='assistant' ? 'bg-violet-700/80' :
    msg.role==='human'     ? 'bg-blue-700/80' : 'bg-slate-700';
  const label = msg.role==='assistant' ? 'IA' : msg.role==='human' ? 'Atendente' : undefined;
  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    : '';
  const media = parseMedia(msg.content);
  return (
    <div className={`flex ${isRight?'justify-end':'justify-start'} gap-1.5`}>
      {!isRight && <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 mt-1">👤</div>}
      <div className={`max-w-[72%] flex flex-col ${isRight?'items-end':'items-start'}`}>
        {label && <span className="text-xs text-slate-400 mb-0.5 px-1">{label}</span>}
        <div className={`${bubble} rounded-2xl ${isRight?'rounded-tr-sm':'rounded-tl-sm'} px-4 py-2.5 text-sm text-white`}>
          {media
            ? <MediaBubble type={media.type} name={media.name} url={media.url}/>
            : <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          }
        </div>
        <span className="text-xs text-slate-600 mt-0.5 px-1">{time}</span>
      </div>
    </div>
  );
}

// ─── Conversation list item (with inline pause/resume) ────────────────────────

function ConvItem({
  conv, selected, onClick, onTogglePause, toggling, photoUrl,
}: {
  conv: Conversation; selected: boolean; onClick: () => void;
  onTogglePause: () => void; toggling: boolean; photoUrl?: string|null;
}) {
  const name = conv.push_name || conv.id;
  const time = conv.last_message_at
    ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    : '';
  return (
    <div className={`flex items-start gap-2 px-3 py-3 border-b border-slate-700/50 transition-colors cursor-pointer ${
      selected ? 'bg-violet-900/30 border-l-2 border-l-violet-500' : 'hover:bg-slate-700/30'
    }`}>
      <div onClick={onClick} className="flex items-start gap-2 flex-1 min-w-0">
        <Avatar name={name} photoUrl={photoUrl}/>
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
            ? 'text-violet-400 hover:bg-violet-900/50'
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

// ─── Number list editor ───────────────────────────────────────────────────────

function NumberListEditor({ value, onChange }: { value: string; onChange:(v:string)=>void }) {
  const [input, setInput] = useState('');
  const numbers = value ? value.split(',').map(n=>n.trim()).filter(Boolean) : [];
  const add = () => {
    const n = input.replace(/\D/g,'').trim();
    if (!n) return;
    const updated = Array.from(new Set([...numbers, n]));
    onChange(updated.join(','));
    setInput('');
  };
  const remove = (n: string) => onChange(numbers.filter(x=>x!==n).join(','));
  return (
    <div className="space-y-2">
      {numbers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {numbers.map(n=>(
            <span key={n} className="flex items-center gap-1 bg-slate-700 text-xs text-slate-200 px-2 py-1 rounded-lg">
              {n}
              <button onClick={()=>remove(n)} className="text-slate-400 hover:text-red-400 ml-0.5"><X size={11}/></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ex: 5519999991111"
          onKeyDown={e=>e.key==='Enter'&&add()}
          className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
        <button onClick={add} className="flex items-center gap-1 bg-slate-600 hover:bg-slate-500 text-white text-xs px-3 py-2 rounded-lg transition-colors">
          <Plus size={13}/> Adicionar
        </button>
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
  const isNumberList = setting.key==='allowed_numbers'||setting.key==='blocked_numbers';
  const selectOptions: Record<string, {value:string;label:string}[]> = {
    signature_enabled: [{value:'false',label:'Desativada'},{value:'true',label:'Ativada'}],
    tts_enabled: [{value:'false',label:'Desativado'},{value:'true',label:'Ativado'}],
    tts_voice: [
      {value:'nova',label:'Nova (feminina, natural)'},
      {value:'alloy',label:'Alloy (neutra)'},
      {value:'echo',label:'Echo (masculina)'},
      {value:'fable',label:'Fable (expressiva)'},
      {value:'onyx',label:'Onyx (masculina, profunda)'},
      {value:'shimmer',label:'Shimmer (feminina, suave)'},
    ],
    tts_mode: [
      {value:'both',label:'Texto + Áudio'},
      {value:'audio_only',label:'Apenas Áudio'},
      {value:'text_only',label:'Apenas Texto (TTS desligado)'},
    ],
  };
  const isSelect = setting.key in selectOptions;
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-start mb-1">
        <label className="text-white text-sm font-medium">{setting.label}</label>
        <button onClick={onSave} disabled={saving}
          className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            saved?'bg-violet-600 text-white':'bg-slate-600 hover:bg-slate-500 text-slate-200'
          }`}>
          {saved?<><CheckCircle size={12}/> Salvo</>:saving?'Salvando…':<><Save size={12}/> Salvar</>}
        </button>
      </div>
      <p className="text-slate-400 text-xs mb-2">{setting.description}</p>
      {isSelect ? (
        <select value={value} onChange={e=>onChange(e.target.value)}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
          {selectOptions[setting.key].map(o=>(
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : isNumberList ? (
        <NumberListEditor value={value} onChange={onChange}/>
      ) : isLong ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)} rows={5}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-y"/>
      ) : isSecret ? (
        <div className="relative">
          <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)}
            className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 pr-20 outline-none focus:ring-1 focus:ring-violet-500 font-mono"/>
          <button type="button" onClick={()=>setShow(v=>!v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1">
            {show?'Ocultar':'Mostrar'}
          </button>
        </div>
      ) : (
        <input type="text" value={value} onChange={e=>onChange(e.target.value)}
          className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [tab,setTab]=useState<Tab>('inbox');
  const [view,setView]=useState<View>('chat');
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [quickReplies,setQuickReplies]=useState<QuickReply[]>([]);
  const [mediaItems,setMediaItems]=useState<MediaItem[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [selectedConv,setSelectedConv]=useState<Conversation|null>(null);
  const [replyText,setReplyText]=useState('');
  const [sending,setSending]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const [showMedia,setShowMedia]=useState(false);
  const [uploadingMedia,setUploadingMedia]=useState(false);
  const [sendingMedia,setSendingMedia]=useState<number|null>(null);
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState<StatusFilter>('all');
  const [settings,setSettings]=useState<Setting[]>([]);
  const [settingValues,setSettingValues]=useState<Record<string,string>>({});
  const [savingKey,setSavingKey]=useState<string|null>(null);
  const [savedKey,setSavedKey]=useState<string|null>(null);
  const [togglingPause,setTogglingPause]=useState<string|null>(null);
  const [selectMode,setSelectMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [newQr,setNewQr]=useState({title:'',content:''});
  const [sseError,setSseError]=useState(false);
  const [contactPhotos,setContactPhotos]=useState<Record<string,string|null>>({});
  const [deletingConv,setDeletingConv]=useState<string|null>(null);

  // ── Audio recording state ─────────────────────────────────────────────────
  const [isRecording,setIsRecording]=useState(false);
  const [recSecs,setRecSecs]=useState(0);
  const [audioBlob,setAudioBlob]=useState<Blob|null>(null);
  const [sendingAudio,setSendingAudio]=useState(false);
  const mediaRecRef=useRef<MediaRecorder|null>(null);
  const chunksRef=useRef<BlobPart[]>([]);
  const recTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Broadcast state ───────────────────────────────────────────────────────
  const [bcastMsgType,setBcastMsgType]=useState<'template'|'free'>('template');
  const [bcastNumbers,setBcastNumbers]=useState('');
  const [bcastTemplateName,setBcastTemplateName]=useState('');
  const [bcastTemplateLang,setBcastTemplateLang]=useState('pt_BR');
  const [bcastTemplateVars,setBcastTemplateVars]=useState<string[]>(['']);
  const [bcastFreeText,setBcastFreeText]=useState('');
  const [bcastSending,setBcastSending]=useState(false);
  const [bcastResults,setBcastResults]=useState<BroadcastResult[]>([]);
  const [bcastTemplates,setBcastTemplates]=useState<MetaTemplate[]>([]);
  const [bcastTemplatesLoaded,setBcastTemplatesLoaded]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const replyRef=useRef<HTMLTextAreaElement>(null);
  const mediaUploadRef=useRef<HTMLInputElement>(null);
  const messagesContainerRef=useRef<HTMLDivElement>(null);
  const prevMsgCountRef=useRef(0);
  const fetchedPhotosRef=useRef<Set<string>>(new Set());

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
  const loadMediaItems=useCallback(async()=>{
    const r=await fetch('/api/media'); if(r.ok) setMediaItems(await r.json());
  },[]);

  // SSE for real-time, fallback to polling
  useEffect(()=>{
    loadConversations();loadSettings();loadQuickReplies();loadMediaItems();
    let fb:ReturnType<typeof setInterval>|null=null;
    const es=new EventSource('/api/events');
    es.onmessage=(e)=>{try{const{type,data}=JSON.parse(e.data);if(type==='conversations')setConversations(data);}catch{}};
    es.onerror=()=>{setSseError(true);es.close();fb=setInterval(loadConversations,5000);};
    return()=>{es.close();if(fb)clearInterval(fb);};
  },[loadConversations,loadSettings,loadQuickReplies,loadMediaItems]);

  useEffect(()=>{if(!selected)return;prevMsgCountRef.current=0;loadMessages(selected);const t=setInterval(()=>loadMessages(selected),3000);return()=>clearInterval(t);},[selected,loadMessages]);

  // Smart auto-scroll: instant on first load, smooth only if near bottom
  useEffect(()=>{
    const el=messagesContainerRef.current;
    if(!el||messages.length===0){prevMsgCountRef.current=0;return;}
    if(prevMsgCountRef.current===0){
      bottomRef.current?.scrollIntoView({behavior:'auto'});
    } else if(messages.length>prevMsgCountRef.current){
      const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<150;
      if(atBottom) bottomRef.current?.scrollIntoView({behavior:'smooth'});
    }
    prevMsgCountRef.current=messages.length;
  },[messages]);

  useEffect(()=>{if(!selected)return;const u=conversations.find(c=>c.id===selected);if(u)setSelectedConv(u);},[conversations,selected]);

  // Fetch photos for all conversations as they appear in the list
  useEffect(()=>{
    const missing=conversations.filter(c=>!fetchedPhotosRef.current.has(c.id));
    if(missing.length===0)return;
    missing.forEach(c=>{
      fetchedPhotosRef.current.add(c.id);
      fetch(`/api/contact-photo/${c.id}`)
        .then(r=>r.ok?r.json():null)
        .then(d=>setContactPhotos(p=>({...p,[c.id]:d?.url??null})))
        .catch(()=>setContactPhotos(p=>({...p,[c.id]:null})));
    });
  },[conversations]);

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

  async function sendMedia(mediaId:number){
    if(!selected||sendingMedia!==null)return;
    setSendingMedia(mediaId);
    try{
      await fetch('/api/send-media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,mediaId})});
      setShowMedia(false);
    }finally{setSendingMedia(null);}
  }
  async function handleMediaUpload(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    setUploadingMedia(true);
    try{
      const fd=new FormData();fd.append('file',file);fd.append('name',file.name);
      const r=await fetch('/api/media',{method:'POST',body:fd});
      if(r.ok){const item=await r.json();setMediaItems(prev=>[item,...prev]);}
    }finally{setUploadingMedia(false);e.target.value='';}
  }
  async function removeMediaItem(id:number){
    await fetch(`/api/media/${id}`,{method:'DELETE'});
    setMediaItems(p=>p.filter(m=>m.id!==id));
  }

  async function deleteSelected(){
    if(!window.confirm(`Apagar ${selectedIds.size} conversa(s) e todo o histórico?`))return;
    const ids=Array.from(selectedIds);
    await Promise.all(ids.map(id=>fetch(`/api/conversations/${id}`,{method:'DELETE'})));
    setConversations(p=>p.filter(c=>!selectedIds.has(c.id)));
    if(selected&&selectedIds.has(selected)){setSelected(null);setMessages([]);setSelectedConv(null);}
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  async function deleteConv(id:string){
    if(!window.confirm('Apagar esta conversa e todo o histórico? Esta ação não pode ser desfeita.'))return;
    setDeletingConv(id);
    await fetch(`/api/conversations/${id}`,{method:'DELETE'});
    setConversations(p=>p.filter(c=>c.id!==id));
    if(selected===id){setSelected(null);setMessages([]);setSelectedConv(null);}
    setDeletingConv(null);
  }

  // ── Audio recording ───────────────────────────────────────────────────────
  const startRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunksRef.current=[];
      const mr=new MediaRecorder(stream);
      mr.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      mr.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        setAudioBlob(new Blob(chunksRef.current,{type:mr.mimeType||'audio/webm'}));
        setIsRecording(false);
        if(recTimerRef.current)clearInterval(recTimerRef.current);
      };
      mr.start();mediaRecRef.current=mr;setIsRecording(true);setRecSecs(0);
      recTimerRef.current=setInterval(()=>setRecSecs(s=>{if(s>=119){mr.stop();return s;}return s+1;}),1000);
    }catch{alert('Não foi possível acessar o microfone. Verifique as permissões.');}
  };
  const stopRecording=()=>{mediaRecRef.current?.stop();};
  const cancelRecording=()=>{
    mediaRecRef.current?.stop();
    if(recTimerRef.current)clearInterval(recTimerRef.current);
    setIsRecording(false);setAudioBlob(null);setRecSecs(0);chunksRef.current=[];
  };
  const sendRecordedAudio=async()=>{
    if(!audioBlob||!selected||sendingAudio)return;
    setSendingAudio(true);
    try{
      const reader=new FileReader();
      reader.onloadend=async()=>{
        const base64=(reader.result as string).split(',')[1];
        const r=await fetch('/api/send-audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,audioBase64:base64})});
        if(r.ok){setAudioBlob(null);setRecSecs(0);await loadMessages(selected);}
        else alert('Falha ao enviar áudio.');
        setSendingAudio(false);
      };
      reader.readAsDataURL(audioBlob);
    }catch{setSendingAudio(false);alert('Erro ao enviar áudio.');}
  };
  const fmtSecs=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // ── Broadcast ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(tab!=='broadcast'||bcastTemplatesLoaded)return;
    fetch('/api/meta-templates').then(r=>r.ok?r.json():null).then(d=>{if(d)setBcastTemplates(d.templates||[]);}).catch(()=>{});
    setBcastTemplatesLoaded(true);
  },[tab,bcastTemplatesLoaded]);

  const parsedBcastNums=bcastNumbers.split('\n').map(n=>n.replace(/\D/g,'').trim()).filter(Boolean);

  async function sendBroadcast(){
    if(!parsedBcastNums.length)return;
    if(!window.confirm(`Enviar para ${parsedBcastNums.length} número(s)?`))return;
    setBcastSending(true);setBcastResults([]);
    try{
      const r=await fetch('/api/meta-broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msgType:bcastMsgType,freeText:bcastFreeText,templateName:bcastTemplateName,templateLang:bcastTemplateLang,templateVars:bcastTemplateVars,numbers:parsedBcastNums})});
      const d=await r.json();
      if(d.error){alert(d.error);return;}
      setBcastResults(d.results||[]);
    }catch{alert('Erro ao conectar com a API.');}
    finally{setBcastSending(false);}
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
          <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <Bot size={16}/>
          </div>
          <span className="hidden sm:block text-sm font-extrabold tracking-tight">
            <span className="text-white">WEEV</span><span className="text-violet-400">ZAP</span>
          </span>
          {sseError&&<span className="text-xs text-amber-400 flex items-center gap-1"><RefreshCw size={10}/> polling</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-xs">
            <StatChip label="Total" value={stats.total}/>
            <StatChip label="IA" value={stats.active} color="text-violet-400" dot="bg-violet-400"/>
            <StatChip label="Humano" value={stats.paused} color="text-amber-400" dot="bg-amber-400"/>
          </div>
          <div className="flex items-center gap-1 bg-slate-700/60 rounded-xl p-1">
            <NavBtn active={tab==='inbox'} onClick={()=>setTab('inbox')} icon={<MessageSquare size={13}/>} label="Inbox"/>
            <NavBtn active={tab==='broadcast'} onClick={()=>setTab('broadcast')} icon={<Megaphone size={13}/>} label="Disparo"/>
            <NavBtn active={tab==='settings'} onClick={()=>setTab('settings')} icon={<Settings size={13}/>} label="Config"/>
          </div>
          <button
            onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});router.push('/login');}}
            title="Sair"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={15}/>
          </button>
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
              className="flex-1 min-w-0 bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500"/>
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
                    {/* Toolbar de seleção */}
                    <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                      {selectMode ? (
                        <>
                          <button onClick={()=>setSelectedIds(new Set(filtered.map(c=>c.id)))}
                            className="text-xs text-slate-400 hover:text-white">Todos</button>
                          <div className="flex items-center gap-2">
                            {selectedIds.size>0&&(
                              <button onClick={deleteSelected}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">
                                <Trash2 size={11}/> Apagar ({selectedIds.size})
                              </button>
                            )}
                            <button onClick={()=>{setSelectMode(false);setSelectedIds(new Set());}}
                              className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <button onClick={()=>setSelectMode(true)}
                          className="text-xs text-slate-500 hover:text-white ml-auto">Selecionar</button>
                      )}
                    </div>
                    {filtered.length===0
                      ? <p className="text-center text-slate-500 text-sm py-12">Nenhuma conversa</p>
                      : filtered.map(conv=>(
                        selectMode ? (
                          <div key={conv.id}
                            onClick={()=>{const n=new Set(selectedIds);if(n.has(conv.id))n.delete(conv.id);else n.add(conv.id);setSelectedIds(n);}}
                            className={`flex items-center gap-2 px-3 py-3 border-b border-slate-700/50 cursor-pointer transition-colors ${selectedIds.has(conv.id)?'bg-violet-900/30':'hover:bg-slate-700/30'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedIds.has(conv.id)?'bg-violet-600 border-violet-600':'border-slate-500'}`}>
                              {selectedIds.has(conv.id)&&<CheckCircle size={10} className="text-white"/>}
                            </div>
                            <Avatar name={conv.push_name||conv.id} photoUrl={contactPhotos[conv.id]}/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{conv.push_name||'Sem nome'}</p>
                              <StatusBadge status={conv.status}/>
                              {conv.last_message&&<p className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message}</p>}
                            </div>
                          </div>
                        ) : (
                          <ConvItem
                            key={conv.id} conv={conv} selected={selected===conv.id}
                            onClick={()=>openConversation(conv.id)}
                            onTogglePause={()=>togglePause(conv.id,conv)}
                            toggling={togglingPause===conv.id}
                            photoUrl={contactPhotos[conv.id]}
                          />
                        )
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
                        <Avatar name={selectedConv?.push_name||selected} photoUrl={contactPhotos[selected]} size="md"/>
                        <div>
                          <p className="font-semibold text-sm">{selectedConv?.push_name||'Sem nome'}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Phone size={10}/> {selected}
                          </p>
                        </div>
                        <StatusBadge status={selectedConv?.status}/>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={()=>selectedConv&&togglePause(selected,selectedConv)}
                          disabled={togglingPause===selected}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                            selectedConv?.status==='paused'
                              ?'bg-violet-700 hover:bg-violet-600'
                              :'bg-amber-700 hover:bg-amber-600'
                          }`}>
                          {selectedConv?.status==='paused'
                            ?<><PlayCircle size={13}/> Retomar IA</>
                            :<><PauseCircle size={13}/> Pausar IA</>}
                        </button>
                        <button onClick={()=>deleteConv(selected)}
                          disabled={deletingConv===selected}
                          title="Apagar conversa"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>

                    {/* Messages */}
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-900">
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
                                  className="text-xs bg-slate-700 hover:bg-violet-700 text-white px-3 py-1.5 rounded-full transition-colors">
                                  {qr.title}
                                </button>
                              ))}
                            </div>
                        }
                      </div>
                    )}

                    {/* Media panel */}
                    {showMedia&&(
                      <div className="border-t border-slate-700 bg-slate-800/90 px-3 py-2.5 shrink-0 max-h-52 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Library size={11} className="text-blue-400"/> Biblioteca de Mídia
                          </span>
                          <div className="flex items-center gap-2">
                            <label className={`cursor-pointer text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${uploadingMedia?'text-slate-500':'text-violet-400 hover:bg-slate-700'}`}>
                              <Upload size={11}/>{uploadingMedia?'Enviando…':'Upload'}
                              <input ref={mediaUploadRef} type="file" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia}/>
                            </label>
                            <button onClick={()=>setShowMedia(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                          </div>
                        </div>
                        {mediaItems.length===0
                          ? <p className="text-xs text-slate-500">Nenhum arquivo. Clique em Upload para adicionar.</p>
                          : <div className="flex flex-wrap gap-2">
                              {mediaItems.map(item=>(
                                <div key={item.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-2.5 py-1.5 max-w-[200px]">
                                  <MediaIcon type={item.type}/>
                                  <span className="text-xs text-white truncate flex-1">{item.name}</span>
                                  <button
                                    onClick={()=>sendMedia(item.id)}
                                    disabled={sendingMedia===item.id}
                                    className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-2 py-0.5 rounded transition-colors disabled:opacity-40 shrink-0">
                                    {sendingMedia===item.id?'…':'Enviar'}
                                  </button>
                                </div>
                              ))}
                            </div>
                        }
                      </div>
                    )}

                    {/* Reply box */}
                    <div className="border-t border-slate-700 bg-slate-800 px-3 py-3 flex items-end gap-2 shrink-0">
                      {!isRecording&&!audioBlob&&(
                        <>
                          <button onClick={()=>{setShowQR(v=>!v);setShowMedia(false);}} title="Respostas rápidas"
                            className={`p-2 rounded-lg transition-colors shrink-0 ${showQR?'bg-amber-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                            <Zap size={17}/>
                          </button>
                          <button onClick={()=>{setShowMedia(v=>!v);setShowQR(false);}} title="Biblioteca de Mídia"
                            className={`p-2 rounded-lg transition-colors shrink-0 ${showMedia?'bg-blue-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                            <Paperclip size={17}/>
                          </button>
                        </>
                      )}

                      {isRecording?(
                        <div className="flex-1 flex items-center gap-2.5 bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"/>
                          <span className="text-sm font-mono text-red-400">{fmtSecs(recSecs)}</span>
                          <span className="text-xs text-slate-400 flex-1">Gravando… (máx 2min)</span>
                          <button onClick={cancelRecording} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                        </div>
                      ):audioBlob?(
                        <div className="flex-1 flex items-center gap-2.5 bg-violet-900/20 border border-violet-700/40 rounded-xl px-3 py-2.5">
                          <Music size={16} className="text-violet-400 shrink-0"/>
                          <span className="text-sm text-slate-300 flex-1">Áudio gravado · {fmtSecs(recSecs)}</span>
                          <button onClick={()=>{setAudioBlob(null);setRecSecs(0);}} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                        </div>
                      ):(
                        <textarea ref={replyRef} value={replyText} onChange={e=>setReplyText(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();sendReply();}}}
                          placeholder="Responder como atendente… (Ctrl+Enter)"
                          rows={2}
                          className="flex-1 bg-slate-700 text-sm text-white placeholder-slate-400 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                      )}

                      {!audioBlob&&(
                        <button onClick={isRecording?stopRecording:startRecording}
                          className={`p-2.5 rounded-xl transition-colors shrink-0 ${isRecording?'bg-red-600 hover:bg-red-500 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                          title={isRecording?'Parar gravação':'Gravar áudio'}>
                          {isRecording?<Square size={15}/>:<Mic size={17}/>}
                        </button>
                      )}

                      {audioBlob?(
                        <button onClick={sendRecordedAudio} disabled={sendingAudio}
                          className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
                          title="Enviar áudio">
                          {sendingAudio?<RefreshCw size={15} className="animate-spin"/>:<Send size={17}/>}
                        </button>
                      ):!isRecording?(
                        <button onClick={sendReply} disabled={sending||!replyText.trim()}
                          className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0">
                          <Send size={17}/>
                        </button>
                      ):null}
                    </div>
                  </>
                )}
              </main>

              {/* Contact info panel — hidden on small screens */}
              {selected&&selectedConv&&(
                <aside className="hidden xl:flex w-56 bg-slate-800 border-l border-slate-700 flex-col shrink-0 overflow-y-auto">
                  <div className="p-5 border-b border-slate-700 flex flex-col items-center gap-3 text-center">
                    <Avatar name={selectedConv.push_name||selected} photoUrl={contactPhotos[selected]} size="lg"/>
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
                        selectedConv.status==='paused'?'bg-violet-700/60 hover:bg-violet-700 text-violet-300':'bg-amber-700/60 hover:bg-amber-700 text-amber-300'
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
                  accent={{dot:'bg-violet-400',border:'border-violet-700/50',text:'text-violet-400',bg:'bg-violet-900/30'}}
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

      {/* ── BROADCAST ── */}
      {tab==='broadcast'&&(
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center">
                <Megaphone size={20} className="text-violet-400"/>
              </div>
              <div>
                <h2 className="text-white font-semibold">Disparo em Massa</h2>
                <p className="text-slate-400 text-xs">Via Meta WhatsApp API Oficial</p>
              </div>
            </div>

            {(!settingValues['meta_phone_number_id']||!settingValues['meta_access_token'])&&(
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-amber-300 text-sm font-medium">Credenciais não configuradas</p>
                  <p className="text-amber-400/80 text-xs mt-0.5">Configure o <strong>Phone Number ID</strong> e o <strong>Token de Acesso</strong> nas Configurações antes de enviar.</p>
                  <button onClick={()=>setTab('settings')} className="mt-2 text-xs text-amber-300 underline hover:text-amber-200">Ir para Configurações →</button>
                </div>
              </div>
            )}

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                <p className="text-white text-sm font-medium">Tipo de Mensagem</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setBcastMsgType('template')}
                  className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='template'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                  <p className="text-sm font-medium text-white">📋 Template Aprovado</p>
                  <p className="text-xs text-slate-400 mt-0.5">Templates criados e aprovados pela Meta. Funciona para qualquer contato, mesmo sem conversa ativa.</p>
                </button>
                <button onClick={()=>setBcastMsgType('free')}
                  className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='free'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                  <p className="text-sm font-medium text-white">💬 Texto Livre</p>
                  <p className="text-xs text-slate-400 mt-0.5"><span className="text-amber-400 font-medium">Válida somente se o contato enviou mensagem nas últimas 24h.</span> Use com cuidado.</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <p className="text-white text-sm font-medium">{bcastMsgType==='template'?'Template':'Mensagem'}</p>
              </div>
              {bcastMsgType==='template'?(
                <div className="space-y-3">
                  <div className="bg-slate-700/50 rounded-lg p-3 flex gap-2">
                    <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-slate-300">O <strong>nome do template</strong> é o identificador técnico (ex: <code className="bg-slate-600 px-1 rounded">lembrete_consulta</code>). Crie e aprove em: <strong>Meta Business Manager → WhatsApp → Modelos de Mensagem</strong>.</p>
                  </div>
                  {bcastTemplates.length>0&&(
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Templates aprovados (clique para selecionar)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {bcastTemplates.map(t=>(
                          <button key={t.name} onClick={()=>{setBcastTemplateName(t.name);setBcastTemplateLang(t.language||'pt_BR');}}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${bcastTemplateName===t.name?'border-violet-500 bg-violet-600/20 text-violet-300':'border-slate-600 text-slate-300 hover:border-slate-400'}`}>
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Nome do template *</label>
                      <input value={bcastTemplateName} onChange={e=>setBcastTemplateName(e.target.value)} placeholder="ex: lembrete_agendamento"
                        className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 font-mono"/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Código do idioma</label>
                      <input value={bcastTemplateLang} onChange={e=>setBcastTemplateLang(e.target.value)} placeholder="pt_BR"
                        className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">Variáveis do template (opcional)</label>
                      <button onClick={()=>setBcastTemplateVars(v=>[...v,''])} className="text-xs text-violet-400 hover:text-violet-300">+ Adicionar variável</button>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2.5 mb-2 flex gap-2">
                      <Info size={13} className="text-blue-400 shrink-0 mt-0.5"/>
                      <p className="text-xs text-slate-400">Se o template usa <code className="bg-slate-600 px-1 rounded">{'{{1}}'}</code>, <code className="bg-slate-600 px-1 rounded">{'{{2}}'}</code> etc., preencha na mesma ordem. Todos os destinatários receberão os mesmos valores.</p>
                    </div>
                    {bcastTemplateVars.map((v,i)=>(
                      <div key={i} className="flex gap-2 mb-2">
                        <span className="text-xs text-slate-500 w-16 flex items-center shrink-0">{`{{${i+1}}}`}</span>
                        <input value={v} onChange={e=>setBcastTemplateVars(prev=>prev.map((x,j)=>j===i?e.target.value:x))} placeholder={`Valor para {{${i+1}}}`}
                          className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                        {bcastTemplateVars.length>1&&<button onClick={()=>setBcastTemplateVars(prev=>prev.filter((_,j)=>j!==i))} className="text-slate-500 hover:text-red-400"><X size={14}/></button>}
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div className="space-y-3">
                  <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3 flex gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-amber-300">Texto livre só pode ser enviado para contatos que interagiram com seu número nas <strong>últimas 24 horas</strong>. Enviar fora dessa janela viola as políticas da Meta e pode suspender o número.</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Mensagem *</label>
                    <textarea value={bcastFreeText} onChange={e=>setBcastFreeText(e.target.value)} placeholder="Digite a mensagem..." rows={4}
                      className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-y"/>
                    <p className="text-xs text-slate-500 mt-1">{bcastFreeText.length} caracteres</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                <p className="text-white text-sm font-medium">Destinatários</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 flex gap-2">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-slate-300">Cole os números um por linha, com DDI + DDD + número, sem espaços. <strong>Exemplo:</strong> <code className="bg-slate-600 px-1 rounded">5519999991111</code></p>
              </div>
              <textarea value={bcastNumbers} onChange={e=>setBcastNumbers(e.target.value)} placeholder={'5511999991111\n5521988887777\n5519912345678'} rows={6}
                className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-y font-mono"/>
              <p className="text-xs text-slate-400">
                {parsedBcastNums.length>0
                  ?<span className="text-violet-400 font-medium">{parsedBcastNums.length} número(s) válido(s)</span>
                  :'Nenhum número detectado'}
              </p>
            </div>

            <button onClick={sendBroadcast}
              disabled={bcastSending||parsedBcastNums.length===0||(bcastMsgType==='template'&&!bcastTemplateName)||(bcastMsgType==='free'&&!bcastFreeText.trim())}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
              {bcastSending?<><RefreshCw size={16} className="animate-spin"/>Enviando…</>:<><Megaphone size={16}/>Enviar para {parsedBcastNums.length} número(s)</>}
            </button>

            {bcastResults.length>0&&(
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">Resultado</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400">✓ {bcastResults.filter(r=>r.ok).length} enviados</span>
                    {bcastResults.filter(r=>!r.ok).length>0&&<span className="text-red-400">✗ {bcastResults.filter(r=>!r.ok).length} falhas</span>}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {bcastResults.map((r,i)=>(
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${r.ok?'bg-emerald-900/20 border border-emerald-700/30':'bg-red-900/20 border border-red-700/30'}`}>
                      <span className={r.ok?'text-emerald-400':'text-red-400'}>{r.ok?'✓':'✗'}</span>
                      <span className="font-mono text-slate-300">{r.number}</span>
                      {r.error&&<span className="text-red-400 ml-auto truncate max-w-[50%]">{r.error}</span>}
                      {r.ok&&<span className="text-emerald-400 ml-auto">Enviado</span>}
                    </div>
                  ))}
                </div>
                <button onClick={()=>setBcastResults([])} className="text-xs text-slate-500 hover:text-slate-300">Limpar resultados</button>
              </div>
            )}
          </div>
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
                <Library size={16} className="text-blue-400"/> Biblioteca de Mídia
              </h2>
              <div className="space-y-3">
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <label className={`inline-flex items-center gap-2 cursor-pointer text-sm font-medium px-4 py-2 rounded-lg transition-colors ${uploadingMedia?'bg-slate-600 text-slate-400':'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                    <Upload size={14}/>{uploadingMedia?'Enviando arquivo…':'Fazer Upload de Arquivo'}
                    <input type="file" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia}/>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Suporta vídeos, PDFs, imagens e áudios. Os arquivos ficam disponíveis para envio rápido no chat.</p>
                </div>
                {mediaItems.length===0&&<p className="text-slate-500 text-sm">Nenhum arquivo na biblioteca.</p>}
                {mediaItems.map(item=>(
                  <div key={item.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                      <MediaIcon type={item.type}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span className="capitalize">{item.type}</span>
                        {item.size_bytes>0&&<span>{(item.size_bytes/1024/1024).toFixed(1)} MB</span>}
                        <span>{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                      </p>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 shrink-0 px-2 py-1 rounded hover:bg-slate-700 transition-colors">
                      Ver
                    </a>
                    <button onClick={()=>removeMediaItem(item.id)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={14}/>
                    </button>
                  </div>
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
                  <p className="text-sm font-medium text-white flex items-center gap-1.5"><Plus size={14} className="text-violet-400"/> Nova resposta rápida</p>
                  <input type="text" placeholder="Título (ex: Horário de atendimento)" value={newQr.title}
                    onChange={e=>setNewQr(p=>({...p,title:e.target.value}))}
                    className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <textarea placeholder="Texto que será enviado ao cliente…" value={newQr.content}
                    onChange={e=>setNewQr(p=>({...p,content:e.target.value}))} rows={4}
                    className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                  <button onClick={addQuickReply} disabled={!newQr.title.trim()||!newQr.content.trim()}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
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
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${active?'bg-violet-600 text-white':'text-slate-400 hover:text-white'}`}>
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
      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${active?'bg-violet-700 text-violet-200':'text-slate-400 hover:text-white bg-slate-700/40'}`}>
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
function MediaIcon({type}:{type:string}){
  if(type==='video') return <Film size={14} className="text-purple-400"/>;
  if(type==='image') return <Image size={14} className="text-blue-400"/>;
  if(type==='audio') return <Music size={14} className="text-amber-400"/>;
  return <FileText size={14} className="text-red-400"/>;
}
