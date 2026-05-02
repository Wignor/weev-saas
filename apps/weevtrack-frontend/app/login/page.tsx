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
      if (data.administrator) {
        router.push('/gestao');
      } else if (data.role === 'distribuidor' || data.role === 'distribuidor_geral') {
        router.push('/distribuidor');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0A0E1E 0%, #0D1B3E 40%, #0A1628 70%, #050810 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Orbs animados */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,122,255,0.12) 0%, transparent 70%)',
        top: '-150px', left: '-100px', animation: 'orbFloat1 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,122,255,0.08) 0%, transparent 70%)',
        bottom: '-100px', right: '-50px', animation: 'orbFloat2 15s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(52,199,89,0.06) 0%, transparent 70%)',
        top: '40%', right: '20%', animation: 'orbFloat3 18s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, -30px) scale(1.08); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -40px); }
        }
      `}</style>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem', width: '100%' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="36" height="46" viewBox="0 0 14 18" fill="none">
              <path d="M7 1C4.24 1 2 3.24 2 6C2 9.75 7 17.5 7 17.5C7 17.5 12 9.75 12 6C12 3.24 9.76 1 7 1Z" fill="white"/>
              <circle cx="7" cy="6" r="2" fill="#007AFF"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#F0F0F5', margin: 0 }}>WeevTrack</h1>
          <p style={{ color: 'white', fontSize: '0.875rem', marginTop: 4, fontWeight: 700 }}>Rastreamento Veicular Inteligente</p>
        </div>

        {/* Card */}
        <div style={{ width: '100%', maxWidth: 384, borderRadius: 16, padding: '1.5rem', background: '#1E2030' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F0F0F5', margin: '0 0 4px' }}>Entrar</h2>
          <p style={{ color: '#8E8EA0', fontSize: '0.875rem', marginTop: 0, marginBottom: '1.5rem' }}>Acesse sua conta WeevTrack</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#8E8EA0', marginBottom: 6 }}>CPF ou CNPJ</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="000.000.000-00"
                required
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 12, fontSize: '0.875rem', outline: 'none', background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#8E8EA0', marginBottom: 6 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '0.75rem 3rem 0.75rem 1rem', borderRadius: 12, fontSize: '0.875rem', outline: 'none', background: '#12131A', color: '#F0F0F5', border: '1px solid #2A2D3E', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8E8EA0', fontSize: '1rem', padding: 0 }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.875rem', background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#007AFF', color: 'white', fontWeight: 600, padding: '0.875rem', borderRadius: 12, border: 'none', fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: 8 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#8E8EA0', marginTop: '2rem' }}>
          © {new Date().getFullYear()} WeevTrack. Todos os direitos reservados.
        </p>

      </div>
    </div>
  );
}
