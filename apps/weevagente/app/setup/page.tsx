'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Lock, Eye, EyeOff, Wifi, CheckCircle, Loader } from 'lucide-react';

function SetupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [step, setStep] = useState<'password' | 'whatsapp' | 'done'>('password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return; }
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erro'); return; }
      setQrCode(d.qrCode);
      setStep('whatsapp');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (step !== 'whatsapp' || connected) return;
    const iv = setInterval(async () => {
      const r = await fetch(`/api/setup/status?token=${token}`);
      if (r.ok) { const d = await r.json(); if (d.connected) { setConnected(true); setStep('done'); clearInterval(iv); setTimeout(() => router.push('/login'), 2000); } }
    }, 3000);
    return () => clearInterval(iv);
  }, [step, connected, token, router]);

  if (!token) return <div className="text-center text-slate-400 p-8">Link inválido ou expirado.</div>;

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-600/30">
          <Bot size={28} className="text-white"/>
        </div>
        <h1 className="text-2xl font-bold text-white">WEEV<span className="text-violet-400">ZAP</span></h1>
        <p className="text-slate-400 text-sm mt-1">Configure sua conta</p>
      </div>

      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
        {step === 'password' && (
          <>
            <h2 className="text-white font-semibold text-lg mb-1">Crie sua senha</h2>
            <p className="text-slate-400 text-xs mb-5">Você usará esta senha para acessar o painel.</p>
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Senha</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6}
                    className="w-full bg-slate-800 text-white text-sm rounded-lg pl-9 pr-10 py-2.5 outline-none border border-slate-700 focus:border-violet-500"/>
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Confirmar senha</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" required
                    className="w-full bg-slate-800 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none border border-slate-700 focus:border-violet-500"/>
                </div>
              </div>
              {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-sm rounded-lg py-2.5 transition-colors">
                {loading ? 'Configurando...' : 'Próximo →'}
              </button>
            </form>
          </>
        )}

        {step === 'whatsapp' && (
          <div className="text-center">
            <Wifi size={28} className="text-violet-400 mx-auto mb-3"/>
            <h2 className="text-white font-semibold text-lg mb-1">Conecte seu WhatsApp</h2>
            <p className="text-slate-400 text-xs mb-5">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="mx-auto rounded-xl border border-slate-700 w-52 h-52 object-contain bg-white p-2"/>
            ) : (
              <div className="w-52 h-52 mx-auto bg-slate-800 rounded-xl flex items-center justify-center">
                <Loader size={24} className="text-violet-400 animate-spin"/>
              </div>
            )}
            <p className="text-slate-500 text-xs mt-4 flex items-center justify-center gap-1.5">
              <Loader size={12} className="animate-spin"/> Aguardando conexão...
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <CheckCircle size={40} className="text-violet-400 mx-auto mb-3"/>
            <h2 className="text-white font-semibold text-lg">WhatsApp conectado!</h2>
            <p className="text-slate-400 text-sm mt-1">Redirecionando para o painel...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl"/>
      </div>
      <Suspense fallback={<div className="text-slate-400">Carregando...</div>}>
        <SetupForm/>
      </Suspense>
    </div>
  );
}
