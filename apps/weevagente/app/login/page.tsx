'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (r.ok) { router.push('/dashboard'); }
      else { const d = await r.json(); setError(d.error || 'Credenciais inválidas'); }
    } catch { setError('Erro de conexão. Tente novamente.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl"/>
      </div>
      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-600/30">
            <Bot size={28} className="text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-white">WEEV<span className="text-violet-400">ZAP</span></h1>
          <p className="text-slate-400 text-sm mt-1">Agente IA para WhatsApp</p>
        </div>
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white font-semibold text-lg mb-5">Entrar na conta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">E-mail</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
                  className="w-full bg-slate-800 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none border border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 placeholder-slate-600"/>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full bg-slate-800 text-white text-sm rounded-lg pl-9 pr-10 py-2.5 outline-none border border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 placeholder-slate-600"/>
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-sm rounded-lg py-2.5 transition-colors mt-1">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">WeevZap © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
