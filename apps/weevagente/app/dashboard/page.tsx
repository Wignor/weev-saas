'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Settings, MessageSquare, Send, Phone, Clock, Plus, Trash2,
  CheckCircle, Save, RefreshCw, PauseCircle, PlayCircle, X,
  ChevronLeft, Wifi, WifiOff, LogOut, Megaphone, Info, AlertTriangle,
  ChevronDown, ChevronUp, Mic, Square, Music, BarChart2, Bell,
  Building2, ArrowRightLeft, Menu, Users, Zap, ShieldCheck, KeyRound,
  Eye, EyeOff, Paperclip, Link,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Conversation {
  id: string; push_name: string | null;
  status: 'active' | 'paused' | 'waiting';
  last_message: string | null; last_message_at: string | null;
  sector_id?: number | null;
}
interface Message { id: string; role: 'user' | 'assistant' | 'human'; content: string; created_at: string; }
interface Setting { key: string; value: string; label: string; description: string; }
interface QuickReply { id: number; title: string; content: string; }
interface TenantInstance { id: string; instance_name: string; label: string | null; connected: boolean; qrCode: string | null; }
interface MetaTemplate { name: string; status: string; category: string; language: string; }
interface BroadcastResult { number: string; ok: boolean; error?: string; }
interface ScheduledBroadcast { id: number; msg_type: string; template_name: string | null; numbers: string[]; scheduled_at: string; status: 'pending' | 'sent' | 'failed'; result_count: number | null; }
interface Sector { id: number; name: string; description: string | null; }
interface FollowupConfig { id?: number; step_order: number; enabled: boolean; delay_minutes: number; message: string; file_url: string; file_type: string; file_name: string; }
interface DailyReport { total_conversations: number; new_contacts: number; human_paused: number; ai_active: number; messages_sent: number; by_hour: { hour: number; count: number }[]; }
interface MediaItem { id: number; name: string; type: 'image'|'video'|'document'|'audio'; url: string; file_name: string; size_bytes: number; }
interface MediaUrlItem { id: number; name: string; url: string; type: 'document'|'video'|'image'|'audio'; description: string|null; }
interface AdminTenant { id: string; email: string; name: string | null; status: string; evolution_instance: string | null; created_at: string; }
interface Operator { id: number; name: string; email: string; sector_id: number | null; active: boolean; created_at: string; }

type Tab = 'dashboard' | 'inbox' | 'whatsapp' | 'broadcast' | 'sectors' | 'followups' | 'settings' | 'admin';

