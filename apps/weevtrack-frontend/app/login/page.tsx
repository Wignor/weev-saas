'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Credenciais inválidas'); return; }
      router.push('/dashboard');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: '#12131A' }}>

      {/* Logo */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 relative">
          <div className="absolute w-14 h-14 rounded-full border-2 border-white/30" />
          <div className="absolute w-9 h-9 rounded-full border-2 border-white/50" />
          <div className="w-6 h-6 rounded-full bg-white" />
        </div>
        <h1 className="text-3xl font-bold text-app-text">WeevTrack</h1>
        <p className="text-app-muted text-sm mt-1">Rastreamento Veicular Inteligente</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#1E2030' }}>
        <h2 className="text-xl font-bold text-app-text mb-1">Entrar</h2>
        <p className="text-app-muted text-sm mb-6">Acesse sua conta WeevTrack</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-app-muted mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-app-muted mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all pr-12"
                style={{ background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E' }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-60 text-sm mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-app-muted mt-8">
        © {new Date().getFullYear()} WeevTrack. Todos os direitos reservados.
      </p>
    </div>
  );
}
