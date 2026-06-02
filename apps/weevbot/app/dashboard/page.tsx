'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Settings, MessageSquare, Send, Zap, LayoutGrid,
  Phone, Clock, Plus, Trash2, CheckCircle, Save, RefreshCw,
  PauseCircle, PlayCircle, X, Menu, ChevronLeft,
  Paperclip, Upload, Film, FileText, Image, Music, Library,
  ExternalLink, LogOut, Megaphone, Info, AlertTriangle,
  Mic, Square, ChevronDown, ChevronUp, BarChart2,
  Wifi, WifiOff, Users, ShieldCheck, KeyRound, Eye, EyeOff, Bell, Link, Building2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Conversation, Message, Setting, QuickReply, MediaItem, DailyReport } from '@/lib/db';

type Tab = 'dashboard' | 'inbox' | 'whatsapp' | 'broadcast' | 'sectors' | 'followups' | 'settings' | 'admin';
type View = 'chat' | 'kanban';
type StatusFilter = 'all' | 'active' | 'paused' | 'waiting';

interface MetaTemplate { name: string; status: string; category: string; language: string; }
interface BroadcastResult { number: string; ok: boolean; error?: string; }
interface WaStatus { connected: boolean; qrCode: string | null; instance: string; }
interface AdminUser { id: number; email: string; name: string | null; created_at: string; }
interface FollowupConfig { id?: number; step_order: number; enabled: boolean; delay_minutes: number; message: string; file_url: string; file_type: string; file_name: string; }
interface MediaUrlItem { id: number; name: string; url: string; type: 'document'|'video'|'image'|'audio'; description: string|null; }

