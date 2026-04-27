export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  installationValue: number;
  monthlyValue: number;
}

export interface Contract {
  id: string;
  token: string;
  templateId: string;
  templateName: string;
  userId: number;
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
  status: 'pending' | 'signed';
  contractText: string;
  clientSignature: string | null;
  selfiePhoto: string | null;
  ipAddress: string | null;
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'ctt_8035',
    name: 'Rastreamento 80/35',
    description: 'Instalação R$80 + Mensalidade R$35',
    installationValue: 80,
    monthlyValue: 35,
  },
  {
    id: 'ctt_10039',
    name: 'Rastreamento 100/39',
    description: 'Instalação R$100 + Mensalidade R$39,90',
    installationValue: 100,
    monthlyValue: 39.9,
  },
];

export const SIGNATORY = {
  name: 'Wignor Aguiller Ferreira',
  cpf: '398.000.258-63',
  company: 'Weev Consultoria e Serviços Ltda',
  cnpj: '34.266.884/0001-42',
};

export function getContractText(
  template: ContractTemplate,
  vars: { nome: string; cpfCnpj: string; data: string; veiculo: string; placa: string; imei: string }
): string {
  const inst = template.installationValue.toFixed(2).replace('.', ',');
  const mens = template.monthlyValue.toFixed(2).replace('.', ',');
  return CONTRACT_BASE
    .replace(/{{NOME}}/g, vars.nome)
    .replace(/{{CPF_CNPJ}}/g, vars.cpfCnpj)
    .replace(/{{DATA}}/g, vars.data)
    .replace(/{{VEICULO}}/g, vars.veiculo)
    .replace(/{{PLACA}}/g, vars.placa)
    .replace(/{{IMEI}}/g, vars.imei)
    .replace(/{{INSTALACAO}}/g, inst)
    .replace(/{{MENSALIDADE}}/g, mens);
}

const CONTRACT_BASE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MONITORAMENTO E RASTREAMENTO VEICULAR
WeevTrack — Comodato de Equipamento GPS

Pelo presente instrumento particular de prestação de serviços, em que são partes:

CONTRATADA: Weev Consultoria e Serviços Ltda, inscrita no CNPJ sob nº 34.266.884/0001-42, com sede em Mogi Guaçu – SP, doravante denominada simplesmente CONTRATADA.

CONTRATANTE: {{NOME}}
CPF/CNPJ: {{CPF_CNPJ}}

Veículo: {{VEICULO}}
Placa: {{PLACA}}
IMEI do Equipamento: {{IMEI}}

As partes acima qualificadas têm entre si justo e contratado o presente instrumento, que se regerá pelas cláusulas e condições seguintes:

──────────────────────────────────
Cláusula 1 – DO OBJETO
──────────────────────────────────

1.1 – O presente instrumento tem por objeto a prestação de serviços de monitoramento, rastreamento e bloqueio remoto veicular, via sistema de localização GPS com comunicação por telefonia celular (GSM/GPRS/4G), bem como a cessão em comodato do equipamento rastreador necessário à execução dos serviços.

1.2 – Os serviços compreendem: (a) localização do veículo em tempo real por coordenadas GPS; (b) histórico de trajetos; (c) alertas configuráveis de velocidade e cerca virtual; (d) acesso ao sistema via plataforma web e/ou aplicativo móvel WeevTrack.

1.3 – Para execução dos serviços, o CONTRATANTE disponibilizará o veículo para instalação do rastreador de propriedade da CONTRATADA, cedido em regime de comodato durante a vigência deste contrato.

──────────────────────────────────
Cláusula 2 – DO SISTEMA E INÍCIO DOS SERVIÇOS
──────────────────────────────────

2.1 – O sistema opera por localização GPS e transmissão de dados via rede de telefonia celular. A qualidade do serviço está condicionada à cobertura da operadora nas áreas de circulação do veículo.

2.2 – O CONTRATANTE receberá credenciais individuais (login e senha) para acesso à plataforma de monitoramento, sendo de sua exclusiva responsabilidade a confidencialidade dessas informações.

2.3 – A prestação dos serviços terá início a partir da instalação e ativação do equipamento no veículo indicado neste instrumento.

──────────────────────────────────
Cláusula 3 – LIMITAÇÕES E RESPONSABILIDADES
──────────────────────────────────

