'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (value: string) => void;
  onClose: () => void;
}

const SCANNER_ID = 'wt-barcode-reader';

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const scannedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch { /* ignore cleanup errors */ }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 260, height: 80 } },
          (text: string) => {
            if (scannedRef.current) return;
            const digits = text.replace(/\D/g, '');
            if (digits.length >= 14 && digits.length <= 17) {
              scannedRef.current = true;
              stopScanner().then(() => {
                if (mounted) onScan(digits.slice(0, 15));
              });
            }
          },
          undefined,
        );

        if (mounted) setStatus('scanning');
      } catch (e) {
        if (!mounted) return;
        setStatus('error');
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (msg.includes('permission') || msg.includes('denied')) {
          setErrorMsg('Permissão de câmera negada. Libere nas configurações do navegador.');
        } else if (msg.includes('not found') || msg.includes('no camera')) {
          setErrorMsg('Nenhuma câmera encontrada neste dispositivo.');
        } else {
          setErrorMsg('Não foi possível acessar a câmera.');
        }
      }
    }

    init();

    return () => {
      mounted = false;
      stopScanner();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    stopScanner().then(onClose);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'rgba(0,0,0,0.85)' }}>
        <button
          onClick={handleClose}
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >← Voltar</button>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: 0 }}>Escanear IMEI</p>
      </div>

      {/* Camera area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

        {status === 'error' ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📷</p>
            <p style={{ color: '#FF3B30', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Câmera indisponível</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>{errorMsg}</p>
            <button
              onClick={handleClose}
              style={{ marginTop: 28, background: '#007AFF', border: 'none', borderRadius: 12, padding: '12px 28px', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
            >Digitar manualmente</button>
          </div>
        ) : (
          <>
            {/* Loading overlay */}
            {status === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 2 }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Iniciando câmera...</p>
              </div>
            )}

            {/* html5-qrcode renders the video inside this div */}
            <div id={SCANNER_ID} style={{ width: '100%', maxWidth: 420 }} />

            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 20, textAlign: 'center', padding: '0 32px', lineHeight: 1.6 }}>
              Aponte para o código de barras da etiqueta IMEI
            </p>
          </>
        )}
      </div>

      {/* Override html5-qrcode default styles */}
      <style>{`
        #${SCANNER_ID} video { width: 100% !important; border-radius: 0 !important; }
        #${SCANNER_ID} img  { display: none !important; }
        #${SCANNER_ID} > div:last-child { display: none !important; }
      `}</style>
    </div>
  );
}
