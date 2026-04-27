'use client';

import { useState } from 'react';

interface User { id: number; name: string; email: string; }
interface Props { user: User; onClose: () => void; }

const BILLING_TYPES = [
  { value: 'BOLETO', label: '🧾 Boleto' },
  { value: 'PIX', label: '⚡ PIX' },
  { value: 'CREDIT_CARD', label: '💳 Cartão de crédito' },
];

const CYCLES = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMIANNUALLY', label: 'Semestral' },
  { value: 'YEARLY', label: 'Anual' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function FaturaModal({ user, onClose }: Props) {
  const [type, setType] = useState<'subscription' | 'payment' | ''>('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [billingType, setBillingType] = useState('BOLETO');
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [cycle, setCycle] = useState('MONTHLY');
  const [description, setDescription] = useState('');
  const [fine, setFine] = useState('10');
  const [interest, setInterest] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ invoiceUrl: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!cpfCnpj || !value || !dueDate || !type) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          clientName: user.name,
          clientCpfCnpj: cpfCnpj,
          clientEmail: user.email,
          clientPhone: phone,
          billingType,
          value: Number(value),
          dueDate,
          cycle,
          description: description || (type === 'subscription' ? `Mensalidade WeevTrack — ${user.name}` : `Cobrança WeevTrack — ${user.name}`),
          fine,
          interest,
        }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || 'Erro ao gerar cobrança');
    } catch { setError('Erro de conexão'); }
    setGenerating(false);
  }

  function whatsappMsg() {
    if (!result) return '';
    return `Olá, Sr.(a) ${user.name}.\n\nAgradecemos por confiar na Weev Consultoria e Serviços.\n\nSegue o link para pagamento:\n\n${result.invoiceUrl}\n\nQualquer dúvida estamos à disposição. Obrigado pela parceria!`;
  }

  function copyMsg() {
    navigator.clipboard.writeText(whatsappMsg());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function openWhatsApp() {
    const ph = phone.replace(/\D/g, '');
    if (!ph) { copyMsg(); return; }
    const num = ph.startsWith('55') ? ph : `55${ph}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(whatsappMsg())}`, '_blank');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ width: '100%', maxHeight: '92dvh', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-border)', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--text-hi)' }}>💰 Faturas — Asaas</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-lo)' }}>{user.name}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {result ? (
            <>
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#34C759' }}>✅ Cobrança gerada!</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-lo)' }}>{type === 'subscription' ? 'Assinatura recorrente criada' : 'Cobrança avulsa criada'}</p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--bg-border)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-lo)' }}>Link de pagamento:</p>
                <p style={{ margin: 0, fontSize: 13, color: '#007AFF', fontWeight: 600, wordBreak: 'break-all' }}>{result.invoiceUrl}</p>
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

              <button onClick={() => { setResult(null); setType(''); }}
                style={{ width: '100%', padding: 12, borderRadius: 12, background: 'transparent', border: '1px solid var(--bg-border)', cursor: 'pointer', fontSize: 13, color: 'var(--text-lo)', fontWeight: 600 }}>
                Nova cobrança
              </button>
            </>
          ) : (
            <>
              {/* Type picker */}
              {!type && (
                <>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-mid)' }}>Qual tipo de cobrança?</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={() => setType('subscription')}
                      style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(0,122,255,0.08)', border: '2px solid rgba(0,122,255,0.2)', cursor: 'pointer', textAlign: 'left' }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#007AFF' }}>🔄 Recorrência</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-lo)' }}>Cobranças automáticas mensais / trimestrais / anuais</p>
                    </button>
                    <button onClick={() => setType('payment')}
                      style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(255,149,0,0.08)', border: '2px solid rgba(255,149,0,0.2)', cursor: 'pointer', textAlign: 'left' }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#FF9500' }}>📄 Avulsa</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-lo)' }}>Cobrança única (instalação, taxa, etc.)</p>
                    </button>
                  </div>
                </>
              )}

              {type && (
                <>
                  <button onClick={() => setType('')} style={{ alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--bg-border)', border: 'none', color: 'var(--text-lo)', cursor: 'pointer' }}>
                    ← Voltar
                  </button>

                  <div style={{ padding: '10px 14px', borderRadius: 10, background: type === 'subscription' ? 'rgba(0,122,255,0.08)' : 'rgba(255,149,0,0.08)', border: `1px solid ${type === 'subscription' ? 'rgba(0,122,255,0.2)' : 'rgba(255,149,0,0.2)'}` }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: type === 'subscription' ? '#007AFF' : '#FF9500' }}>
                      {type === 'subscription' ? '🔄 Recorrência' : '📄 Cobrança Avulsa'}
                    </p>
                  </div>

                  {[
                    { label: 'CPF ou CNPJ do cliente *', value: cpfCnpj, set: setCpfCnpj, placeholder: '000.000.000-00', type: 'text' },
                    { label: 'Telefone (WhatsApp)', value: phone, set: setPhone, placeholder: '(19) 99999-9999', type: 'tel' },
                  ].map(f => (
                    <div key={f.label}>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>{f.label}</p>
                      <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type={f.type}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}

                  {type === 'subscription' && (
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Periodicidade</p>
                      <select value={cycle} onChange={e => setCycle(e.target.value)}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13 }}>
                        {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Forma de pagamento</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {BILLING_TYPES.map(b => (
                        <button key={b.value} onClick={() => setBillingType(b.value)}
                          style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: `2px solid ${billingType === b.value ? '#007AFF' : 'var(--bg-border)'}`, background: billingType === b.value ? 'rgba(0,122,255,0.1)' : 'var(--bg-input)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: billingType === b.value ? '#007AFF' : 'var(--text-lo)' }}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Valor (R$) *</p>
                      <input value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" type="number" min="0" step="0.01"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>{type === 'subscription' ? '1º vencimento' : 'Vencimento'} *</p>
                      <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Multa (%)</p>
                      <input value={fine} onChange={e => setFine(e.target.value)} placeholder="10" type="number" min="0" max="100"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Juros (% a.m.)</p>
                      <input value={interest} onChange={e => setInterest(e.target.value)} placeholder="1" type="number" min="0" max="10" step="0.1"
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-lo)' }}>Descrição</p>
                    <input value={description} onChange={e => setDescription(e.target.value)} placeholder={type === 'subscription' ? 'Mensalidade WeevTrack' : 'Instalação WeevTrack'}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>

                  {error && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)' }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#FF3B30' }}>❌ {error}</p>
                    </div>
                  )}

                  <button onClick={generate} disabled={generating || !cpfCnpj || !value || !dueDate}
                    style={{ width: '100%', background: cpfCnpj && value && dueDate ? '#007AFF' : '#e5e7eb', color: cpfCnpj && value && dueDate ? 'white' : '#9CA3AF', fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 12, border: 'none', cursor: cpfCnpj && value && dueDate ? 'pointer' : 'not-allowed', opacity: generating ? 0.6 : 1 }}>
                    {generating ? 'Gerando...' : '🎯 Gerar cobrança'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
