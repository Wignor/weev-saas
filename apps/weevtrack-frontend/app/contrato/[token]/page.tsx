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
      <div style={{ width: 32, height: 32, border: '3px solid #00C9A7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
          .contract-text { max-height: none !important; overflow: visible !important; }
        }
        @page { size: A4; margin: 0; }
      `}</style>

      {/* Barra de navegação */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
        <button onClick={() => window.history.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, color: 'white', padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Voltar
        </button>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 13, flex: 1, textAlign: 'center' }}>📄 Comprovante do Contrato</span>
        <button onClick={() => window.print()} style={{ background: '#00C9A7', border: 'none', borderRadius: 10, color: 'white', padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 12px 40px' }}>
        <div className="print-page" style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.12)' }}>

          {/* ── CABEÇALHO TIMBRADO ── */}
          <div style={{ background: '#1a1a2e', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#00C9A7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                  <circle cx="10" cy="10" r="3.5" fill="white"/>
                  <circle cx="22" cy="10" r="3.5" stroke="white" strokeWidth="2" fill="none"/>
                  <path d="M10 6.5V3M10 17v-3.5M6.5 10H3M17 10h-3.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 22a6 6 0 1 0 12 0 6 6 0 0 0-12 0z" stroke="white" strokeWidth="2"/>
                  <path d="M22 19v3l2 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: 'white', letterSpacing: '-0.3px', lineHeight: 1.2 }}>WEEV CONSULTORIA</p>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: 'white', letterSpacing: '-0.3px', lineHeight: 1.2 }}>E SERVIÇOS LTDA</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>WeevTrack — Rastreamento Veicular</p>
              </div>
            </div>
            <div style={{ textAlign: 'right', lineHeight: 1.8 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'white' }}>CNPJ: 34.266.884/0001-42</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>(19) 99978-0601</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Mogi Guaçu – SP</p>
            </div>
          </div>

          {/* Faixa cliente */}
          <div style={{ background: '#0f172a', padding: '8px 28px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: '#00C9A7', fontWeight: 700, fontSize: 14 }}>{contract?.clientName}</span>
            {contract?.clientCpfCnpj && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>CPF/CNPJ: {contract.clientCpfCnpj}</span></>}
            {contract?.vehicle && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{contract.vehicle} — {contract.vehiclePlate}</span></>}
          </div>

          {/* Título do comprovante */}
          <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '18px 28px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 15, color: '#1a1a2e', letterSpacing: '0.5px' }}>
              COMPROVANTE DE CONTRATO DIGITAL — {(contract?.templateName ?? '').toUpperCase()}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Gerado em {contract?.createdAt ? new Date(contract.createdAt).toLocaleString('pt-BR') : '—'}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              Assinado em {contract?.signedAt ? new Date(contract.signedAt).toLocaleString('pt-BR') : '—'}
            </p>
          </div>

          <div style={{ padding: '0 24px 28px' }}>

            {/* DADOS DO CONTRATANTE */}
            <div style={{ marginTop: 22 }}>
              <div style={{ background: '#1a1a2e', borderRadius: '8px 8px 0 0', padding: '9px 16px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 11, color: 'white', letterSpacing: '1.2px' }}>DADOS DO CONTRATANTE</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                <tbody>
                  {([
                    ['Nome', contract?.clientName, 'CPF / CNPJ', contract?.clientCpfCnpj],
                    ['Telefone', contract?.clientPhone, 'E-mail', contract?.clientEmail],
                    ['Veículo', contract?.vehicle, 'Placa', contract?.vehiclePlate],
                    ['IMEI', contract?.deviceImei, 'Mensalidade', contract?.monthlyValue != null ? `R$ ${Number(contract.monthlyValue).toFixed(2).replace('.', ',')}` : null],
                  ] as [string, string|null|undefined, string, string|null|undefined][]).map(([l1, v1, l2, v2], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#374151', width: '16%', fontSize: 11, letterSpacing: '0.3px' }}>{l1}</td>
                      <td style={{ padding: '10px 14px', color: '#111827', width: '34%', fontWeight: 500 }}>{v1 || '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#374151', width: '16%', fontSize: 11, letterSpacing: '0.3px' }}>{l2}</td>
                      <td style={{ padding: '10px 14px', color: '#111827', width: '34%', fontWeight: 500 }}>{v2 || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TEXTO DO CONTRATO */}
            <div style={{ marginTop: 22 }}>
              <div style={{ background: '#1a1a2e', borderRadius: '8px 8px 0 0', padding: '9px 16px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 11, color: 'white', letterSpacing: '1.2px' }}>TEXTO DO CONTRATO</p>
              </div>
              <div
                className="contract-text"
                style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '20px', fontSize: 12.5, lineHeight: 1.85, color: '#1f2937', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', maxHeight: 380, overflowY: 'auto' }}
              >
                {contract?.contractText}
              </div>
            </div>

            {/* ASSINATURAS */}
            <div style={{ marginTop: 22 }}>
              <div style={{ background: '#1a1a2e', borderRadius: '8px 8px 0 0', padding: '9px 16px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 11, color: 'white', letterSpacing: '1.2px' }}>ASSINATURAS</p>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Assinatura do contratante */}
                  <div>
                    <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 10, color: '#6b7280', letterSpacing: '1.2px' }}>CONTRATANTE — ASSINATURA DIGITAL</p>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fafafa', height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {contract?.clientSignature
                        ? <img src={contract.clientSignature} alt="Assinatura" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
                        : <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Assinatura não disponível</p>}
                    </div>
                    <p style={{ margin: '8px 0 2px', fontSize: 13, color: '#111827', fontWeight: 700 }}>{contract?.clientName}</p>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#4b5563' }}>CPF/CNPJ: {contract?.clientCpfCnpj}</p>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#4b5563' }}>Assinado em: {contract?.signedAt ? new Date(contract.signedAt).toLocaleString('pt-BR') : '—'}</p>
                    {contract?.ipAddress && <p style={{ margin: 0, fontSize: 11, color: '#4b5563' }}>IP: {contract.ipAddress}</p>}
                  </div>

                  {/* Selfie */}
                  <div>
                    <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 10, color: '#6b7280', letterSpacing: '1.2px' }}>SELFIE COM DOCUMENTO</p>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fafafa', height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {contract?.selfiePhoto
                        ? <img src={contract.selfiePhoto} alt="Selfie com documento" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Selfie não enviada</p>}
                    </div>
                  </div>
                </div>

                {/* Contratada */}
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 10, color: '#6b7280', letterSpacing: '1.2px' }}>CONTRATADA</p>
                    <p style={{ margin: '0 0 2px', fontSize: 13, color: '#111827', fontWeight: 700 }}>Wignor Aguiller Ferreira</p>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#4b5563' }}>CPF: 398.000.258-63</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#4b5563' }}>Weev Consultoria e Serviços Ltda — CNPJ: 34.266.884/0001-42</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CERTIFICADO DIGITAL */}
            <div style={{ marginTop: 22, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 13, color: '#1a1a2e' }}>Certificado Digital WeevTrack</p>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569' }}>
                Token do documento: <code style={{ background: '#e2e8f0', borderRadius: 4, padding: '2px 6px', fontSize: 10.5, fontFamily: 'monospace', wordBreak: 'break-all' }}>{contract?.token}</code>
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569' }}>Contrato gerado em: {contract?.createdAt ? new Date(contract.createdAt).toLocaleString('pt-BR') : '—'}</p>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569' }}>Assinatura registrada em: {contract?.signedAt ? new Date(contract.signedAt).toLocaleString('pt-BR') : '—'}</p>
              {contract?.ipAddress && <p style={{ margin: '0 0 4px', fontSize: 11, color: '#475569' }}>IP de origem da assinatura: {contract.ipAddress}</p>}
              <p style={{ margin: '10px 0 0', fontSize: 10, color: '#94a3b8' }}>
                Documento assinado eletronicamente conforme MP 2.200-2/01, Art. 10º, §2. Weev Consultoria e Serviços Ltda — CNPJ: 34.266.884/0001-42
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
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
      <div style={{ marginTop: 28, padding: '14px 20px', borderRadius: 14, background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.2)', textAlign: 'center', maxWidth: 320 }}>
        <p style={{ fontSize: 13, color: '#00C9A7', fontWeight: 600 }}>📞 Suporte: (19) 99978-0601</p>
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

      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 720, margin: '0 auto', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ background: '#1a1a2e', color: 'white', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#00C9A7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            <div style={{ background: 'rgba(0,201,167,0.08)', borderBottom: '1px solid rgba(0,201,167,0.15)', padding: '10px 16px', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#00C9A7', fontWeight: 600 }}>
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
                  style={{ width: '100%', background: '#00C9A7', color: 'white', fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 14, border: 'none', cursor: 'pointer' }}
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
                    <button onClick={captureSelfie} style={{ flex: 1, background: '#00C9A7', color: 'white', fontWeight: 700, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14 }}>
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
