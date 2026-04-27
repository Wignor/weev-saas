'use client';

import { useState, useEffect } from 'react';

interface Signatory {
  id: string;
  name: string;
  cpf: string;
  company: string;
  cnpj: string;
  isDefault: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  installationValue: number;
  monthlyValue: number;
  isCustom: boolean;
}

interface Props { onClose: () => void; }

export default function ConfigModal({ onClose }: Props) {
  const [tab, setTab] = useState<'signatarios' | 'modelos'>('signatarios');
  const [msg, setMsg] = useState('');

  // Signatories
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loadingSig, setLoadingSig] = useState(true);
  const [sigForm, setSigForm] = useState({ name: '', cpf: '', company: '', cnpj: '' });
  const [savingSig, setSavingSig] = useState(false);
  const [deletingSigId, setDeletingSigId] = useState<string | null>(null);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [newTplForm, setNewTplForm] = useState({ name: '', description: '', installationValue: '', monthlyValue: '' });
  const [savingTpl, setSavingTpl] = useState(false);
  const [deletingTplId, setDeletingTplId] = useState<string | null>(null);
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', installationValue: '', monthlyValue: '' });

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  }

  useEffect(() => {
    fetch('/api/signatarios')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSignatories(data); })
      .catch(() => {})
      .finally(() => setLoadingSig(false));

    fetch('/api/templates')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTemplates(data); })
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
  }, []);

  function startEdit(t: Template) {
    setEditingTpl(t);
    setEditForm({
      name: t.name,
      description: t.description,
      installationValue: t.installationValue.toFixed(2).replace('.', ','),
      monthlyValue: t.monthlyValue.toFixed(2).replace('.', ','),
    });
  }

  async function saveEdit() {
    if (!editingTpl || !editForm.name) return;
    setSavingTpl(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTpl.id,
          name: editForm.name,
          description: editForm.description,
          installationValue: parseFloat(editForm.installationValue.replace(',', '.')) || 0,
          monthlyValue: parseFloat(editForm.monthlyValue.replace(',', '.')) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates(prev => prev.map(t => t.id === data.id ? data : t));
        setEditingTpl(null);
        flash('✅ Modelo atualizado');
      } else {
        flash(`❌ ${data.error || 'Erro ao salvar'}`);
      }
    } catch { flash('❌ Erro de conexão'); }
    setSavingTpl(false);
  }

  async function addSignatory() {
    if (!sigForm.name || !sigForm.cpf) return;
    setSavingSig(true);
    try {
      const res = await fetch('/api/signatarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sigForm),
      });
      const data = await res.json();
      if (res.ok) {
        setSignatories(prev => [...prev, data]);
        setSigForm({ name: '', cpf: '', company: '', cnpj: '' });
        flash('✅ Signatário adicionado');
      } else { flash(`❌ ${data.error || 'Erro ao adicionar'}`); }
    } catch { flash('❌ Erro de conexão'); }
    setSavingSig(false);
  }

  async function deleteSignatory(id: string) {
    if (!confirm('Remover este signatário?')) return;
    setDeletingSigId(id);
    try {
      const res = await fetch('/api/signatarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setSignatories(prev => prev.filter(s => s.id !== id)); flash('✅ Removido'); }
      else { const d = await res.json(); flash(`❌ ${d.error || 'Erro'}`); }
    } catch { flash('❌ Erro de conexão'); }
    setDeletingSigId(null);
  }

  async function addTemplate() {
    if (!newTplForm.name) return;
    setSavingTpl(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTplForm.name,
          description: newTplForm.description,
          installationValue: parseFloat(newTplForm.installationValue.replace(',', '.')) || 0,
          monthlyValue: parseFloat(newTplForm.monthlyValue.replace(',', '.')) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates(prev => [...prev, data]);
        setNewTplForm({ name: '', description: '', installationValue: '', monthlyValue: '' });
        flash('✅ Modelo adicionado');
      } else { flash(`❌ ${data.error || 'Erro'}`); }
    } catch { flash('❌ Erro de conexão'); }
    setSavingTpl(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Remover este modelo de contrato?')) return;
    setDeletingTplId(id);
    try {
      const res = await fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setTemplates(prev => prev.filter(t => t.id !== id)); flash('✅ Modelo removido'); }
      else { flash('❌ Erro ao remover'); }
    } catch { flash('❌ Erro de conexão'); }
    setDeletingTplId(null);
  }

  const inp = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    background: 'var(--bg-input)', color: 'var(--text-hi)',
    border: '1px solid var(--bg-border)', fontSize: 13, boxSizing: 'border-box' as const,
  };
  const lbl = { margin: '0 0 5px', fontSize: 12, fontWeight: 600 as const, color: 'var(--text-lo)' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ width: '100%', maxHeight: '92dvh', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-border)', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--text-hi)' }}>⚙️ Configurações</p>
            <button onClick={onClose} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--bg-border)', border: 'none', color: 'var(--text-lo)', cursor: 'pointer' }}>Fechar</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['signatarios', 'modelos'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setEditingTpl(null); }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: tab === t ? '#007AFF' : 'var(--bg-border)',
                  color: tab === t ? 'white' : 'var(--text-lo)' }}>
                {t === 'signatarios' ? '✍️ Signatários' : '📋 Modelos'}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div style={{ margin: '0 20px 10px', padding: '8px 14px', borderRadius: 10, fontSize: 13, textAlign: 'center', fontWeight: 600,
            background: msg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
            color: msg.startsWith('✅') ? '#34C759' : '#FF3B30',
            border: `1px solid ${msg.startsWith('✅') ? 'rgba(52,199,89,0.25)' : 'rgba(255,59,48,0.25)'}` }}>
            {msg}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>

          {/* ── SIGNATÁRIOS ── */}
          {tab === 'signatarios' && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-lo)', marginBottom: 10 }}>Signatários cadastrados</p>
              {loadingSig
                ? <div style={{ textAlign: 'center', padding: 20 }}><div style={{ width: 22, height: 22, border: '2px solid #007AFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {signatories.map(s => (
                      <div key={s.id} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-hi)' }}>{s.name}</p>
                            {s.isDefault && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,122,255,0.15)', color: '#007AFF', fontWeight: 700 }}>padrão</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-lo)' }}>CPF: {s.cpf}</p>
                          {s.company && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-lo)' }}>{s.company}{s.cnpj ? ` — ${s.cnpj}` : ''}</p>}
                        </div>
                        {!s.isDefault && (
                          <button onClick={() => deleteSignatory(s.id)} disabled={deletingSigId === s.id}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: deletingSigId === s.id ? 0.5 : 1, flexShrink: 0 }}>
                            🗑 Remover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
              }

              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-lo)', marginBottom: 10 }}>Adicionar signatário</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Nome completo *', key: 'name', placeholder: 'Ex: João da Silva' },
                  { label: 'CPF *', key: 'cpf', placeholder: '000.000.000-00' },
                  { label: 'Empresa', key: 'company', placeholder: 'Ex: Empresa Ltda' },
                  { label: 'CNPJ da empresa', key: 'cnpj', placeholder: '00.000.000/0001-00' },
                ].map(f => (
                  <div key={f.key}>
                    <p style={lbl}>{f.label}</p>
                    <input value={sigForm[f.key as keyof typeof sigForm]} onChange={e => setSigForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} style={inp} />
                  </div>
                ))}
                <button onClick={addSignatory} disabled={savingSig || !sigForm.name || !sigForm.cpf}
                  style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', cursor: sigForm.name && sigForm.cpf ? 'pointer' : 'not-allowed',
                    background: sigForm.name && sigForm.cpf ? '#007AFF' : 'var(--bg-border)',
                    color: sigForm.name && sigForm.cpf ? 'white' : 'var(--text-lo)', fontWeight: 700, fontSize: 14, opacity: savingSig ? 0.6 : 1 }}>
                  {savingSig ? 'Adicionando...' : '+ Adicionar signatário'}
                </button>
              </div>
            </>
          )}

          {/* ── MODELOS DE CONTRATO ── */}
          {tab === 'modelos' && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-lo)', marginBottom: 10 }}>Modelos disponíveis</p>

              {loadingTpl
                ? <div style={{ textAlign: 'center', padding: 20 }}><div style={{ width: 22, height: 22, border: '2px solid #007AFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {templates.map(t => (
                      <div key={t.id}>
                        <div style={{ padding: '12px 14px', borderRadius: editingTpl?.id === t.id ? '12px 12px 0 0' : 12, background: 'var(--bg-input)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-hi)' }}>{t.name}</p>
                              {!t.isCustom && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,122,255,0.15)', color: '#007AFF', fontWeight: 700 }}>padrão</span>}
                            </div>
                            {t.description && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-lo)' }}>{t.description}</p>}
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-lo)' }}>
                              Instalação: R$ {t.installationValue.toFixed(2).replace('.', ',')} &nbsp;|&nbsp; Mensalidade: R$ {t.monthlyValue.toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => editingTpl?.id === t.id ? setEditingTpl(null) : startEdit(t)}
                              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: editingTpl?.id === t.id ? 'rgba(255,149,0,0.15)' : 'rgba(0,122,255,0.1)', color: editingTpl?.id === t.id ? '#FF9500' : '#007AFF', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                              {editingTpl?.id === t.id ? '✕ Cancelar' : '✏️ Editar'}
                            </button>
                            {t.isCustom && (
                              <button onClick={() => deleteTemplate(t.id)} disabled={deletingTplId === t.id}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: deletingTplId === t.id ? 0.5 : 1 }}>
                                🗑
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {editingTpl?.id === t.id && (
                          <div style={{ padding: '14px', borderRadius: '0 0 12px 12px', background: 'var(--bg-input)', border: '1px solid var(--bg-border)', borderTop: '1px solid rgba(255,149,0,0.3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div>
                                <p style={lbl}>Nome do modelo</p>
                                <input value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} style={inp} />
                              </div>
                              <div>
                                <p style={lbl}>Descrição</p>
                                <input value={editForm.description} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Ex: Instalação R$80 + Mensalidade R$35" style={inp} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                  <p style={lbl}>Instalação (R$)</p>
                                  <input value={editForm.installationValue} onChange={e => setEditForm(prev => ({ ...prev, installationValue: e.target.value }))} inputMode="decimal" style={inp} />
                                </div>
                                <div>
                                  <p style={lbl}>Mensalidade (R$)</p>
                                  <input value={editForm.monthlyValue} onChange={e => setEditForm(prev => ({ ...prev, monthlyValue: e.target.value }))} inputMode="decimal" style={inp} />
                                </div>
                              </div>
                              <button onClick={saveEdit} disabled={savingTpl || !editForm.name}
                                style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#FF9500', color: 'white', fontWeight: 700, fontSize: 13, opacity: savingTpl ? 0.6 : 1 }}>
                                {savingTpl ? 'Salvando...' : '💾 Salvar alterações'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
              }

              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-lo)', marginBottom: 10 }}>Adicionar modelo personalizado</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={lbl}>Nome do modelo *</p>
                  <input value={newTplForm.name} onChange={e => setNewTplForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Ex: Rastreamento 120/45" style={inp} />
                </div>
                <div>
                  <p style={lbl}>Descrição (aparece no seletor)</p>
                  <input value={newTplForm.description} onChange={e => setNewTplForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Ex: Instalação R$120 + Mensalidade R$45" style={inp} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={lbl}>Valor instalação (R$)</p>
                    <input value={newTplForm.installationValue} onChange={e => setNewTplForm(prev => ({ ...prev, installationValue: e.target.value }))} placeholder="120,00" inputMode="decimal" style={inp} />
                  </div>
                  <div>
                    <p style={lbl}>Mensalidade (R$)</p>
                    <input value={newTplForm.monthlyValue} onChange={e => setNewTplForm(prev => ({ ...prev, monthlyValue: e.target.value }))} placeholder="45,00" inputMode="decimal" style={inp} />
                  </div>
                </div>
                <button onClick={addTemplate} disabled={savingTpl || !newTplForm.name}
                  style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', cursor: newTplForm.name ? 'pointer' : 'not-allowed',
                    background: newTplForm.name ? '#007AFF' : 'var(--bg-border)',
                    color: newTplForm.name ? 'white' : 'var(--text-lo)', fontWeight: 700, fontSize: 14, opacity: savingTpl ? 0.6 : 1 }}>
                  {savingTpl ? 'Adicionando...' : '+ Adicionar modelo'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
