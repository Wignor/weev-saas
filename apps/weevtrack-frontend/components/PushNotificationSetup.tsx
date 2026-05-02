'use client';

import { useState, useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export default function PushNotificationSetup() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported'>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'granted') setStatus('subscribed');
    else if (Notification.permission === 'denied') setStatus('denied');
  }, []);

  async function subscribe() {
    setStatus('loading');
    try {
      const { key } = await fetch('/api/push/vapid-public').then((r) => r.json());
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus('subscribed');
    } catch {
      setStatus('idle');
    }
  }

  if (status === 'subscribed' || status === 'unsupported') return null;

  return (
    <div className="mx-4 mt-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-dark">Ativar notificações</p>
          <p className="text-xs text-muted truncate">Alertas quando o veículo ligar ou desligar</p>
        </div>
      </div>
      {status === 'denied' ? (
        <span className="text-xs text-danger flex-shrink-0">Bloqueado</span>
      ) : (
        <button
          onClick={subscribe}
          disabled={status === 'loading'}
          className="bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-60"
        >
          {status === 'loading' ? 'Ativando...' : 'Ativar'}
        </button>
      )}
    </div>
  );
}
