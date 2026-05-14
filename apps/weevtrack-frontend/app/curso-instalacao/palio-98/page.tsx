'use client';

export default function Palio98Page() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; }
        .root { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #f8fafc; min-height: 100vh; }

        .header { background: linear-gradient(135deg, #0f172a 0%, #7c2d12 100%); color: white; padding: 40px 24px 36px; text-align: center; }
        .header .back { display: inline-flex; align-items: center; gap: 6px; color: #fca5a5; font-size: 13px; font-weight: 600; text-decoration: none; margin-bottom: 20px; }
        .header h1 { font-size: clamp(22px, 5vw, 36px); font-weight: 800; margin-bottom: 8px; }
        .header p { color: #fca5a5; font-size: 14px; max-width: 480px; margin: 0 auto 24px; line-height: 1.6; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 24px; }
        .chip { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 5px 13px; font-size: 12px; font-weight: 700; color: #fef3c7; }
        .print-btn { background: #b45309; color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .print-btn:hover { background: #92400e; }

        .body { max-width: 860px; margin: 0 auto; padding: 36px 20px 56px; }

        .section { margin-bottom: 40px; }
        .section-header { display: flex; align-items: center; gap: 12px; background: linear-gradient(90deg, #7c2d12, #b45309); color: white; padding: 12px 18px; border-radius: 10px; margin-bottom: 20px; }
        .section-num { width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0; }
        .section-header h2 { font-size: 16px; font-weight: 700; }

        h3 { font-size: 14px; font-weight: 700; color: #7c2d12; margin: 20px 0 8px; padding-left: 10px; border-left: 4px solid #b45309; }
        p { font-size: 14px; line-height: 1.65; color: #374151; margin-bottom: 10px; }
        ul, ol { padding-left: 20px; margin-bottom: 12px; }
        li { font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 5px; }

        .table-wrap { overflow-x: auto; margin: 12px 0 18px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #7c2d12; color: white; padding: 9px 13px; text-align: left; font-weight: 600; }
        td { padding: 8px 13px; border-bottom: 1px solid #e5e7eb; background: white; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #fafafa; }

        .box { border-radius: 10px; padding: 13px 15px; margin: 12px 0; font-size: 14px; line-height: 1.6; }
        .box-warn { background: #fffbeb; border-left: 5px solid #f59e0b; }
        .box-tip  { background: #fff7ed; border-left: 5px solid #b45309; }
        .box-ok   { background: #f0fdf4; border-left: 5px solid #22c55e; }
        .box-red  { background: #fff1f2; border-left: 5px solid #ef4444; }
        .box-title { font-weight: 700; margin-bottom: 4px; }

        .wire-list { display: flex; flex-direction: column; gap: 9px; margin: 12px 0; }
        .wire-row { display: flex; align-items: flex-start; gap: 12px; background: white; border-radius: 8px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
        .wire-dot { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; border: 2px solid rgba(0,0,0,0.12); }
        .wire-info strong { display: block; font-size: 13px; color: #111; margin-bottom: 2px; }
        .wire-info span { font-size: 13px; color: #6b7280; }

        .steps { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
        .step { display: flex; gap: 13px; background: white; border-radius: 10px; padding: 13px 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
        .step-num { width: 30px; height: 30px; background: #b45309; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0; }
        .step-body strong { display: block; font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 3px; }
        .step-body p { margin: 0; font-size: 13px; }
        .step-body ul { margin: 4px 0 0; }
        .step-body li { font-size: 13px; }

        .diagram { background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 18px; font-family: 'Courier New', monospace; font-size: 11.5px; line-height: 2; margin: 14px 0; overflow-x: auto; white-space: pre; }

        .checklist-card { background: white; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
        .check-section { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #b45309; margin: 14px 0 7px; }
        .check-item { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151; }
        .check-item:last-child { border-bottom: none; }
        .check-box { width: 17px; height: 17px; border: 2px solid #d1d5db; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }

        .ficha { border: 2px solid #b45309; border-radius: 12px; padding: 22px; background: white; }
        .ficha-header { background: #7c2d12; color: white; margin: -22px -22px 18px; padding: 13px 22px; border-radius: 10px 10px 0 0; font-weight: 700; font-size: 15px; text-align: center; }
        .ficha-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
        @media(max-width:500px){ .ficha-fields { grid-template-columns: 1fr; } }
        .field-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .field-line { border-bottom: 2px solid #e5e7eb; height: 26px; }

        .footer { text-align: center; padding: 28px 20px; color: #94a3b8; font-size: 13px; background: #0f172a; }
        .footer a { color: #fdba74; text-decoration: none; }

        @media print {
          body { background: white !important; }
          .root { background: white; }
          .header { background: #7c2d12 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-btn, .back { display: none !important; }
          .section { page-break-inside: avoid; }
          .diagram { background: #f1f5f9 !important; color: #1e293b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .footer { background: white; color: #666; }
        }
      `}</style>

      <div className="root">

        {/* HEADER */}
        <div className="header">
          <a className="back" href="/curso-instalacao">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar ao curso completo
          </a>
          <h1>🚗 Fiat Palio 1998<br/>1.0 Básico 4 Portas Manual</h1>
          <p>Guia específico de instalação de rastreador com bloqueio na ignição via tap connectors — sem cortar fio.</p>
          <div className="chips">
            <span className="chip">📦 J16 / SL28 / SL44</span>
            <span className="chip">⚡ Relé 12V 40A</span>
            <span className="chip">🔌 Tap Connectors</span>
            <span className="chip">✂️ Sem cortar fio</span>
          </div>
          <button className="print-btn" onClick={() => window.print()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir / Salvar PDF
          </button>
        </div>

        <div className="body">

          {/* SEÇÃO 1 — LOCALIZAÇÃO */}
          <div className="section">
            <div className="section-header">
              <div className="section-num">1</div>
              <h2>Onde Ficam os Pontos no Palio 98</h2>
            </div>

            <div className="box box-tip">
              <div className="box-title">🚗 Palio 98 — características elétricas</div>
              Sistema 12V negativo. Motor Fire 1.0 com injeção Magneti Marelli IAW. Fiação simples — um dos carros mais fáceis para instalar rastreador. Painel desmonta só com espatula plástica.
            </div>

            <h3>Caixa de Fusíveis</h3>
            <p>Localizada <strong>embaixo do painel, lado do motorista</strong>, próxima à coluna de direção. Tampa preta com encaixe de pressão — abre com a mão ou espatula plástica.</p>

            <h3>Rádio de Fábrica</h3>
            <p>Para acessar: espatula plástica na moldura → puxa → 4 parafusos Phillips no suporte → desliza o rádio para fora. Os fios de alimentação ficam no conector traseiro.</p>

            <h3>Chave de Ignição (coluna de direção)</h3>
            <p>Conector de 4 vias atrás da chave. Acessível removendo a capa plástica da coluna (2 parafusos Phillips embaixo).</p>
          </div>

          {/* SEÇÃO 2 — FIOS */}
          <div className="section">
            <div className="section-header">
              <div className="section-num">2</div>
              <h2>Identificação dos Fios — Confirme Sempre com Multímetro</h2>
            </div>

            <div className="wire-list">
              <div className="wire-row">
                <div className="wire-dot" style={{background:'#dc2626'}}/>
                <div className="wire-info">
                  <strong>VERMELHO → VCC (positivo constante)</strong>
                  <span>Fio vermelho do conector traseiro do rádio de fábrica. Confirmar: 12V com chave fora E com chave ligada.</span>
                </div>
              </div>
              <div className="wire-row">
                <div className="wire-dot" style={{background:'#111827'}}/>
                <div className="wire-info">
                  <strong>PRETO → GND (massa)</strong>
                  <span>Parafuso da coluna A — lateral esquerda do para-brisa, embaixo do painel. Fixar com terminal de olhal.</span>
                </div>
              </div>
              <div className="wire-row">
                <div className="wire-dot" style={{background:'#ca8a04'}}/>
                <div className="wire-info">
                  <strong>AMARELO → ACC (ignição) — o mais importante</strong>
                  <span>Fio amarelo/preto ou vermelho/azul do conector do rádio de fábrica. Confirmar: 0V com chave OFF e 12V com chave ON.</span>
                </div>
              </div>
            </div>

            <h3>Conector da Chave de Ignição (alternativa para o ACC)</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pino</th><th>Cor típica no Palio 98</th><th>Função</th><th>Uso</th></tr></thead>
                <tbody>
                  <tr><td>30</td><td>Vermelho ou Branco</td><td>+12V constante</td><td>VCC (alternativa)</td></tr>
                  <tr><td style={{background:'#fef9c3'}}><strong>15</strong></td><td style={{background:'#fef9c3'}}><strong>Vermelho/Azul ou Amarelo</strong></td><td style={{background:'#fef9c3'}}><strong>ACC — chave ON</strong></td><td style={{background:'#fef9c3'}}><strong>← Use este para ACC e bloqueio</strong></td></tr>
                  <tr><td>50</td><td>Verde ou Cinza</td><td>Partida (momentâneo)</td><td>Não usar</td></tr>
                  <tr><td>31</td><td>Preto</td><td>Massa</td><td>GND (alternativa)</td></tr>
                </tbody>
              </table>
            </div>

            <div className="box box-warn">
              <div className="box-title">⚠️ Cores podem variar entre lotes</div>
              O Palio 98 teve vários lotes e fornecedores. Sempre confirme com multímetro antes de usar qualquer tap connector. Regra: <strong>0V com chave fora = ACC</strong>.
            </div>
          </div>

          {/* SEÇÃO 3 — BLOQUEIO */}
          <div className="section">
            <div className="section-header">
              <div className="section-num">3</div>
              <h2>Bloqueio na Ignição — Tap Connectors, Sem Cortar Fio</h2>
            </div>

            <div className="box box-ok">
              <div className="box-title">✅ Como funciona este método no Palio 98</div>
              Dois tap connectors são colocados no fio ACC (pino 15 da ignição), com ~15 cm de distância entre eles. O relé fica em série entre os dois taps. Com o bloqueio ativo, o relé abre o contato e a corrente não chega ao módulo de injeção — o carro não pega.
            </div>

            <h3>Diagrama de ligação</h3>
            <div className="diagram">{`FIO ACC DO PALIO 98 (pino 15 da ignição / fio do rádio)
────────────────────────────────────────────────────────────────

  [FONTE: bateria/ignição]                [DESTINO: módulo Magneti Marelli]
         │                                          │
       TAP 1  ─────────────────────────────────  TAP 2
         │                                          │
      Pino 30                                   Pino 87a
         └──────────── RELÉ 12V 40A ──────────────┘
                       Pino 86 ← fio BRANCO (rastreador)
                       Pino 85 → MASSA (chassi)

────────────────────────────────────────────────────────────────
Normal:   TAP1 → pino 30 → pino 87a → TAP2 → módulo OK ✓
Bloqueio: relé ativa → 87a abre → módulo sem sinal → não pega ✗`}</div>

            <h3>Passo a passo da instalação</h3>
            <div className="steps">
              {[
                {
                  n: '1', title: 'Desmonte o painel lateral esquerdo',
                  body: 'Espátula plástica nas bordas, encaixes de pressão um a um. Não force — vai na sequência.',
                },
                {
                  n: '2', title: 'Localize o fio ACC e confirme com multímetro',
                  body: 'Melhor ponto: conector traseiro do rádio (fio amarelo/preto ou vermelho/azul). Chave OFF = 0V ✓ | Chave ON = 12V ✓. Se não achar, use o pino 15 do conector da chave de ignição.',
                },
                {
                  n: '3', title: 'Marque dois pontos no fio ACC com 15 cm de distância',
                  body: 'Ponto A: mais próximo da fonte (lado da bateria). Ponto B: mais próximo da carga (módulo de injeção). Esses 15 cm são onde o relé vai ficar "em série".',
                },
                {
                  n: '4', title: 'Instale o TAP 1 no ponto A',
                  body: 'Coloque o tap connector. Aperte completamente até o metal perfurar o fio (ouvirá um clique). O fio saindo vai para o pino 30 do relé.',
                },
                {
                  n: '5', title: 'Instale o TAP 2 no ponto B',
                  body: 'Mesmo procedimento. O fio saindo vai para o pino 87a do relé.',
                },
                {
                  n: '6', title: 'Conecte os fios de controle ao rastreador',
                  body: 'Fio BRANCO do rastreador → pino 86 do relé. Fio VERDE do rastreador → pino 85 → parafuso de massa.',
                },
                {
                  n: '7', title: 'Fixe e isole tudo',
                  body: 'Zip-tie no relé junto ao feixe de fios. Fita automotiva em cada tap e em cada emenda. Nenhum metal exposto.',
                },
                {
                  n: '8', title: 'Recoloque o painel e teste',
                  body: 'Feche o painel, reconecte a bateria, aguarde 5 min e siga o checklist abaixo.',
                },
              ].map((s) => (
                <div key={s.n} className="step">
                  <div className="step-num">{s.n}</div>
                  <div className="step-body">
                    <strong>{s.title}</strong>
                    <p>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="box box-red" style={{marginTop: 16}}>
              <div className="box-title">🔴 Atenção ao sentido dos taps</div>
              TAP 1 (pino 30) SEMPRE do lado da fonte (bateria). TAP 2 (pino 87a) do lado da carga (módulo). Invertido, o bloqueio não funciona.
            </div>
          </div>

          {/* SEÇÃO 4 — CHECKLIST */}
          <div className="section">
            <div className="section-header">
              <div className="section-num">4</div>
              <h2>Checklist de Testes — Palio 98</h2>
            </div>

            <p style={{marginBottom:14}}>Aguarde <strong>5 minutos</strong> após reconectar a bateria antes de testar.</p>
            <div className="checklist-card">
              <div className="check-section">Conexão e GPS</div>
              {['Dispositivo Online no WeevTrack', 'Posição GPS correta no mapa', 'Velocidade 0 km/h com carro parado'].map(t=>(
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}
              <div className="check-section">Ignição</div>
              {['Chave OFF → mostra "Desligado" no WeevTrack','Chave ON → mostra "Ligado" no WeevTrack','Alerta "Motor Ligado" recebido (aguardar ~1 min)','Alerta "Motor Desligado" recebido'].map(t=>(
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}
              <div className="check-section">Bloqueio</div>
              {['Comando de bloqueio enviado pelo WeevTrack','Tentativa de dar partida: carro NÃO pegou ✓','Desbloqueio enviado → carro voltou a funcionar ✓'].map(t=>(
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}
              <div className="check-section">Acabamento</div>
              {['Todos os taps cobertos com fita automotiva','Relé fixo com zip-tie','Painel recolocado sem folgas'].map(t=>(
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}
            </div>
          </div>

          {/* SEÇÃO 5 — FICHA */}
          <div className="section">
            <div className="section-header">
              <div className="section-num">5</div>
              <h2>Ficha de Campo — Palio 98</h2>
            </div>

            <div className="ficha">
              <div className="ficha-header">📋 FICHA DE INSTALAÇÃO — FIAT PALIO 98 1.0 — WEEVTRACK</div>

              <div className="ficha-fields">
                {['Cliente','Data','Placa','IMEI do rastreador','Ponto do ACC usado','Tensão ACC medida (on)'].map(f=>(
                  <div key={f}>
                    <div className="field-label">{f}</div>
                    <div className="field-line"/>
                  </div>
                ))}
              </div>

              {[
                { s: 'Confirmação de fios', items: ['VCC constante confirmado: _____ V','Massa confirmada (continuidade OK)','ACC confirmado: 0V (off) / _____ V (on)'] },
                { s: 'Instalação', items: ['Bateria desconectada','GND fixado com terminal de olhal','Fusível 1A no fio vermelho','VCC conectado','ACC conectado','TAP 1 e TAP 2 instalados no fio de ignição','Relé conectado e fixado com zip-tie','Todos os taps cobertos com fita automotiva','Painel recolocado'] },
                { s: 'Testes', items: ['Online no WeevTrack','Ignição OFF = Desligado ✓','Ignição ON = Ligado ✓','Bloqueio: não pegou ✓','Desbloqueio: funcionou ✓'] },
              ].map(sec=>(
                <div key={sec.s}>
                  <div className="check-section">{sec.s}</div>
                  <div style={{background:'#f8fafc', borderRadius:8, padding:'4px 10px'}}>
                    {sec.items.map(item=>(
                      <div key={item} className="check-item"><div className="check-box"/><span>{item}</span></div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{marginTop:16}}>
                <div className="field-label">Observações</div>
                <div style={{border:'1px solid #e5e7eb', borderRadius:8, height:50}}/>
              </div>

              <div className="ficha-fields" style={{marginTop:18}}>
                <div><div className="field-label">Assinatura do instalador</div><div className="field-line"/></div>
                <div><div className="field-label">Assinatura do cliente</div><div className="field-line"/></div>
              </div>
            </div>
          </div>

        </div>

        <div className="footer">
          <p>WeevTrack — Instalação Fiat Palio 98 1.0</p>
          <p style={{marginTop:6}}>
            <a href="/curso-instalacao">← Voltar ao curso completo</a>
            &nbsp;·&nbsp;
            <a href="https://app.weevtrack.com">app.weevtrack.com</a>
          </p>
        </div>

      </div>
    </>
  );
}