3.1 – Instalado o equipamento, a CONTRATADA fica expressamente autorizada pelo CONTRATANTE a monitorar e rastrear o veículo durante a vigência do contrato.

3.2 – O presente instrumento NÃO constitui apólice de seguro, contrato de vigilância ou garantia de recuperação do veículo. Os serviços visam auxiliar na localização em caso de roubo ou furto, sem garantia de êxito.

3.3 – O CONTRATANTE está ciente de que o sistema opera por rede de telefonia celular, podendo sofrer interrupções por falhas de cobertura, indisponibilidade da operadora, força maior ou caso fortuito, sem que tais ocorrências impliquem responsabilidade da CONTRATADA.

3.4 – A CONTRATADA não se responsabiliza por danos ou perdas decorrentes de falhas de transmissão de dados, queda de sinal, invasão do sistema por terceiros ou eventos alheios ao seu controle.

3.5 – Eventual ação de bloqueio remoto do veículo, quando solicitada, é de exclusiva responsabilidade do CONTRATANTE, que exime a CONTRATADA de quaisquer danos ou prejuízos decorrentes.

3.6 – Em caso de roubo ou furto, o CONTRATANTE deverá comunicar imediatamente às autoridades policiais e em seguida à CONTRATADA pelo WhatsApp (19) 99978-0601.

──────────────────────────────────
Cláusula 4 – DO PRAZO E FIDELIDADE
──────────────────────────────────

4.1 – O presente contrato tem prazo mínimo de fidelidade de 12 (doze) meses, contados da data de instalação e ativação do equipamento, renovando-se automaticamente por iguais períodos, salvo notificação de rescisão com antecedência mínima de 30 (trinta) dias do vencimento.

4.2 – Em caso de rescisão antecipada pelo CONTRATANTE dentro do prazo mínimo de fidelidade, será devida multa compensatória equivalente a 50% (cinquenta por cento) das mensalidades restantes até o término do período de fidelidade, sem prejuízo da obrigação de devolução do equipamento.

4.3 – A rescisão imotivada por iniciativa da CONTRATADA, fora dos casos de inadimplência, não ensejará cobrança de multa ao CONTRATANTE.

──────────────────────────────────
Cláusula 5 – DO PAGAMENTO
──────────────────────────────────

5.1 – Pelos serviços contratados, o CONTRATANTE pagará:
• Taxa de instalação/habilitação: R$ {{INSTALACAO}} (devida no ato da instalação)
• Mensalidade de monitoramento: R$ {{MENSALIDADE}} (com vencimento 30 dias após a instalação, e assim sucessivamente)

5.2 – Os valores das mensalidades serão reajustados anualmente pelo IGPM/FGV acumulado do período, com base na data de aniversário do contrato.

5.3 – O atraso no pagamento implicará: (a) multa moratória de 2% (dois por cento) sobre o valor em aberto; (b) juros de mora de 1% (um por cento) ao mês; (c) correção monetária pelo IGPM/FGV.

5.4 – Decorridos 3 (três) dias de atraso, a CONTRATADA poderá suspender temporariamente o monitoramento; decorridos 30 (trinta) dias de inadimplência, poderá rescindir o contrato e negativar o CONTRATANTE nos órgãos de proteção ao crédito (SPC/Serasa).

5.5 – Serviços adicionais e cobranças eventuais:
• Desinstalação do equipamento: R$ {{INSTALACAO}}
• Reinstalação em outro veículo: R$ {{INSTALACAO}}
• Visita técnica improdutiva (ausência do CONTRATANTE em horário agendado): R$ 50,00 fixos + R$ 2,00 por km rodado acima de 10 km

──────────────────────────────────
Cláusula 6 – DO COMODATO DO EQUIPAMENTO
──────────────────────────────────

6.1 – O equipamento permanece de propriedade exclusiva da CONTRATADA, sendo cedido em comodato para uso exclusivo no veículo identificado neste contrato.

6.2 – O CONTRATANTE compromete-se a: (a) zelar pela integridade do equipamento; (b) não realizar nem autorizar intervenções técnicas não autorizadas pela CONTRATADA; (c) devolver o equipamento em até 5 (cinco) dias úteis após a rescisão contratual.

