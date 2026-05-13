'use client';

export default function CursoInstalacaoPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #0f172a; }

        .curso-root {
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
          color: #1e293b;
          background: #f8fafc;
          min-height: 100vh;
        }

        /* HEADER */
        .curso-header {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: white;
          padding: 48px 24px 40px;
          text-align: center;
          position: relative;
        }
        .curso-header .badge {
          display: inline-block;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50px;
          padding: 5px 16px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          margin-bottom: 16px;
          color: #93c5fd;
        }
        .curso-header h1 {
          font-size: clamp(24px, 5vw, 40px);
          font-weight: 800;
          line-height: 1.15;
          margin-bottom: 10px;
        }
        .curso-header p {
          font-size: 15px;
          color: #93c5fd;
          max-width: 520px;
          margin: 0 auto 24px;
          line-height: 1.6;
        }
        .modelo-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-bottom: 28px;
        }
        .modelo-chip {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 700;
          color: #e0f2fe;
        }
        .print-btn {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 11px 22px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s;
        }
        .print-btn:hover { background: #2563eb; }

        /* LAYOUT */
        .curso-body {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px 60px;
        }

        /* MÓDULOS */
        .module { margin-bottom: 48px; }
        .module-header {
          display: flex;
          align-items: center;
          gap: 14px;
          background: linear-gradient(90deg, #1e3a8a, #1d4ed8);
          color: white;
          padding: 14px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .module-num {
          width: 36px; height: 36px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px;
          flex-shrink: 0;
        }
        .module-header h2 { font-size: 18px; font-weight: 700; }

        h3 {
          font-size: 15px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 24px 0 10px;
          padding-left: 12px;
          border-left: 4px solid #3b82f6;
        }
        h4 { font-size: 13px; font-weight: 700; color: #374151; margin: 14px 0 6px; }
        p { font-size: 14px; line-height: 1.65; color: #374151; margin-bottom: 10px; }
        ul, ol { padding-left: 20px; margin-bottom: 12px; }
        li { font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 5px; }

        /* TABELAS */
        .table-wrap { overflow-x: auto; margin: 12px 0 20px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #1e3a8a; color: white; padding: 10px 14px; text-align: left; font-weight: 600; }
        th:first-child { border-radius: 0; }
        td { padding: 9px 14px; border-bottom: 1px solid #e5e7eb; background: white; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #f8fafc; }

        /* BOXES */
        .box { border-radius: 10px; padding: 14px 16px; margin: 14px 0; font-size: 14px; line-height: 1.6; }
        .box-warn { background: #fffbeb; border-left: 5px solid #f59e0b; }
        .box-tip  { background: #eff6ff; border-left: 5px solid #3b82f6; }
        .box-ok   { background: #f0fdf4; border-left: 5px solid #22c55e; }
        .box-red  { background: #fff1f2; border-left: 5px solid #ef4444; }
        .box-title { font-weight: 700; margin-bottom: 5px; font-size: 14px; }

        /* FIOS */
        .wire-list { display: flex; flex-direction: column; gap: 10px; margin: 14px 0; }
        .wire-row { display: flex; align-items: flex-start; gap: 12px; background: white; border-radius: 8px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
        .wire-dot { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; margin-top: 1px; border: 2px solid rgba(0,0,0,0.12); }
        .wire-info strong { display: block; font-size: 13px; color: #111; margin-bottom: 2px; }
        .wire-info span { font-size: 13px; color: #6b7280; }

        /* STEPS */
        .steps { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
        .step { display: flex; gap: 14px; align-items: flex-start; background: white; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
        .step-num { width: 32px; height: 32px; background: #1e40af; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0; }
        .step-body strong { display: block; font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 3px; }
        .step-body p { margin-bottom: 0; font-size: 13px; }

        /* RELAY DIAGRAM */
        .relay-diagram {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 10px;
          padding: 20px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.9;
          margin: 16px 0;
          overflow-x: auto;
          white-space: pre;
        }

        /* ERRORS GRID */
        .error-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .error-card { background: white; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        @media(max-width:600px){ .error-card { grid-template-columns: 1fr; } }
        .error-col-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 4px; }
        .error-col p { margin: 0; font-size: 13px; }

        /* CHECKLIST */
        .checklist-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .checklist-section { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #3b82f6; margin: 16px 0 8px; }
        .check-item { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151; }
        .check-item:last-child { border-bottom: none; }
        .check-box { width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; flex-shrink: 0; margin-top: 1px; }

        /* FICHA */
        .ficha { border: 2px solid #1e3a8a; border-radius: 12px; padding: 24px; background: white; }
        .ficha-header { background: #1e3a8a; color: white; margin: -24px -24px 20px; padding: 14px 24px; border-radius: 10px 10px 0 0; font-weight: 700; font-size: 16px; text-align: center; }
        .ficha-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
        @media(max-width:500px){ .ficha-fields { grid-template-columns: 1fr; } }
        .ficha-field label { display: block; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .ficha-field .field-line { border-bottom: 2px solid #e5e7eb; height: 28px; }

        /* FOOTER */
        .curso-footer { text-align: center; padding: 32px 20px; color: #94a3b8; font-size: 13px; background: #0f172a; }
        .curso-footer a { color: #60a5fa; text-decoration: none; }

        /* PRINT */
        @media print {
          body { background: white !important; }
          .curso-root { background: white; }
          .curso-header { background: #1e3a8a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-btn { display: none !important; }
          .module { page-break-inside: avoid; }
          .curso-footer { background: white; color: #666; }
          .relay-diagram { background: #f1f5f9 !important; color: #1e293b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="curso-root">

        {/* HEADER */}
        <div className="curso-header">
          <div className="badge">📍 WeevTrack — Guia Técnico</div>
          <h1>Curso Prático de Instalação<br/>de Rastreadores</h1>
          <p>Guia completo para instaladores. Conecte, teste e configure com segurança.</p>
          <div className="modelo-chips">
            <span className="modelo-chip">📦 J16</span>
            <span className="modelo-chip">📦 SL28</span>
            <span className="modelo-chip">📦 SL44</span>
            <span className="modelo-chip">⚡ Relé 12V 40A</span>
          </div>
          <button className="print-btn" onClick={() => window.print()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir / Salvar PDF
          </button>
        </div>

        <div className="curso-body">

          {/* MÓDULO 1 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">1</div>
              <h2>Componentes e Pinagem</h2>
            </div>

            <h3>1.1 — O que você vai usar</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Item</th><th>Modelo</th><th>Função</th></tr></thead>
                <tbody>
                  <tr><td>📡 Rastreador</td><td>J16 / SL28 / SL44</td><td>GPS + GSM 4G — envia posição para o WeevTrack</td></tr>
                  <tr><td>⚡ Relé</td><td>12V 40A (Sucre Lee)</td><td>Interrompe o circuito de ignição no bloqueio remoto</td></tr>
                  <tr><td>🔌 Soquete do relé</td><td>4/5 terminais</td><td>Suporte com fios pré-soldados</td></tr>
                  <tr><td>🔧 Harness</td><td>Fios coloridos</td><td>Cabagem de alimentação e sinal do rastreador</td></tr>
                </tbody>
              </table>
            </div>

            <h3>1.2 — Pinagem dos rastreadores (J16 / SL28 / SL44)</h3>
            <div className="box box-tip">
              <div className="box-title">ℹ️ Os três modelos usam a mesma pinagem padrão</div>
              A cor dos fios pode variar entre lotes. Sempre confirme com multímetro.
            </div>

            <div className="wire-list">
              {[
                { color: '#dc2626', label: 'VERMELHO — VCC', desc: 'Positivo constante +12V. Fica com tensão mesmo com o carro desligado.' },
                { color: '#111827', label: 'PRETO — GND', desc: 'Massa / Terra. Conectar num parafuso metálico do chassi.' },
                { color: '#ca8a04', label: 'AMARELO — ACC', desc: 'Detecção de ignição. Recebe +12V somente com a chave ligada. Fio mais crítico.' },
                { color: '#ea580c', label: 'LARANJA — INPUT', desc: 'Entrada digital opcional (sensor de porta, botão de pânico). Deixe isolado se não usar.' },
                { color: '#f9fafb', label: 'BRANCO — RELAY +', desc: 'Saída positiva para acionar a bobina do relé de bloqueio.' },
                { color: '#16a34a', label: 'VERDE — RELAY –', desc: 'Saída negativa da bobina do relé de bloqueio.' },
              ].map((w) => (
                <div key={w.label} className="wire-row">
                  <div className="wire-dot" style={{ background: w.color }} />
                  <div className="wire-info">
                    <strong>{w.label}</strong>
                    <span>{w.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <h3>1.3 — Terminais do relé 12V 40A</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Terminal</th><th>Nome</th><th>Função na instalação</th></tr></thead>
                <tbody>
                  <tr><td><strong>85</strong></td><td>Bobina (–)</td><td>Negativo da bobina → conecta na massa (GND)</td></tr>
                  <tr><td><strong>86</strong></td><td>Bobina (+)</td><td>Sinal de acionamento → fio BRANCO do rastreador</td></tr>
                  <tr><td><strong>30</strong></td><td>Comum</td><td>Entrada — vem do +12V que alimentava a ignição</td></tr>
                  <tr><td><strong>87a</strong></td><td>Normalmente fechado (NC)</td><td>Saída normal → vai para a ignição do veículo</td></tr>
                  <tr><td><strong>87</strong></td><td>Normalmente aberto (NO)</td><td>Não usar — deixe isolado</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* MÓDULO 2 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">2</div>
              <h2>Ferramentas e Preparação</h2>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Ferramenta</th><th>Para que serve</th><th>Obs.</th></tr></thead>
                <tbody>
                  <tr><td>📏 Multímetro digital</td><td>Identificar e confirmar fios</td><td><strong>Indispensável — sem ele não instale</strong></td></tr>
                  <tr><td>🔧 Alicate de crimpagem</td><td>Fixar terminais e tap connectors</td><td>Com terminais isolados sortidos</td></tr>
                  <tr><td>🔌 Conectores IDC (tap)</td><td>Derivar fios sem cortar</td><td>Evite fios torcidos sem isolamento</td></tr>
                  <tr><td>🔩 Chaves Phillips + Torx</td><td>Remover painéis</td><td>Conjunto T10 a T30</td></tr>
                  <tr><td>🪖 Espátulas plásticas</td><td>Abrir painéis sem arranhar</td><td>Kit com 5 peças</td></tr>
                  <tr><td>🔵 Fita isolante + fita automotiva</td><td>Proteger conexões</td><td>Fita automotiva não afrouxa com calor</td></tr>
                  <tr><td>🔗 Zip-ties</td><td>Fixar cablagem</td><td>Pack 100 unidades</td></tr>
                </tbody>
              </table>
            </div>

            <div className="box box-red">
              <div className="box-title">🚫 Antes de qualquer conexão: desconecte o negativo da bateria</div>
              Curto durante a instalação pode queimar o rastreador ou a central do veículo. Só reconecte a bateria na hora de testar.
            </div>
          </div>

          {/* MÓDULO 3 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">3</div>
              <h2>Identificando os Fios no Veículo</h2>
            </div>

            <div className="box box-warn">
              <div className="box-title">⚠️ Este módulo é o mais importante</div>
              Conexão errada no fio ACC é a causa número 1 de problemas (ignição invertida, notificações erradas). Confirme sempre com o multímetro nas duas posições da chave.
            </div>

            <h3>3.1 — Positivo Constante (+12V sempre ativo)</h3>
            <p>Tem tensão o tempo todo — mesmo com chave fora e carro desligado.</p>
            <h4>Onde encontrar:</h4>
            <ul>
              <li>Fusível de memória do rádio / relógio na caixa de fusíveis</li>
              <li>Fio vermelho atrás do rádio (positivo da central de som)</li>
              <li>Direto da bateria com fusível in-line (opção mais segura)</li>
            </ul>
            <h4>Confirmar com multímetro (VDC 20V):</h4>
            <ul>
              <li>Chave <strong>desligada</strong>: deve marcar <strong>12V a 14V</strong> ✓</li>
              <li>Chave <strong>ligada</strong>: deve marcar <strong>12V a 14V</strong> ✓</li>
            </ul>

            <h3>3.2 — Massa / GND</h3>
            <p>Qualquer parafuso que toque na estrutura metálica do chassi.</p>
            <ul>
              <li>Parafuso da coluna A (lateral do para-brisa) — excelente ponto</li>
              <li>Parafusos embaixo do painel do passageiro</li>
            </ul>
            <p><strong>Confirmação:</strong> continuidade entre o ponto e o negativo da bateria (multímetro em buzzer/continuidade).</p>

            <h3>3.3 — Fio ACC (ignição) — confirme SEMPRE com multímetro</h3>
            <p>Recebe +12V <em>somente</em> com a chave na posição ON ou acessórios.</p>
            <h4>Melhores locais:</h4>
            <ul>
              <li><strong>Fio de alimentação do rádio / DVD</strong> — o rádio só liga com a chave, mesma origem que o ACC</li>
              <li>Posição "ACC" na caixa de fusíveis (muitos carros têm etiqueta)</li>
              <li>Fios atrás da chave de ignição (coluna de direção)</li>
            </ul>
            <h4>Confirmação obrigatória (VDC 20V, negativo na massa):</h4>
            <ul>
              <li>Chave <strong>OFF</strong> → deve marcar <strong>0V</strong> ✓</li>
              <li>Chave <strong>ON</strong> → deve marcar <strong>12V</strong> ✓</li>
              <li>Se marcar 12V com chave OFF → não é ACC, é positivo constante — procure outro ponto ✗</li>
            </ul>

            <div className="box box-red">
              <div className="box-title">🔴 Causa clássica de ignição invertida</div>
              Se o ACC for conectado num ponto que funciona ao contrário (12V com chave off), o rastreador reporta "Motor Ligado" quando o carro está desligado. Confirme com multímetro nas <strong>duas</strong> posições da chave antes de usar o tap connector.
            </div>
          </div>

          {/* MÓDULO 4 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">4</div>
              <h2>Passo a Passo da Instalação</h2>
            </div>

            <div className="steps">
              {[
                { n: 1, title: 'Desconecte o negativo da bateria', body: 'Chave 10mm. Afaste o cabo para não encostar no terminal.' },
                { n: 2, title: 'Confirme os 3 fios com o multímetro', body: 'VCC constante, GND e ACC — não avance sem confirmar os três (ver Módulo 3).' },
                { n: 3, title: 'Escolha o local de fixação do rastreador', body: 'Preferência: atrás do painel do passageiro ou embaixo do banco. Deve ser coberto e sem calor excessivo. Antena GPS precisa de visão para cima — evite chapas metálicas acima.' },
                { n: 4, title: 'Passe os fios discretamente', body: 'Use canaletas e passagens existentes. Prenda com zip-ties a cada 15–20 cm. Deixe folga nas conexões para não esticar.' },
                { n: 5, title: 'Conecte o GND (fio preto)', body: 'Terminal de olhal num parafuso do chassi. Aperte bem — má conexão de massa é a causa nº 1 de instabilidade.' },
                { n: 6, title: 'Instale fusível in-line 1A no fio vermelho', body: 'Antes de conectar no positivo constante, coloque porta-fusível in-line com fusível 1A. Protege o rastreador contra curto.' },
                { n: 7, title: 'Conecte o VCC (fio vermelho)', body: 'Tap connector no positivo constante identificado. Ou derive de um fusível com add-a-fuse.' },
                { n: 8, title: 'Conecte o ACC (fio amarelo)', body: 'Tap connector no fio de ignição confirmado. Use o tap com cuidado: aperte completamente até o metal perfurar o fio.' },
                { n: 9, title: 'Instale o relé de bloqueio (se solicitado)', body: 'Veja Módulo 5 completo.' },
                { n: 10, title: 'Proteja todas as conexões', body: 'Fita isolante em cada tap, depois fita automotiva. Prenda tudo com zip-ties. Nenhum fio exposto.' },
                { n: 11, title: 'Recoloque o painel e reconecte a bateria', body: 'Encaixe todos os clipes. Reconecte o negativo da bateria.' },
                { n: 12, title: 'Aguarde 5 minutos e execute o checklist (Módulo 6)', body: 'O rastreador precisa de tempo para conectar ao servidor e fixar sinal GPS.' },
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
          </div>

          {/* MÓDULO 5 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">5</div>
              <h2>Bloqueio na Ignição — Sem Cortar Fios</h2>
            </div>

            <div className="box box-tip">
              <div className="box-title">💡 Como funciona este método</div>
              O relé é inserido em série no fio de alimentação da ignição usando dois tap connectors. Nenhum fio é cortado — o tap perfura o isolamento e deriva a corrente. Quando o WeevTrack envia o comando de bloqueio, o relé abre o circuito e o carro não dá partida.
            </div>

            <h3>5.1 — Diagrama de ligação (bloqueio na ignição)</h3>
            <div className="relay-diagram">{`RASTREADOR                    RELÉ 12V 40A                    VEÍCULO
─────────────────────────────────────────────────────────────────────

Fio BRANCO (relay+) ─────────► Pino 86 (bobina +)
Fio VERDE  (relay–) ─────────► Pino 85 (bobina –) ─────────► MASSA

                                Pino 30 (entrada) ◄── TAP no fio ACC
                                                      (antes da ignição)

                                Pino 87a (NC) ──────────────► TAP no mesmo
                                                              fio ACC
                                                              (após a ignição)

─────────────────────────────────────────────────────────────────────
LÓGICA: Sem bloqueio → pino 30 → 87a → corrente chega na ignição ✓
        Com bloqueio → relé ativa → 87a abre → ignição sem sinal ✗`}</div>

            <h3>5.2 — Passo a passo do relé (sem cortar fio)</h3>
            <div className="steps">
              <div className="step">
                <div className="step-num">A</div>
                <div className="step-body">
                  <strong>Localize o fio ACC que alimenta a bobina de ignição ou o módulo de injeção</strong>
                  <p>Geralmente é o mesmo fio ACC já identificado no Módulo 3. Confirme que é o fio que vai direto para a chave ou módulo de partida.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">B</div>
                <div className="step-body">
                  <strong>Instale o primeiro tap connector no fio ACC (ponto 1)</strong>
                  <p>Conecte o fio que vai ao pino 30 do relé. Este tap fica mais próximo da fonte de sinal (antes da ignição). Não corte o fio original.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">C</div>
                <div className="step-body">
                  <strong>Instale o segundo tap connector no mesmo fio ACC (ponto 2), a 10–15 cm de distância</strong>
                  <p>Conecte o fio que vem do pino 87a do relé. Este tap fica do lado da ignição (depois do ponto 1 no sentido da corrente).</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">D</div>
                <div className="step-body">
                  <strong>Conecte os fios de controle do relé ao rastreador</strong>
                  <p>Fio BRANCO do rastreador → pino 86 do relé. Fio VERDE → pino 85 → massa do chassi.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">E</div>
                <div className="step-body">
                  <strong>Fixe o relé e isole tudo</strong>
                  <p>Prenda o relé com zip-tie. Cubra cada tap connector com fita automotiva. Nenhuma parte metálica exposta.</p>
                </div>
              </div>
            </div>

            <div className="box box-warn">
              <div className="box-title">⚠️ Por que dois taps no mesmo fio funcionam como bloqueio?</div>
              O relé fica em série: pino 30 recebe o sinal de um ponto do fio, pino 87a entrega para o próximo ponto. Quando o relé está desativado (normal), o circuito fecha por dentro do relé e a corrente passa normalmente. Quando ativado, o contato 87a abre e a corrente não chega à ignição — mesmo sem cortar o fio original.
            </div>

            <div className="box box-red">
              <div className="box-title">🔴 Atenção ao sentido dos taps</div>
              O tap do pino 30 deve ficar do lado da <strong>fonte</strong> (bateria / ACC) e o tap do pino 87a do lado da <strong>carga</strong> (ignição / módulo). Se invertido, o bloqueio não funciona.
            </div>
          </div>

          {/* MÓDULO 6 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">6</div>
              <h2>Checklist de Testes</h2>
            </div>
            <p style={{marginBottom: 16}}>Aguarde <strong>5 minutos</strong> após reconectar a bateria.</p>

            <div className="checklist-card">
              <div className="checklist-section">GPS e Conexão</div>
              {['Dispositivo aparece Online no WeevTrack', 'Posição GPS correta no mapa (erro menor que 50m)', 'Velocidade marcando 0 km/h com carro parado'].map(t => (
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}

              <div className="checklist-section">Ignição</div>
              {[
                'Chave OFF → ignição mostra "Desligado" no WeevTrack',
                'Chave ON → ignição mostra "Ligado" no WeevTrack',
                'Alerta "Motor Ligado" recebido ao ligar (aguardar ~1 min)',
                'Alerta "Motor Desligado" recebido ao desligar (aguardar ~1 min)',
              ].map(t => (
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}

              <div className="checklist-section">Bloqueio (se instalado)</div>
              {[
                'Comando de bloqueio enviado pelo WeevTrack',
                'Carro não deu partida após bloqueio',
                'Desbloqueio testado — carro voltou a funcionar normalmente',
              ].map(t => (
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}

              <div className="checklist-section">Acabamento</div>
              {[
                'Todos os fios isolados com fita automotiva',
                'Cablagem presa com zip-ties',
                'Painéis recolocados sem folgas ou clipes quebrados',
              ].map(t => (
                <div key={t} className="check-item"><div className="check-box"/><span>{t}</span></div>
              ))}
            </div>

            <div className="box box-red" style={{marginTop: 16}}>
              <div className="box-title">🔴 Ignição invertida? (Ligado = Desligado)</div>
              O fio ACC está no ponto errado. Remova o tap, encontre outro ponto de ACC no veículo e confirme: <strong>0V com chave OFF / 12V com chave ON</strong>.
            </div>
          </div>

          {/* MÓDULO 7 */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">7</div>
              <h2>Erros Comuns e Soluções</h2>
            </div>

            <div className="error-grid">
              {[
                { err: 'ACC no ponto errado', sint: 'Ignição invertida — ligado aparece como desligado', sol: 'Confirmar com multímetro: 0V off / 12V on — mudar o tap de ponto' },
                { err: 'Massa mal fixada ou enferrujada', sint: 'Rastreador reinicia, GPS instável, offline frequente', sol: 'Apertar parafuso, lixar a superfície, usar terminal de olhal' },
                { err: 'Sem fusível in-line no fio vermelho', sint: 'Rastreador queima com qualquer curto', sol: 'Sempre instalar fusível 1A antes do rastreador' },
                { err: 'Tap connector mal crimpado', sint: 'Falha intermitente com vibração', sol: 'Apertar o tap até o metal perfurar completamente o fio, verificar com leve puxão' },
                { err: 'Rastreador atrás de chapa de metal', sint: 'GPS demora para fixar ou não fixa', sol: 'Mover para local menos blindado ou usar extensão de antena' },
                { err: 'Taps invertidos no relé (30 e 87a trocados)', sint: 'Bloqueio não funciona ou bloqueia ao contrário', sol: 'Pino 30 sempre do lado da fonte; 87a do lado da carga (ignição)' },
                { err: 'Chip sem plano de dados ativo', sint: 'Rastreador nunca fica online', sol: 'Verificar plano do chip antes de instalar' },
              ].map((e) => (
                <div key={e.err} className="error-card">
                  <div><div className="error-col-label">❌ Erro</div><p>{e.err}</p></div>
                  <div><div className="error-col-label">⚠️ Sintoma</div><p>{e.sint}</p></div>
                  <div><div className="error-col-label">✅ Solução</div><p>{e.sol}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* MÓDULO 8 — FICHA */}
          <div className="module">
            <div className="module-header">
              <div className="module-num">8</div>
              <h2>Ficha de Instalação — Imprimir e Preencher</h2>
            </div>
            <p style={{marginBottom: 20}}>Imprima uma ficha por instalação. Preencha e arquive para histórico do cliente.</p>

            <div className="ficha">
              <div className="ficha-header">📋 FICHA DE INSTALAÇÃO — WEEVTRACK</div>

              <div className="ficha-fields">
                {['Cliente', 'Data', 'Veículo / Placa', 'Modelo do rastreador', 'IMEI'].map(f => (
                  <div key={f} className="ficha-field">
                    <label>{f}</label>
                    <div className="field-line"/>
                  </div>
                ))}
                <div className="ficha-field">
                  <label>Relé instalado</label>
                  <div style={{display:'flex', gap:16, paddingTop:4, fontSize:14}}>
                    <label style={{display:'flex',gap:6,alignItems:'center', fontWeight:'normal'}}><input type="checkbox" readOnly/> Sim</label>
                    <label style={{display:'flex',gap:6,alignItems:'center', fontWeight:'normal'}}><input type="checkbox" readOnly/> Não</label>
                  </div>
                </div>
              </div>

              {[
                { section: 'Pré-instalação', items: ['Chip ativo e IMEI cadastrado no WeevTrack', 'Multímetro disponível', 'Fusível in-line 1A preparado'] },
                { section: 'Identificação de fios', items: ['Positivo constante confirmado: _____ V (chave off)', 'Massa confirmada (continuidade OK)', 'ACC confirmado: _____ V (off) / _____ V (on)'] },
                { section: 'Instalação', items: ['Bateria desconectada', 'GND fixado no chassi, parafuso apertado', 'Fusível 1A no fio vermelho', 'VCC conectado no +12V constante', 'ACC conectado no fio de ignição correto', 'Fios protegidos com fita automotiva', 'Cablagem presa com zip-ties', 'Painel recolocado'] },
                { section: 'Teste final', items: ['Aguardado 5 min após reconectar bateria', 'Dispositivo Online no WeevTrack', 'GPS correto no mapa', 'Ignição OFF → Desligado ✓', 'Ignição ON → Ligado ✓', 'Bloqueio testado (se instalou relé) ✓'] },
              ].map(sec => (
                <div key={sec.section}>
                  <div className="checklist-section">{sec.section}</div>
                  <div className="checklist-card" style={{padding: '8px 14px', marginBottom: 8}}>
                    {sec.items.map(item => (
                      <div key={item} className="check-item">
                        <div className="check-box"/>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{marginTop: 16}}>
                <div className="checklist-section">Observações</div>
                <div style={{border:'1px solid #e5e7eb', borderRadius:8, height:56, padding:'8px 12px', fontSize:13, color:'#9ca3af'}}>
                  &nbsp;
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:20}}>
                <div className="ficha-field"><label>Assinatura do instalador</label><div className="field-line"/></div>
                <div className="ficha-field"><label>Assinatura do cliente</label><div className="field-line"/></div>
              </div>
            </div>
          </div>

        </div>{/* /curso-body */}

        {/* FOOTER */}
        <div className="curso-footer">
          <p>WeevTrack — Sistema de Rastreamento Veicular</p>
          <p style={{marginTop:6}}><a href="https://app.weevtrack.com">app.weevtrack.com</a> · Guia técnico para uso interno</p>
        </div>

      </div>
    </>
  );
}