// ─── Logo Component ───────────────────────────────────────────────────────────
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
const COLORS = ['bg-violet-600','bg-blue-600','bg-indigo-600','bg-rose-600','bg-amber-600','bg-cyan-600'];
function Avatar({ name, size='sm' }: { name: string; size?: 'sm'|'md' }) {
  const s = size==='md' ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  return (
    <div className={`${s} ${COLORS[name.charCodeAt(0)%COLORS.length]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string|null }) {
  if (status==='active')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/70 text-violet-400 border border-violet-700/50">IA Ativa</span>;
  if (status==='paused')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/70 text-amber-400 border border-amber-700/50">Atendente</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">Aguardando</span>;
}

// ─── MsgBubble ────────────────────────────────────────────────────────────────
function MsgBubble({ msg }: { msg: Message }) {
  const isRight = msg.role==='assistant' || msg.role==='human';
  const bubble = msg.role==='assistant' ? 'bg-violet-700/80' : msg.role==='human' ? 'bg-blue-700/80' : 'bg-slate-700';
  const label  = msg.role==='assistant' ? 'IA' : msg.role==='human' ? 'Atendente' : undefined;
  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
  return (
    <div className={`flex ${isRight?'justify-end':'justify-start'} gap-1.5`}>
      {!isRight && <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 mt-1">👤</div>}
      <div className="max-w-[75%]">
        {label && <p className="text-[10px] text-slate-400 mb-0.5 text-right">{label}</p>}
        <div className={`${bubble} text-white text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap break-words`}>{msg.content}</div>
        <p className="text-[10px] text-slate-500 mt-0.5 text-right">{time}</p>
      </div>
    </div>
  );
}

// ─── NumberListEditor ─────────────────────────────────────────────────────────
function NumberListEditor({ value, onChange }: { value: string; onChange:(v:string)=>void }) {
  const [input, setInput] = useState('');
  const numbers = value ? value.split(',').map(n=>n.trim()).filter(Boolean) : [];
  const add = () => { const n=input.replace(/\D/g,'').trim(); if(!n)return; onChange(Array.from(new Set([...numbers,n])).join(',')); setInput(''); };
  const remove = (n: string) => onChange(numbers.filter(x=>x!==n).join(','));
  return (
    <div className="space-y-2">
      {numbers.length>0 && <div className="flex flex-wrap gap-1.5">{numbers.map(n=><span key={n} className="flex items-center gap-1 bg-slate-700 text-xs text-slate-200 px-2 py-1 rounded-lg">{n}<button onClick={()=>remove(n)} className="text-slate-400 hover:text-red-400"><X size={11}/></button></span>)}</div>}
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
  const isLong = setting.key==='welcome_message';
  const isSecret = setting.key==='openai_api_key'||setting.key==='google_client_secret'||setting.key==='google_refresh_token';
  const isNumberList = setting.key==='allowed_numbers'||setting.key==='blocked_numbers';
  const selectOptions: Record<string,{value:string;label:string}[]> = {
    signature_enabled:[{value:'false',label:'Desativada'},{value:'true',label:'Ativada'}],
    tts_enabled:[{value:'false',label:'Desativado'},{value:'true',label:'Ativado'}],
    tts_voice:[{value:'nova',label:'Nova (feminina, natural)'},{value:'alloy',label:'Alloy (neutra)'},{value:'echo',label:'Echo (masculina)'},{value:'fable',label:'Fable (expressiva)'},{value:'onyx',label:'Onyx (masculina, profunda)'},{value:'shimmer',label:'Shimmer (feminina, suave)'}],
    tts_mode:[{value:'both',label:'Texto + Áudio'},{value:'audio_only',label:'Apenas Áudio'},{value:'text_only',label:'Apenas Texto'}],
  };
  const isSelect = setting.key in selectOptions;

  // Group calendar settings
  const isCalendar = setting.key.startsWith('google_');

  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${isCalendar?'border-emerald-700/30':'border-slate-700'}`}>
      <div className="flex justify-between items-start mb-1">
        <label className="text-white text-sm font-medium">{setting.label}</label>
        <button onClick={onSave} disabled={saving}
          className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${saved?'bg-violet-600 text-white':'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}>
          {saved ? <><CheckCircle size={12}/> Salvo</> : saving ? 'Salvando…' : <><Save size={12}/> Salvar</>}
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

// ─── FollowupStepCard ─────────────────────────────────────────────────────────
function FollowupStepCard({ step, config, onSave }: {
  step: number;
  config: FollowupConfig;
  onSave: (c: FollowupConfig) => Promise<void>;
}) {
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
    setSaving(true);
    await onSave(local);
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };

  return (
    <div className={`bg-slate-800 rounded-xl border transition-colors ${local.enabled?'border-violet-700/50':'border-slate-700'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${local.enabled?'bg-violet-600 text-white':'bg-slate-700 text-slate-400'}`}>
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Follow-up {step}</p>
          <p className="text-slate-400 text-xs truncate">{local.enabled ? `Após ${local.delay_minutes >= 1440 ? `${local.delay_minutes/1440}d` : local.delay_minutes >= 60 ? `${local.delay_minutes/60}h` : `${local.delay_minutes}min`} · ${local.message||'(sem mensagem)'}` : 'Desativado'}</p>
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
            <label className="text-xs text-slate-400 block mb-1">Enviar após</label>
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
            <input type="url" value={local.file_url} onChange={e=>setLocal(p=>({...p,file_url:e.target.value}))} placeholder="URL do arquivo (PDF, vídeo, imagem...)"
              className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 mb-2"/>
            <div className="flex gap-2">
              <select value={local.file_type} onChange={e=>setLocal(p=>({...p,file_type:e.target.value}))}
                className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                <option value="">Tipo</option>
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
                <option value="document">Documento/PDF</option>
              </select>
              <input type="text" value={local.file_name} onChange={e=>setLocal(p=>({...p,file_name:e.target.value}))} placeholder="Nome do arquivo"
                className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`w-full flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-lg transition-colors ${saved?'bg-violet-600 text-white':'bg-slate-600 hover:bg-slate-500 text-white'} disabled:opacity-50`}>
            {saved?<><CheckCircle size={14}/> Salvo!</>:saving?'Salvando…':<><Save size={14}/> Salvar passo {step}</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Inbox
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation|null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [newQrTitle, setNewQrTitle] = useState('');
  const [newQrContent, setNewQrContent] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQrPicker, setShowQrPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource|null>(null);

  // Settings
  const [settings, setSettings] = useState<Setting[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string,string>>({});
  const [savingKey, setSavingKey] = useState<string|null>(null);
  const [savedKey, setSavedKey] = useState<string|null>(null);

  // WhatsApp
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [maxInstances, setMaxInstances] = useState(1);
  const [waLoading, setWaLoading] = useState(false);
  const [addingInstance, setAddingInstance] = useState(false);
  const [newInstanceLabel, setNewInstanceLabel] = useState('');
  const [disconnecting, setDisconnecting] = useState<string|null>(null);

  // Media library
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [showMedia, setShowMedia] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sendingMedia, setSendingMedia] = useState<number|null>(null);
  const mediaUploadRef = useRef<HTMLInputElement>(null);

  // Media URLs
  const [mediaUrls, setMediaUrls] = useState<MediaUrlItem[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState({ name: '', url: '', type: 'document' as MediaUrlItem['type'], description: '' });
  const [savingMediaUrl, setSavingMediaUrl] = useState(false);

  // Audio
  const [isRecording, setIsRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

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
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<ScheduledBroadcast[]>([]);

  // Dashboard report
  const [dailyReport, setDailyReport] = useState<DailyReport|null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0,10));
  const [reportLoading, setReportLoading] = useState(false);

  // Current user
  const [currentUserEmail, setCurrentUserEmail] = useState<string|null>(null);
  const [currentRole, setCurrentRole] = useState<'admin'|'operator'>('admin');
  const [currentSectorId, setCurrentSectorId] = useState<number|null>(null);
  const ADMIN_EMAIL = 'wignor.ferreira@gmail.com';

  // Admin panel
  const [adminTenants, setAdminTenants] = useState<AdminTenant[]>([]);
  const [adminTenantsLoaded, setAdminTenantsLoaded] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<'clients'|'sectors'|'operators'>('clients');
  const [newTenant, setNewTenant] = useState({ email: '', name: '', password: '', evolutionInstance: '' });
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState<string|null>(null);
  const [resetingTenant, setResetingTenant] = useState<string|null>(null);
  const [resetTenantPwd, setResetTenantPwd] = useState<Record<string,string>>({});
  // Change password
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [changePwdForm, setChangePwdForm] = useState({ current: '', next: '', confirm: '' });
  const [changePwdSaving, setChangePwdSaving] = useState(false);
  const [changePwdMsg, setChangePwdMsg] = useState<{ok:boolean;text:string}|null>(null);
  const [showPwdFields, setShowPwdFields] = useState({ current: false, next: false, confirm: false });

  // Sectors
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorDesc, setNewSectorDesc] = useState('');
  const [creatingSector, setCreatingSector] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Operators
  const [operators, setOperators] = useState<Operator[]>([]);
  const [newOperator, setNewOperator] = useState({ name: '', email: '', password: '', sectorId: '' });
  const [creatingOperator, setCreatingOperator] = useState(false);
  const [operatorsLoaded, setOperatorsLoaded] = useState(false);
  const [transferSectorId, setTransferSectorId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Follow-ups
  const [followupConfigs, setFollowupConfigs] = useState<FollowupConfig[]>(() =>
    Array.from({length:5},(_,i)=>({ step_order:i+1, enabled:false, delay_minutes:60*(i+1), message:'', file_url:'', file_type:'', file_name:'' }))
  );

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try { const r = await fetch('/api/conversations'); if (r.ok) setConversations(await r.json()); } catch {}
  }, []);

  const loadAdminTenants = useCallback(async () => {
    try { const r = await fetch('/api/admin/users'); if (r.ok) setAdminTenants(await r.json()); } catch {}
    setAdminTenantsLoaded(true);
  }, []);

  const loadOperators = useCallback(async () => {
    try { const r = await fetch('/api/operators'); if (r.ok) setOperators(await r.json()); } catch {}
    setOperatorsLoaded(true);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{
      setCurrentUserEmail(d.email);
      setCurrentRole(d.role ?? 'admin');
      setCurrentSectorId(d.sectorId ?? null);
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    if ((tab === 'admin' || tab === 'sectors') && !adminTenantsLoaded) loadAdminTenants();
    if ((tab === 'admin' || tab === 'sectors') && !operatorsLoaded) loadOperators();
  }, [tab, adminTenantsLoaded, loadAdminTenants, operatorsLoaded, loadOperators]);

  useEffect(() => {
    loadConversations();
    fetch('/api/quick-replies').then(r=>r.json()).then(setQuickReplies).catch(()=>{});
    fetch('/api/settings').then(r=>r.json()).then((s:Setting[])=>{
      setSettings(s); setSettingValues(Object.fromEntries(s.map(x=>[x.key,x.value])));
    }).catch(()=>{});
    fetch('/api/sectors').then(r=>r.json()).then(setSectors).catch(()=>{});
    fetch('/api/media').then(r=>r.json()).then((d:MediaItem[])=>{ if(Array.isArray(d)) setMediaItems(d); }).catch(()=>{});
    fetch('/api/media-urls').then(r=>r.json()).then((d:MediaUrlItem[])=>{ if(Array.isArray(d)) setMediaUrls(d); }).catch(()=>{});
    fetch('/api/followups').then(r=>r.json()).then((data:FollowupConfig[])=>{
      if (data?.length) {
        setFollowupConfigs(prev=>prev.map(p=>data.find(d=>d.step_order===p.step_order)||p));
      }
    }).catch(()=>{});
  }, [loadConversations]);

  // SSE
  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;
      es.onmessage = (e) => { try { const {type,data}=JSON.parse(e.data); if(type==='conversations')setConversations(data); } catch {} };
      es.onerror = () => { es.close(); setTimeout(connect,5000); };
    };
    connect();
    return () => eventSourceRef.current?.close();
  }, []);

  // Load messages
  useEffect(() => {
    if (!selected) return;
    fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>{setMessages(d.messages||[]);setSelectedConv(d.conversation||null);}).catch(()=>{});
  }, [selected]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  // Load daily report
  const loadReport = useCallback(async (date: string) => {
    setReportLoading(true);
    try {
      const r = await fetch(`/api/report/daily?date=${date}`);
      if (r.ok) setDailyReport(await r.json());
    } catch {}
    setReportLoading(false);
  }, []);

  useEffect(() => { if (tab==='dashboard') loadReport(reportDate); }, [tab, reportDate, loadReport]);

  // Load WhatsApp instances
  const loadInstances = useCallback(async () => {
    setWaLoading(true);
    try { const r=await fetch('/api/instances'); if(r.ok){const d=await r.json();setInstances(d.instances||[]);setMaxInstances(d.maxInstances||1);} } catch {}
    setWaLoading(false);
  }, []);

  useEffect(() => {
    if (tab!=='whatsapp') return;
    loadInstances();
    const iv=setInterval(()=>{setInstances(p=>{if(p.length>0&&p.every(i=>i.connected)){clearInterval(iv);return p;}return p;});loadInstances();},5000);
    return ()=>clearInterval(iv);
  }, [tab, loadInstances]);

  // Load broadcast data
  useEffect(() => {
    if (tab!=='broadcast'||bcastTemplatesLoaded) return;
    Promise.all([fetch('/api/meta-templates').catch(()=>null),fetch('/api/meta-broadcast').catch(()=>null)]).then(([r1,r2])=>{
      if(r1?.ok)r1.json().then(d=>setBcastTemplates(d.templates||[]));
      if(r2?.ok)r2.json().then(d=>setScheduledBroadcasts(d.broadcasts||[]));
    });
    setBcastTemplatesLoaded(true);
  }, [tab, bcastTemplatesLoaded]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const convName = (c: Conversation) => c.push_name || c.id;
  const fmtSecs = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const logout = async () => { await fetch('/api/auth/logout',{method:'POST'}); router.push('/login'); };

  // ── Send reply ────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!selected||!replyText.trim()||sending) return;
    setSending(true);
    try {
      const r=await fetch('/api/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,text:replyText.trim()})});
      if(r.ok){setReplyText('');setTimeout(()=>fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>{setMessages(d.messages||[]);setSelectedConv(d.conversation||null);}).catch(()=>{}),600);}
    } catch {}

  };

  const handleDirectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected || sendingFile) return;
    e.target.value = '';
    setSendingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('number', selected);
      await fetch('/api/send-file', { method: 'POST', body: fd });
    } catch {}
    setSendingFile(false);
    setSending(false);
  };

  const STORAGE_LIMIT_MB = 120;
  const storageUsedBytes = mediaItems.reduce((s, m) => s + (m.size_bytes || 0), 0);
  const storageUsedMB = storageUsedBytes / (1024 * 1024);
  const storagePercent = Math.min((storageUsedMB / STORAGE_LIMIT_MB) * 100, 100);
  const isAdminMaster = currentUserEmail === ADMIN_EMAIL;

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingMedia) return;
    e.target.value = '';
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      const r = await fetch('/api/media', { method: 'POST', body: fd });
      if (r.status === 413) { alert('Limite de armazenamento atingido (120 MB). Exclua arquivos para liberar espaço.'); }
      else if (r.ok) { const item = await r.json(); setMediaItems(p => [item, ...p]); }
    } catch {}
    setUploadingMedia(false);
  };

  const sendMediaItem = async (mediaId: number) => {
    if (!selected || sendingMedia) return;
    setSendingMedia(mediaId);
    try {
      await fetch('/api/send-media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: selected, mediaId }) });
      setShowMedia(false);
    } catch {}
    setSendingMedia(null);
  };

  const deleteMediaItem = async (id: number) => {
    await fetch('/api/media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setMediaItems(p => p.filter(m => m.id !== id));
  };

  const [sendingUrlMedia, setSendingUrlMedia] = useState<string|null>(null);
  const sendUrlMedia = async (url: string, type: string, name: string, key: string) => {
    if (!selected || sendingUrlMedia) return;
    setSendingUrlMedia(key);
    try {
      await fetch('/api/send-url-media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: selected, url, type, name }) });
      setShowMedia(false);
    } catch {}
    setSendingUrlMedia(null);
  };

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const togglePause = async () => {
    if (!selected||!selectedConv) return;
    const action=selectedConv.status==='paused'?'resume':'pause';
    await fetch(`/api/conversations/${selected}/pause`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>setSelectedConv(d.conversation||null)).catch(()=>{});
    await loadConversations();
  };

  // ── Save setting ──────────────────────────────────────────────────────────
  const saveSetting = async (key: string) => {
    setSavingKey(key);
    await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:settingValues[key]})});
    setSavingKey(null);setSavedKey(key);setTimeout(()=>setSavedKey(null),2000);
  };

  // ── Quick replies ─────────────────────────────────────────────────────────
  const addQuickReply = async () => {
    if (!newQrTitle.trim()||!newQrContent.trim()) return;
    const r=await fetch('/api/quick-replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:newQrTitle,content:newQrContent})});
    if(r.ok){const qr=await r.json();setQuickReplies(p=>[...p,qr]);setNewQrTitle('');setNewQrContent('');}
  };
  const deleteQuickReply = async (id:number) => {
    await fetch(`/api/quick-replies/${id}`,{method:'DELETE'});
    setQuickReplies(p=>p.filter(q=>q.id!==id));
  };

  // ── Delete conversations ───────────────────────────────────────────────────
  const deleteSelected = async () => {
    if (!window.confirm(`Apagar ${selectedIds.size} conversa(s)?`)) return;
    const ids=Array.from(selectedIds);
    await Promise.all(ids.map(id=>fetch(`/api/conversations/${id}`,{method:'DELETE'})));
    setConversations(p=>p.filter(c=>!selectedIds.has(c.id)));
    if(selected&&selectedIds.has(selected)){setSelected(null);setMessages([]);setSelectedConv(null);}
    setSelectedIds(new Set());setSelectMode(false);
  };

  // ── Audio ─────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunksRef.current=[];
      const mimeType=['audio/ogg;codecs=opus','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const mr=new MediaRecorder(stream,mimeType?{mimeType}:{});
      mr.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setAudioBlob(new Blob(chunksRef.current,{type:mr.mimeType||'audio/webm'}));setIsRecording(false);if(recTimerRef.current)clearInterval(recTimerRef.current);};
      mr.start();mediaRecRef.current=mr;setIsRecording(true);setRecSecs(0);
      recTimerRef.current=setInterval(()=>setRecSecs(s=>{if(s>=119){mr.stop();return s;}return s+1;}),1000);
    } catch { alert('Não foi possível acessar o microfone.'); }
  };
  const stopRecording=()=>mediaRecRef.current?.stop();
  const cancelRecording=()=>{mediaRecRef.current?.stop();if(recTimerRef.current)clearInterval(recTimerRef.current);setIsRecording(false);setAudioBlob(null);setRecSecs(0);chunksRef.current=[];};
  const sendRecordedAudio=async()=>{
    if(!audioBlob||!selected||sendingAudio)return;
    setSendingAudio(true);
    try {
      const reader=new FileReader();
      reader.onloadend=async()=>{
        const base64=(reader.result as string).split(',')[1];
        const r=await fetch('/api/send-audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selected,audioBase64:base64})});
        if(r.ok){setAudioBlob(null);setRecSecs(0);setTimeout(()=>fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>{setMessages(d.messages||[]);setSelectedConv(d.conversation||null);}).catch(()=>{}),800);}
        else alert('Falha ao enviar áudio.');
        setSendingAudio(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch {setSendingAudio(false);}
  };

  // ── Sectors ───────────────────────────────────────────────────────────────
  const createSector = async () => {
    if (!newSectorName.trim()) return;
    setCreatingSector(true);
    try {
      const r=await fetch('/api/sectors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newSectorName.trim(),description:newSectorDesc.trim()})});
      if(r.ok){const s=await r.json();setSectors(p=>[...p,s]);setNewSectorName('');setNewSectorDesc('');}
    } catch {}
    setCreatingSector(false);
  };
  const removeSector = async (id: number) => {
    if (!window.confirm('Remover este setor?')) return;
    await fetch(`/api/sectors/${id}`,{method:'DELETE'});
    setSectors(p=>p.filter(s=>s.id!==id));
  };
  const transferToSector = async () => {
    if (!selected||!transferSectorId) return;
    setTransferring(true);
    try {
      await fetch('/api/sectors/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:selected,toSectorId:parseInt(transferSectorId),note:transferNote})});
      setTransferModalOpen(false);setTransferSectorId('');setTransferNote('');
      fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>setSelectedConv(d.conversation||null)).catch(()=>{});
    } catch {}
    setTransferring(false);
  };

  // ── Follow-ups ────────────────────────────────────────────────────────────
  const saveFollowupStep = async (config: FollowupConfig) => {
    await fetch('/api/followups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
    setFollowupConfigs(p=>p.map(c=>c.step_order===config.step_order?config:c));
  };

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const addInstance = async () => {
    setAddingInstance(true);
    try {
      const r=await fetch('/api/instances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:newInstanceLabel.trim()||undefined})});
      if(r.ok){setNewInstanceLabel('');await loadInstances();}
      else{const d=await r.json();if(d.error==='limit_reached')alert('Limite de conexões atingido.');}
    } catch {}
    setAddingInstance(false);
  };
  const disconnectInstance = async (instanceName: string) => {
    if (!window.confirm('Desconectar este número?')) return;
    setDisconnecting(instanceName);
    await fetch(`/api/whatsapp?instance=${encodeURIComponent(instanceName)}`,{method:'DELETE'}).catch(()=>{});
    setDisconnecting(null);await loadInstances();
  };

  // ── Broadcast ─────────────────────────────────────────────────────────────
  const parsedNumbers = bcastNumbers.split('\n').map(n=>n.replace(/\D/g,'').trim()).filter(Boolean);
  const sendBroadcast = async () => {
    if (!parsedNumbers.length) return;
    if (!window.confirm(`${bcastScheduledAt?'Agendar':'Enviar'} para ${parsedNumbers.length} número(s)?`)) return;
    setBcastSending(true);setBcastResults([]);
    try {
      const r=await fetch('/api/meta-broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msgType:bcastMsgType,freeText:bcastFreeText,templateName:bcastTemplateName,templateLang:bcastTemplateLang,templateVars:bcastTemplateVars,numbers:parsedNumbers,scheduledAt:bcastScheduledAt||undefined})});
      const data=await r.json();
      if(data.error){alert(data.error);return;}
      if(data.scheduled){alert(`Agendado para ${new Date(data.scheduledAt).toLocaleString('pt-BR')}!`);setBcastScheduledAt('');fetch('/api/meta-broadcast').then(r=>r.json()).then(d=>setScheduledBroadcasts(d.broadcasts||[]));return;}
      setBcastResults(data.results||[]);
    } catch {alert('Erro ao conectar com a API.');}
    finally{setBcastSending(false);}
  };

  // ── Admin actions ─────────────────────────────────────────────────────────
  const createAdminTenant = async () => {
    if(!newTenant.email||!newTenant.password||newTenant.password.length<6) return;
    setCreatingTenant(true);
    const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newTenant)});
    if(r.ok){const t=await r.json();setAdminTenants(p=>[t,...p]);setNewTenant({email:'',name:'',password:'',evolutionInstance:''});}
    else{const d=await r.json();alert(d.error||'Erro ao criar cliente.');}
    setCreatingTenant(false);
  };
  const deleteAdminTenant = async (id:string) => {
    if(!window.confirm('Remover este cliente e todos os dados?'))return;
    setDeletingTenant(id);
    await fetch(`/api/admin/users/${id}`,{method:'DELETE'});
    setAdminTenants(p=>p.filter(t=>t.id!==id));
    setDeletingTenant(null);
  };
  const resetAdminTenantPassword = async (id:string) => {
    const pwd=resetTenantPwd[id];
    if(!pwd||pwd.length<6){alert('Senha deve ter no mínimo 6 caracteres.');return;}
    setResetingTenant(id);
    const r=await fetch(`/api/admin/users/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pwd})});
    if(r.ok){setResetTenantPwd(p=>({...p,[id]:''}));alert('Senha redefinida!');}
    else{const d=await r.json();alert(d.error||'Erro.');}
    setResetingTenant(null);
  };
  const changeOwnPassword = async () => {
    if(!changePwdForm.current||!changePwdForm.next||changePwdForm.next.length<6){setChangePwdMsg({ok:false,text:'Preencha todos os campos (mín. 6 chars).'});return;}
    if(changePwdForm.next!==changePwdForm.confirm){setChangePwdMsg({ok:false,text:'As novas senhas não coincidem.'});return;}
    setChangePwdSaving(true);setChangePwdMsg(null);
    const r=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:changePwdForm.current,newPassword:changePwdForm.next})});
    const d=await r.json();
    setChangePwdMsg({ok:r.ok,text:r.ok?'Senha alterada com sucesso!':d.error||'Erro.'});
    if(r.ok)setChangePwdForm({current:'',next:'',confirm:''});
    setChangePwdSaving(false);
  };

  // ── Nav items ─────────────────────────────────────────────────────────────
  const navItems: [Tab, string, React.ReactNode][] = [
    ['dashboard', 'Dashboard', <BarChart2 size={16}/>],
    ['inbox', 'Atendimento', <MessageSquare size={16}/>],
    ['whatsapp', 'WhatsApp', <Phone size={16}/>],
    ['broadcast', 'Disparo', <Megaphone size={16}/>],
    ['sectors', 'Setores', <Building2 size={16}/>],
    ['followups', 'Follow-ups', <Bell size={16}/>],
    ...(currentRole !== 'operator' ? [['settings', 'Configurações', <Settings size={16}/>] as [Tab, string, React.ReactNode]] : []),
    ...(currentUserEmail === ADMIN_EMAIL ? [['admin', 'Admin', <ShieldCheck size={16}/>] as [Tab, string, React.ReactNode]] : []),
  ];

  const changeTab = (t: Tab) => { setTab(t); setMobileMenuOpen(false); };

  // Settings grouped
  const settingGroups: Record<string, string[]> = {
    'Agente IA': ['openai_api_key','openai_assistant_id','welcome_message'],
    'Atendimento': ['notification_number','ai_reactivation_minutes'],
    'Mídias': ['video_url','pdf_url'],
    'Voz (TTS)': ['tts_enabled','tts_mode','tts_voice'],
    'Google Calendar': ['google_calendar_id','google_client_id','google_client_secret','google_refresh_token','google_event_duration','google_timezone'],
    'Meta API': ['meta_phone_number_id','meta_access_token','meta_business_account_id'],
    'Filtros': ['allowed_numbers','blocked_numbers'],
    'Assinatura': ['signature_enabled','signature_text'],
  };

  const [openGroups, setOpenGroups] = useState<Record<string,boolean>>({ 'Agente IA': true });
  const toggleGroup = (g: string) => setOpenGroups(p=>({...p,[g]:!p[g]}));

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={()=>setMobileMenuOpen(false)}/>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto inset-y-0 left-0
        flex flex-col border-r border-slate-700/60 bg-slate-900
        transition-all duration-200
        ${sidebarOpen ? 'w-56' : 'w-0 lg:w-16'}
        ${mobileMenuOpen ? 'translate-x-0 w-56' : '-translate-x-full lg:translate-x-0'}
        overflow-hidden shrink-0
      `}>
        {/* Logo */}
        <div className={`flex items-center border-b border-slate-700/60 shrink-0 ${sidebarOpen ? 'gap-2.5 px-4 py-3.5' : 'justify-center py-3.5 px-2'}`}>
          <div className="shrink-0 drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
            <WeevZapLogo size="sm"/>
          </div>
          {sidebarOpen && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-black text-sm text-white tracking-tight">WeevZap</span>
              <span className="text-[10px] font-bold text-violet-400 border border-violet-600/50 px-1 rounded bg-violet-600/10">PRO</span>
            </div>
          )}
          {sidebarOpen && (
            <button onClick={logout} className="ml-auto text-slate-500 hover:text-white transition-colors shrink-0" title="Sair">
              <LogOut size={14}/>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(([t, label, icon])=>(
            <button key={t} onClick={()=>changeTab(t)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                tab===t ? 'text-violet-400 bg-violet-600/10 border-r-2 border-violet-500' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              } ${!sidebarOpen ? 'justify-center px-2' : ''}`}
              title={!sidebarOpen ? label : undefined}>
              <span className="shrink-0">{icon}</span>
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Alterar senha + Collapse toggle */}
        {sidebarOpen && (
          <div className="px-4 py-2.5 border-t border-slate-700/60">
            <button onClick={()=>setShowChangePwd(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <KeyRound size={11}/> Alterar senha
            </button>
          </div>
        )}
        <button onClick={()=>setSidebarOpen(v=>!v)}
          className="hidden lg:flex items-center justify-center py-3 border-t border-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors">
          {sidebarOpen ? <ChevronLeft size={16}/> : <Zap size={16} className="text-violet-400"/>}
        </button>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 shrink-0">
          {/* Mobile menu button */}
          <button onClick={()=>setMobileMenuOpen(v=>!v)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu size={20}/>
          </button>

          {tab==='inbox' && selected && selectedConv ? (
            <>
              <button onClick={()=>setSelected(null)} className="text-slate-400 hover:text-white lg:hidden"><ChevronLeft size={20}/></button>
              <Avatar name={convName(selectedConv)} size="md"/>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{convName(selectedConv)}</p>
                <div className="flex items-center gap-1.5"><Clock size={11} className="text-slate-500"/><StatusBadge status={selectedConv.status}/></div>
              </div>
              <div className="flex items-center gap-2">
                {sectors.length>0 && (
                  <button onClick={()=>setTransferModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors">
                    <ArrowRightLeft size={13}/> Transferir
                  </button>
                )}
                <button onClick={togglePause}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${selectedConv.status==='paused'?'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30':'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'}`}>
                  {selectedConv.status==='paused'?<><PlayCircle size={13}/> Retomar IA</>:<><PauseCircle size={13}/> Assumir</>}
                </button>
              </div>
            </>
          ) : (
            <span className="text-white font-semibold text-sm">{navItems.find(n=>n[0]===tab)?.[1]}</span>
          )}
        </header>

        {/* ── Transfer modal ──────────────────────────────────────────────── */}
        {transferModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold">Transferir Atendimento</p>
                <button onClick={()=>setTransferModalOpen(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Setor de destino *</label>
                  <select value={transferSectorId} onChange={e=>setTransferSectorId(e.target.value)}
                    className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="">Selecionar setor...</option>
                    {sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Observação (opcional)</label>
                  <textarea value={transferNote} onChange={e=>setTransferNote(e.target.value)} rows={2} placeholder="Motivo da transferência..."
                    className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                </div>
                <button onClick={transferToSector} disabled={!transferSectorId||transferring}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-xl transition-colors">
                  {transferring?'Transferindo…':'Confirmar Transferência'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
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
                  <button onClick={()=>loadReport(reportDate)} disabled={reportLoading}
                    className="text-slate-400 hover:text-white disabled:opacity-50">
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
                    {dailyReport.by_hour.length > 0 ? (
                      <div className="pb-5 relative">
                        <HourChart data={dailyReport.by_hour}/>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm text-center py-4">Nenhuma mensagem registrada neste dia.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    {reportLoading ? <RefreshCw size={24} className="text-violet-400 animate-spin mx-auto mb-2"/> : <BarChart2 size={24} className="text-slate-600 mx-auto mb-2"/>}
                    <p className="text-slate-500 text-sm">{reportLoading?'Carregando relatório…':'Selecione uma data para ver o relatório.'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INBOX TAB ────────────────────────────────────────────────── */}
          {tab==='inbox' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Conversation list */}
              <div className={`flex flex-col border-r border-slate-700/60 shrink-0 overflow-hidden transition-all ${selected?'hidden md:flex w-72':'w-full md:w-72'}`}>
                {/* Toolbar */}
                <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
                  {selectMode ? (
                    <>
                      <button onClick={()=>setSelectedIds(new Set(conversations.map(c=>c.id)))} className="text-xs text-slate-400 hover:text-white">Todos</button>
                      <div className="flex items-center gap-2">
                        {selectedIds.size>0&&<button onClick={deleteSelected} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20"><Trash2 size={11}/> Apagar ({selectedIds.size})</button>}
                        <button onClick={()=>{setSelectMode(false);setSelectedIds(new Set());}} className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">{conversations.length} conversa(s)</p>
                      <button onClick={()=>setSelectMode(true)} className="text-xs text-slate-500 hover:text-white">Selecionar</button>
                    </>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {conversations.length===0&&<p className="text-slate-500 text-xs text-center mt-8 px-4">Nenhuma conversa ainda.<br/>Conecte seu WhatsApp e aguarde mensagens.</p>}
                  {conversations.map(c=>(
                    <div key={c.id} onClick={()=>selectMode?setSelectedIds(p=>{const n=new Set(p);n.has(c.id)?n.delete(c.id):n.add(c.id);return n;}):setSelected(c.id)}
                      className={`flex items-center gap-2.5 px-3 py-3 border-b border-slate-700/40 cursor-pointer transition-colors ${selectedIds.has(c.id)?'bg-violet-900/30':selected===c.id&&!selectMode?'bg-slate-700':'hover:bg-slate-800'}`}>
                      {selectMode&&<div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selectedIds.has(c.id)?'bg-violet-600 border-violet-600':'border-slate-500'}`}>{selectedIds.has(c.id)&&<CheckCircle size={10} className="text-white"/>}</div>}
                      <Avatar name={convName(c)}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium text-white truncate">{convName(c)}</p>
                          <StatusBadge status={c.status}/>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{c.last_message||'...'}</p>
                        {c.sector_id&&sectors.find(s=>s.id===c.sector_id)&&(
                          <span className="text-[10px] text-blue-400 flex items-center gap-0.5 mt-0.5"><Building2 size={9}/>{sectors.find(s=>s.id===c.sector_id)?.name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages area */}
              <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${!selected?'hidden md:flex':''}`}>
                {!selected ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mb-4">
                      <MessageSquare size={28} className="text-violet-400"/>
                    </div>
                    <p className="text-slate-300 font-medium mb-1">Selecione uma conversa</p>
                    <p className="text-slate-500 text-sm">Escolha uma conversa para visualizar as mensagens.</p>
                    {conversations.length===0&&<button onClick={()=>changeTab('whatsapp')} className="mt-4 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"><Phone size={15}/> Conectar WhatsApp</button>}
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map(m=><MsgBubble key={m.id} msg={m}/>)}
                      <div ref={messagesEndRef}/>
                    </div>
                    <div className="border-t border-slate-700/60 p-3 shrink-0">
                      {showQrPicker&&quickReplies.length>0&&!isRecording&&!audioBlob&&(
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {quickReplies.map(q=><button key={q.id} onClick={()=>{setReplyText(q.content);setShowQrPicker(false);}} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">{q.title}</button>)}
                          <button onClick={()=>setShowQrPicker(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                        </div>
                      )}
                      {showMedia&&!isRecording&&!audioBlob&&(
                        <div className="mb-2 bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-medium">Midia</span>
                            <div className="flex items-center gap-2">
                              <button onClick={()=>fileInputRef.current?.click()} disabled={sendingFile} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 disabled:opacity-50">
                                <Paperclip size={11}/>{sendingFile?'Enviando...':'Enviar direto'}
                              </button>
                              <button onClick={()=>mediaUploadRef.current?.click()} disabled={uploadingMedia} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50">
                                <Plus size={11}/>{uploadingMedia?'Salvando...':'+ Biblioteca'}
                              </button>
                            </div>
                          </div>
                          {!isAdminMaster&&(
                            <div className="mb-2">
                              <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                <span>Armazenamento</span>
                                <span>{storageUsedMB.toFixed(1)} MB / {STORAGE_LIMIT_MB} MB</span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${storagePercent>90?'bg-red-500':storagePercent>70?'bg-amber-500':'bg-violet-500'}`} style={{width:`${storagePercent}%`}}/>
                              </div>
                            </div>
                          )}
                          {(()=>{
                            const settingsMedia=[
                              settingValues['pdf_url']?{key:'pdf_url',name:'PDF (Configuracoes)',url:settingValues['pdf_url'],type:'document'}:null,
                              settingValues['video_url']?{key:'video_url',name:'Video (Configuracoes)',url:settingValues['video_url'],type:'video'}:null,
                            ].filter(Boolean) as {key:string;name:string;url:string;type:string}[];
                            const hasAny=settingsMedia.length>0||mediaItems.length>0;
                            if(!hasAny) return <p className="text-xs text-slate-500">Nenhum arquivo na biblioteca.</p>;
                            return (
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                {settingsMedia.map(item=>(
                                  <div key={item.key} className="flex items-center gap-2 bg-slate-600 border border-slate-500 rounded-lg px-2.5 py-1.5 max-w-[220px]">
                                    <span className="text-xs text-slate-300 truncate flex-1">{item.name}</span>
                                    <button onClick={()=>sendUrlMedia(item.url,item.type,item.name,item.key)} disabled={sendingUrlMedia===item.key} className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-2 py-0.5 rounded disabled:opacity-40 shrink-0">{sendingUrlMedia===item.key?'...':'Enviar'}</button>
                                  </div>
                                ))}
                                {mediaItems.map(item=>(
                                  <div key={item.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-2.5 py-1.5 max-w-[220px]">
                                    <span className="text-xs text-white truncate flex-1">{item.name}</span>
                                    <button onClick={()=>sendMediaItem(item.id)} disabled={sendingMedia===item.id} className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-2 py-0.5 rounded disabled:opacity-40 shrink-0">{sendingMedia===item.id?'...':'Enviar'}</button>
                                    <button onClick={()=>deleteMediaItem(item.id)} className="text-slate-500 hover:text-red-400 shrink-0"><X size={11}/></button>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleDirectFile}/>
                      <input ref={mediaUploadRef} type="file" className="hidden" onChange={uploadMedia}/>
                      <div className="flex gap-2 items-end">
                        {quickReplies.length>0&&!isRecording&&!audioBlob&&(
                          <button onClick={()=>setShowQrPicker(v=>!v)} className="w-9 h-9 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 shrink-0 transition-colors"><Zap size={16}/></button>
                        )}
                        {!isRecording&&!audioBlob&&(
                          <button onClick={()=>{setShowMedia(v=>!v);setShowQrPicker(false);}} title="Midia" className={`w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 shrink-0 transition-colors ${showMedia?'bg-blue-600 text-white':'bg-slate-700 hover:bg-slate-600'}`}>
                            <Paperclip size={16}/>
                          </button>
                        )}
                        {isRecording ? (
                          <div className="flex-1 flex items-center gap-2.5 bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2.5 min-h-[40px]">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"/>
                            <span className="text-sm font-mono text-red-400">{fmtSecs(recSecs)}</span>
                            <span className="text-xs text-slate-400 flex-1">Gravando…</span>
                            <button onClick={cancelRecording} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                          </div>
                        ) : audioBlob ? (
                          <div className="flex-1 flex items-center gap-2.5 bg-violet-900/20 border border-violet-700/40 rounded-xl px-3 py-2.5 min-h-[40px]">
                            <Music size={16} className="text-violet-400 shrink-0"/>
                            <span className="text-sm text-slate-300 flex-1">Áudio · {fmtSecs(recSecs)}</span>
                            <button onClick={()=>{setAudioBlob(null);setRecSecs(0);}} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                          </div>
                        ) : (
                          <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Digite uma mensagem... (Ctrl+Enter para pular linha)"
                            rows={1} onKeyDown={e=>{if(e.key==='Enter'&&!e.ctrlKey){e.preventDefault();sendReply();}}}
                            className="flex-1 bg-slate-700 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-none min-h-[40px] max-h-[120px]"/>
                        )}
                        {!audioBlob&&<button onClick={isRecording?stopRecording:startRecording}
                          className={`w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${isRecording?'bg-red-600 hover:bg-red-500 text-white':'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                          {isRecording?<Square size={14}/>:<Mic size={16}/>}
                        </button>}
                        {audioBlob ? (
                          <button onClick={sendRecordedAudio} disabled={sendingAudio} className="w-10 h-10 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl shrink-0 transition-colors">
                            {sendingAudio?<RefreshCw size={15} className="animate-spin"/>:<Send size={16}/>}
                          </button>
                        ) : !isRecording ? (
                          <button onClick={sendReply} disabled={sending||!replyText.trim()} className="w-10 h-10 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shrink-0 transition-colors">
                            <Send size={16}/>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── WHATSAPP TAB ─────────────────────────────────────────────── */}
          {tab==='whatsapp' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Conexões WhatsApp</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{instances.length}/{maxInstances}</span>
                  <button onClick={loadInstances} disabled={waLoading} className="text-slate-400 hover:text-white disabled:opacity-50"><RefreshCw size={14} className={waLoading?'animate-spin':''}/></button>
                </div>
              </div>
              {instances.map(inst=>(
                <div key={inst.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{inst.label||inst.instance_name}</p>
                    <div className="flex items-center gap-2">
                      {inst.connected ? (
                        <><Wifi size={14} className="text-green-400"/><span className="text-xs text-green-400 font-medium">Conectado</span>
                        <button onClick={()=>disconnectInstance(inst.instance_name)} disabled={disconnecting===inst.instance_name}
                          className="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-700/30 disabled:opacity-50">
                          {disconnecting===inst.instance_name?'Desconectando…':'Desconectar'}
                        </button></>
                      ) : (
                        <><WifiOff size={14} className="text-red-400"/><span className="text-xs text-red-400 font-medium">Desconectado</span></>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{inst.instance_name}</p>
                  {!inst.connected&&inst.qrCode&&<div><p className="text-xs text-slate-400 mb-2">Escaneie com o WhatsApp:</p><img src={inst.qrCode} alt="QR Code" className="w-full rounded-lg border border-slate-600 max-w-xs"/></div>}
                  {!inst.connected&&!inst.qrCode&&<p className="text-xs text-slate-500">Aguardando QR code… Clique em atualizar.</p>}
                </div>
              ))}
              {instances.length===0&&!waLoading&&<p className="text-slate-500 text-xs text-center py-4">Nenhuma conexão configurada.</p>}
              {instances.length<maxInstances&&(
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <p className="text-sm font-medium text-white">Adicionar conexão</p>
                  <div className="flex gap-2">
                    <input value={newInstanceLabel} onChange={e=>setNewInstanceLabel(e.target.value)} placeholder="Nome (ex: Vendas)" onKeyDown={e=>e.key==='Enter'&&addInstance()}
                      className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    <button onClick={addInstance} disabled={addingInstance} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap">
                      <Plus size={13}/>{addingInstance?'Criando…':'Criar'}
                    </button>
                  </div>
                </div>
              )}
              {instances.length>=maxInstances&&(
                <a href="https://pay.kiwify.com.br/XhAcGsB" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-3 rounded-xl transition-colors">
                  <Plus size={15}/> Adicionar mais conexões
                </a>
              )}
            </div>
          )}

          {/* ── SECTORS TAB ──────────────────────────────────────────────── */}
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
                    <input value={newSectorName} onChange={e=>setNewSectorName(e.target.value)} placeholder="Nome do setor (ex: Financeiro)"
                      onKeyDown={e=>e.key==='Enter'&&createSector()}
                      className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  </div>
                  <input value={newSectorDesc} onChange={e=>setNewSectorDesc(e.target.value)} placeholder="Descrição (opcional)"
                    className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <button onClick={createSector} disabled={creatingSector||!newSectorName.trim()}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                    <Plus size={14}/>{creatingSector?'Criando…':'Criar Setor'}
                  </button>
                </div>
              )}

              {/* Sector list */}
              <div className="space-y-2">
                {sectors.length===0&&<p className="text-slate-500 text-sm text-center py-6">Nenhum setor criado ainda.</p>}
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
                      <button onClick={()=>removeSector(s.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={15}/></button>
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
                    <p className="text-sm font-medium text-white">Novo Operador</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={newOperator.name} onChange={e=>setNewOperator(p=>({...p,name:e.target.value}))} placeholder="Nome completo"
                        className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                      <input value={newOperator.email} onChange={e=>setNewOperator(p=>({...p,email:e.target.value}))} placeholder="E-mail" type="email"
                        className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    </div>
                    <input value={newOperator.password} onChange={e=>setNewOperator(p=>({...p,password:e.target.value}))} placeholder="Senha (mín. 6 caracteres)" type="password"
                      className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    <select value={newOperator.sectorId} onChange={e=>setNewOperator(p=>({...p,sectorId:e.target.value}))}
                      className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500">
                      <option value="">Sem setor</option>
                      {sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button onClick={async()=>{
                      if(!newOperator.name.trim()||!newOperator.email.trim()||newOperator.password.length<6) return;
                      setCreatingOperator(true);
                      try {
                        const r = await fetch('/api/operators',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
                          name:newOperator.name.trim(), email:newOperator.email.trim().toLowerCase(),
                          password:newOperator.password, sectorId:newOperator.sectorId?parseInt(newOperator.sectorId):null
                        })});
                        if(r.ok){ const op=await r.json(); setOperators(p=>[...p,op]); setNewOperator({name:'',email:'',password:'',sectorId:''}); }
                        else { const e=await r.json(); alert(e.error||'Erro ao criar operador'); }
                      } finally { setCreatingOperator(false); }
                    }} disabled={creatingOperator||!newOperator.name.trim()||!newOperator.email.trim()||newOperator.password.length<6}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                      <Plus size={14}/>{creatingOperator?'Criando…':'Criar Operador'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {operators.length===0&&operatorsLoaded&&<p className="text-slate-500 text-sm text-center py-4">Nenhum operador criado ainda.</p>}
                    {operators.map(op=>(
                      <div key={op.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
                          <Users size={16} className="text-blue-400"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{op.name}</p>
                          <p className="text-slate-400 text-xs font-mono">{op.email}</p>
                          {op.sector_id&&sectors.find(s=>s.id===op.sector_id)&&(
                            <span className="text-[10px] text-blue-400 flex items-center gap-0.5 mt-0.5"><Building2 size={9}/>{sectors.find(s=>s.id===op.sector_id)?.name}</span>
                          )}
                        </div>
                        <button onClick={async()=>{
                          await fetch(`/api/operators/${op.id}`,{method:'DELETE'});
                          setOperators(p=>p.filter(o=>o.id!==op.id));
                        }} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={15}/></button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── FOLLOW-UPS TAB ───────────────────────────────────────────── */}
          {tab==='followups' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h2 className="text-white font-semibold">Follow-ups Automáticos</h2>
                <p className="text-slate-400 text-xs">Configure até 5 mensagens automáticas enviadas em sequência após o primeiro contato</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-blue-700/30 flex gap-2">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-slate-300">
                  Os follow-ups são acionados quando um novo contato inicia uma conversa. Os delays são acumulativos: se o passo 1 é em 1h e o passo 2 em 2h, o passo 2 é enviado 3h após o primeiro contato.
                </p>
              </div>
              <div className="space-y-3">
                {followupConfigs.map(c=>(
                  <FollowupStepCard key={c.step_order} step={c.step_order} config={c} onSave={saveFollowupStep}/>
                ))}
              </div>
            </div>
          )}

          {/* ── BROADCAST TAB ────────────────────────────────────────────── */}
          {tab==='broadcast' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center"><Megaphone size={20} className="text-violet-400"/></div>
                <div><h2 className="text-white font-semibold">Disparo em Massa</h2><p className="text-slate-400 text-xs">Via Meta WhatsApp API Oficial</p></div>
              </div>
              {(!settingValues['meta_phone_number_id']||!settingValues['meta_access_token'])&&(
                <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 flex gap-3">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/>
                  <div><p className="text-amber-300 text-sm font-medium">Credenciais não configuradas</p><p className="text-amber-400/80 text-xs mt-0.5">Configure o <strong>Phone Number ID</strong> e o <strong>Token de Acesso</strong> nas Configurações.</p><button onClick={()=>changeTab('settings')} className="mt-2 text-xs text-amber-300 underline">Ir para Configurações →</button></div>
                </div>
              )}
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-white text-sm font-medium">Tipo de Mensagem</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={()=>setBcastMsgType('template')} className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='template'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                    <p className="text-sm font-medium text-white">📋 Template</p><p className="text-xs text-slate-400 mt-0.5">Aprovado pela Meta. Funciona para qualquer contato.</p>
                  </button>
                  <button onClick={()=>setBcastMsgType('free')} className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='free'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                    <p className="text-sm font-medium text-white">💬 Texto Livre</p><p className="text-xs text-slate-400 mt-0.5"><span className="text-amber-400">Apenas para contatos ativos nas últimas 24h.</span></p>
                  </button>
                </div>
              </div>
              {bcastMsgType==='template'?(
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <p className="text-white text-sm font-medium">Template</p>
                  {bcastTemplates.length>0&&<div className="flex flex-wrap gap-1.5">{bcastTemplates.map(t=><button key={t.name} onClick={()=>{setBcastTemplateName(t.name);setBcastTemplateLang(t.language||'pt_BR');}} className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${bcastTemplateName===t.name?'border-violet-500 bg-violet-600/20 text-violet-300':'border-slate-600 text-slate-300 hover:border-slate-400'}`}>{t.name}</button>)}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    <input value={bcastTemplateName} onChange={e=>setBcastTemplateName(e.target.value)} placeholder="Nome do template" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 font-mono"/>
                    <input value={bcastTemplateLang} onChange={e=>setBcastTemplateLang(e.target.value)} placeholder="pt_BR" className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><label className="text-xs text-slate-400">Variáveis</label><button onClick={()=>setBcastTemplateVars(v=>[...v,''])} className="text-xs text-violet-400">+ Adicionar</button></div>
                    {bcastTemplateVars.map((v,i)=>(
                      <div key={i} className="flex gap-2 mb-2">
                        <span className="text-xs text-slate-500 w-12 flex items-center">{`{{${i+1}}}`}</span>
                        <input value={v} onChange={e=>setBcastTemplateVars(p=>p.map((x,j)=>j===i?e.target.value:x))} placeholder={`Valor {{${i+1}}}`} className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                        {bcastTemplateVars.length>1&&<button onClick={()=>setBcastTemplateVars(p=>p.filter((_,j)=>j!==i))} className="text-slate-500 hover:text-red-400"><X size={14}/></button>}
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                  <p className="text-white text-sm font-medium">Mensagem</p>
                  <textarea value={bcastFreeText} onChange={e=>setBcastFreeText(e.target.value)} rows={4} placeholder="Digite a mensagem..." className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-y"/>
                </div>
              )}
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-white text-sm font-medium">Destinatários</p>
                <textarea value={bcastNumbers} onChange={e=>setBcastNumbers(e.target.value)} rows={5} placeholder={'5511999991111\n5521988887777'} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-y font-mono"/>
                <p className="text-xs text-slate-400">{parsedNumbers.length>0?<span className="text-violet-400">{parsedNumbers.length} número(s) válido(s)</span>:'Nenhum número detectado'}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-2">
                <p className="text-white text-sm font-medium">Agendamento <span className="text-slate-500 text-xs font-normal">(opcional)</span></p>
                <input type="datetime-local" value={bcastScheduledAt} onChange={e=>setBcastScheduledAt(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)} className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                {bcastScheduledAt&&<p className="text-xs text-violet-400 flex items-center gap-1"><Clock size={11}/> {new Date(bcastScheduledAt).toLocaleString('pt-BR')}</p>}
              </div>
              <button onClick={sendBroadcast} disabled={bcastSending||parsedNumbers.length===0||(bcastMsgType==='template'&&!bcastTemplateName)||(bcastMsgType==='free'&&!bcastFreeText.trim())}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors">
                {bcastSending?<><RefreshCw size={16} className="animate-spin"/>{bcastScheduledAt?'Agendando…':'Enviando…'}</>:bcastScheduledAt?<><Clock size={16}/> Agendar para {parsedNumbers.length} número(s)</>:<><Megaphone size={16}/> Enviar para {parsedNumbers.length} número(s)</>}
              </button>
              {scheduledBroadcasts.length>0&&(
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-2">
                  <p className="text-white text-sm font-medium">Disparos Agendados</p>
                  {scheduledBroadcasts.map(b=>(
                    <div key={b.id} className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${b.status==='sent'?'bg-emerald-400':b.status==='failed'?'bg-red-400':'bg-amber-400'}`}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 truncate">{b.msg_type==='template'?`Template: ${b.template_name}`:'Texto Livre'} · {Array.isArray(b.numbers)?b.numbers.length:0} números</p>
                        <p className="text-slate-500">{new Date(b.scheduled_at).toLocaleString('pt-BR')} · {b.status==='pending'?'Aguardando':b.status==='sent'?`Enviado (${b.result_count||0})`:b.status==='failed'?'Falhou':''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {bcastResults.length>0&&(
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between"><p className="text-white text-sm font-medium">Resultado</p><div className="flex gap-3 text-xs"><span className="text-emerald-400">✓ {bcastResults.filter(r=>r.ok).length}</span>{bcastResults.filter(r=>!r.ok).length>0&&<span className="text-red-400">✗ {bcastResults.filter(r=>!r.ok).length}</span>}</div></div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {bcastResults.map((r,i)=>(
                      <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${r.ok?'bg-emerald-900/20 border border-emerald-700/30':'bg-red-900/20 border border-red-700/30'}`}>
                        <span className={r.ok?'text-emerald-400':'text-red-400'}>{r.ok?'✓':'✗'}</span>
                        <span className="font-mono text-slate-300">{r.number}</span>
                        {r.error&&<span className="text-red-400 ml-auto truncate">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setBcastResults([])} className="text-xs text-slate-500 hover:text-slate-300">Limpar</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ─────────────────────────────────────────────── */}
          {tab==='settings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              {Object.entries(settingGroups).map(([group, keys]) => {
                const groupSettings = settings.filter(s=>keys.includes(s.key));
                if (!groupSettings.length) return null;
                const isOpen = !!openGroups[group];
                const isLibOpen = !!openGroups['__media_lib'];
                return (
                  <div key={group}>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                      <button onClick={()=>toggleGroup(group)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
                        <span className="text-white text-sm font-semibold">{group}</span>
                        {isOpen?<ChevronUp size={15} className="text-slate-400"/>:<ChevronDown size={15} className="text-slate-400"/>}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
                          {groupSettings.map(s=>(
                            <SettingCard key={s.key} setting={s} value={settingValues[s.key]??''}
                              onChange={v=>setSettingValues(p=>({...p,[s.key]:v}))}
                              onSave={()=>saveSetting(s.key)}
                              saving={savingKey===s.key} saved={savedKey===s.key}/>
                          ))}
                          {group==='Mídias'&&(
                            <div className="border-t border-slate-700/60 pt-3 space-y-2">
                              {mediaUrls.map(item=>(
                                <div key={item.id} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white">{item.name}</p>
                                    <p className="text-[10px] text-slate-500 capitalize">{item.type}</p>
                                  </div>
                                  <button onClick={async()=>{await fetch('/api/media-urls',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id})});setMediaUrls(p=>p.filter(m=>m.id!==item.id));}} className="text-slate-500 hover:text-red-400 shrink-0"><X size={12}/></button>
                                </div>
                              ))}
                              <div className="space-y-2">
                                <input value={newMediaUrl.name} onChange={e=>setNewMediaUrl(p=>({...p,name:e.target.value}))} placeholder="Nome (ex: Catálogo PDF)" className="w-full bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"/>
                                <input value={newMediaUrl.url} onChange={e=>setNewMediaUrl(p=>({...p,url:e.target.value}))} placeholder="URL pública do arquivo" className="w-full bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"/>
                                <div className="flex gap-2">
                                  <select value={newMediaUrl.type} onChange={e=>setNewMediaUrl(p=>({...p,type:e.target.value as MediaUrlItem['type']}))} className="flex-1 bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none">
                                    <option value="document">Documento / PDF</option>
                                    <option value="video">Vídeo</option>
                                    <option value="image">Imagem</option>
                                    <option value="audio">Áudio</option>
                                  </select>
                                  <button disabled={savingMediaUrl||!newMediaUrl.name.trim()||!newMediaUrl.url.trim()} onClick={async()=>{setSavingMediaUrl(true);try{const r=await fetch('/api/media-urls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newMediaUrl)});if(r.ok){const item=await r.json();setMediaUrls(p=>[...p,item]);setNewMediaUrl({name:'',url:'',type:'document',description:''});}}finally{setSavingMediaUrl(false);}}} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors shrink-0 flex items-center gap-1">
                                    <Plus size={12}/>{savingMediaUrl?'…':'+ Adicionar'}
                                  </button>
                                </div>
                              </div>
                              {mediaUrls.length>0&&<p className="text-[10px] text-slate-500 font-mono">{mediaUrls.map(m=>m.name).join(' · ')}</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <button onClick={()=>toggleGroup('__media_lib')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
                  <span className="text-white text-sm font-semibold flex items-center gap-2"><Paperclip size={13} className="text-blue-400"/>Biblioteca de Mídia</span>
                  {openGroups['__media_lib']?<ChevronUp size={15} className="text-slate-400"/>:<ChevronDown size={15} className="text-slate-400"/>}
                </button>
                {openGroups['__media_lib']&&(
                  <div className="px-3 pb-3 border-t border-slate-700/50 pt-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${uploadingMedia?'bg-slate-600 text-slate-400':'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                        <Plus size={12}/>{uploadingMedia?'Enviando…':'Fazer Upload'}
                        <input type="file" className="hidden" onChange={uploadMedia} disabled={uploadingMedia}/>
                      </label>
                      {!isAdminMaster&&(
                        <div className="flex-1 ml-3">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                            <span>{storageUsedMB.toFixed(1)} MB / {STORAGE_LIMIT_MB} MB</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${storagePercent>90?'bg-red-500':storagePercent>70?'bg-amber-500':'bg-violet-500'}`} style={{width:`${storagePercent}%`}}/>
                          </div>
                        </div>
                      )}
                    </div>
                    {mediaItems.length===0&&<p className="text-xs text-slate-500">Nenhum arquivo na biblioteca.</p>}
                    {mediaItems.map(item=>(
                      <div key={item.id} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex items-center gap-2">
                        <span className="text-xs text-white truncate flex-1">{item.name}</span>
                        <span className="text-[10px] text-slate-500 shrink-0 capitalize">{item.type}</span>
                        {item.size_bytes>0&&<span className="text-[10px] text-slate-500 shrink-0">{(item.size_bytes/1024/1024).toFixed(1)}MB</span>}
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0">Ver</a>
                        <button onClick={()=>deleteMediaItem(item.id)} className="text-slate-500 hover:text-red-400 shrink-0"><X size={11}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <button onClick={()=>toggleGroup('__qr')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
                  <span className="text-white text-sm font-semibold">Respostas Rápidas</span>
                  {openGroups['__qr']?<ChevronUp size={15} className="text-slate-400"/>:<ChevronDown size={15} className="text-slate-400"/>}
                </button>
                {openGroups['__qr'] && (
                  <div className="px-3 pb-3 border-t border-slate-700/50 pt-3 space-y-3">
                    {quickReplies.map(q=>(
                      <div key={q.id} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex justify-between gap-2">
                        <div className="min-w-0"><p className="text-xs font-medium text-white truncate">{q.title}</p><p className="text-xs text-slate-400 truncate">{q.content}</p></div>
                        <button onClick={()=>deleteQuickReply(q.id)} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={13}/></button>
                      </div>
                    ))}
                    <div className="space-y-2">
                      <input value={newQrTitle} onChange={e=>setNewQrTitle(e.target.value)} placeholder="Título" className="w-full bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                      <textarea value={newQrContent} onChange={e=>setNewQrContent(e.target.value)} placeholder="Conteúdo da resposta rápida" rows={2} className="w-full bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                      <button onClick={addQuickReply} className="w-full flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium py-2 rounded-lg transition-colors"><Plus size={13}/> Adicionar</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-slate-700 pt-3">
                <button onClick={logout} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors">
                  <LogOut size={15}/> Sair da conta
                </button>
              </div>
            </div>
          )}
          {/* ── ADMIN ──────────────────────────────────────────────────────── */}
          {tab==='admin' && currentUserEmail===ADMIN_EMAIL && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center"><ShieldCheck size={20} className="text-violet-400"/></div>
                  <div><h2 className="text-white font-semibold">Painel Administrativo</h2><p className="text-slate-400 text-xs">Clientes, setores e operadores</p></div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 border border-slate-700">
                  {(['clients','sectors','operators'] as const).map(t=>(
                    <button key={t} onClick={()=>setAdminSubTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${adminSubTab===t?'bg-violet-600 text-white':'text-slate-400 hover:text-white'}`}>
                      {t==='clients'?'Clientes':t==='sectors'?'Setores':'Operadores'}
                    </button>
                  ))}
                </div>

                {/* ── Clientes ── */}
                {adminSubTab==='clients'&&(<>
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
                  <p className="text-white text-sm font-medium flex items-center gap-2"><Plus size={14} className="text-violet-400"/> Criar novo cliente</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={newTenant.email} onChange={e=>setNewTenant(p=>({...p,email:e.target.value}))} placeholder="E-mail" type="email"
                      className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                    <input value={newTenant.name} onChange={e=>setNewTenant(p=>({...p,name:e.target.value}))} placeholder="Nome do cliente"
                      className="bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  </div>
                  <input value={newTenant.password} onChange={e=>setNewTenant(p=>({...p,password:e.target.value}))} placeholder="Senha de acesso (mín. 6 caracteres)" type="password"
                    className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <input value={newTenant.evolutionInstance} onChange={e=>setNewTenant(p=>({...p,evolutionInstance:e.target.value}))} placeholder="Instância Evolution API (ex: cliente123)"
                    className="w-full bg-slate-700 text-sm text-white font-mono rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <button onClick={createAdminTenant} disabled={creatingTenant||!newTenant.email||newTenant.password.length<6}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    {creatingTenant?<><RefreshCw size={14} className="animate-spin"/> Criando…</>:<><Plus size={14}/> Criar Cliente</>}
                  </button>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
                    <p className="text-white text-sm font-medium">Clientes cadastrados</p>
                    <button onClick={()=>{setAdminTenantsLoaded(false);loadAdminTenants();}} className="text-slate-400 hover:text-white"><RefreshCw size={13}/></button>
                  </div>
                  {!adminTenantsLoaded ? (
                    <p className="text-slate-500 text-sm p-5 flex items-center gap-2"><RefreshCw size={13} className="animate-spin"/> Carregando…</p>
                  ) : adminTenants.length===0 ? (
                    <p className="text-slate-500 text-sm p-5">Nenhum cliente ainda.</p>
                  ) : (
                    <div className="divide-y divide-slate-700/50">
                      {adminTenants.map(t=>(
                        <div key={t.id} className="px-5 py-4 flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
                            <Users size={14} className="text-violet-400"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{t.name||'Sem nome'}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${t.status==='active'?'bg-emerald-900/40 text-emerald-400 border-emerald-700/30':t.status==='suspended'?'bg-red-900/40 text-red-400 border-red-700/30':'bg-slate-700 text-slate-400 border-slate-600'}`}>{t.status}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">{t.email}</p>
                            {t.evolution_instance && <p className="text-xs text-slate-500 mt-0.5">Instância: <span className="font-mono">{t.evolution_instance}</span></p>}
                            <p className="text-xs text-slate-600 mt-0.5">Criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <input value={resetTenantPwd[t.id]||''} onChange={e=>setResetTenantPwd(p=>({...p,[t.id]:e.target.value}))} placeholder="Nova senha…" type="password"
                                className="flex-1 bg-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-violet-500"/>
                              <button onClick={()=>resetAdminTenantPassword(t.id)} disabled={resetingTenant===t.id||(resetTenantPwd[t.id]?.length||0)<6}
                                className="text-xs px-2.5 py-1.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1">
                                {resetingTenant===t.id?<RefreshCw size={11} className="animate-spin"/>:<KeyRound size={11}/>} Redefinir
                              </button>
                            </div>
                          </div>
                          <button onClick={()=>deleteAdminTenant(t.id)} disabled={deletingTenant===t.id}
                            className="text-slate-500 hover:text-red-400 disabled:opacity-40 mt-0.5 shrink-0 transition-colors">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </>)}

                {/* ── Setores ── */}
                {adminSubTab==='sectors'&&(
                  <div className="space-y-4">
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex gap-2">
                      <input value={newSectorName} onChange={e=>setNewSectorName(e.target.value)} placeholder="Nome do setor (ex: Vendas)" className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                      <button disabled={creatingSector||!newSectorName.trim()} onClick={async()=>{setCreatingSector(true);try{const r=await fetch('/api/sectors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newSectorName})});if(r.ok){const s=await r.json();setSectors(p=>[...p,s]);setNewSectorName('');}}finally{setCreatingSector(false);}}} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0">
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
                    {!operatorsLoaded?<p className="text-slate-500 text-sm flex items-center gap-2"><RefreshCw size={13} className="animate-spin"/> Carregando…</p>:operators.length===0?<p className="text-slate-500 text-sm">Nenhum operador cadastrado.</p>:operators.map(op=>(
                      <div key={op.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><Users size={13} className="text-slate-400"/></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{op.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{op.email}</p>
                          {op.sector_id && <p className="text-xs text-violet-400 mt-0.5">{sectors.find(s=>s.id===op.sector_id)?.name}</p>}
                        </div>
                        <button onClick={async()=>{await fetch(`/api/operators/${op.id}`,{method:'DELETE'});setOperators(p=>p.filter(x=>x.id!==op.id));}} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={13}/></button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Change Password Modal ──────────────────────────────────────────────── */}
      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2"><KeyRound size={16} className="text-violet-400"/> Alterar Senha</h3>
              <button onClick={()=>{setShowChangePwd(false);setChangePwdMsg(null);setChangePwdForm({current:'',next:'',confirm:''});}} className="text-slate-400 hover:text-white"><X size={16}/></button>
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
