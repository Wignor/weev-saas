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

const CONTRACT_BASE = `CONTRATO DE MONITORAMENTO E RASTREAMENTO DE VEÍCULOS
WeevTrack e Comodato de Equipamentos

Pelo presente instrumento particular, em que são partes, de um lado Weev Consultoria e Serviços Ltda, inscrita no CNPJ sob nº 34.266.884/0001-42, localizada em Mogi Guaçu – SP, doravante denominada CONTRATADA, e de outro:

CONTRATANTE: {{NOME}}
CPF/CNPJ: {{CPF_CNPJ}}

Veículo: {{VEICULO}}
Placa: {{PLACA}}
IMEI do Equipamento: {{IMEI}}

Têm entre si, justo e avençado o presente contrato de monitoramento, rastreamento e bloqueio remoto via sistema de localização GPS e comunicação via telefonia celular móvel, bem como o comodato dos equipamentos listados no termo, doravante denominado apenas Rastreamento Veicular, mediante adesão às cláusulas e condições estabelecidas neste Contrato que reger-se-á pelas seguintes cláusulas e condições abaixo descritas:

──────────────────────────────────
Cláusula 1 – DO OBJETO
──────────────────────────────────

1.1 – O presente instrumento tem por objeto o monitoramento, rastreamento e bloqueio remoto, quando contratado, via sistema com tecnologia de localização GPS e comunicação via telefonia celular móvel pela CONTRATADA ao CONTRATANTE, na área de cobertura da operadora de telefonia celular definida neste instrumento, além da cessão de direitos ao CONTRATANTE para a utilização do software de Rastreamento Veicular via Internet.

1.2 – Fica convencionado que os serviços de monitoramento, rastreamento e bloqueio veicular serão prestados com a tecnologia GPS e comunicação via telefonia celular móvel.

1.3 – Para realização dos serviços haverá o COMODATO de equipamentos, devendo o contratante na oportunidade da contratação disponibilizar o veículo objeto do monitoramento para instalação de rastreador de propriedade da CONTRATADA, entregue ao CONTRATANTE na condição de comodato.

1.4 – O serviço de monitoramento consiste em: atualização do posicional do veículo através de coordenadas de GPS em tempos pré-programados, identificados através de login e senha disponibilizada ao CONTRATANTE que por esse expediente efetivará o acesso aos posicionais do veículo através do site.

──────────────────────────────────
Cláusula 2 – DO SISTEMA DE RASTREAMENTO
──────────────────────────────────

2.1 – O sistema permite o monitoramento e rastreamento remoto de um veículo através do envio de dados sistêmicos em períodos programados, com a utilização de telefonia celular móvel, a partir da informação obtida pelo sinal GPS.

2.2 – O CONTRATANTE receberá da CONTRATADA o equipamento contratado, codificado com um número intransferível e em perfeito estado de funcionamento, por ocasião da instalação no veículo a ser indicado neste instrumento.

2.3 – A prestação dos serviços terá início a partir da instalação e ativação do equipamento no veículo a ser monitorado, ficando o CONTRATANTE responsável pelos efeitos do contrato em relação ao veículo descritos neste contrato, ainda que a titularidade esteja em nome de terceiros.

──────────────────────────────────
Cláusula 3 – DOS SERVIÇOS E RESPONSABILIDADES
──────────────────────────────────

3.1 – Uma vez instalado o equipamento no veículo do CONTRATANTE, a CONTRATADA fica autorizada, de forma expressa e sem ressalvas, a monitorar e rastrear o veículo.

3.2 – Qualquer intervenção no veículo do CONTRATANTE, uma vez provocada e solicitada, será avaliada pela CONTRATADA para operar o sistema no melhor momento, sem prejuízo de eventual bloqueio automático, quando contratado.

3.3 – O presente instrumento contratual não constitui apólice de seguro. A prestação dos serviços de rastreamento e monitoramento visa minimizar e tentar frustrar a possibilidade de sucesso na ocorrência de roubos e furtos veiculares e não substitui qualquer outro equipamento antifurto instalado no veículo do CONTRATANTE.

3.4 – O CONTRATANTE está ciente de que o equipamento opera por sistema de telefonia celular móvel, sujeito às condições de recepção de sinais da rede, podendo sofrer interferência que impeça seu funcionamento regular, não se caracterizando responsabilidade da CONTRATADA por prejuízos decorrentes dessas anomalias.

3.5 – O CONTRATANTE reconhece que os serviços prestados não garantem recuperação de 100% do veículo. Os serviços visam dificultar a ação dos infratores e frustrar a tentativa de furto e/ou roubo.

3.6 – O CONTRATANTE reconhece e assume todas as responsabilidades decorrentes de uma ação de intervenção da CONTRATADA, com referência ao bloqueio de veículo em movimento.

3.7 – O CONTRATANTE se compromete a comunicar aos órgãos competentes do poder público, na eventualidade de roubo e furto, bem como à empresa seguradora responsável, se o veículo estiver segurado.

3.8 – O CONTRATANTE não poderá responsabilizar a CONTRATADA por problemas na operação do equipamento ocorridos por falhas na rede de telecomunicações, sombras, indisponibilidade de sinais, caso fortuito ou de força maior.

──────────────────────────────────
Cláusula 4 – DO PRAZO
──────────────────────────────────

4.1 – O presente contrato tem validade de 6 (seis) meses, sendo que, após este período, será automaticamente renovado por iguais períodos. Caso o CONTRATANTE não intencione renovar o contrato, deverá comunicar à CONTRATADA por escrito, com antecedência mínima de 30 (trinta) dias anteriormente ao término deste contrato.

4.2 – Havendo a extinção do contratado por qualquer uma das partes, aplicar-se-á multa por quebra contratual no valor de 50% das parcelas restantes até o prazo final do contrato.

──────────────────────────────────
Cláusula 5 – DO PAGAMENTO E CONDIÇÕES DE USO
──────────────────────────────────

5.1 – Pela consecução integral deste Contrato, o CONTRATANTE pagará à CONTRATADA o valor de habilitação/instalação de R$ {{INSTALACAO}} por veículo e mensalidades de R$ {{MENSALIDADE}} por veículo, a título de locação e prestação de serviços de monitoramento.

5.2 – A primeira parcela de pagamento da mensalidade deverá ser paga no ato da instalação, juntamente com o valor de instalação. Após isso, contar-se-ão 30 dias corridos para os demais vencimentos.

5.3 – O CONTRATANTE fica ciente que os valores serão atualizados monetariamente a cada 12 (doze) meses pelo IGPM.

5.4 – Em caso de falta de pagamento, a CONTRATADA se reserva no direito de suspender temporariamente a prestação dos serviços transcorridos 3 (três) dias, e cancelar definitivamente após 30 dias de atraso, inscrevendo o nome do contratante nos serviços de proteção ao crédito.

5.5 – Valores dos Serviços:
• Instalação: R$ {{INSTALACAO}}
• Desinstalação: R$ {{INSTALACAO}} (quando necessário)
• Visita improdutiva: R$2,00 por km rodado + pedágios

──────────────────────────────────
Cláusula 6 – CONDIÇÕES ESPECÍFICAS DE COMODATO
──────────────────────────────────

6.1 – O CONTRATANTE compromete-se a devolver à CONTRATADA o equipamento cedido na hipótese de rescisão contratual, seja qual for o motivo. O descumprimento desta obrigação caracterizará o crime de apropriação indébita, previsto no artigo 168 do Código Penal.

6.2 – Durante a vigência da locação, a CONTRATADA oferece manutenção do módulo principal e periféricos, não estando cobertos defeitos causados por manuseio deficiente, sobrecarga elétrica ou intervenção por pessoas não autorizadas.

6.3 – A impontualidade dos pagamentos implicará multa moratória de 10% (dez por cento) sobre o valor de locação mensal em aberto, além de juros de 1% ao mês de atraso.

6.4 – Em havendo a extinção deste contrato, o CONTRATANTE obriga-se a disponibilizar o veículo para desinstalação do equipamento à CONTRATADA até 5 (cinco) dias úteis seguintes ao término da avença.

6.5 – Passando-se 60 (sessenta) dias sem quitação das parcelas em atraso e sem devolução do equipamento, o CONTRATANTE ficará sujeito à negativação junto aos órgãos de proteção de crédito vigentes.

──────────────────────────────────
Cláusula 7 – INSTALAÇÃO, ASSISTÊNCIA TÉCNICA E TRANSFERÊNCIA
──────────────────────────────────

7.1 – Somente os técnicos da CONTRATADA, próprios ou nomeados, terão direito de efetuar qualquer correção/reparos nos equipamentos cedidos em comodato.

7.2 – A instalação e a assistência técnica serão realizadas pela CONTRATADA através de técnicos treinados e qualificados, de segunda-feira a sábado, em horário comercial.

7.3 – O CONTRATANTE tem todo o direito de transferir o equipamento para outro veículo, mediante comunicação à CONTRATADA e pagamento do serviço de retirada e reinstalação.

──────────────────────────────────
Cláusula 8 – DISPOSIÇÕES GERAIS
──────────────────────────────────

8.1 – A utilização do software CONTRATADA pelo CONTRATANTE somente poderá ser feita através de LOGIN e SENHA específicos, de seu conhecimento exclusivo.

8.2 – O CONTRATANTE expressamente autoriza a CONTRATADA a proceder à gravação de todas as comunicações e/ou solicitações, com vistas ao controle das operações e serviços.

8.3 – A eventual anulação de um dos itens do presente instrumento não invalidará as demais regras deste Contrato.

──────────────────────────────────
Cláusula 9 – ATENDIMENTO EM CASO DE ROUBO OU FURTO
──────────────────────────────────

9.1 – Os serviços de atendimento ao cliente serão prestados pela CONTRATADA através do WhatsApp: (19) 99978-0601.

──────────────────────────────────
Cláusula 10 – DA IRRETRATABILIDADE
──────────────────────────────────

10.1 – O presente instrumento é celebrado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores nas obrigações ora pactuadas.

──────────────────────────────────
Cláusula 11 – DO FORO DE ELEIÇÃO
──────────────────────────────────

11.1 – Fica eleito o Foro de Mogi Guaçu – Estado de São Paulo, com exclusão de qualquer outro por mais privilegiado que seja, para dirimir dúvidas de interpretação ou execução decorrentes do presente contrato.

E, por estarem justas e contratadas, as partes assinam o presente instrumento eletronicamente, na data de {{DATA}}, para que surta os regulares efeitos legais.

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
`;
