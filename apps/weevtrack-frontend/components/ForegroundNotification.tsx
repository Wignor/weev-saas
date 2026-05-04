'use client';

import { useEffect, useState } from 'react';

type Toast = { id: number; title: string; body: string; url: string };

export default function ForegroundNotification() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'PUSH_NOTIFICATION') return;
      const { title, body, url } = event.data as { type: string; title: string; body: string; url: string };
      const toast: Toast = { id: Date.now(), title, body, url: url || '/dashboard' };
      setToasts(prev => [toast, ...prev].slice(0, 4));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 7000);
    }

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
      width: 'calc(100% - 32px)', maxWidth: '420px', pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => { window.location.href = toast.url; }}
          className="wt-toast"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            borderRadius: '16px',
            padding: '12px 14px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: 'pointer', pointerEvents: 'auto',
            animation: 'wt-slide-down 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'rgba(0,122,255,0.15)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
          }}>
            🔔
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-hi)', margin: 0, lineHeight: 1.3 }}>
              {toast.title}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-lo)', margin: '2px 0 0', lineHeight: 1.3 }}>
              {toast.body}
            </p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', opacity: 0.5, flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-lo)" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
