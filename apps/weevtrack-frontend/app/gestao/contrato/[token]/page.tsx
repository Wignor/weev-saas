'use client';

import { useState, useEffect } from 'react';

type FullContract = {
  token: string;
  templateName: string;
  clientName: string;
  clientCpfCnpj: string;
  clientPhone: string;
  clientEmail: string;
  vehicle: string;
  vehiclePlate: string;
  deviceImei: string;
  installationValue: number;
  monthlyValue: number;
  createdAt: string;
  signedAt: string | null;
  status: string;
  contractText: string;
  clientSignature: string | null;
  selfiePhoto: string | null;
  ipAddress: string | null;
};

export default function ComprovantePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [contract, setContract] = useState<FullContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/contratos/${token}?full=1`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        if (!data.signed) { setError('Contrato ainda não foi assinado pelo cliente.'); return; }
        setContract(data);
      })
      .catch(() => setError('Erro ao carregar contrato.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid #007AFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#f0f2f5' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
      <p style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>{error}</p>
      <button onClick={() => history.back()} style={{ marginTop: 20, background: '#007AFF', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>← Voltar</button>
    </div>
  );

  const c = contract!;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-family: Arial, Helvetica, sans-serif; background: #f0f2f5; color: #1a1a2e; }
        .no-print { display: block; }
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 600px) {
          .sig-grid { grid-template-columns: 1fr; }
          .data-row { flex-direction: column; }
        }
        @media print {
          .no-print { display: none !important; }
          html { background: white; }
          .page { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
          .contract-text { max-height: none !important; overflow: visible !important; }
          @page { margin: 1.2cm; size: A4; }
        }
      `}</style>

      {/* Barra superior — oculta na impressão */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#1a1a2e', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button onClick={() => history.back()} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>📄 Comprovante do Contrato</span>
        <button onClick={() => window.print()} style={{ background: '#007AFF', color: 'white', border: 'none', borderRadius: 8, padding: '7px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>🖨️ Imprimir / PDF</button>
      </div>

      {/* Conteúdo imprimível */}
      <div style={{ padding: '24px 16px 48px', minHeight: '100vh' }}>
        <div className="page" style={{ maxWidth: 820, margin: '0 auto', background: 'white', borderRadius: 10, boxShadow: '0 4px 32px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

          {/* Cabeçalho */}
          <div style={{ background: '#1a1a2e', color: 'white', padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: 18, letterSpacing: '0.03em', marginBottom: 4 }}>WEEV CONSULTORIA E SERVIÇOS LTDA</p>
                <p style={{ fontSize: 12, opacity: 0.65 }}>CNPJ: 34.266.884/0001-42 &nbsp;|&nbsp; (19) 99978-0601 &nbsp;|&nbsp; Mogi Guaçu – SP</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 800, fontSize: 15, opacity: 0.95 }}>{c.clientName}</p>
                {c.clientCpfCnpj && <p style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>CPF/CNPJ: {c.clientCpfCnpj}</p>}
                {c.vehicle && <p style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{c.vehicle}{c.vehiclePlate ? ` — ${c.vehiclePlate}` : ''}</p>}
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 16 }}>
              <p style={{ fontWeight: 800, fontSize: 15, textAlign: 'center', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Comprovante de Contrato Digital — {c.templateName}
              </p>
              <p style={{ textAlign: 'center', fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                Gerado em {fmt(c.createdAt)} &nbsp;|&nbsp; Assinado em {fmt(c.signedAt)}
              </p>
            </div>
          </div>

          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Dados do cliente */}
            <section>
              <div style={{ background: '#1a1a2e', color: 'white', padding: '7px 14px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Dados do Contratante
              </div>
              {(() => {
                const empty = (v: string | null | undefined) => !v || v === '—';
                const fields = [
                  { label: 'Nome', value: c.clientName },
                  { label: 'CPF / CNPJ', value: c.clientCpfCnpj },
                  { label: 'Telefone', value: c.clientPhone },
                  { label: 'E-mail', value: c.clientEmail },
                  { label: 'Veículo', value: c.vehicle },
                  { label: 'Placa', value: c.vehiclePlate },
                  { label: 'IMEI', value: c.deviceImei },
                  { label: 'Instalação', value: `R$ ${c.installationValue.toFixed(2).replace('.', ',')}` },
                  { label: 'Mensalidade', value: `R$ ${c.monthlyValue.toFixed(2).replace('.', ',')}` },
                ].filter(f => !empty(f.value));

                const rows: Array<[typeof fields[0], typeof fields[0] | null]> = [];
                for (let i = 0; i < fields.length; i += 2) {
                  rows.push([fields[i], fields[i + 1] ?? null]);
                }

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #dde1e7', borderTop: 'none' }}>
                    <tbody>
                      {rows.map(([a, b], i) => (
                        <tr key={i}>
                          <td style={{ padding: '8px 12px', borderBottom: i < rows.length - 1 ? '1px solid #eef0f3' : 'none', borderRight: '1px solid #dde1e7', width: '20%', fontWeight: 700, color: '#555', fontSize: 12 }}>{a.label}</td>
                          <td style={{ padding: '8px 12px', borderBottom: i < rows.length - 1 ? '1px solid #eef0f3' : 'none', borderRight: '1px solid #dde1e7', width: '30%' }}>{a.value}</td>
                          <td style={{ padding: '8px 12px', borderBottom: i < rows.length - 1 ? '1px solid #eef0f3' : 'none', borderRight: '1px solid #dde1e7', width: '20%', fontWeight: 700, color: '#555', fontSize: 12 }}>{b?.label ?? ''}</td>
                          <td style={{ padding: '8px 12px', borderBottom: i < rows.length - 1 ? '1px solid #eef0f3' : 'none', width: '30%' }}>{b?.value ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </section>

            {/* Texto do contrato */}
            <section>
              <div style={{ background: '#1a1a2e', color: 'white', padding: '7px 14px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Texto do Contrato
              </div>
              <div className="contract-text" style={{ border: '1px solid #dde1e7', borderTop: 'none', padding: '16px 20px', fontSize: 12, lineHeight: 1.75, color: '#2a2a3a', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, "Times New Roman", serif', maxHeight: 360, overflowY: 'auto', background: '#fafbfc' }}>
                {c.contractText}
              </div>
            </section>

            {/* Assinaturas */}
            <section>
              <div style={{ background: '#1a1a2e', color: 'white', padding: '7px 14px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Assinaturas
              </div>
              <div style={{ border: '1px solid #dde1e7', borderTop: 'none', padding: '20px 20px 16px' }}>
                <div className="sig-grid">

                  {/* Assinatura manuscrita */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Contratante — Assinatura Digital</p>
                    <div style={{ border: '1px solid #dde1e7', borderRadius: 8, background: '#fafbfc', padding: 6, marginBottom: 10, minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.clientSignature
                        ? <img src={c.clientSignature} alt="Assinatura" style={{ maxWidth: '100%', maxHeight: 110, objectFit: 'contain', display: 'block' }} />
                        : <span style={{ fontSize: 12, color: '#aaa' }}>— sem assinatura —</span>}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{c.clientName}</p>
                    <p style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>CPF/CNPJ: {c.clientCpfCnpj || '—'}</p>
                    <p style={{ fontSize: 11, color: '#777', marginBottom: 2 }}>Assinado em: {fmt(c.signedAt)}</p>
                    {c.ipAddress && <p style={{ fontSize: 11, color: '#777' }}>IP: {c.ipAddress}</p>}
                  </div>

                  {/* Selfie */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Selfie com Documento</p>
                    {c.selfiePhoto
                      ? <img src={c.selfiePhoto} alt="Selfie" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid #dde1e7', display: 'block' }} />
                      : <div style={{ border: '1px dashed #ccc', borderRadius: 8, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>Selfie não enviada</div>}
                  </div>
                </div>

                {/* Contratada */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eef0f3' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contratada</p>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Wignor Aguiller Ferreira</p>
                  <p style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>CPF: 398.000.258-63</p>
                  <p style={{ fontSize: 12, color: '#555' }}>Weev Consultoria e Serviços Ltda — CNPJ: 34.266.884/0001-42</p>
                </div>
              </div>
            </section>

            {/* Certificado */}
            <section>
              <div style={{ background: '#f0f4ff', border: '1px solid #c7d4f0', borderRadius: 8, padding: '14px 18px' }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#1a1a2e', marginBottom: 6 }}>Certificado Digital WeevTrack</p>
                <p style={{ fontSize: 11, color: '#444', marginBottom: 2 }}>Token do documento: <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>{c.token}</code></p>
                <p style={{ fontSize: 11, color: '#444', marginBottom: 2 }}>Contrato gerado em: {fmt(c.createdAt)}</p>
                <p style={{ fontSize: 11, color: '#444', marginBottom: 2 }}>Assinatura registrada em: {fmt(c.signedAt)}</p>
                {c.ipAddress && <p style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>IP de origem da assinatura: {c.ipAddress}</p>}
                <p style={{ fontSize: 10, color: '#888', marginTop: 6 }}>
                  Documento assinado eletronicamente conforme MP 2.200-2/01, Art. 10º, §2. Weev Consultoria e Serviços Ltda — CNPJ: 34.266.884/0001-42
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
