'use client';

import { useState, useEffect, useRef } from 'react';

interface User { id: number; name: string; email: string; }
interface Contract { id: string; token: string; templateName: string; status: string; createdAt: string; signedAt?: string; }
interface Props { user: User; onClose: () => void; }

const APP_URL = 'https://app.weevtrack.com';

const VARS = [
  { tag: '{nome}', label: 'Nome do cliente' },
  { tag: '{cpf}', label: 'CPF/CNPJ' },
  { tag: '{data}', label: 'Data de hoje' },
  { tag: '{veiculo}', label: 'Veículo' },
  { tag: '{placa}', label: 'Placa' },
  { tag: '{imei}', label: 'IMEI' },
  { tag: '{email}', label: 'E-mail' },
  { tag: '{telefone}', label: 'Telefone' },
];

export default function ContratoDistribuidorModal({ user, onClose }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [step, setStep] = useState<'list' | 'create' | 'done'>('list');
  const [contractText, setContractText] = useState('');
  const [savedTemplate, setSavedTemplate] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [plate, setPlate] = useState('');
  const [imei, setImei] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/contratos?userId=${user.id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setContracts(data); })
      .catch(() => {})
      .finally(() => setLoadingContracts(false));

    fetch('/api/distribuidor/templates')
      .then(r => r.json())
      .then(data => {
        const text = data.text || '';
        setSavedTemplate(text);
        setContractText(text);
      })
      .catch(() => {});
  }, [user.id]);

  function insertVar(tag: string) {
    const el = textareaRef.current;
    if (!el) { setContractText(prev => prev + tag); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = contractText.slice(0, start) + tag + contractText.slice(end);
    setContractText(next);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + tag.length; el.focus(); }, 0);
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    try {
      await fetch('/api/distribuidor/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: contractText }),
      });
      setSavedTemplate(contractText);
    } catch { /* */ }
    setSavingTemplate(false);
  }

  async function generate() {
    if (!contractText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customContractText: contractText,
          userId: user.id,
          clientName: user.name,
          clientCpfCnpj: cpfCnpj,
          clientPhone: phone,
          clientEmail: user.email,
          vehicle,
          vehiclePlate: plate,
          deviceImei: imei,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedUrl(data.url);
        setContracts(prev => [{ id: data.token, token: data.token, templateName: 'Contrato Personalizado', status: 'pending', createdAt: new Date().toISOString() }, ...prev]);
        setStep('done');
      }
    } catch { /* */ }
    setSaving(false);
  }

  async function deleteContract(token: string) {
    if (!confirm('Excluir este contrato? Esta ação não pode ser desfeita.')) return;
    setDeletingId(token);
    try {
      const res = await fetch(`/api/contratos/${token}`, { method: 'DELETE' });
      if (res.ok) setContracts(prev => prev.filter(c => c.token !== token));
    } catch { /* */ }
    setDeletingId(null);
  }

  function whatsappMsg() {
    return `Olá, ${user.name}!\n\nSeu contrato de serviços está pronto para assinatura digital.\n\nAcesse o link abaixo para ler e assinar:\n${generatedUrl}\n\nEm caso de dúvidas, entre em contato conosco.`;
  }

  function copyMsg() {
    navigator.clipboard.writeText(whatsappMsg());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function openWhatsApp() {
    const phone_clean = phone.replace(/\D/g, '');
    if (!phone_clean) { copyMsg(); return; }
    const num = phone_clean.startsWith('55') ? phone_clean : `55${phone_clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(whatsappMsg())}`, '_blank');
  }

  const templateChanged = contractText !== savedTemplate;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ width: '100%', maxHeight: '92dvh', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-border)', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--text-hi)' }}>📄 Contratos</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-lo)' }}>{user.name}</p>
            </div>
            {step !== 'list' && (
              <button onClick={() => setStep('list')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--bg-border)', border: 'none', color: 'var(--text-lo)', cursor: 'pointer' }}>← Voltar</button>
            )}
          </div>
        </div>

        <div style={{ padding: '0 20px 40px', flex: 1 }}>

          {/* LIST */}
          {step === 'list' && (
            <>
              <button onClick={() => { setContractText(savedTemplate); setStep('create'); }}
                style={{ width: '100%', background: '#007AFF', color: 'white', fontWeight: 700, fontSize: 14, padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', marginBottom: 16 }}>
                + Gerar novo contrato
              </button>

              {loadingContracts ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ width: 24, height: 24, border: '2px solid #007AFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                </div>
              ) : contracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
                  <p style={{ fontSize: 13, color: 'var(--text-lo)' }}>Nenhum contrato gerado ainda</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-lo)', marginBottom: 4 }}>Contratos</p>
                  {contracts.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--bg-border)' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-hi)' }}>{c.templateName}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-lo)' }}>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700, background: c.status === 'signed' ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)', color: c.status === 'signed' ? '#34C759' : '#FF9500' }}>
                          {c.status === 'signed' ? '✅ Assinado' : '⏳ Pendente'}
                        </span>
                        <button onClick={() => { navigator.clipboard.writeText(`${APP_URL}/contrato/${c.token}`); }}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,122,255,0.1)', color: '#007AFF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          Copiar link
                        </button>
                        <button onClick={() => deleteContract(c.token)} disabled={deletingId === c.token}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: deletingId === c.token ? 0.5 : 1 }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CREATE */}
          {step === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Contract text editor */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Texto do contrato *</p>
                  <button onClick={saveTemplate} disabled={savingTemplate || !templateChanged}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: templateChanged ? 'rgba(0,122,255,0.12)' : 'var(--bg-border)', color: templateChanged ? '#007AFF' : 'var(--text-lo)', border: 'none', cursor: templateChanged ? 'pointer' : 'default', fontWeight: 600 }}>
                    {savingTemplate ? 'Salvando...' : templateChanged ? '💾 Salvar modelo' : '✅ Modelo salvo'}
                  </button>
                </div>

                {/* Variable chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {VARS.map(v => (
                    <button key={v.tag} onClick={() => insertVar(v.tag)}
                      title={`Inserir ${v.label}`}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', fontWeight: 600 }}>
                      {v.tag}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={contractText}
                  onChange={e => setContractText(e.target.value)}
                  placeholder="Digite aqui o texto do seu contrato. Use as variáveis acima para inserir dados do cliente automaticamente.

Exemplo:
Contrato de Prestação de Serviços de Rastreamento

Cliente: {nome}
CPF/CNPJ: {cpf}
Veículo: {veiculo} — Placa: {placa}
Data: {data}

..."
                  rows={12}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-lo)' }}>
                  Clique nas variáveis acima para inserir no cursor. Salve o modelo para reutilizar futuramente.
                </p>
              </div>

              {/* Client fields */}
              {[
                { label: 'CPF ou CNPJ do cliente', value: cpfCnpj, set: setCpfCnpj, placeholder: '000.000.000-00' },
                { label: 'Telefone (WhatsApp)', value: phone, set: setPhone, placeholder: '(19) 99999-9999' },
                { label: 'Veículo (modelo, cor, ano)', value: vehicle, set: setVehicle, placeholder: 'Ex: VW Gol Branco 2020' },
                { label: 'Placa', value: plate, set: setPlate, placeholder: 'Ex: ABC-1234' },
                { label: 'IMEI do rastreador', value: imei, set: setImei, placeholder: '355488062098989' },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>{f.label}</p>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}

              <button onClick={generate} disabled={saving || !contractText.trim()}
                style={{ width: '100%', background: contractText.trim() ? '#007AFF' : '#e5e7eb', color: contractText.trim() ? 'white' : '#9CA3AF', fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 12, border: 'none', cursor: contractText.trim() ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1, marginTop: 4 }}>
                {saving ? 'Gerando...' : 'Gerar link do contrato'}
              </button>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#34C759' }}>✅ Contrato gerado!</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-lo)' }}>Envie o link abaixo para o cliente assinar</p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--bg-border)', wordBreak: 'break-all' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-lo)' }}>Link do contrato:</p>
                <p style={{ margin: 0, fontSize: 13, color: '#007AFF', fontWeight: 600 }}>{generatedUrl}</p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--bg-border)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-lo)' }}>Mensagem para WhatsApp:</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{whatsappMsg()}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={copyMsg}
                  style={{ padding: 13, borderRadius: 12, background: copied ? 'rgba(52,199,89,0.15)' : 'var(--bg-border)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: copied ? '#34C759' : 'var(--text-hi)' }}>
                  {copied ? '✅ Copiado!' : '📋 Copiar msg'}
                </button>
                <button onClick={openWhatsApp}
                  style={{ padding: 13, borderRadius: 12, background: 'rgba(37,211,102,0.15)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#25D366' }}>
                  📱 WhatsApp
                </button>
              </div>

              <button onClick={() => setStep('list')}
                style={{ width: '100%', padding: 12, borderRadius: 12, background: 'transparent', border: '1px solid var(--bg-border)', cursor: 'pointer', fontSize: 13, color: 'var(--text-lo)', fontWeight: 600 }}>
                Ver todos os contratos
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
