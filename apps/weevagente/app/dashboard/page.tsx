'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bot, Settings, MessageSquare, Send, Zap,
  Phone, Clock, Plus, Trash2, CheckCircle, Save, RefreshCw,
  PauseCircle, PlayCircle, X, Menu, ChevronLeft,
  Wifi, WifiOff, LogOut, Megaphone, Info, AlertTriangle,
  ChevronDown, ChevronUp, Mic, Square, Music,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  push_name: string | null;
  status: 'active' | 'paused' | 'waiting';
  last_message: string | null;
  last_message_at: string | null;
}
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'human';
  content: string;
  created_at: string;
}
interface Setting { key: string; value: string; label: string; description: string; }
interface QuickReply { id: number; title: string; content: string; }
interface TenantInstance { id: string; instance_name: string; label: string | null; connected: boolean; qrCode: string | null; }

type Tab = 'inbox' | 'whatsapp' | 'settings' | 'broadcast';

interface MetaTemplate { name: string; status: string; category: string; language: string; }
interface BroadcastResult { number: string; ok: boolean; error?: string; }

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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string|null }) {
  if (status==='active')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/70 text-violet-400 border border-violet-700/50">IA Ativa</span>;
  if (status==='paused')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/70 text-amber-400 border border-amber-700/50">Atendente</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">Aguardando</span>;
}

// ─── Message bubble ───────────────────────────────────────────────────────────
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
        <div className={`${bubble} text-white text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap break-words`}>
          {msg.content}
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5 text-right">{time}</p>
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

