'use client';

import { useState, useEffect, useRef } from 'react';

type Step = 'loading' | 'reading' | 'signing' | 'done' | 'error' | 'already_signed';

export default function ContratoPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [step, setStep] = useState<Step>('loading');
  const [contract, setContract] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const [signing, setSigning] = useState(false);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const textRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawingRef = useRef(false);
  const [hasDraw, setHasDraw] = useState(false);

  useEffect(() => {
    fetch(`/api/contratos/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStep('error'); return; }
        if (data.signed) { setContract(data); setStep('already_signed'); return; }
        setContract(data);
        setStep('reading');
      })
      .catch(() => setStep('error'));
  }, [token]);

  function handleScroll() {
    const el = textRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
  }

  function initCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    drawingRef.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDraw(true);
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    drawingRef.current = false;
  }

  function clearSig() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDraw(false);
  }

  async function openCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      setCameraError('Câmera não disponível. Você pode prosseguir sem a selfie.');
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setSelfieData(canvas.toDataURL('image/jpeg', 0.7));
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function discardSelfie() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setSelfieData(null);
  }

  async function sign() {
    if (!hasDraw) return;
    setSigning(true);
    try {
      const signature = canvasRef.current!.toDataURL('image/png');
      const res = await fetch(`/api/contratos/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, selfie: selfieData }),
      });
      if (res.ok) setStep('done');
      else { const d = await res.json(); alert(d.error || 'Erro ao assinar'); }
    } catch { alert('Erro de conexão'); }
    setSigning(false);
  }

  if (step === 'loading') return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #007AFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (step === 'error') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8f9fa' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Contrato não encontrado</p>
      <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>O link pode ter expirado ou ser inválido. Entre em contato com a Weev.</p>
    </div>
  );

  if (step === 'already_signed') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8f9fa' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Contrato já assinado</p>
      <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
        Assinado em {contract?.signedAt ? new Date(contract.signedAt).toLocaleString('pt-BR') : '—'}
      </p>
      <div style={{ marginTop: 24, padding: '12px 20px', borderRadius: 12, background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)' }}>
        <p style={{ fontSize: 13, color: '#34C759', fontWeight: 600 }}>Obrigado, {contract?.clientName}!</p>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8f9fa' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginBottom: 12, textAlign: 'center' }}>Contrato assinado!</p>
      <p style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 1.6 }}>
        Obrigado, <strong>{contract?.clientName}</strong>.<br />
        Sua assinatura foi registrada com sucesso.<br />
        Em breve a Weev entrará em contato.
      </p>
      <div style={{ marginTop: 28, padding: '14px 20px', borderRadius: 14, background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.2)', textAlign: 'center', maxWidth: 320 }}>
        <p style={{ fontSize: 13, color: '#007AFF', fontWeight: 600 }}>📞 Suporte: (19) 99978-0601</p>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Weev Consultoria e Serviços</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; }
      `}</style>

      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ background: '#1a1a2e', color: 'white', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="7" cy="7" r="2.5" fill="white"/>
                <path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>WeevTrack</p>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>Contrato Digital — {contract?.templateName}</p>
            </div>
          </div>
        </header>

        {/* Reading step */}
        {step === 'reading' && (
          <>
            <div style={{ background: 'rgba(0,122,255,0.08)', borderBottom: '1px solid rgba(0,122,255,0.15)', padding: '10px 16px', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#007AFF', fontWeight: 600 }}>
                📋 Leia o contrato até o final para assinar
              </p>
            </div>

            <div
              ref={textRef}
              onScroll={handleScroll}
              style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', background: 'white', fontSize: 13, lineHeight: 1.8, color: '#1a1a2e', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}
            >
              {contract?.contractText}
            </div>

            <div style={{ flexShrink: 0, padding: '16px 20px', background: 'white', borderTop: '1px solid #eee' }}>
              {scrolled ? (
                <button
                  onClick={() => { setStep('signing'); setTimeout(initCanvas, 100); }}
                  style={{ width: '100%', background: '#007AFF', color: 'white', fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 14, border: 'none', cursor: 'pointer' }}
                >
                  Li e aceito — Prosseguir para assinar
                </button>
              ) : (
                <button
                  style={{ width: '100%', background: '#e5e7eb', color: '#9CA3AF', fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 14, border: 'none', cursor: 'not-allowed' }}
                  disabled
                >
                  Role até o final para continuar ↓
                </button>
              )}
            </div>
          </>
        )}

        {/* Signing step */}
        {step === 'signing' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>Assinatura digital</p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6B7280' }}>Assine dentro do espaço abaixo usando o dedo</p>
              <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 12, border: '2px dashed #d1d5db', background: '#fafafa', overflow: 'hidden' }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block', cursor: 'crosshair' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {!hasDraw && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <p style={{ fontSize: 13, color: '#9CA3AF' }}>✍️ Assine aqui</p>
                  </div>
                )}
              </div>
              {hasDraw && (
                <button onClick={clearSig} style={{ marginTop: 8, background: 'none', border: 'none', color: '#FF3B30', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  🗑 Limpar assinatura
                </button>
              )}
            </div>

            {/* Selfie */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>Selfie com documento <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>(opcional)</span></p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6B7280' }}>Segure seu documento ao lado do rosto e tire uma foto</p>

              {cameraError && <p style={{ fontSize: 12, color: '#FF9500', marginBottom: 10 }}>{cameraError}</p>}

              {selfieData ? (
                <div style={{ position: 'relative' }}>
                  <img src={selfieData} alt="selfie" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
                  <button onClick={() => { setSelfieData(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>
                    Refazer
                  </button>
                </div>
              ) : cameraOpen ? (
                <div>
                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 12, background: '#000', display: 'block' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={captureSelfie} style={{ flex: 1, background: '#007AFF', color: 'white', fontWeight: 700, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                      📸 Capturar
                    </button>
                    <button onClick={discardSelfie} style={{ padding: '12px 16px', background: '#f3f4f6', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 13, color: '#6B7280' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={openCamera} style={{ width: '100%', background: '#f3f4f6', border: '2px dashed #d1d5db', borderRadius: 12, padding: 20, cursor: 'pointer', color: '#6B7280', fontSize: 14, fontWeight: 600 }}>
                  📷 Abrir câmera
                </button>
              )}
            </div>

            {/* Submit */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                Ao clicar em "Assinar contrato", você confirma que leu, compreendeu e concorda com todas as cláusulas do contrato acima.
              </p>
              <button
                onClick={sign}
                disabled={!hasDraw || signing}
                style={{ width: '100%', background: hasDraw ? '#34C759' : '#e5e7eb', color: hasDraw ? 'white' : '#9CA3AF', fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 14, border: 'none', cursor: hasDraw ? 'pointer' : 'not-allowed', opacity: signing ? 0.6 : 1 }}
              >
                {signing ? 'Registrando...' : '✅ Assinar contrato'}
              </button>
            </div>

            <div style={{ textAlign: 'center', paddingBottom: 32 }}>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>Weev Consultoria e Serviços Ltda — CNPJ 34.266.884/0001-42</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