6.3 – O não cumprimento do prazo de devolução caracterizará apropriação indébita (Art. 168 do Código Penal Brasileiro), sujeitando o CONTRATANTE às medidas legais cabíveis, além do pagamento do valor de reposição do equipamento (R$ 350,00).

6.4 – Avarias causadas ao equipamento por mau uso, descarga elétrica, intervenção não autorizada ou subtração isolada do rastreador (sem o veículo) serão de responsabilidade do CONTRATANTE.

6.5 – Passados 60 (sessenta) dias de inadimplência sem devolução do equipamento, o CONTRATANTE ficará sujeito à negativação e às medidas judiciais cabíveis.

──────────────────────────────────
Cláusula 7 – DA INSTALAÇÃO E SUPORTE TÉCNICO
──────────────────────────────────

7.1 – A instalação, manutenção e desinstalação do equipamento serão realizadas exclusivamente por técnicos da CONTRATADA ou por ela expressamente autorizados.

7.2 – O suporte técnico será prestado pela CONTRATADA via WhatsApp (19) 99978-0601, em dias úteis das 08h às 18h.

7.3 – O CONTRATANTE poderá solicitar a transferência do equipamento para outro veículo de sua titularidade, mediante agendamento prévio e pagamento da taxa de reinstalação prevista na Cláusula 5.5.

──────────────────────────────────
Cláusula 8 – DA PROTEÇÃO DE DADOS PESSOAIS (LGPD)
──────────────────────────────────

8.1 – Em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD), a CONTRATADA informa que os dados pessoais coletados neste contrato (nome, CPF/CNPJ, telefone, e-mail e dados do veículo) serão tratados exclusivamente para: (a) execução deste contrato; (b) cumprimento de obrigações legais; (c) exercício regular de direito em processos judiciais ou administrativos.

8.2 – Os dados pessoais não serão compartilhados com terceiros, exceto mediante determinação legal ou judicial.

8.3 – Os dados de localização do veículo são tratados como informação de titularidade do CONTRATANTE, acessíveis exclusivamente por ele e pela CONTRATADA para fins operacionais.

8.4 – O CONTRATANTE poderá, a qualquer tempo, solicitar acesso, correção, anonimização ou exclusão de seus dados pessoais, por meio dos canais de atendimento da CONTRATADA.

──────────────────────────────────
Cláusula 9 – DO DIREITO DE ARREPENDIMENTO (CDC)
──────────────────────────────────

9.1 – Por se tratar de contrato celebrado por meio eletrônico, fora do estabelecimento comercial, o CONTRATANTE possui o direito de arrependimento previsto no Art. 49 do Código de Defesa do Consumidor (Lei nº 8.078/90), podendo desistir do contrato no prazo de 7 (sete) dias corridos a partir da assinatura, sem qualquer ônus, desde que o equipamento não tenha sido instalado.

9.2 – Caso o equipamento já tenha sido instalado e o CONTRATANTE exerça o direito de arrependimento dentro do prazo legal, serão devidas somente as despesas de desinstalação, conforme Cláusula 5.5.

──────────────────────────────────
Cláusula 10 – DISPOSIÇÕES GERAIS
──────────────────────────────────

10.1 – O CONTRATANTE autoriza a CONTRATADA a registrar e armazenar todas as comunicações e solicitações de serviço para fins de controle operacional e resolução de eventuais disputas.

10.2 – A eventual nulidade de qualquer cláusula deste instrumento não afetará a validade das demais disposições.

10.3 – As partes declaram ter lido, compreendido e concordado com todas as cláusulas deste instrumento, assinando-o eletronicamente nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.

──────────────────────────────────
Cláusula 11 – DO FORO
──────────────────────────────────

11.1 – Fica eleito o Foro da Comarca de Mogi Guaçu – Estado de São Paulo, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir quaisquer dúvidas ou litígios decorrentes do presente contrato.

Mogi Guaçu – SP, {{DATA}}.

──────────────────────────────────
ASSINATURAS
──────────────────────────────────

CONTRATANTE:
{{NOME}}
CPF/CNPJ: {{CPF_CNPJ}}

CONTRATADA:
Wignor Aguiller Ferreira
CPF: 398.000.258-63
Weev Consultoria e Serviços Ltda
CNPJ: 34.266.884/0001-42

TESTEMUNHAS:

1. _________________________________
   Nome:
   CPF:

2. _________________________________
   Nome:
   CPF:
`;