// ─── FollowupStepCard ─────────────────────────────────────────────────────────
function FollowupStepCard({ step, config, onSave }: { step: number; config: FollowupConfig; onSave: (c: FollowupConfig) => Promise<void>; }) {
  const [local, setLocal] = useState<FollowupConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const delayUnit = local.delay_minutes >= 1440 ? 'days' : local.delay_minutes >= 60 ? 'hours' : 'minutes';
  const delayVal = delayUnit==='days' ? local.delay_minutes/1440 : delayUnit==='hours' ? local.delay_minutes/60 : local.delay_minutes;
  const setDelay = (val: number, unit: string) => {
    const mins = unit==='days' ? val*1440 : unit==='hours' ? val*60 : val;
    setLocal(p=>({...p, delay_minutes: mins}));
  };
  const handleSave = async () => {
    setSaving(true); await onSave(local); setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };

  return (
    <div className={`bg-slate-800 rounded-xl border transition-colors ${local.enabled?'border-violet-700/50':'border-slate-700'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${local.enabled?'bg-violet-600 text-white':'bg-slate-700 text-slate-400'}`}>{step}</div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Follow-up {step}</p>
          <p className="text-slate-400 text-xs truncate">{local.enabled ? `Apos ${local.delay_minutes >= 1440 ? `${local.delay_minutes/1440}d` : local.delay_minutes >= 60 ? `${local.delay_minutes/60}h` : `${local.delay_minutes}min`} · ${local.message||'(sem mensagem)'}` : 'Desativado'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e=>{e.stopPropagation(); setLocal(p=>({...p, enabled:!p.enabled}));}}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${local.enabled?'bg-violet-600/20 text-violet-400':'bg-slate-700 text-slate-500'}`}>
            {local.enabled?'Ativo':'Off'}
          </button>
          {open ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Enviar apos</label>
            <div className="flex gap-2">
              <input type="number" min="1" value={Math.round(delayVal)} onChange={e=>setDelay(parseInt(e.target.value)||1, delayUnit)}
                className="w-24 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
              <select value={delayUnit} onChange={e=>setDelay(Math.round(delayVal), e.target.value)}
                className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Mensagem</label>
            <textarea value={local.message} onChange={e=>setLocal(p=>({...p,message:e.target.value}))} rows={3} placeholder="Mensagem do follow-up..."
              className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Arquivo (opcional)</label>
            <input type="url" value={local.file_url} onChange={e=>setLocal(p=>({...p,file_url:e.target.value}))} placeholder="URL do arquivo (PDF, video, imagem...)"
              className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 mb-2"/>
            <div className="flex gap-2">
              <select value={local.file_type} onChange={e=>setLocal(p=>({...p,file_type:e.target.value}))}
                className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                <option value="">Tipo</option>
                <option value="image">Imagem</option>
                <option value="video">Video</option>
                <option value="document">Documento/PDF</option>
              </select>
              <input type="text" value={local.file_name} onChange={e=>setLocal(p=>({...p,file_name:e.target.value}))} placeholder="Nome do arquivo"
                className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`w-full flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-colors ${saved?'bg-violet-600 text-white':'bg-slate-600 hover:bg-slate-500 text-white'} disabled:opacity-50`}>
            {saved?<><CheckCircle size={14}/> Salvo!</>:saving?'Salvando...':<><Save size={14}/> Salvar passo {step}</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WeevZap Logo ─────────────────────────────────────────────────────────────
function WeevZapLogo({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
  const dim = size === 'md' ? 40 : size === 'sm' ? 32 : 24;
  return (
    <svg width={dim} height={dim} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#7c3aed"/>
      <line x1="24" y1="6" x2="24" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="24" cy="5" r="2.5" fill="white"/>
      <rect x="10" y="13" width="28" height="20" rx="5" fill="white"/>
      <rect x="15" y="18" width="7" height="7" rx="2" fill="#7c3aed"/>
      <rect x="26" y="18" width="7" height="7" rx="2" fill="#7c3aed"/>
      <rect x="16.5" y="19.5" width="2" height="2" rx="0.5" fill="white"/>
      <rect x="27.5" y="19.5" width="2" height="2" rx="0.5" fill="white"/>
      <rect x="16" y="28" width="16" height="3" rx="1.5" fill="#7c3aed"/>
      <rect x="19" y="28" width="2" height="3" fill="white"/>
      <rect x="23" y="28" width="2" height="3" fill="white"/>
      <rect x="27" y="28" width="2" height="3" fill="white"/>
      <rect x="14" y="34" width="20" height="10" rx="4" fill="white"/>
      <circle cx="24" cy="39" r="3" fill="#7c3aed" opacity="0.4"/>
      <rect x="6" y="34" width="7" height="5" rx="2.5" fill="white"/>
      <rect x="35" y="34" width="7" height="5" rx="2.5" fill="white"/>
    </svg>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${color} flex items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-xs mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">{icon}</div>
    </div>
  );
}

// ─── HourChart ────────────────────────────────────────────────────────────────
function HourChart({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map(d=>d.count), 1);
  const all = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: data.find(d=>d.hour===h)?.count||0 }));
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {all.map(d => (
        <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${d.hour}h: ${d.count} msgs`}>
          <div className="w-full bg-violet-600 rounded-sm transition-all duration-300" style={{ height: `${(d.count/max)*100}%`, minHeight: d.count?'2px':'0' }}/>
          {d.hour % 6 === 0 && <span className="text-[8px] text-slate-500 absolute -bottom-4">{d.hour}h</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_BG = ['bg-violet-600','bg-blue-600','bg-indigo-600','bg-rose-600','bg-amber-600','bg-cyan-600'];
function Avatar({ name, photoUrl, size = 'sm' }: { name: string; photoUrl?: string|null; size?: 'sm'|'md'|'lg' }) {
  const i = name.charCodeAt(0) % AVATAR_BG.length;
  const s = size==='lg' ? 'w-14 h-14 text-xl' : size==='md' ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${s} rounded-full object-cover shrink-0`} onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>;
  }
  return (
    <div className={`${s} ${AVATAR_BG[i]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string|null }) {
  if (status==='active')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/70 text-violet-400 border border-violet-700/50 whitespace-nowrap">IA Ativa</span>;
  if (status==='paused')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/70 text-amber-400 border border-amber-700/50 whitespace-nowrap">Atendente</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 whitespace-nowrap">Aguardando</span>;
}

// ─── Media helpers ────────────────────────────────────────────────────────────
function parseMedia(content: string) {
  const m = content.match(/^\[MEDIA:(\w+)(?::([^\]]*))?\]\s*([\s\S]+)/);
  if (!m) return null;
  return { type: m[1], name: m[2] || '', url: m[3].trim() };
}

function MediaBubble({ type, name, url }: { type: string; name: string; url: string }) {
  const icons: Record<string, React.ReactNode> = {
    video: <Film size={20} className="text-purple-300"/>, image: <Image size={20} className="text-blue-300"/>,
    document: <FileText size={20} className="text-red-300"/>, audio: <Music size={20} className="text-amber-300"/>,
  };
  const labels: Record<string, string> = { video:'Vídeo', image:'Imagem', document:'Documento', audio:'Áudio' };
  if (type === 'image') return (
    <div className="flex flex-col gap-1">
      <img src={url} alt={name||'imagem'} className="rounded-xl max-w-[220px] max-h-[180px] object-cover cursor-pointer" onClick={()=>window.open(url,'_blank')}/>
      {name && <span className="text-xs text-slate-300 px-1">{name}</span>}
    </div>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2.5 transition-colors min-w-[160px]">
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
  const bubble = msg.role==='assistant' ? 'bg-violet-700/80' : msg.role==='human' ? 'bg-blue-700/80' : 'bg-slate-700';
  const label = msg.role==='assistant' ? 'IA' : msg.role==='human' ? 'Atendente' : undefined;
  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
  const media = parseMedia(msg.content);
  return (
    <div className={`flex ${isRight?'justify-end':'justify-start'} gap-1.5`}>
      {!isRight && <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 mt-1">👤</div>}
      <div className={`max-w-[72%] flex flex-col ${isRight?'items-end':'items-start'}`}>
        {label && <span className="text-xs text-slate-400 mb-0.5 px-1">{label}</span>}
        <div className={`${bubble} rounded-2xl ${isRight?'rounded-tr-sm':'rounded-tl-sm'} px-4 py-2.5 text-sm text-white`}>
          {media ? <MediaBubble type={media.type} name={media.name} url={media.url}/> : <span className="whitespace-pre-wrap break-words">{msg.content}</span>}
        </div>
        <span className="text-xs text-slate-600 mt-0.5 px-1">{time}</span>
      </div>
    </div>
  );
}

// ─── ConvItem ─────────────────────────────────────────────────────────────────
function ConvItem({ conv, selected, onClick, onTogglePause, toggling, photoUrl, sectorName }: {
  conv: Conversation; selected: boolean; onClick: () => void;
  onTogglePause: () => void; toggling: boolean; photoUrl?: string|null; sectorName?: string;
}) {
  const name = conv.push_name || conv.id;
  const time = conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
  return (
    <div className={`flex items-start gap-2 px-3 py-3 border-b border-slate-700/50 transition-colors cursor-pointer ${selected?'bg-violet-900/30 border-l-2 border-l-violet-500':'hover:bg-slate-700/30'}`}>
      <div onClick={onClick} className="flex items-start gap-2 flex-1 min-w-0">
        <Avatar name={name} photoUrl={photoUrl}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-medium text-white truncate">{conv.push_name || 'Sem nome'}</span>
            <span className="text-xs text-slate-500 shrink-0">{time}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusBadge status={conv.status}/>
            {sectorName && <span className="text-[10px] px-1.5 py-0.5 bg-violet-800/40 text-violet-300 rounded-full">{sectorName}</span>}
          </div>
          {conv.last_message && <p className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message}</p>}
        </div>
      </div>
      <button onClick={e=>{e.stopPropagation();onTogglePause();}} disabled={toggling} title={conv.status==='paused'?'Retomar IA':'Pausar IA'}
        className={`mt-1 p-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0 ${conv.status==='paused'?'text-violet-400 hover:bg-violet-900/50':'text-amber-400 hover:bg-amber-900/50'}`}>
        {conv.status==='paused' ? <PlayCircle size={15}/> : <PauseCircle size={15}/>}
      </button>
    </div>
  );
}

// ─── KanbanCol ────────────────────────────────────────────────────────────────
function KanbanCol({ label, convs, accent, onSelect }: { label: string; convs: Conversation[]; accent: { dot:string;border:string;text:string;bg:string }; onSelect:(id:string)=>void }) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 ${accent.bg} border ${accent.border}`}>
        <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${accent.dot}`}/><span className={`text-sm font-medium ${accent.text}`}>{label}</span></div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${accent.bg} ${accent.text} border ${accent.border}`}>{convs.length}</span>
      </div>
      <div className="space-y-2 overflow-y-auto">
        {convs.length===0 && <p className="text-center text-slate-600 text-xs py-6">Vazio</p>}
        {convs.map(c=>(
          <button key={c.id} onClick={()=>onSelect(c.id)} className="w-full bg-slate-800 hover:bg-slate-700/60 border border-slate-700 rounded-xl p-3 text-left transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar name={c.push_name||c.id}/>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{c.push_name||'Sem nome'}</p><p className="text-xs text-slate-500 truncate">{c.id}</p></div>
            </div>
            {c.last_message && <p className="text-xs text-slate-400 truncate">{c.last_message}</p>}
            {c.last_message_at && <p className="text-xs text-slate-600 mt-1">{new Date(c.last_message_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── NumberListEditor ─────────────────────────────────────────────────────────
function NumberListEditor({ value, onChange }: { value: string; onChange:(v:string)=>void }) {
  const [input, setInput] = useState('');
  const numbers = value ? value.split(',').map(n=>n.trim()).filter(Boolean) : [];
  const add = () => { const n=input.replace(/\D/g,'').trim();if(!n)return;onChange(Array.from(new Set([...numbers,n])).join(','));setInput(''); };
  const remove = (n: string) => onChange(numbers.filter(x=>x!==n).join(','));
  return (
    <div className="space-y-2">
      {numbers.length>0&&<div className="flex flex-wrap gap-1.5">{numbers.map(n=><span key={n} className="flex items-center gap-1 bg-slate-700 text-xs text-slate-200 px-2 py-1 rounded-lg">{n}<button onClick={()=>remove(n)} className="text-slate-400 hover:text-red-400 ml-0.5"><X size={11}/></button></span>)}</div>}
      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ex: 5519999991111" onKeyDown={e=>e.key==='Enter'&&add()}
          className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
        <button onClick={add} className="flex items-center gap-1 bg-slate-600 hover:bg-slate-500 text-white text-xs px-3 py-2 rounded-lg transition-colors"><Plus size={13}/> Adicionar</button>
      </div>
    </div>
  );
}

// ─── SettingCard ──────────────────────────────────────────────────────────────
function SettingCard({ setting, value, onChange, onSave, saving, saved }: {
  setting: Setting; value: string; onChange:(v:string)=>void; onSave:()=>void; saving:boolean; saved:boolean;
}) {
  const [show,setShow] = useState(false);
  const isLong = setting.key==='system_prompt'||setting.key==='welcome_message';
  const isSecret = setting.key==='openai_api_key'||setting.key==='supabase_key';
  const isNumberList = setting.key==='allowed_numbers'||setting.key==='blocked_numbers';
  const selectOptions: Record<string,{value:string;label:string}[]> = {
    signature_enabled:[{value:'false',label:'Desativada'},{value:'true',label:'Ativada'}],
    tts_enabled:[{value:'false',label:'Desativado'},{value:'true',label:'Ativado'}],
    tts_voice:[{value:'nova',label:'Nova (feminina, natural)'},{value:'alloy',label:'Alloy (neutra)'},{value:'echo',label:'Echo (masculina)'},{value:'fable',label:'Fable (expressiva)'},{value:'onyx',label:'Onyx (masculina, profunda)'},{value:'shimmer',label:'Shimmer (feminina, suave)'}],
    tts_mode:[{value:'both',label:'Texto + Áudio'},{value:'audio_only',label:'Apenas Áudio'},{value:'text_only',label:'Apenas Texto'}],
  };
  const isSelect = setting.key in selectOptions;
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-start mb-1">
        <label className="text-white text-sm font-medium">{setting.label}</label>
        <button onClick={onSave} disabled={saving}
          className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${saved?'bg-violet-600 text-white':'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}>
          {saved?<><CheckCircle size={12}/> Salvo</>:saving?'Salvando…':<><Save size={12}/> Salvar</>}
        </button>
      </div>
      <p className="text-slate-400 text-xs mb-2">{setting.description}</p>
      {isSelect ? (
        <select value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
          {selectOptions[setting.key].map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : isNumberList ? <NumberListEditor value={value} onChange={onChange}/>
        : isLong ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={5} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-y"/>
        : isSecret ? (
          <div className="relative">
            <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 pr-20 outline-none focus:ring-1 focus:ring-violet-500 font-mono"/>
            <button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1">{show?'Ocultar':'Mostrar'}</button>
          </div>
        ) : (
          <input type="text" value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
        )}
    </div>
  );
}

// ─── SettingGroup (collapsible) ───────────────────────────────────────────────
function SettingGroup({ label, icon, defaultOpen = false, children }: { label: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden">
      <button onClick={()=>setOpen(v=>!v)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700/50 transition-colors text-left">
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-200">{icon}{label}</div>
        {open ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
      </button>
      {open && <div className="p-3 space-y-3 bg-slate-900/30">{children}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inbox');
  const [view, setView] = useState<View>('chat');
  const [navOpen, setNavOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [convOpen, setConvOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<string|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation|null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sendingMedia, setSendingMedia] = useState<number|null>(null);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string,string>>({});
  const [savingKey, setSavingKey] = useState<string|null>(null);
  const [savedKey, setSavedKey] = useState<string|null>(null);
  const [togglingPause, setTogglingPause] = useState<string|null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newQr, setNewQr] = useState({title:'',content:''});
  const [sseError, setSseError] = useState(false);
  const [contactPhotos, setContactPhotos] = useState<Record<string,string|null>>({});
  const [deletingConv, setDeletingConv] = useState<string|null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Follow-ups
  const [followupConfigs, setFollowupConfigs] = useState<FollowupConfig[]>(() =>
    [1,2,3,4,5].map(s=>({step_order:s, enabled:false, delay_minutes:60, message:'', file_url:'', file_type:'', file_name:''}))
  );

  // Current user
  const [currentUserEmail, setCurrentUserEmail] = useState<string|null>(null);
  const [currentRole, setCurrentRole] = useState<'admin'|'operator'>('admin');
  const [currentSectorId, setCurrentSectorId] = useState<number|null>(null);
  const ADMIN_EMAIL = 'wignor.ferreira@gmail.com';

  // Sectors & Operators (admin panel)
  const [sectors, setSectors] = useState<{id:number;name:string;description:string|null}[]>([]);
  const [operators, setOperators] = useState<{id:number;name:string;email:string;sector_id:number|null;sector_name?:string;created_at:string}[]>([]);
  const [sectorsOpLoaded, setSectorsOpLoaded] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<'users'|'sectors'|'operators'>('users');
  const [newSector, setNewSector] = useState({ name: '' });
  const [creatingSector, setCreatingSector] = useState(false);
  const [newOperator, setNewOperator] = useState({ name: '', email: '', password: '', sectorId: '' });
  const [creatingOperator, setCreatingOperator] = useState(false);

  // Media URLs
  const [mediaUrls, setMediaUrls] = useState<MediaUrlItem[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState({ name: '', url: '', type: 'document' as MediaUrlItem['type'], description: '' });
  const [savingMediaUrl, setSavingMediaUrl] = useState(false);

  // Admin panel
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersLoaded, setAdminUsersLoaded] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<number|null>(null);
  const [resetingUser, setResetingUser] = useState<number|null>(null);
  const [resetPwd, setResetPwd] = useState<Record<number,string>>({});
  // Change password
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [changePwdForm, setChangePwdForm] = useState({ current: '', next: '', confirm: '' });
  const [changePwdSaving, setChangePwdSaving] = useState(false);
  const [changePwdMsg, setChangePwdMsg] = useState<{ok:boolean;text:string}|null>(null);
  const [showPwdFields, setShowPwdFields] = useState({ current: false, next: false, confirm: false });

  // Dashboard
  const [dailyReport, setDailyReport] = useState<DailyReport|null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0,10));
  const [reportLoading, setReportLoading] = useState(false);

  // WhatsApp
  const [waStatus, setWaStatus] = useState<WaStatus>({ connected: false, qrCode: null, instance: '' });
  const [waLoading, setWaLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Broadcast
  const [bcastMsgType, setBcastMsgType] = useState<'template'|'free'>('template');
  const [bcastNumbers, setBcastNumbers] = useState('');
  const [bcastTemplateName, setBcastTemplateName] = useState('');
  const [bcastTemplateLang, setBcastTemplateLang] = useState('pt_BR');
  const [bcastTemplateVars, setBcastTemplateVars] = useState<string[]>(['']);
  const [bcastFreeText, setBcastFreeText] = useState('');
  const [bcastSending, setBcastSending] = useState(false);
  const [bcastResults, setBcastResults] = useState<BroadcastResult[]>([]);
  const [bcastTemplates, setBcastTemplates] = useState<MetaTemplate[]>([]);
  const [bcastTemplatesLoaded, setBcastTemplatesLoaded] = useState(false);
  const [bcastScheduledAt, setBcastScheduledAt] = useState('');
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<{id:number;msg_type:string;template_name:string|null;numbers:string[];scheduled_at:string;status:string;result_count:number|null}[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const mediaUploadRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const fetchedPhotosRef = useRef<Set<string>>(new Set());

  const loadConversations = useCallback(async()=>{
    const r=await fetch('/api/conversations'); if(r.ok) setConversations(await r.json());
  },[]);
  const loadMessages = useCallback(async(id:string)=>{
    const r=await fetch(`/api/conversations/${id}`);
    if(r.ok){const d=await r.json();setMessages(d.messages??[]);setSelectedConv(d.conversation??null);}
  },[]);
  const loadSettings = useCallback(async()=>{
    const r=await fetch('/api/settings');
    if(r.ok){const d:Setting[]=await r.json();setSettings(d);const v:Record<string,string>={};d.forEach(s=>{v[s.key]=s.value??'';});setSettingValues(v);}
  },[]);
  const loadQuickReplies = useCallback(async()=>{const r=await fetch('/api/quick-replies');if(r.ok)setQuickReplies(await r.json());},[]);
  const loadMediaItems = useCallback(async()=>{const r=await fetch('/api/media');if(r.ok)setMediaItems(await r.json());},[]);
  const loadMediaUrls = useCallback(async()=>{const r=await fetch('/api/media-urls');if(r.ok)setMediaUrls(await r.json());},[]);

  const loadCurrentUser = useCallback(async()=>{
    try{const r=await fetch('/api/auth/me');if(r.ok){const d=await r.json();setCurrentUserEmail(d.email);setCurrentRole(d.role||'admin');setCurrentSectorId(d.sectorId??null);}}catch{}
  },[]);

  const loadAdminUsers = useCallback(async()=>{
    try{const r=await fetch('/api/admin/users');if(r.ok)setAdminUsers(await r.json());}catch{}
    setAdminUsersLoaded(true);
  },[]);

  const loadReport = useCallback(async(date:string)=>{
    setReportLoading(true);
    try{const r=await fetch(`/api/report/daily?date=${date}`);if(r.ok)setDailyReport(await r.json());}catch{}
    setReportLoading(false);
  },[]);

  const loadWaStatus = useCallback(async()=>{
    setWaLoading(true);
    try{const r=await fetch('/api/whatsapp');if(r.ok)setWaStatus(await r.json());}catch{}
    setWaLoading(false);
  },[]);

  useEffect(()=>{ loadCurrentUser(); },[loadCurrentUser]);

  useEffect(()=>{
    if(tab==='admin'&&!adminUsersLoaded) loadAdminUsers();
    if((tab==='admin'||tab==='sectors')&&!sectorsOpLoaded){
      Promise.all([fetch('/api/sectors').then(r=>r.ok?r.json():[]),fetch('/api/operators').then(r=>r.ok?r.json():[])])
        .then(([s,o])=>{setSectors(s);setOperators(o);setSectorsOpLoaded(true);}).catch(()=>setSectorsOpLoaded(true));
    }
  },[tab,adminUsersLoaded,loadAdminUsers,sectorsOpLoaded]);

  useEffect(()=>{
    loadConversations();loadSettings();loadQuickReplies();loadMediaItems();loadMediaUrls();
    fetch('/api/followups').then(r=>r.json()).then((data:FollowupConfig[])=>{
      if(data?.length) setFollowupConfigs(prev=>prev.map(p=>data.find(d=>d.step_order===p.step_order)||p));
    }).catch(()=>{});
    let fb:ReturnType<typeof setInterval>|null=null;
    const es=new EventSource('/api/events');
    es.onmessage=(e)=>{try{const{type,data}=JSON.parse(e.data);if(type==='conversations')setConversations(data);}catch{}};
    es.onerror=()=>{setSseError(true);es.close();fb=setInterval(loadConversations,5000);};
    return()=>{es.close();if(fb)clearInterval(fb);};
  },[loadConversations,loadSettings,loadQuickReplies,loadMediaItems]);

  useEffect(()=>{if(tab==='dashboard')loadReport(reportDate);},[tab,reportDate,loadReport]);

  useEffect(()=>{
    if(tab!=='whatsapp')return;
    loadWaStatus();
    const iv=setInterval(()=>{if(!waStatus.connected)loadWaStatus();},5000);
    return()=>clearInterval(iv);
  },[tab,loadWaStatus,waStatus.connected]);

  useEffect(()=>{
    if(!selected)return;prevMsgCountRef.current=0;loadMessages(selected);
    const t=setInterval(()=>loadMessages(selected),3000);return()=>clearInterval(t);
  },[selected,loadMessages]);

  useEffect(()=>{
    const el=messagesContainerRef.current;
    if(!el||messages.length===0){prevMsgCountRef.current=0;return;}
    if(prevMsgCountRef.current===0){bottomRef.current?.scrollIntoView({behavior:'auto'});}
    else if(messages.length>prevMsgCountRef.current){const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<150;if(atBottom)bottomRef.current?.scrollIntoView({behavior:'smooth'});}
    prevMsgCountRef.current=messages.length;
  },[messages]);

  useEffect(()=>{if(!selected)return;const u=conversations.find(c=>c.id===selected);if(u)setSelectedConv(u);},[conversations,selected]);

  useEffect(()=>{
    const missing=conversations.filter(c=>!fetchedPhotosRef.current.has(c.id));
    if(missing.length===0)return;
    missing.forEach(c=>{
      fetchedPhotosRef.current.add(c.id);
      fetch(`/api/contact-photo/${c.id}`).then(r=>r.ok?r.json():null).then(d=>setContactPhotos(p=>({...p,[c.id]:d?.url??null}))).catch(()=>setContactPhotos(p=>({...p,[c.id]:null})));
    });
  },[conversations]);

  useEffect(()=>{
    if(tab!=='broadcast'||bcastTemplatesLoaded)return;
    fetch('/api/meta-templates').then(r=>r.ok?r.json():null).then(d=>{if(d)setBcastTemplates(d.templates||[]);}).catch(()=>{});
    fetch('/api/meta-broadcast').then(r=>r.ok?r.json():null).then(d=>{if(d)setScheduledBroadcasts(d.broadcasts||[]);}).catch(()=>{});
    setBcastTemplatesLoaded(true);
  },[tab,bcastTemplatesLoaded]);

  const logout = async () => { await fetch('/api/auth/logout',{method:'POST'}); router.push('/login'); };

  async function sendReply(){
    if(!replyText.trim()||!selected||sending)return;setSending(true);
    try{await fetch('/api/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,text:replyText.trim()})});setReplyText('');setShowQR(false);await loadMessages(selected);}
    finally{setSending(false);}
  }
  async function togglePause(convId:string,conv:Conversation){
    setTogglingPause(convId);
    const action=conv.status==='paused'?'resume':'pause';
    await fetch(`/api/conversations/${convId}/pause`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    await loadConversations();if(convId===selected)await loadMessages(convId);setTogglingPause(null);
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
    await fetch(`/api/quick-replies/${id}`,{method:'DELETE'});setQuickReplies(p=>p.filter(q=>q.id!==id));
  }
  async function sendMedia(mediaId:number){
    if(!selected||sendingMedia!==null)return;setSendingMedia(mediaId);
    try{await fetch('/api/send-media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,mediaId})});setShowMedia(false);}
    finally{setSendingMedia(null);}
  }
  async function handleDirectSend(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file||!selected||sendingDirect)return;
    e.target.value='';setSendingDirect(true);
    try{
      const fd=new FormData();fd.append('file',file);fd.append('number',selected);
      await fetch('/api/send-file',{method:'POST',body:fd});
      setShowMedia(false);
    }catch{}
    setSendingDirect(false);
  }
  const STORAGE_LIMIT_MB = 120;
  const storageUsedBytes = mediaItems.reduce((s, m) => s + (m.size_bytes || 0), 0);
  const storageUsedMB = storageUsedBytes / (1024 * 1024);
  const storagePercent = Math.min((storageUsedMB / STORAGE_LIMIT_MB) * 100, 100);
  const isAdminMaster = currentUserEmail === ADMIN_EMAIL;

  async function handleMediaUpload(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;setUploadingMedia(true);
    try{const fd=new FormData();fd.append('file',file);fd.append('name',file.name);const r=await fetch('/api/media',{method:'POST',body:fd});if(r.status===413){alert('Limite de armazenamento atingido (120 MB). Exclua arquivos para liberar espaço.');}else if(r.ok){const item=await r.json();setMediaItems(prev=>[item,...prev]);}}
    finally{setUploadingMedia(false);e.target.value='';}
  }
  async function removeMediaItem(id:number){await fetch(`/api/media/${id}`,{method:'DELETE'});setMediaItems(p=>p.filter(m=>m.id!==id));}
  async function deleteSelected(){
    if(!window.confirm(`Apagar ${selectedIds.size} conversa(s)?`))return;
    const ids=Array.from(selectedIds);
    await Promise.all(ids.map(id=>fetch(`/api/conversations/${id}`,{method:'DELETE'})));
    setConversations(p=>p.filter(c=>!selectedIds.has(c.id)));
    if(selected&&selectedIds.has(selected)){setSelected(null);setMessages([]);setSelectedConv(null);}
    setSelectedIds(new Set());setSelectMode(false);
  }
  async function deleteConv(id:string){
    if(!window.confirm('Apagar esta conversa?'))return;setDeletingConv(id);
    await fetch(`/api/conversations/${id}`,{method:'DELETE'});
    setConversations(p=>p.filter(c=>c.id!==id));
    if(selected===id){setSelected(null);setMessages([]);setSelectedConv(null);}
    setDeletingConv(null);
  }
  async function disconnectWhatsApp(){
    if(!window.confirm('Desconectar o WhatsApp?'))return;setDisconnecting(true);
    await fetch('/api/whatsapp',{method:'DELETE'}).catch(()=>{});
    setDisconnecting(false);loadWaStatus();
  }

  const startRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunksRef.current=[];
      const mimeType=['audio/ogg;codecs=opus','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const mr=new MediaRecorder(stream,mimeType?{mimeType}:{});
      mr.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setAudioBlob(new Blob(chunksRef.current,{type:mr.mimeType||'audio/webm'}));setIsRecording(false);if(recTimerRef.current)clearInterval(recTimerRef.current);};
      mr.start();mediaRecRef.current=mr;setIsRecording(true);setRecSecs(0);
      recTimerRef.current=setInterval(()=>setRecSecs(s=>{if(s>=119){mr.stop();return s;}return s+1;}),1000);
    }catch{alert('Não foi possível acessar o microfone.');}
  };
  const stopRecording=()=>mediaRecRef.current?.stop();
  const cancelRecording=()=>{mediaRecRef.current?.stop();if(recTimerRef.current)clearInterval(recTimerRef.current);setIsRecording(false);setAudioBlob(null);setRecSecs(0);chunksRef.current=[];};
  const sendRecordedAudio=async()=>{
    if(!audioBlob||!selected||sendingAudio)return;setSendingAudio(true);
    try{
      const reader=new FileReader();
      reader.onloadend=async()=>{
        const base64=(reader.result as string).split(',')[1];
        const r=await fetch('/api/send-audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,audioBase64:base64})});
        if(r.ok){setAudioBlob(null);setRecSecs(0);await loadMessages(selected);}else alert('Falha ao enviar áudio.');
        setSendingAudio(false);
      };reader.readAsDataURL(audioBlob);
    }catch{setSendingAudio(false);}
  };
  const fmtSecs=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const reloadScheduled=async()=>{const r=await fetch('/api/meta-broadcast').catch(()=>null);if(r?.ok){const d=await r.json();setScheduledBroadcasts(d.broadcasts||[]);}};
  const parsedBcastNums=bcastNumbers.split('\n').map(n=>n.replace(/\D/g,'').trim()).filter(Boolean);
  async function sendBroadcast(){
    if(!parsedBcastNums.length)return;
    if(!window.confirm(`${bcastScheduledAt?'Agendar':'Enviar'} para ${parsedBcastNums.length} número(s)?`))return;
    setBcastSending(true);setBcastResults([]);
    try{
      const r=await fetch('/api/meta-broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msgType:bcastMsgType,freeText:bcastFreeText,templateName:bcastTemplateName,templateLang:bcastTemplateLang,templateVars:bcastTemplateVars,numbers:parsedBcastNums,scheduledAt:bcastScheduledAt||undefined})});
      const d=await r.json();
      if(d.error){alert(d.error);return;}
      if(d.scheduled){alert(`Agendado para ${new Date(d.scheduledAt).toLocaleString('pt-BR')}!`);setBcastScheduledAt('');await reloadScheduled();return;}
      setBcastResults(d.results||[]);
    }catch{alert('Erro ao conectar.');}finally{setBcastSending(false);}
  }

  async function createAdminUser(){
    if(!newUser.email||!newUser.password||newUser.password.length<6)return;
    setCreatingUser(true);
    const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newUser)});
    if(r.ok){const u=await r.json();setAdminUsers(p=>[u,...p]);setNewUser({email:'',name:'',password:''});}
    else{const d=await r.json();alert(d.error||'Erro ao criar usuário.');}
    setCreatingUser(false);
  }
  async function deleteAdminUser(id:number){
    if(!window.confirm('Remover este usuário?'))return;
    setDeletingUser(id);
    await fetch(`/api/admin/users/${id}`,{method:'DELETE'});
    setAdminUsers(p=>p.filter(u=>u.id!==id));
    setDeletingUser(null);
  }
  async function resetAdminUserPassword(id:number){
    const pwd=resetPwd[id];
    if(!pwd||pwd.length<6){alert('Senha deve ter no mínimo 6 caracteres.');return;}
    setResetingUser(id);
    const r=await fetch(`/api/admin/users/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pwd})});
    if(r.ok){setResetPwd(p=>({...p,[id]:''}));alert('Senha redefinida com sucesso!');}
    else{const d=await r.json();alert(d.error||'Erro ao redefinir senha.');}
    setResetingUser(null);
  }
  async function changeOwnPassword(){
    if(!changePwdForm.current||!changePwdForm.next||changePwdForm.next.length<6){setChangePwdMsg({ok:false,text:'Preencha todos os campos (mín. 6 chars).'});return;}
    if(changePwdForm.next!==changePwdForm.confirm){setChangePwdMsg({ok:false,text:'As novas senhas não coincidem.'});return;}
    setChangePwdSaving(true);setChangePwdMsg(null);
    const r=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:changePwdForm.current,newPassword:changePwdForm.next})});
    const d=await r.json();
    setChangePwdMsg({ok:r.ok,text:r.ok?'Senha alterada com sucesso!':d.error||'Erro.'});
    if(r.ok)setChangePwdForm({current:'',next:'',confirm:''});
    setChangePwdSaving(false);
  }

  const stats = { total:conversations.length, active:conversations.filter(c=>c.status==='active').length, paused:conversations.filter(c=>c.status==='paused').length };
  const filtered = conversations.filter(c=>{
    if(statusFilter!=='all'&&c.status!==statusFilter)return false;
    if(!search)return true;
    const q=search.toLowerCase();
    return c.id.includes(q)||c.push_name?.toLowerCase().includes(q)||c.last_message?.toLowerCase().includes(q);
  });

  const saveFollowupStep = async (config: FollowupConfig) => {
    await fetch('/api/followups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
    setFollowupConfigs(p=>p.map(c=>c.step_order===config.step_order?config:c));
  };

  const navItems: [Tab, React.ReactNode, string][] = [
    ['dashboard', <BarChart2 size={16}/>,  'Dashboard'],
    ['inbox',     <MessageSquare size={16}/>, 'Atendimento'],
    ['whatsapp',  <Phone size={16}/>,      'WhatsApp'],
    ['broadcast', <Megaphone size={16}/>,  'Disparo'],
    ['sectors',   <Building2 size={16}/>,  'Setores'],
    ['followups', <Bell size={16}/>,       'Follow-ups'],
    ...(currentRole !== 'operator' ? [['settings', <Settings size={16}/>, 'Configurações'] as [Tab, React.ReactNode, string]] : []),
    ...(currentUserEmail === ADMIN_EMAIL ? [['admin', <ShieldCheck size={16}/>, 'Admin'] as [Tab, React.ReactNode, string]] : []),
  ];

  const settingGroups: [string, React.ReactNode, string[]][] = [
    ['Agente IA',    <Zap size={14} className="text-violet-400"/>,  ['openai_api_key','openai_assistant_id','system_prompt','welcome_message']],
    ['Atendimento',  <Users size={14} className="text-blue-400"/>,  ['notification_number','ai_reactivation_minutes']],
    ['Mídias',       <Film size={14} className="text-purple-400"/>, ['video_url','pdf_url']],
    ['Voz (TTS)',    <Music size={14} className="text-amber-400"/>, ['tts_enabled','tts_mode','tts_voice']],
    ['Meta API',     <Megaphone size={14} className="text-green-400"/>, ['meta_phone_number_id','meta_access_token','meta_business_account_id']],
    ['Filtros',      <Settings size={14} className="text-slate-400"/>, ['allowed_numbers','blocked_numbers']],
    ['Assinatura',   <CheckCircle size={14} className="text-cyan-400"/>, ['signature_enabled','signature_text']],
    ['Integrações',  <ExternalLink size={14} className="text-orange-400"/>, ['n8n_forward_url','supabase_url','supabase_key']],
    ['Avançado',     <Settings size={14} className="text-slate-500"/>, ['openai_model','max_history_messages']],
  ];

  const changeTab = (t: Tab) => { setTab(t); setMobileMenuOpen(false); };

  function openConversation(id: string) {
    setSelected(id);
    if (window.innerWidth < 768) setConvOpen(false);
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={()=>setMobileMenuOpen(false)}/>}

      {/* ── Left sidebar ──────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto inset-y-0 left-0
        flex flex-col border-r border-slate-700/60 bg-slate-900
        transition-all duration-200
        ${navOpen ? 'w-56' : 'w-0 lg:w-16'}
        ${mobileMenuOpen ? 'translate-x-0 w-56' : '-translate-x-full lg:translate-x-0'}
        overflow-hidden shrink-0
      `}>
        <div className={`flex items-center border-b border-slate-700/60 shrink-0 ${navOpen?'gap-2.5 px-4 py-3.5':'justify-center py-3.5 px-2'}`}>
          <div className="shrink-0 drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]"><WeevZapLogo size="sm"/></div>
          {navOpen && <span className="font-black text-sm text-white tracking-tight">WeevZap</span>}
          {navOpen && (
            <button onClick={logout} className="ml-auto text-slate-500 hover:text-white transition-colors shrink-0" title="Sair"><LogOut size={14}/></button>
          )}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(([t, icon, label])=>(
            <button key={t} onClick={()=>changeTab(t)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${tab===t?'text-violet-400 bg-violet-600/10 border-r-2 border-violet-500':'text-slate-400 hover:text-slate-200 hover:bg-slate-800'} ${!navOpen?'justify-center px-2':''}`}
              title={!navOpen?label:undefined}>
              <span className="shrink-0">{icon}</span>
              {navOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {navOpen && (
          <div className="px-4 py-3 border-t border-slate-700/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Total</span>
              <span className="font-bold text-slate-300">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"/>IA Ativa</span>
              <span className="font-bold text-violet-400">{stats.active}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>Atendente</span>
              <span className="font-bold text-amber-400">{stats.paused}</span>
            </div>
            <button onClick={()=>setShowChangePwd(true)} className="w-full flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors">
              <KeyRound size={11}/> Alterar senha
            </button>
          </div>
        )}

        <button onClick={()=>setNavOpen(v=>!v)} className="hidden lg:flex items-center justify-center py-3 border-t border-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors">
          {navOpen ? <ChevronLeft size={16}/> : <Zap size={16} className="text-violet-400"/>}
        </button>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 shrink-0 bg-slate-900">
          <button onClick={()=>setMobileMenuOpen(v=>!v)} className="lg:hidden text-slate-400 hover:text-white"><Menu size={20}/></button>
          {tab==='inbox' && selected && selectedConv ? (
            <>
              <button onClick={()=>{setSelected(null);setConvOpen(true);}} className="text-slate-400 hover:text-white lg:hidden"><ChevronLeft size={20}/></button>
              <Avatar name={selectedConv.push_name||selected} photoUrl={contactPhotos[selected]} size="md"/>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{selectedConv.push_name||'Sem nome'}</p>
                <div className="flex items-center gap-1.5"><Clock size={11} className="text-slate-500"/><StatusBadge status={selectedConv.status}/><span className="text-xs text-slate-500">{selected}</span></div>
                {sectors.length>0&&currentRole==='admin'&&(
                  <select value={selectedConv.sector_id??''} onChange={async e=>{const sid=e.target.value?parseInt(e.target.value):null;if(sid){await fetch('/api/sectors/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:selected,toSectorId:sid})});setConversations(prev=>prev.map(c=>c.id===selected?{...c,sector_id:sid}:c));setSelectedConv(prev=>prev?{...prev,sector_id:sid}:prev);}}} className="mt-1 bg-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="">Sem setor</option>
                    {sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>selectedConv&&togglePause(selected,selectedConv)} disabled={togglingPause===selected}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${selectedConv.status==='paused'?'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30':'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'}`}>
                  {selectedConv.status==='paused'?<><PlayCircle size={13}/> Retomar IA</>:<><PauseCircle size={13}/> Pausar IA</>}
                </button>
                <button onClick={()=>deleteConv(selected)} disabled={deletingConv===selected} title="Apagar" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"><Trash2 size={15}/></button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between flex-1">
              <span className="text-white font-semibold text-sm">{navItems.find(n=>n[0]===tab)?.[2]}</span>
              {sseError && <span className="text-xs text-amber-400 flex items-center gap-1"><RefreshCw size={10}/> polling</span>}
            </div>
          )}
        </header>

        {/* ── DASHBOARD ─────────────────────────────────────────────── */}
        {tab==='dashboard' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Relatório do Dia</h2>
                <p className="text-slate-400 text-xs">Visão geral dos atendimentos</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}
                  max={new Date().toISOString().slice(0,10)}
                  className="bg-slate-800 text-sm text-white rounded-lg px-3 py-1.5 outline-none border border-slate-700 focus:border-violet-500"/>
                <button onClick={()=>loadReport(reportDate)} disabled={reportLoading} className="text-slate-400 hover:text-white disabled:opacity-50">
                  <RefreshCw size={15} className={reportLoading?'animate-spin':''}/>
                </button>
              </div>
            </div>
            {dailyReport ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <MetricCard label="Conversas" value={dailyReport.total_conversations} color="border-slate-700" icon={<MessageSquare size={18} className="text-violet-400"/>}/>
                  <MetricCard label="Novos Contatos" value={dailyReport.new_contacts} color="border-emerald-700/30" icon={<Users size={18} className="text-emerald-400"/>}/>
                  <MetricCard label="IA Ativa" value={dailyReport.ai_active} color="border-violet-700/30" icon={<Zap size={18} className="text-violet-400"/>}/>
                  <MetricCard label="Em Atendimento" value={dailyReport.human_paused} color="border-amber-700/30" icon={<Users size={18} className="text-amber-400"/>}/>
                  <MetricCard label="Mensagens" value={dailyReport.messages_sent} color="border-blue-700/30" icon={<MessageSquare size={18} className="text-blue-400"/>}/>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <p className="text-white text-sm font-medium mb-3">Mensagens por hora</p>
                  {dailyReport.by_hour.length>0 ? (
                    <div className="pb-5 relative"><HourChart data={dailyReport.by_hour}/></div>
                  ) : (
                    <p className="text-slate-500 text-sm text-center py-4">Nenhuma mensagem registrada neste dia.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  {reportLoading ? <RefreshCw size={24} className="text-violet-400 animate-spin mx-auto mb-2"/> : <BarChart2 size={24} className="text-slate-600 mx-auto mb-2"/>}
                  <p className="text-slate-500 text-sm">{reportLoading?'Carregando…':'Selecione uma data para ver o relatório.'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INBOX ─────────────────────────────────────────────────── */}
        {tab==='inbox' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar */}
            <div className="bg-slate-900 border-b border-slate-700/60 px-3 py-2 flex items-center gap-2 shrink-0">
              <button onClick={()=>setConvOpen(v=>!v)} className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title={convOpen?'Minimizar':'Expandir'}>
                {convOpen ? <ChevronLeft size={16}/> : <MessageSquare size={16}/>}
              </button>
              <div className="flex items-center gap-0.5 bg-slate-700/60 rounded-lg p-0.5 shrink-0">
                <ViewBtn active={view==='chat'} onClick={()=>setView('chat')} icon={<MessageSquare size={12}/>} label="Chat"/>
                <ViewBtn active={view==='kanban'} onClick={()=>setView('kanban')} icon={<LayoutGrid size={12}/>} label="Kanban"/>
              </div>
              <input type="text" placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)} className="flex-1 min-w-0 bg-slate-800 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500"/>
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {(['all','active','paused'] as StatusFilter[]).map(f=>(
                  <FilterPill key={f} active={statusFilter===f} onClick={()=>setStatusFilter(f)} label={{all:'Todos',active:'IA',paused:'Humano',waiting:'Aguard.'}[f]}/>
                ))}
              </div>
            </div>

            {view==='chat' && (
              <div className="flex flex-1 overflow-hidden relative">
                {/* Conv list */}
                <aside className={`${convOpen?'w-72 min-w-[18rem]':'w-0 min-w-0 overflow-hidden'} bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 overflow-y-auto transition-all duration-200 ease-in-out absolute lg:relative z-20 h-full ${convOpen?'left-0':'-left-full lg:left-0'}`}>
                  {convOpen && (
                    <>
                      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                        {selectMode ? (
                          <>
                            <button onClick={()=>setSelectedIds(new Set(filtered.map(c=>c.id)))} className="text-xs text-slate-400 hover:text-white">Todos</button>
                            <div className="flex items-center gap-2">
                              {selectedIds.size>0 && <button onClick={deleteSelected} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20"><Trash2 size={11}/> Apagar ({selectedIds.size})</button>}
                              <button onClick={()=>{setSelectMode(false);setSelectedIds(new Set());}} className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <button onClick={()=>setSelectMode(true)} className="text-xs text-slate-500 hover:text-white ml-auto">Selecionar</button>
                        )}
                      </div>
                      {filtered.length===0 ? <p className="text-center text-slate-500 text-sm py-12">Nenhuma conversa</p>
                        : filtered.map(conv=>(
                          selectMode ? (
                            <div key={conv.id} onClick={()=>{const n=new Set(selectedIds);if(n.has(conv.id))n.delete(conv.id);else n.add(conv.id);setSelectedIds(n);}}
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
                            <ConvItem key={conv.id} conv={conv} selected={selected===conv.id} onClick={()=>openConversation(conv.id)}
                              onTogglePause={()=>togglePause(conv.id,conv)} toggling={togglingPause===conv.id} photoUrl={contactPhotos[conv.id]}
                              sectorName={conv.sector_id ? sectors.find(s=>s.id===conv.sector_id)?.name : undefined}/>
                          )
                        ))
                      }
                    </>
                  )}
                </aside>
                {convOpen && <div className="lg:hidden absolute inset-0 z-10 bg-black/40" onClick={()=>setConvOpen(false)}/>}

                {/* Chat */}
                <main className="flex-1 flex flex-col overflow-hidden">
                  {!selected ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                      <MessageSquare size={48} strokeWidth={1}/>
                      <p className="text-sm">Selecione uma conversa</p>
                      {conversations.length===0 && <button onClick={()=>changeTab('whatsapp')} className="mt-2 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"><Phone size={15}/> Conectar WhatsApp</button>}
                    </div>
                  ) : (
                    <>
                      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-900">
                        {messages.length===0&&<p className="text-center text-slate-600 text-sm py-10">Nenhuma mensagem</p>}
                        {messages.map(m=><MsgBubble key={m.id} msg={m}/>)}
                        <div ref={bottomRef}/>
                      </div>
                      {showQR && (
                        <div className="border-t border-slate-700 bg-slate-800/90 px-3 py-2.5 shrink-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Zap size={11} className="text-amber-400"/> Respostas rápidas</span>
                            <button onClick={()=>setShowQR(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                          </div>
                          {quickReplies.length===0 ? <p className="text-xs text-slate-500">Nenhuma resposta rápida.</p>
                            : <div className="flex flex-wrap gap-2">{quickReplies.map(qr=><button key={qr.id} onClick={()=>{setReplyText(qr.content);setShowQR(false);replyRef.current?.focus();}} className="text-xs bg-slate-700 hover:bg-violet-700 text-white px-3 py-1.5 rounded-full transition-colors">{qr.title}</button>)}</div>}
                        </div>
                      )}
                      {showMedia && (
                        <div className="border-t border-slate-700 bg-slate-800/90 px-3 py-2.5 shrink-0 max-h-52 overflow-y-auto">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Library size={11} className="text-blue-400"/> Mídia</span>
                            <div className="flex items-center gap-2">
                              <label className={`cursor-pointer text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${sendingDirect?'text-slate-500':'text-emerald-400 hover:bg-slate-700'}`} title="Enviar arquivo direto ao cliente sem salvar na biblioteca">
                                <Paperclip size={11}/>{sendingDirect?'Enviando…':'Enviar direto'}
                                <input type="file" className="hidden" onChange={handleDirectSend} disabled={sendingDirect}/>
                              </label>
                              <label className={`cursor-pointer text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${uploadingMedia?'text-slate-500':'text-violet-400 hover:bg-slate-700'}`}>
                                <Upload size={11}/>{uploadingMedia?'Salvando…':'+ Biblioteca'}
                                <input ref={mediaUploadRef} type="file" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia}/>
                              </label>
                              <button onClick={()=>setShowMedia(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                            </div>
                          </div>
                          {!isAdminMaster&&(
                            <div className="mb-2">
                              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                <span>Armazenamento</span>
                                <span>{storageUsedMB.toFixed(1)} MB / {STORAGE_LIMIT_MB} MB</span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${storagePercent>90?'bg-red-500':storagePercent>70?'bg-amber-500':'bg-blue-500'}`} style={{width:`${storagePercent}%`}}/>
                              </div>
                            </div>
                          )}
                          {mediaItems.length===0 ? <p className="text-xs text-slate-500">Nenhum arquivo.</p>
                            : <div className="flex flex-wrap gap-2">{mediaItems.map(item=><div key={item.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-2.5 py-1.5 max-w-[200px]"><MediaIcon type={item.type}/><span className="text-xs text-white truncate flex-1">{item.name}</span><button onClick={()=>sendMedia(item.id)} disabled={sendingMedia===item.id} className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-2 py-0.5 rounded disabled:opacity-40 shrink-0">{sendingMedia===item.id?'…':'Enviar'}</button></div>)}</div>}
                        </div>
                      )}
                      <div className="border-t border-slate-700 bg-slate-800 px-3 py-3 flex items-end gap-2 shrink-0">
                        {!isRecording && !audioBlob && (
                          <>
                            <button onClick={()=>{setShowQR(v=>!v);setShowMedia(false);}} className={`p-2 rounded-lg transition-colors shrink-0 ${showQR?'bg-amber-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Zap size={17}/></button>
                            <button onClick={()=>{setShowMedia(v=>!v);setShowQR(false);}} className={`p-2 rounded-lg transition-colors shrink-0 ${showMedia?'bg-blue-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Paperclip size={17}/></button>
                          </>
                        )}
                        {isRecording ? (
                          <div className="flex-1 flex items-center gap-2.5 bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"/>
                            <span className="text-sm font-mono text-red-400">{fmtSecs(recSecs)}</span>
                            <span className="text-xs text-slate-400 flex-1">Gravando…</span>
                            <button onClick={cancelRecording} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                          </div>
                        ) : audioBlob ? (
                          <div className="flex-1 flex items-center gap-2.5 bg-violet-900/20 border border-violet-700/40 rounded-xl px-3 py-2.5">
                            <Music size={16} className="text-violet-400 shrink-0"/>
                            <span className="text-sm text-slate-300 flex-1">Áudio · {fmtSecs(recSecs)}</span>
                            <button onClick={()=>{setAudioBlob(null);setRecSecs(0);}} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                          </div>
                        ) : (
                          <textarea ref={replyRef} value={replyText} onChange={e=>setReplyText(e.target.value)}
                            onKeyDown={e=>{if(e.key==='Enter'&&!e.ctrlKey){e.preventDefault();sendReply();}}}
                            placeholder="Responder como atendente… (Ctrl+Enter para pular linha)" rows={2}
                            className="flex-1 bg-slate-700 text-sm text-white placeholder-slate-400 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                        )}
                        {!audioBlob && <button onClick={isRecording?stopRecording:startRecording} className={`p-2.5 rounded-xl transition-colors shrink-0 ${isRecording?'bg-red-600 hover:bg-red-500 text-white':'text-slate-400 hover:text-white hover:bg-slate-700'}`} title={isRecording?'Parar':'Gravar'}>{isRecording?<Square size={15}/>:<Mic size={17}/>}</button>}
                        {audioBlob ? <button onClick={sendRecordedAudio} disabled={sendingAudio} className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl shrink-0">{sendingAudio?<RefreshCw size={15} className="animate-spin"/>:<Send size={17}/>}</button>
                          : !isRecording ? <button onClick={sendReply} disabled={sending||!replyText.trim()} className="p-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl shrink-0"><Send size={17}/></button>
                          : null}
                      </div>
                    </>
                  )}
                </main>

                {/* Contact panel xl */}
                {selected && selectedConv && (
                  <aside className="hidden xl:flex w-56 bg-slate-800 border-l border-slate-700 flex-col shrink-0 overflow-y-auto">
                    <div className="p-5 border-b border-slate-700 flex flex-col items-center gap-3 text-center">
                      <Avatar name={selectedConv.push_name||selected} photoUrl={contactPhotos[selected]} size="lg"/>
                      <div><p className="font-semibold text-sm">{selectedConv.push_name||'Sem nome'}</p><p className="text-xs text-slate-400 mt-0.5">{selected}</p></div>
                      <StatusBadge status={selectedConv.status}/>
                    </div>
                    <div className="p-4 space-y-3 text-xs border-b border-slate-700">
                      <div><p className="text-xs text-slate-500 flex items-center gap-1 mb-0.5"><Clock size={12}/> Último contato</p><p className="text-xs text-slate-300 break-words">{selectedConv.last_message_at?new Date(selectedConv.last_message_at).toLocaleString('pt-BR'):'—'}</p></div>
                    </div>
                    <div className="p-4">
                      <button onClick={()=>togglePause(selected,selectedConv)} disabled={togglingPause===selected}
                        className={`w-full text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${selectedConv.status==='paused'?'bg-violet-700/60 hover:bg-violet-700 text-violet-300':'bg-amber-700/60 hover:bg-amber-700 text-amber-300'}`}>
                        {selectedConv.status==='paused'?<><PlayCircle size={12}/> Retomar IA</>:<><PauseCircle size={12}/> Pausar IA</>}
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            )}

            {view==='kanban' && (
              <div className="flex-1 overflow-auto">
                <div className="flex gap-4 p-5 min-h-full">
                  <KanbanCol label="IA Ativa" convs={filtered.filter(c=>c.status==='active')} accent={{dot:'bg-violet-400',border:'border-violet-700/50',text:'text-violet-400',bg:'bg-violet-900/30'}} onSelect={id=>{setSelected(id);setView('chat');}}/>
                  <KanbanCol label="Atendente" convs={filtered.filter(c=>c.status==='paused')} accent={{dot:'bg-amber-400',border:'border-amber-700/50',text:'text-amber-400',bg:'bg-amber-900/30'}} onSelect={id=>{setSelected(id);setView('chat');}}/>
                  <KanbanCol label="Aguardando" convs={filtered.filter(c=>c.status==='waiting')} accent={{dot:'bg-slate-400',border:'border-slate-600/50',text:'text-slate-400',bg:'bg-slate-700/30'}} onSelect={id=>{setSelected(id);setView('chat');}}/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WHATSAPP ──────────────────────────────────────────────── */}
        {tab==='whatsapp' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Conexão WhatsApp</p>
              <button onClick={loadWaStatus} disabled={waLoading} className="text-slate-400 hover:text-white disabled:opacity-50"><RefreshCw size={14} className={waLoading?'animate-spin':''}/></button>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{waStatus.instance || 'Instância Principal'}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{waStatus.instance}</p>
                </div>
                <div className="flex items-center gap-2">
                  {waStatus.connected ? (
                    <>
                      <Wifi size={14} className="text-green-400"/>
                      <span className="text-xs text-green-400 font-medium">Conectado</span>
                      <button onClick={disconnectWhatsApp} disabled={disconnecting}
                        className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-700/30 disabled:opacity-50 transition-colors">
                        {disconnecting?'Desconectando…':'Desconectar'}
                      </button>
                    </>
                  ) : (
                    <>
                      <WifiOff size={14} className="text-red-400"/>
                      <span className="text-xs text-red-400 font-medium">Desconectado</span>
                    </>
                  )}
                </div>
              </div>
              {!waStatus.connected && waStatus.qrCode && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Escaneie com o WhatsApp:</p>
                  <img src={waStatus.qrCode} alt="QR Code" className="w-full max-w-xs rounded-lg border border-slate-600"/>
                </div>
              )}
              {!waStatus.connected && !waStatus.qrCode && !waLoading && (
                <div className="bg-slate-700/50 rounded-lg p-3 flex gap-2">
                  <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
                  <p className="text-xs text-slate-300">Aguardando QR code. Clique em atualizar para tentar conectar.</p>
                </div>
              )}
              {waLoading && <p className="text-xs text-slate-500 flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin"/> Verificando conexão…</p>}
            </div>
          </div>
        )}

        {/* ── BROADCAST ────────────────────────────────────────────── */}
        {tab==='broadcast' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center"><Megaphone size={20} className="text-violet-400"/></div>
                <div><h2 className="text-white font-semibold">Disparo em Massa</h2><p className="text-slate-400 text-xs">Via Meta WhatsApp API Oficial</p></div>
              </div>
              {(!settingValues['meta_phone_number_id']||!settingValues['meta_access_token']) && (
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 flex gap-3">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/>
                  <div><p className="text-amber-300 text-sm font-medium">Credenciais não configuradas</p><p className="text-amber-400/80 text-xs mt-0.5">Configure o Phone Number ID e o Token nas Configurações.</p><button onClick={()=>setTab('settings')} className="mt-2 text-xs text-amber-300 underline">Ir para Configurações →</button></div>
                </div>
              )}
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span><p className="text-white text-sm font-medium">Tipo de Mensagem</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={()=>setBcastMsgType('template')} className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='template'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                    <p className="text-sm font-medium text-white">📋 Template</p><p className="text-xs text-slate-400 mt-0.5">Aprovado pela Meta.</p>
                  </button>
                  <button onClick={()=>setBcastMsgType('free')} className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='free'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                    <p className="text-sm font-medium text-white">💬 Texto Livre</p><p className="text-xs text-slate-400 mt-0.5"><span className="text-amber-400">Apenas nas últimas 24h.</span></p>
                  </button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span><p className="text-white text-sm font-medium">{bcastMsgType==='template'?'Template':'Mensagem'}</p></div>
                {bcastMsgType==='template' ? (
                  <div className="space-y-3">
                    {bcastTemplates.length>0 && <div className="flex flex-wrap gap-1.5">{bcastTemplates.map(t=><button key={t.name} onClick={()=>{setBcastTemplateName(t.name);setBcastTemplateLang(t.language||'pt_BR');}} className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${bcastTemplateName===t.name?'border-violet-500 bg-violet-600/20 text-violet-300':'border-slate-600 text-slate-300 hover:border-slate-400'}`}>{t.name}</button>)}</div>}
                    <div className="grid grid-cols-2 gap-3">
                      <input value={bcastTemplateName} onChange={e=>setBcastTemplateName(e.target.value)} placeholder="Nome do template" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 font-mono"/>
                      <input value={bcastTemplateLang} onChange={e=>setBcastTemplateLang(e.target.value)} placeholder="pt_BR" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1"><label className="text-xs text-slate-400">Variáveis</label><button onClick={()=>setBcastTemplateVars(v=>[...v,''])} className="text-xs text-violet-400">+ Adicionar</button></div>
                      {bcastTemplateVars.map((v,i)=>(
                        <div key={i} className="flex gap-2 mb-2">
                          <span className="text-xs text-slate-500 w-16 flex items-center shrink-0">{`{{${i+1}}}`}</span>
                          <input value={v} onChange={e=>setBcastTemplateVars(prev=>prev.map((x,j)=>j===i?e.target.value:x))} placeholder={`Valor {{${i+1}}}`} className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                          {bcastTemplateVars.length>1&&<button onClick={()=>setBcastTemplateVars(prev=>prev.filter((_,j)=>j!==i))} className="text-slate-500 hover:text-red-400"><X size={14}/></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea value={bcastFreeText} onChange={e=>setBcastFreeText(e.target.value)} placeholder="Mensagem..." rows={4} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-y"/>
                    <p className="text-xs text-slate-500">{bcastFreeText.length} caracteres</p>
                  </div>
                )}
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">3</span><p className="text-white text-sm font-medium">Destinatários</p></div>
                <textarea value={bcastNumbers} onChange={e=>setBcastNumbers(e.target.value)} placeholder={'5511999991111\n5521988887777'} rows={6} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-y font-mono"/>
                <p className="text-xs text-slate-400">{parsedBcastNums.length>0?<span className="text-violet-400 font-medium">{parsedBcastNums.length} número(s)</span>:'Nenhum número'}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">4</span><p className="text-white text-sm font-medium">Agendamento <span className="text-slate-500 text-xs font-normal">(opcional)</span></p></div>
                <input type="datetime-local" value={bcastScheduledAt} onChange={e=>setBcastScheduledAt(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                {bcastScheduledAt && <p className="text-xs text-violet-400">Agendado para: {new Date(bcastScheduledAt).toLocaleString('pt-BR')}</p>}
              </div>
              <button onClick={sendBroadcast} disabled={bcastSending||parsedBcastNums.length===0||(bcastMsgType==='template'&&!bcastTemplateName)||(bcastMsgType==='free'&&!bcastFreeText.trim())}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors">
                {bcastSending?<><RefreshCw size={16} className="animate-spin"/>{bcastScheduledAt?'Agendando…':'Enviando…'}</>:bcastScheduledAt?<><Clock size={16}/>Agendar para {parsedBcastNums.length} número(s)</> :<><Megaphone size={16}/>Enviar para {parsedBcastNums.length} número(s)</>}
              </button>
              {scheduledBroadcasts.length>0&&<div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-2"><div className="flex items-center justify-between"><p className="text-white text-sm font-medium">Agendados</p><button onClick={reloadScheduled} className="text-slate-400 hover:text-white"><RefreshCw size={13}/></button></div>{scheduledBroadcasts.map(b=><div key={b.id} className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2 text-xs"><span className={`w-2 h-2 rounded-full shrink-0 ${b.status==='sent'?'bg-emerald-400':b.status==='failed'?'bg-red-400':'bg-amber-400'}`}/><div className="flex-1 min-w-0"><p className="text-slate-200 truncate">{b.msg_type==='template'?`Template: ${b.template_name}`:'Texto Livre'} · {Array.isArray(b.numbers)?b.numbers.length:0} números</p><p className="text-slate-500">{new Date(b.scheduled_at).toLocaleString('pt-BR')}</p></div></div>)}</div>}
              {bcastResults.length>0&&<div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-2"><div className="flex items-center justify-between"><p className="text-white text-sm font-medium">Resultado</p><div className="flex gap-3 text-xs"><span className="text-emerald-400">✓ {bcastResults.filter(r=>r.ok).length}</span>{bcastResults.filter(r=>!r.ok).length>0&&<span className="text-red-400">✗ {bcastResults.filter(r=>!r.ok).length}</span>}</div></div><div className="max-h-48 overflow-y-auto space-y-1">{bcastResults.map((r,i)=><div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${r.ok?'bg-emerald-900/20 border border-emerald-700/30':'bg-red-900/20 border border-red-700/30'}`}><span className={r.ok?'text-emerald-400':'text-red-400'}>{r.ok?'✓':'✗'}</span><span className="font-mono text-slate-300">{r.number}</span>{r.error&&<span className="text-red-400 ml-auto truncate">{r.error}</span>}</div>)}</div><button onClick={()=>setBcastResults([])} className="text-xs text-slate-500 hover:text-slate-300">Limpar</button></div>}
            </div>
          </div>
        )}

        {/* ── ADMIN ────────────────────────────────────────────────── */}
        {tab==='admin' && currentUserEmail===ADMIN_EMAIL && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center"><ShieldCheck size={20} className="text-violet-400"/></div>
                <div><h2 className="text-white font-semibold">Painel Administrativo</h2><p className="text-slate-400 text-xs">Logins, setores e operadores</p></div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 border border-slate-700">
                {(['users','sectors','operators'] as const).map(t=>(
                  <button key={t} onClick={()=>setAdminSubTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${adminSubTab===t?'bg-violet-600 text-white':'text-slate-400 hover:text-white'}`}>
                    {t==='users'?'Logins Admin':t==='sectors'?'Setores':'Operadores'}
                  </button>
                ))}
              </div>

              {/* ── Setores ── */}
              {adminSubTab==='sectors'&&(
                <div className="space-y-4">
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex gap-2">
                    <input value={newSector.name} onChange={e=>setNewSector(p=>({...p,name:e.target.value}))} placeholder="Nome do setor (ex: Vendas)" className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    <button disabled={creatingSector||!newSector.name.trim()} onClick={async()=>{setCreatingSector(true);try{const r=await fetch('/api/sectors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newSector.name})});if(r.ok){const s=await r.json();setSectors(p=>[...p,s]);setNewSector({name:''});}}finally{setCreatingSector(false);}}} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0">
                      <Plus size={13}/>{creatingSector?'…':'Criar'}
                    </button>
                  </div>
                  {sectors.length===0?<p className="text-slate-500 text-sm">Nenhum setor cadastrado.</p>:sectors.map(s=>(
                    <div key={s.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-800/40 flex items-center justify-center shrink-0"><Users size={13} className="text-violet-400"/></div>
                      <span className="flex-1 text-sm font-medium text-white">{s.name}</span>
                      <button onClick={async()=>{await fetch(`/api/sectors/${s.id}`,{method:'DELETE'});setSectors(p=>p.filter(x=>x.id!==s.id));}} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Operadores ── */}
              {adminSubTab==='operators'&&(
                <div className="space-y-4">
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                    <p className="text-white text-sm font-medium flex items-center gap-2"><Plus size={13} className="text-violet-400"/> Novo operador</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={newOperator.name} onChange={e=>setNewOperator(p=>({...p,name:e.target.value}))} placeholder="Nome" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                      <input value={newOperator.email} onChange={e=>setNewOperator(p=>({...p,email:e.target.value}))} placeholder="E-mail" type="email" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={newOperator.password} onChange={e=>setNewOperator(p=>({...p,password:e.target.value}))} placeholder="Senha" type="password" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                      <select value={newOperator.sectorId} onChange={e=>setNewOperator(p=>({...p,sectorId:e.target.value}))} className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                        <option value="">Setor (opcional)</option>
                        {sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <button disabled={creatingOperator||!newOperator.name.trim()||!newOperator.email.trim()||newOperator.password.length<6} onClick={async()=>{setCreatingOperator(true);try{const r=await fetch('/api/operators',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newOperator.name,email:newOperator.email,password:newOperator.password,sectorId:newOperator.sectorId?parseInt(newOperator.sectorId):null})});if(r.ok){const op=await r.json();setOperators(p=>[...p,op]);setNewOperator({name:'',email:'',password:'',sectorId:''});}}finally{setCreatingOperator(false);}}} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                      {creatingOperator?'Criando…':'Criar Operador'}
                    </button>
                  </div>
                  {operators.length===0?<p className="text-slate-500 text-sm">Nenhum operador cadastrado.</p>:operators.map(op=>(
                    <div key={op.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><Users size={13} className="text-slate-400"/></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{op.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{op.email}</p>
                        {op.sector_name && <p className="text-xs text-violet-400 mt-0.5">{op.sector_name}</p>}
                      </div>
                      <button onClick={async()=>{await fetch(`/api/operators/${op.id}`,{method:'DELETE'});setOperators(p=>p.filter(x=>x.id!==op.id));}} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Logins Admin ── */}
              {adminSubTab==='users'&&(<>
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
                <p className="text-white text-sm font-medium flex items-center gap-2"><Plus size={14} className="text-violet-400"/> Criar novo login</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={newUser.email} onChange={e=>setNewUser(p=>({...p,email:e.target.value}))} placeholder="E-mail" type="email"
                    className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <input value={newUser.name} onChange={e=>setNewUser(p=>({...p,name:e.target.value}))} placeholder="Nome (opcional)"
                    className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                </div>
                <input value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} placeholder="Senha (mín. 6 caracteres)" type="password"
                  className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                <button onClick={createAdminUser} disabled={creatingUser||!newUser.email||newUser.password.length<6}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                  {creatingUser?<><RefreshCw size={14} className="animate-spin"/> Criando…</>:<><Plus size={14}/> Criar Login</>}
                </button>
              </div>

              {/* Users list */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
                  <p className="text-white text-sm font-medium">Logins cadastrados</p>
                  <button onClick={()=>{setAdminUsersLoaded(false);loadAdminUsers();}} className="text-slate-400 hover:text-white"><RefreshCw size={13}/></button>
                </div>
                {!adminUsersLoaded ? (
                  <p className="text-slate-500 text-sm p-5 flex items-center gap-2"><RefreshCw size={13} className="animate-spin"/> Carregando…</p>
                ) : adminUsers.length===0 ? (
                  <p className="text-slate-500 text-sm p-5">Nenhum login cadastrado ainda.</p>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {adminUsers.map(u=>(
                      <div key={u.id} className="px-5 py-4 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
                          <Users size={14} className="text-violet-400"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{u.name||'Sem nome'}</p>
                          <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                          <p className="text-xs text-slate-600 mt-0.5">Criado em {new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <input value={resetPwd[u.id]||''} onChange={e=>setResetPwd(p=>({...p,[u.id]:e.target.value}))} placeholder="Nova senha…" type="password"
                              className="flex-1 bg-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-violet-500"/>
                            <button onClick={()=>resetAdminUserPassword(u.id)} disabled={resetingUser===u.id||(resetPwd[u.id]?.length||0)<6}
                              className="text-xs px-2.5 py-1.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1">
                              {resetingUser===u.id?<RefreshCw size={11} className="animate-spin"/>:<KeyRound size={11}/>} Redefinir
                            </button>
                          </div>
                        </div>
                        <button onClick={()=>deleteAdminUser(u.id)} disabled={deletingUser===u.id}
                          className="text-slate-500 hover:text-red-400 disabled:opacity-40 mt-0.5 shrink-0 transition-colors">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>)}
            </div>
          </div>
        )}

        {/* ── FOLLOW-UPS ────────────────────────────────────────────── */}
        {tab==='followups' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Bell size={20} className="text-violet-400"/>
                <h2 className="text-white font-semibold">Follow-ups Automaticos</h2>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-400">
                Os follow-ups sao acionados quando um lead inicia conversa e nao converte. Os delays sao acumulativos: passo 1 em 1h + passo 2 em 2h = passo 2 enviado 3h apos o primeiro contato.
              </div>
              {followupConfigs.map(c=>(
                <FollowupStepCard key={c.step_order} step={c.step_order} config={c} onSave={saveFollowupStep}/>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ──────────────────────────────────────────────── */}
        {/* ── SECTORS TAB ─────────────────────────────────────────────── */}
        {tab==='sectors' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h2 className="text-white font-semibold">Setores</h2>
              <p className="text-slate-400 text-xs">Crie setores para organizar e transferir atendimentos</p>
            </div>

            {/* Add sector — admin only */}
            {currentRole !== 'operator' && (
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-sm font-medium text-white">Novo Setor</p>
                <div className="flex gap-2">
                  <input value={newSector.name} onChange={e=>setNewSector(p=>({...p,name:e.target.value}))} placeholder="Nome do setor (ex: Vendas)"
                    onKeyDown={e=>e.key==='Enter'&&!creatingSector&&newSector.name.trim()&&(async()=>{setCreatingSector(true);try{const r=await fetch('/api/sectors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newSector.name})});if(r.ok){const s=await r.json();setSectors(p=>[...p,s]);setNewSector({name:''});}}finally{setCreatingSector(false);}})()}
                    className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <button disabled={creatingSector||!newSector.name.trim()} onClick={async()=>{setCreatingSector(true);try{const r=await fetch('/api/sectors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newSector.name})});if(r.ok){const s=await r.json();setSectors(p=>[...p,s]);setNewSector({name:''});}}finally{setCreatingSector(false);}}}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0">
                    <Plus size={13}/>{creatingSector?'…':'Criar'}
                  </button>
                </div>
              </div>
            )}

            {/* Sectors list */}
            <div className="space-y-2">
              {sectors.length===0 && <p className="text-slate-500 text-sm text-center py-6">Nenhum setor criado ainda.</p>}
              {sectors.map(s=>(
                <div key={s.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-violet-400"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{s.name}</p>
                    {s.description&&<p className="text-slate-400 text-xs truncate">{s.description}</p>}
                  </div>
                  {currentRole !== 'operator' && (
                    <button onClick={async()=>{await fetch(`/api/sectors/${s.id}`,{method:'DELETE'});setSectors(p=>p.filter(x=>x.id!==s.id));}}
                      className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={15}/></button>
                  )}
                </div>
              ))}
            </div>

            {/* Operators management — admin only */}
            {currentRole !== 'operator' && (
              <>
                <div className="pt-2">
                  <h3 className="text-white font-semibold text-sm">Operadores</h3>
                  <p className="text-slate-400 text-xs">Crie logins para sua equipe com acesso ao setor designado</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <p className="text-white text-sm font-medium">Novo Operador</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={newOperator.name} onChange={e=>setNewOperator(p=>({...p,name:e.target.value}))} placeholder="Nome completo"
                      className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    <input value={newOperator.email} onChange={e=>setNewOperator(p=>({...p,email:e.target.value}))} placeholder="E-mail" type="email"
                      className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={newOperator.password} onChange={e=>setNewOperator(p=>({...p,password:e.target.value}))} placeholder="Senha (mín. 6 caracteres)" type="password"
                      className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    <select value={newOperator.sectorId} onChange={e=>setNewOperator(p=>({...p,sectorId:e.target.value}))}
                      className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                      <option value="">Sem setor</option>
                      {sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <button disabled={creatingOperator||!newOperator.name.trim()||!newOperator.email.trim()||newOperator.password.length<6}
                    onClick={async()=>{setCreatingOperator(true);try{const r=await fetch('/api/operators',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newOperator.name,email:newOperator.email,password:newOperator.password,sectorId:newOperator.sectorId?parseInt(newOperator.sectorId):null})});if(r.ok){const op=await r.json();setOperators(p=>[...p,op]);setNewOperator({name:'',email:'',password:'',sectorId:'',});}}finally{setCreatingOperator(false);}}}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                    <Plus size={13}/>{creatingOperator?'Criando…':'Criar Operador'}
                  </button>
                </div>
                <div className="space-y-2">
                  {operators.length===0&&sectorsOpLoaded&&<p className="text-slate-500 text-sm text-center py-4">Nenhum operador criado ainda.</p>}
                  {operators.map(op=>(
                    <div key={op.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
                        <Users size={16} className="text-blue-400"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{op.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{op.email}</p>
                        {op.sector_name&&<span className="text-[10px] text-blue-400 flex items-center gap-0.5 mt-0.5"><Building2 size={9}/>{op.sector_name}</span>}
                      </div>
                      <button onClick={async()=>{await fetch(`/api/operators/${op.id}`,{method:'DELETE'});setOperators(p=>p.filter(x=>x.id!==op.id));}}
                        className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={15}/></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab==='settings' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* AI Enable/Disable Toggle */}
              {(() => {
                const aiOn = settingValues['ai_enabled'] !== 'false';
                return (
                  <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-colors ${aiOn?'bg-violet-900/30 border-violet-700/60':'bg-slate-800/80 border-slate-600'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Zap size={15} className={aiOn?'text-violet-400':'text-slate-500'}/>
                        <span className="text-sm font-bold text-white">Resposta Automática da IA</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${aiOn?'bg-violet-600 text-white':'bg-slate-600 text-slate-300'}`}>{aiOn?'LIGADA':'DESLIGADA'}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 ml-6">Quando desligada, mensagens são registradas mas o bot não responde automaticamente.</p>
                    </div>
                    <button onClick={async()=>{
                      const next = aiOn?'false':'true';
                      setSettingValues(p=>({...p,'ai_enabled':next}));
                      await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'ai_enabled',value:next})});
                    }} className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${aiOn?'bg-violet-600':'bg-slate-600'}`}>
                      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${aiOn?'left-8':'left-1'}`}/>
                    </button>
                  </div>
                );
              })()}
              {settingGroups.map(([groupLabel, groupIcon, keys])=>{
                const groupSettings = settings.filter(s=>keys.includes(s.key));
                if(groupSettings.length===0) return null;
                return (
                  <div key={groupLabel}>
                    <SettingGroup label={groupLabel} icon={groupIcon} defaultOpen={groupLabel==='Agente IA'}>
                      {groupSettings.map(s=>(
                        <SettingCard key={s.key} setting={s} value={settingValues[s.key]??''}
                          onChange={v=>setSettingValues(p=>({...p,[s.key]:v}))}
                          onSave={()=>saveSetting(s.key)} saving={savingKey===s.key} saved={savedKey===s.key}/>
                      ))}
                      {groupLabel==='Mídias'&&(
                        <div className="border-t border-slate-700/60 pt-3 mt-1 space-y-2">
                          {mediaUrls.map(item=>(
                            <div key={item.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{item.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5 capitalize">{item.type} · <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{item.url.length>50?item.url.slice(0,50)+'…':item.url}</a></p>
                              </div>
                              <button onClick={async()=>{await fetch('/api/media-urls',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});setMediaUrls(p=>p.filter(m=>m.id!==item.id));}} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={14}/></button>
                            </div>
                          ))}
                          <div className="grid grid-cols-1 gap-2">
                            <input value={newMediaUrl.name} onChange={e=>setNewMediaUrl(p=>({...p,name:e.target.value}))} placeholder="Nome (ex: Catálogo PDF)" className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"/>
                            <input value={newMediaUrl.url} onChange={e=>setNewMediaUrl(p=>({...p,url:e.target.value}))} placeholder="URL pública do arquivo" className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"/>
                            <div className="flex gap-2">
                              <select value={newMediaUrl.type} onChange={e=>setNewMediaUrl(p=>({...p,type:e.target.value as MediaUrlItem['type']}))} className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500">
                                <option value="document">Documento / PDF</option>
                                <option value="video">Vídeo</option>
                                <option value="image">Imagem</option>
                                <option value="audio">Áudio</option>
                              </select>
                              <button disabled={savingMediaUrl||!newMediaUrl.name.trim()||!newMediaUrl.url.trim()} onClick={async()=>{setSavingMediaUrl(true);try{const r=await fetch('/api/media-urls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newMediaUrl)});if(r.ok){const item=await r.json();setMediaUrls(p=>[...p,item]);setNewMediaUrl({name:'',url:'',type:'document',description:''});}}finally{setSavingMediaUrl(false);}}} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors shrink-0 flex items-center gap-1.5">
                                <Plus size={13}/>{savingMediaUrl?'…':'+ Adicionar'}
                              </button>
                            </div>
                          </div>
                          {mediaUrls.length>0&&<p className="text-[10px] text-slate-500 font-mono">{mediaUrls.map(m=>m.name).join(' · ')}</p>}
                        </div>
                      )}
                    </SettingGroup>
                  </div>
                );
              })}

              {/* Settings not in any group */}
              {(() => {
                const allGrouped = settingGroups.flatMap(([,,keys])=>keys);
                const ungrouped = settings.filter(s=>!allGrouped.includes(s.key) && s.key !== 'ai_enabled');
                if(ungrouped.length===0) return null;
                return (
                  <SettingGroup label="Outros" icon={<Settings size={14} className="text-slate-400"/>}>
                    {ungrouped.map(s=>(
                      <SettingCard key={s.key} setting={s} value={settingValues[s.key]??''}
                        onChange={v=>setSettingValues(p=>({...p,[s.key]:v}))}
                        onSave={()=>saveSetting(s.key)} saving={savingKey===s.key} saved={savedKey===s.key}/>
                    ))}
                  </SettingGroup>
                );
              })()}

              <SettingGroup label="Biblioteca de Mídia" icon={<Library size={14} className="text-blue-400"/>}>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <label className={`inline-flex items-center gap-2 cursor-pointer text-sm font-medium px-4 py-2 rounded-lg transition-colors ${uploadingMedia?'bg-slate-600 text-slate-400':'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                    <Upload size={14}/>{uploadingMedia?'Enviando…':'Fazer Upload de Arquivo'}
                    <input type="file" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia}/>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Suporta vídeos, PDFs, imagens e áudios. Envie ao cliente via atendimento manual.</p>
                  {!isAdminMaster&&(
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Armazenamento</span>
                        <span>{storageUsedMB.toFixed(1)} MB / {STORAGE_LIMIT_MB} MB</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${storagePercent>90?'bg-red-500':storagePercent>70?'bg-amber-500':'bg-blue-500'}`} style={{width:`${storagePercent}%`}}/>
                      </div>
                    </div>
                  )}
                </div>
                {mediaItems.length===0 && <p className="text-slate-500 text-sm">Nenhum arquivo.</p>}
                {mediaItems.map(item=>(
                  <div key={item.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0"><MediaIcon type={item.type}/></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2"><span className="capitalize">{item.type}</span>{item.size_bytes>0&&<span>{(item.size_bytes/1024/1024).toFixed(1)} MB</span>}</p>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 shrink-0 px-2 py-1 rounded hover:bg-slate-700">Ver</a>
                    <button onClick={()=>removeMediaItem(item.id)} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={14}/></button>
                  </div>
                ))}
              </SettingGroup>

              {/* Respostas Rápidas */}
              <SettingGroup label="Respostas Rápidas" icon={<Zap size={14} className="text-amber-400"/>}>
                {quickReplies.length===0 && <p className="text-slate-500 text-sm">Nenhuma resposta rápida.</p>}
                {quickReplies.map(qr=>(
                  <div key={qr.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-start gap-3">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white">{qr.title}</p><p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap line-clamp-2">{qr.content}</p></div>
                    <button onClick={()=>removeQuickReply(qr.id)} className="text-slate-500 hover:text-red-400 shrink-0 mt-0.5"><Trash2 size={14}/></button>
                  </div>
                ))}
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <p className="text-sm font-medium text-white flex items-center gap-1.5"><Plus size={14} className="text-violet-400"/> Nova resposta rápida</p>
                  <input type="text" placeholder="Título" value={newQr.title} onChange={e=>setNewQr(p=>({...p,title:e.target.value}))} className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <textarea placeholder="Mensagem…" value={newQr.content} onChange={e=>setNewQr(p=>({...p,content:e.target.value}))} rows={3} className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                  <button onClick={addQuickReply} disabled={!newQr.title.trim()||!newQr.content.trim()} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5">
                    <Plus size={14}/> Adicionar
                  </button>
                </div>
              </SettingGroup>
            </div>
          </div>
        )}

      </main>
    {/* ── Change Password Modal ─────────────────────────────────────────── */}
    {showChangePwd && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2"><KeyRound size={16} className="text-violet-400"/> Alterar Senha</h3>
            <button onClick={()=>{setShowChangePwd(false);setChangePwdMsg(null);setChangePwdForm({current:'',next:'',confirm:'',});}} className="text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
          {(['current','next','confirm'] as const).map((field,i)=>{
            const labels={current:'Senha atual',next:'Nova senha',confirm:'Confirmar nova senha'};
            return (
              <div key={field} className="relative">
                <label className="text-xs text-slate-400 mb-1 block">{labels[field]}</label>
                <input type={showPwdFields[field]?'text':'password'} value={changePwdForm[field]}
                  onChange={e=>setChangePwdForm(p=>({...p,[field]:e.target.value}))}
                  placeholder={i===0?'Senha atual':'Mínimo 6 caracteres'}
                  className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 pr-10 outline-none focus:ring-1 focus:ring-violet-500"/>
                <button type="button" onClick={()=>setShowPwdFields(p=>({...p,[field]:!p[field]}))}
                  className="absolute right-2.5 bottom-2.5 text-slate-400 hover:text-white">
                  {showPwdFields[field]?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            );
          })}
          {changePwdMsg && (
            <p className={`text-xs px-3 py-2 rounded-lg ${changePwdMsg.ok?'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40':'bg-red-900/40 text-red-400 border border-red-700/40'}`}>{changePwdMsg.text}</p>
          )}
          <button onClick={changeOwnPassword} disabled={changePwdSaving}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
            {changePwdSaving?<><RefreshCw size={14} className="animate-spin"/> Salvando…</>:<><CheckCircle size={14}/> Salvar nova senha</>}
          </button>
        </div>
      </div>
    )}

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ViewBtn({ active, onClick, icon, label }: { active:boolean; onClick:()=>void; icon:React.ReactNode; label:string }) {
  return <button onClick={onClick} className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${active?'bg-slate-600 text-white':'text-slate-400 hover:text-white'}`}>{icon}{label}</button>;
}
function FilterPill({ active, onClick, label }: { active:boolean; onClick:()=>void; label:string }) {
  return <button onClick={onClick} className={`text-xs px-2.5 py-1 rounded-full transition-colors ${active?'bg-violet-700 text-violet-200':'text-slate-400 hover:text-white bg-slate-700/40'}`}>{label}</button>;
}
function MediaIcon({ type }: { type:string }) {
  if(type==='video') return <Film size={14} className="text-purple-400"/>;
  if(type==='image') return <Image size={14} className="text-blue-400"/>;
  if(type==='audio') return <Music size={14} className="text-amber-400"/>;
  return <FileText size={14} className="text-red-400"/>;
}
