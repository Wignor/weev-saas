'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F0FE 100%)' }}>
      {/* Painel esquerdo — marca */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center bg-primary p-12">
        <div className="text-center text-white">
          <div className="mb-8">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="38" stroke="white" strokeWidth="4" opacity="0.3"/>
              <circle cx="40" cy="40" r="12" fill="white"/>
              <path d="M40 8 L40 20" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M40 60 L40 72" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M8 40 L20 40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M60 40 L72 40" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M16 16 L24 24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M56 56 L64 64" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M64 16 L56 24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M24 56 L16 64" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-3">WeevTrack</h1>
          <p className="text-xl opacity-80 mb-10">Rastreamento Veicular Inteligente</p>
          <div className="space-y-4 text-left">
            {['Monitoramento em tempo real', 'Histórico completo de percursos', 'Alertas de velocidade e cerca', 'Acesso 24/7 de qualquer lugar'].map((feature) => (
              <div key={feature} className="flex items-center gap-3 opacity-90">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3" fill="white"/>
                  <path d="M8 1 L8 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 12 L8 15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M1 8 L4 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 8 L15 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-dark">WeevTrack</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <h2 className="text-2xl font-bold text-dark mb-1">Bem-vindo</h2>
            <p className="text-muted text-sm mb-8">Entre com suas credenciais para acessar</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-danger text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-muted mt-6">
            © {new Date().getFullYear()} WeevTrack. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
