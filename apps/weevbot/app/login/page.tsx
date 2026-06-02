'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (r.ok) {
        router.push('/dashboard');
      } else {
        const d = await r.json();
        setError(d.error || 'Credenciais inválidas');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-violet-600/8 rounded-full blur-3xl"/>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-indigo-600/5 rounded-full blur-3xl"/>
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 drop-shadow-[0_0_20px_rgba(124,58,237,0.5)]">
            <WeevZapLogo size="md"/>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">WeevZap</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1.5">Atendimento inteligente no WhatsApp</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-6 shadow-2xl shadow-black/40">
          <h2 className="text-white font-semibold text-lg mb-5">Entrar na conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">E-mail</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full bg-slate-800 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 outline-none border border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 placeholder-slate-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800 text-white text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none border border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 placeholder-slate-600 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-2.5 transition-colors mt-1 shadow-lg shadow-violet-600/20">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          WeevZap © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