// ─── Setting card ─────────────────────────────────────────────────────────────
function SettingCard({ setting, value, onChange, onSave, saving, saved }: {
  setting: Setting; value: string; onChange:(v:string)=>void;
  onSave:()=>void; saving:boolean; saved:boolean;
}) {
  const [show,setShow] = useState(false);
  const isLong       = setting.key==='system_prompt'||setting.key==='welcome_message';
  const isSecret     = setting.key==='openai_api_key';
  const isNumberList = setting.key==='allowed_numbers'||setting.key==='blocked_numbers';
  const selectOptions: Record<string,{value:string;label:string}[]> = {
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
          className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${saved?'bg-violet-600 text-white':'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}>
          {saved ? <><CheckCircle size={12}/> Salvo</> : saving ? 'Salvando…' : <><Save size={12}/> Salvar</>}
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
  const [tab, setTab] = useState<Tab>('inbox');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [selected, setSelected] = useState<string|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation|null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [settingValues, setSettingValues] = useState<Record<string,string>>({});
  const [savingKey, setSavingKey] = useState<string|null>(null);
  const [savedKey, setSavedKey] = useState<string|null>(null);
  const [newQrTitle, setNewQrTitle] = useState('');
  const [newQrContent, setNewQrContent] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [maxInstances, setMaxInstances] = useState(1);
  const [waLoading, setWaLoading] = useState(false);
  const [addingInstance, setAddingInstance] = useState(false);
  const [newInstanceLabel, setNewInstanceLabel] = useState('');
  const [showQrPicker, setShowQrPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource|null>(null);

  // ── Audio recording state ─────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Broadcast state ───────────────────────────────────────────────────────
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

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch('/api/conversations');
      if (r.ok) setConversations(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadConversations();
    fetch('/api/quick-replies').then(r=>r.json()).then(setQuickReplies).catch(()=>{});
    fetch('/api/settings').then(r=>r.json()).then((s:Setting[]) => {
      setSettings(s);
      setSettingValues(Object.fromEntries(s.map(x=>[x.key,x.value])));
    }).catch(()=>{});
  }, [loadConversations]);

  // ── SSE ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;
      es.onmessage = (e) => {
        try {
          const { type, data } = JSON.parse(e.data);
          if (type==='conversations') setConversations(data);
        } catch {}
      };
      es.onerror = () => { es.close(); setTimeout(connect, 5000); };
    };
    connect();
    return () => eventSourceRef.current?.close();
  }, []);

  // ── Load messages ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    fetch(`/api/conversations/${selected}`)
      .then(r=>r.json())
      .then(d => { setMessages(d.messages||[]); setSelectedConv(d.conversation||null); })
      .catch(()=>{});
  }, [selected]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  // ── Instances ─────────────────────────────────────────────────────────────
  const loadInstances = async () => {
    setWaLoading(true);
    try {
      const r = await fetch('/api/instances');
      if (r.ok) {
        const d = await r.json();
        setInstances(d.instances || []);
        setMaxInstances(d.maxInstances || 1);
      }
    } catch {}
    setWaLoading(false);
  };
  useEffect(() => {
    if (tab !== 'whatsapp') return;
    loadInstances();
    const iv = setInterval(() => {
      setInstances(prev => {
        if (prev.length > 0 && prev.every(i => i.connected)) { clearInterval(iv); return prev; }
        return prev;
      });
      loadInstances();
    }, 5000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const addInstance = async () => {
    setAddingInstance(true);
    try {
      const r = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newInstanceLabel.trim() || undefined }),
      });
      if (r.ok) { setNewInstanceLabel(''); await loadInstances(); }
      else {
        const d = await r.json();
        if (d.error === 'limit_reached') alert('Limite de conexões atingido. Adquira mais conexões.');
      }
    } catch {}
    setAddingInstance(false);
  };

  // ── Send reply ────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/reply', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ number: selected, text: replyText.trim() }),
      });
      if (r.ok) {
        setReplyText('');
        setTimeout(() => {
          fetch(`/api/conversations/${selected}`)
            .then(r=>r.json())
            .then(d=>{ setMessages(d.messages||[]); setSelectedConv(d.conversation||null); })
            .catch(()=>{});
        }, 600);
      }
    } catch {}
    setSending(false);
  };

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const togglePause = async () => {
    if (!selected || !selectedConv) return;
    const action = selectedConv.status==='paused' ? 'resume' : 'pause';
    await fetch(`/api/conversations/${selected}/pause`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action }),
    });
    fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>setSelectedConv(d.conversation||null)).catch(()=>{});
    await loadConversations();
  };

  // ── Save setting ──────────────────────────────────────────────────────────
  const saveSetting = async (key: string) => {
    setSavingKey(key);
    await fetch('/api/settings', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ key, value: settingValues[key] }),
    });
    setSavingKey(null); setSavedKey(key);
    setTimeout(()=>setSavedKey(null), 2000);
  };

  // ── Quick replies ─────────────────────────────────────────────────────────
  const addQuickReply = async () => {
    if (!newQrTitle.trim()||!newQrContent.trim()) return;
    const r = await fetch('/api/quick-replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:newQrTitle,content:newQrContent})});
    if (r.ok) {
      const qr = await r.json();
      setQuickReplies(prev=>[...prev,qr]);
      setNewQrTitle(''); setNewQrContent('');
    }
  };
  const deleteQuickReply = async (id:number) => {
    await fetch(`/api/quick-replies/${id}`,{method:'DELETE'});
    setQuickReplies(prev=>prev.filter(q=>q.id!==id));
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    await fetch('/api/auth/logout',{method:'POST'});
    router.push('/login');
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Apagar ${selectedIds.size} conversa(s) e todo o histórico?`)) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => fetch(`/api/conversations/${id}`, { method: 'DELETE' })));
    setConversations(prev => prev.filter(c => !selectedIds.has(c.id)));
    if (selected && selectedIds.has(selected)) { setSelected(null); setMessages([]); setSelectedConv(null); }
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const convName = (c: Conversation) => c.push_name || c.id;

  // ── Audio recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setIsRecording(false);
        if (recTimerRef.current) clearInterval(recTimerRef.current);
      };
      mr.start();
      mediaRecRef.current = mr;
      setIsRecording(true);
      setRecSecs(0);
      recTimerRef.current = setInterval(() => setRecSecs(s => {
        if (s >= 119) { mr.stop(); return s; }
        return s + 1;
      }), 1000);
    } catch { alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.'); }
  };

  const stopRecording = () => { mediaRecRef.current?.stop(); };

  const cancelRecording = () => {
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setIsRecording(false);
    setAudioBlob(null);
    setRecSecs(0);
    chunksRef.current = [];
  };

  const sendRecordedAudio = async () => {
    if (!audioBlob || !selected || sendingAudio) return;
    setSendingAudio(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const r = await fetch('/api/send-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: selected, audioBase64: base64 }),
        });
        if (r.ok) {
          setAudioBlob(null);
          setRecSecs(0);
          setTimeout(() => {
            fetch(`/api/conversations/${selected}`).then(r=>r.json()).then(d=>{ setMessages(d.messages||[]); setSelectedConv(d.conversation||null); }).catch(()=>{});
          }, 800);
        } else {
          alert('Falha ao enviar áudio.');
        }
        setSendingAudio(false);
      };
      reader.readAsDataURL(audioBlob);
    } catch { setSendingAudio(false); alert('Erro ao enviar áudio.'); }
  };

  const fmtSecs = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // ── Broadcast ─────────────────────────────────────────────────────────────
  const loadBcastTemplates = async () => {
    if (bcastTemplatesLoaded) return;
    const r = await fetch('/api/meta-templates').catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setBcastTemplates(d.templates || []);
    }
    setBcastTemplatesLoaded(true);
  };

  useEffect(() => { if (tab === 'broadcast') loadBcastTemplates(); }, [tab]);

  const parsedNumbers = bcastNumbers.split('\n').map(n => n.replace(/\D/g,'').trim()).filter(Boolean);

  const sendBroadcast = async () => {
    if (!parsedNumbers.length) return;
    if (!window.confirm(`Enviar para ${parsedNumbers.length} número(s)?`)) return;
    setBcastSending(true);
    setBcastResults([]);
    try {
      const r = await fetch('/api/meta-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgType: bcastMsgType,
          freeText: bcastFreeText,
          templateName: bcastTemplateName,
          templateLang: bcastTemplateLang,
          templateVars: bcastTemplateVars,
          numbers: parsedNumbers,
        }),
      });
      const data = await r.json();
      if (data.error) { alert(data.error); return; }
      setBcastResults(data.results || []);
    } catch { alert('Erro ao conectar com a API.'); }
    finally { setBcastSending(false); }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`flex flex-col border-r border-slate-700/60 transition-all duration-200 ${sidebarOpen?'w-72':'w-0'} shrink-0 overflow-hidden`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-700/60">
          <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center"><Zap size={16}/></div>
          <span className="font-bold text-white">WeevAgente</span>
          <button onClick={logout} className="ml-auto text-slate-400 hover:text-white" title="Sair">
            <LogOut size={16}/>
          </button>
        </div>
        {/* Nav tabs */}
        <div className="flex border-b border-slate-700/60">
          {([['inbox','Inbox',MessageSquare],['whatsapp','WhatsApp',Phone],['broadcast','Disparo',Megaphone],['settings','Config',Settings]] as const).map(([t,label,Icon])=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${tab===t?'text-violet-400 border-b-2 border-violet-500':'text-slate-400 hover:text-slate-200'}`}>
              <Icon size={15}/>{label}
            </button>
          ))}
        </div>

        {/* ── Inbox list ───────────────────────────────────────────────── */}
        {tab==='inbox' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar de seleção */}
            <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between shrink-0">
              {selectMode ? (
                <>
                  <button onClick={()=>setSelectedIds(new Set(conversations.map(c=>c.id)))}
                    className="text-xs text-slate-400 hover:text-white">Todos</button>
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <button onClick={deleteSelected}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">
                        <Trash2 size={11}/> Apagar ({selectedIds.size})
                      </button>
                    )}
                    <button onClick={()=>{ setSelectMode(false); setSelectedIds(new Set()); }}
                      className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                  </div>
                </>
              ) : (
                <button onClick={()=>setSelectMode(true)}
                  className="text-xs text-slate-500 hover:text-white ml-auto">Selecionar</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length===0 && (
                <p className="text-slate-500 text-xs text-center mt-8 px-4">Nenhuma conversa ainda.<br/>Conecte seu WhatsApp e aguarde mensagens.</p>
              )}
              {conversations.map(c=>(
                <div key={c.id}
                  onClick={()=> selectMode ? toggleSelect(c.id) : setSelected(c.id)}
                  className={`flex items-center gap-2.5 px-3 py-3 border-b border-slate-700/40 transition-colors cursor-pointer ${
                    selectedIds.has(c.id) ? 'bg-violet-900/30' : selected===c.id&&!selectMode ? 'bg-slate-700' : 'hover:bg-slate-800'
                  }`}>
                  {selectMode && (
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedIds.has(c.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-500'
                    }`}>
                      {selectedIds.has(c.id) && <CheckCircle size={10} className="text-white"/>}
                    </div>
                  )}
                  <Avatar name={convName(c)}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-white truncate">{convName(c)}</p>
                      <StatusBadge status={c.status}/>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{c.last_message||'...'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WhatsApp ─────────────────────────────────────────────────── */}
        {tab==='whatsapp' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Conexões WhatsApp</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{instances.length}/{maxInstances}</span>
                <button onClick={loadInstances} disabled={waLoading} className="text-slate-400 hover:text-white disabled:opacity-50">
                  <RefreshCw size={14} className={waLoading?'animate-spin':''}/>
                </button>
              </div>
            </div>

            {/* Instance cards */}
            {instances.map(inst=>(
              <div key={inst.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{inst.label || inst.instance_name}</p>
                  <div className="flex items-center gap-1.5">
                    {inst.connected
                      ? <><Wifi size={14} className="text-green-400"/><span className="text-xs text-green-400 font-medium">Conectado</span></>
                      : <><WifiOff size={14} className="text-red-400"/><span className="text-xs text-red-400 font-medium">Desconectado</span></>
                    }
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">{inst.instance_name}</p>
                {!inst.connected && inst.qrCode && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Escaneie o QR Code com o WhatsApp:</p>
                    <img src={inst.qrCode} alt="QR Code" className="w-full rounded-lg border border-slate-600"/>
                  </div>
                )}
                {!inst.connected && !inst.qrCode && (
                  <p className="text-xs text-slate-500">Aguardando QR code... Clique em atualizar.</p>
                )}
              </div>
            ))}

            {instances.length === 0 && !waLoading && (
              <p className="text-slate-500 text-xs text-center py-4">Nenhuma conexão configurada ainda.</p>
            )}

            {/* Add instance (if under limit) */}
            {instances.length < maxInstances && (
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-sm font-medium text-white">Adicionar nova conexão</p>
                <div className="flex gap-2">
                  <input value={newInstanceLabel} onChange={e=>setNewInstanceLabel(e.target.value)}
                    placeholder="Nome (ex: Vendas, Suporte)"
                    onKeyDown={e=>e.key==='Enter'&&addInstance()}
                    className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                  <button onClick={addInstance} disabled={addingInstance}
                    className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                    <Plus size={13}/> {addingInstance?'Criando…':'Criar'}
                  </button>
                </div>
              </div>
            )}

            {/* Upsell button (if at limit) */}
            {instances.length >= maxInstances && (
              <a href="https://pay.kiwify.com.br/XhAcGsB" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-3 rounded-xl transition-colors">
                <Plus size={15}/> Adicionar mais conexões
              </a>
            )}
          </div>
        )}

        {/* ── Settings ─────────────────────────────────────────────────── */}
        {tab==='settings' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {settings.map(s=>(
              <SettingCard key={s.key} setting={s} value={settingValues[s.key]??''}
                onChange={v=>setSettingValues(prev=>({...prev,[s.key]:v}))}
                onSave={()=>saveSetting(s.key)}
                saving={savingKey===s.key} saved={savedKey===s.key}/>
            ))}
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs font-medium text-slate-300 mb-2">Respostas Rápidas</p>
              <div className="space-y-2 mb-3">
                {quickReplies.map(q=>(
                  <div key={q.id} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{q.title}</p>
                      <p className="text-xs text-slate-400 truncate">{q.content}</p>
                    </div>
                    <button onClick={()=>deleteQuickReply(q.id)} className="text-slate-500 hover:text-red-400 shrink-0"><Trash2 size={13}/></button>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <input value={newQrTitle} onChange={e=>setNewQrTitle(e.target.value)} placeholder="Título (ex: Preço)"
                  className="w-full bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                <textarea value={newQrContent} onChange={e=>setNewQrContent(e.target.value)} placeholder="Texto da resposta rápida" rows={2}
                  className="w-full bg-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 resize-none"/>
                <button onClick={addQuickReply}
                  className="w-full flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium py-2 rounded-lg transition-colors">
                  <Plus size={13}/> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* ── BROADCAST PANEL ────────────────────────────────────────────── */}
        {tab === 'broadcast' ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center">
                <Megaphone size={20} className="text-violet-400"/>
              </div>
              <div>
                <h2 className="text-white font-semibold">Disparo em Massa</h2>
                <p className="text-slate-400 text-xs">Via Meta WhatsApp API Oficial</p>
              </div>
            </div>

            {/* Credentials check */}
            {(!settingValues['meta_phone_number_id'] || !settingValues['meta_access_token']) && (
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-amber-300 text-sm font-medium">Credenciais não configuradas</p>
                  <p className="text-amber-400/80 text-xs mt-0.5">
                    Configure o <strong>Phone Number ID</strong> e o <strong>Token de Acesso</strong> nas Configurações antes de enviar.
                  </p>
                  <button onClick={()=>setTab('settings')} className="mt-2 text-xs text-amber-300 underline hover:text-amber-200">
                    Ir para Configurações →
                  </button>
                </div>
              </div>
            )}

            {/* Step 1 — Message type */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                <p className="text-white text-sm font-medium">Tipo de Mensagem</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={()=>setBcastMsgType('template')}
                  className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='template'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                  <p className="text-sm font-medium text-white">📋 Template Aprovado</p>
                  <p className="text-xs text-slate-400 mt-0.5">Envia templates criados e aprovados pela Meta. Funciona para qualquer contato, mesmo sem conversa ativa.</p>
                </button>
                <button onClick={()=>setBcastMsgType('free')}
                  className={`p-3 rounded-xl border text-left transition-colors ${bcastMsgType==='free'?'border-violet-500 bg-violet-600/10':'border-slate-600 hover:border-slate-500'}`}>
                  <p className="text-sm font-medium text-white">💬 Texto Livre</p>
                  <p className="text-xs text-slate-400 mt-0.5">Mensagem de texto normal. <span className="text-amber-400 font-medium">Válida somente se o contato enviou uma mensagem nas últimas 24h.</span></p>
                </button>
              </div>
            </div>

            {/* Step 2 — Message content */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <p className="text-white text-sm font-medium">{bcastMsgType==='template' ? 'Template' : 'Mensagem'}</p>
              </div>

              {bcastMsgType === 'template' ? (
                <div className="space-y-3">
                  <div className="bg-slate-700/50 rounded-lg p-3 flex gap-2">
                    <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-slate-300">
                      O <strong>nome do template</strong> é o identificador técnico, não o nome de exibição. Exemplo: <code className="bg-slate-600 px-1 rounded">boas_vindas_cliente</code>. Crie e aprove templates em: <strong>Meta Business Manager → WhatsApp → Modelos de Mensagem</strong>.
                    </p>
                  </div>

                  {bcastTemplates.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Templates aprovados (clique para usar)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {bcastTemplates.map(t => (
                          <button key={t.name} onClick={()=>{ setBcastTemplateName(t.name); setBcastTemplateLang(t.language||'pt_BR'); }}
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
                      <input value={bcastTemplateName} onChange={e=>setBcastTemplateName(e.target.value)}
                        placeholder="ex: lembrete_agendamento"
                        className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500 font-mono"/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Código do idioma</label>
                      <input value={bcastTemplateLang} onChange={e=>setBcastTemplateLang(e.target.value)}
                        placeholder="pt_BR"
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
                      <p className="text-xs text-slate-400">
                        Se seu template usa <code className="bg-slate-600 px-1 rounded">{'{{1}}'}</code>, <code className="bg-slate-600 px-1 rounded">{'{{2}}'}</code> etc., preencha os valores abaixo na mesma ordem. Todos os destinatários receberão os mesmos valores.
                      </p>
                    </div>
                    {bcastTemplateVars.map((v, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <span className="text-xs text-slate-500 w-16 flex items-center shrink-0">{`{{${i+1}}}`}</span>
                        <input value={v} onChange={e=>setBcastTemplateVars(prev=>prev.map((x,j)=>j===i?e.target.value:x))}
                          placeholder={`Valor para {{${i+1}}}`}
                          className="flex-1 bg-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-500"/>
                        {bcastTemplateVars.length > 1 && (
                          <button onClick={()=>setBcastTemplateVars(prev=>prev.filter((_,j)=>j!==i))}
                            className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3 flex gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5"/>
                    <p className="text-xs text-amber-300">
                      Mensagens de texto livre só podem ser enviadas para contatos que interagiram com seu número nas <strong>últimas 24 horas</strong>. Enviar para contatos fora dessa janela viola as políticas da Meta e pode resultar em suspensão do número.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Mensagem *</label>
                    <textarea value={bcastFreeText} onChange={e=>setBcastFreeText(e.target.value)}
                      placeholder="Digite a mensagem que será enviada para todos os destinatários..."
                      rows={4}
                      className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-y"/>
                    <p className="text-xs text-slate-500 mt-1">{bcastFreeText.length} caracteres</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 — Recipients */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                <p className="text-white text-sm font-medium">Destinatários</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 flex gap-2">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-slate-300">
                  Cole os números um por linha. Use o formato completo com DDI + DDD + número, sem espaços ou traços.<br/>
                  <strong>Exemplo:</strong> <code className="bg-slate-600 px-1 rounded">5519999991111</code> (Brasil 55 + DDD 19 + número)
                </p>
              </div>
              <textarea value={bcastNumbers} onChange={e=>setBcastNumbers(e.target.value)}
                placeholder={'5511999991111\n5521988887777\n5519912345678'}
                rows={6}
                className="w-full bg-slate-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-y font-mono"/>
              <p className="text-xs text-slate-400">
                {parsedNumbers.length > 0
                  ? <span className="text-violet-400 font-medium">{parsedNumbers.length} número(s) válido(s) detectado(s)</span>
                  : 'Nenhum número detectado ainda'}
              </p>
            </div>

            {/* Send button */}
            <button
              onClick={sendBroadcast}
              disabled={bcastSending || parsedNumbers.length === 0 || (bcastMsgType==='template' && !bcastTemplateName) || (bcastMsgType==='free' && !bcastFreeText.trim())}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
              {bcastSending
                ? <><RefreshCw size={16} className="animate-spin"/> Enviando…</>
                : <><Megaphone size={16}/> Enviar para {parsedNumbers.length} número(s)</>}
            </button>

            {/* Results */}
            {bcastResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">Resultado do Envio</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400">✓ {bcastResults.filter(r=>r.ok).length} enviados</span>
                    {bcastResults.filter(r=>!r.ok).length > 0 && (
                      <span className="text-red-400">✗ {bcastResults.filter(r=>!r.ok).length} falhas</span>
                    )}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {bcastResults.map((r, i) => (
                    <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs ${r.ok?'bg-emerald-900/20 border border-emerald-700/30':'bg-red-900/20 border border-red-700/30'}`}>
                      <span className={r.ok?'text-emerald-400':'text-red-400'}>{r.ok?'✓':'✗'}</span>
                      <span className="font-mono text-slate-300">{r.number}</span>
                      {r.error && <span className="text-red-400 ml-auto truncate max-w-[50%]">{r.error}</span>}
                      {r.ok && <span className="text-emerald-400 ml-auto">Enviado</span>}
                    </div>
                  ))}
                </div>
                <button onClick={()=>setBcastResults([])} className="text-xs text-slate-500 hover:text-slate-300">Limpar resultados</button>
              </div>
            )}
          </div>

        ) : (
          <>
            {/* Top bar */}
            <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 shrink-0">
              <button onClick={()=>setSidebarOpen(v=>!v)} className="text-slate-400 hover:text-white" title={sidebarOpen?'Minimizar':'Expandir'}>
                {sidebarOpen ? <ChevronLeft size={20}/> : <Menu size={20}/>}
              </button>
              {selected && selectedConv ? (
                <>
                  <button onClick={()=>setSelected(null)} className="text-slate-400 hover:text-white lg:hidden"><ChevronLeft size={20}/></button>
                  <Avatar name={convName(selectedConv)} size="md"/>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{convName(selectedConv)}</p>
                    <div className="flex items-center gap-1.5"><Clock size={11} className="text-slate-500"/><StatusBadge status={selectedConv.status}/></div>
                  </div>
                  <button onClick={togglePause}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${selectedConv.status==='paused'?'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30':'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'}`}>
                    {selectedConv.status==='paused'
                      ? <><PlayCircle size={14}/> Retomar IA</>
                      : <><PauseCircle size={14}/> Assumir</>}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center"><Zap size={14}/></div>
                  <span className="font-semibold text-sm">WeevAgente</span>
                </div>
              )}
            </header>

            {/* Messages / Empty state */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!selected ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare size={28} className="text-violet-400"/>
                  </div>
                  <p className="text-slate-300 font-medium mb-1">Selecione uma conversa</p>
                  <p className="text-slate-500 text-sm">Escolha uma conversa no painel à esquerda para visualizar as mensagens.</p>
                  {conversations.length===0 && (
                    <button onClick={()=>setTab('whatsapp')}
                      className="mt-4 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                      <Phone size={15}/> Conectar WhatsApp
                    </button>
                  )}
                </div>
              ) : (
                messages.map(m=><MsgBubble key={m.id} msg={m}/>)
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Reply box */}
            {selected && (
              <div className="border-t border-slate-700/60 p-3 shrink-0">
                {/* Quick replies picker */}
                {showQrPicker && quickReplies.length>0 && !isRecording && !audioBlob && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {quickReplies.map(q=>(
                      <button key={q.id} onClick={()=>{ setReplyText(q.content); setShowQrPicker(false); }}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                        {q.title}
                      </button>
                    ))}
                    <button onClick={()=>setShowQrPicker(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  {/* Quick replies button */}
                  {quickReplies.length>0 && !isRecording && !audioBlob && (
                    <button onClick={()=>setShowQrPicker(v=>!v)}
                      className="w-9 h-9 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 shrink-0 transition-colors">
                      <Zap size={16}/>
                    </button>
                  )}

                  {/* Recording indicator */}
                  {isRecording ? (
                    <div className="flex-1 flex items-center gap-2.5 bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2.5 min-h-[40px]">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"/>
                      <span className="text-sm font-mono text-red-400">{fmtSecs(recSecs)}</span>
                      <span className="text-xs text-slate-400 flex-1">Gravando… (máx 2min)</span>
                      <button onClick={cancelRecording} className="text-slate-500 hover:text-red-400 ml-auto"><X size={14}/></button>
                    </div>
                  ) : audioBlob ? (
                    /* Audio preview */
                    <div className="flex-1 flex items-center gap-2.5 bg-violet-900/20 border border-violet-700/40 rounded-xl px-3 py-2.5 min-h-[40px]">
                      <Music size={16} className="text-violet-400 shrink-0"/>
                      <span className="text-sm text-slate-300 flex-1">Áudio gravado · {fmtSecs(recSecs)}</span>
                      <button onClick={()=>{ setAudioBlob(null); setRecSecs(0); }} className="text-slate-500 hover:text-red-400"><X size={14}/></button>
                    </div>
                  ) : (
                    /* Normal textarea */
                    <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Digite uma mensagem como atendente..."
                      rows={1} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReply();} }}
                      className="flex-1 bg-slate-700 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 resize-none min-h-[40px] max-h-[120px]"/>
                  )}

                  {/* Mic / Stop / Send audio button */}
                  {!audioBlob && (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                      title={isRecording ? 'Parar gravação' : 'Gravar áudio'}>
                      {isRecording ? <Square size={14}/> : <Mic size={16}/>}
                    </button>
                  )}

                  {/* Send text / Send audio button */}
                  {audioBlob ? (
                    <button onClick={sendRecordedAudio} disabled={sendingAudio}
                      className="w-10 h-10 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl shrink-0 transition-colors"
                      title="Enviar áudio">
                      {sendingAudio ? <RefreshCw size={15} className="animate-spin"/> : <Send size={16}/>}
                    </button>
                  ) : !isRecording ? (
                    <button onClick={sendReply} disabled={sending||!replyText.trim()}
                      className="w-10 h-10 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shrink-0 transition-colors">
                      <Send size={16}/>
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
