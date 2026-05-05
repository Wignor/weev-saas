'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const stopCamera = useCallback(() => {
    activeRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorMsg('Câmera não disponível neste dispositivo.');
        return;
      }
      if (!('BarcodeDetector' in window)) {
        setStatus('error');
        setErrorMsg('Leitor de código de barras não suportado. Use Chrome ou Edge.');
        return;
      }

      let detector: { detect: (img: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BD = (window as any).BarcodeDetector;
        const supported: string[] = await BD.getSupportedFormats();
        const wanted = ['code_128', 'ean_13', 'ean_8', 'qr_code', 'data_matrix', 'upc_a'];
        const formats = wanted.filter((f: string) => supported.includes(f));
        detector = new BD({ formats: formats.length ? formats : supported });
      } catch {
        setStatus('error');
        setErrorMsg('Erro ao inicializar o leitor de código de barras.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('scanning');

        async function scan() {
          if (!activeRef.current || !videoRef.current) return;
          if (videoRef.current.readyState >= 2) {
            try {
              const results = await detector.detect(videoRef.current);
              for (const r of results) {
                const digits = r.rawValue.replace(/\D/g, '');
                if (digits.length >= 14 && digits.length <= 17) {
                  stopCamera();
                  onScan(digits.slice(0, 15));
                  return;
                }
              }
            } catch { /* ignore detection errors */ }
          }
          if (activeRef.current) requestAnimationFrame(scan);
        }
        requestAnimationFrame(scan);
      } catch {
        setStatus('error');
        setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      }
    }

    init();
    return stopCamera;
  }, [onScan, stopCamera]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.8)', flexShrink: 0 }}>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          ← Voltar
        </button>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: 0 }}>Escanear IMEI</p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {status === 'error' ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>📷</p>
            <p style={{ color: '#FF3B30', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Câmera indisponível</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5 }}>{errorMsg}</p>
            <button
              onClick={() => { stopCamera(); onClose(); }}
              style={{ marginTop: 24, background: '#007AFF', border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
            >
              Digitar manualmente
            </button>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#000' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />

              {/* Scan overlay */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {/* Scan window */}
                <div style={{
                  position: 'absolute', left: '8%', right: '8%',
                  top: '50%', transform: 'translateY(-50%)',
                  height: 88,
                  border: '2px solid #007AFF',
                  borderRadius: 10,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                }} />
                {/* Animated scan line */}
                {status === 'scanning' && (
                  <div style={{
                    position: 'absolute', left: '8%', right: '8%',
                    top: '50%', height: 2,
                    background: 'linear-gradient(90deg, transparent, #007AFF, transparent)',
                    animation: 'wt-scanline 1.8s ease-in-out infinite',
                  }} />
                )}
              </div>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 24, textAlign: 'center', padding: '0 32px', lineHeight: 1.6 }}>
              {status === 'loading'
                ? 'Iniciando câmera...'
                : 'Aponte para o código de barras da etiqueta IMEI'}
            </p>

            <style>{`
              @keyframes wt-scanline {
                0%,100% { transform: translateY(-42px); opacity: 0.3; }
                50%      { transform: translateY(42px);  opacity: 1; }
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}
