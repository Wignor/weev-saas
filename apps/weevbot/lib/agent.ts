import OpenAI from 'openai';
import { getConversationHistory, getSetting } from './db';

export type ToolCall = 'enviar_video_demonstracao' | 'enviar_pdf_apresentacao' | 'transferir_para_humano';

export interface AgentResult {
  text: string;
  toolCalls: ToolCall[];
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'enviar_video_demonstracao',
      description: 'Envia o vídeo demonstrativo do sistema/produto para o cliente. Use quando o cliente pedir para ver o sistema funcionando, pedir um vídeo, demonstração, ou quando o prompt indicar que deve oferecer o vídeo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_pdf_apresentacao',
      description: 'Envia o PDF de apresentação ou proposta para o cliente. Use quando o cliente pedir um material, proposta, catálogo, PDF ou documento.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_para_humano',
      description: 'Transfere o atendimento para um consultor humano. Use somente nas situações definidas no prompt: cliente digitou "Falar com Atendente", documentação completa pronta para instalação, ou situações que o prompt especifica.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export async function runAgent(
  number: string,
  userMessage: string,
  contactStatus?: string | null,
  pushName?: string
): Promise<AgentResult> {
  const [history, systemPromptSetting, openaiKey, modelSetting, historyLimitSetting] =
    await Promise.all([
      getConversationHistory(number, 30),
      getSetting('system_prompt'),
      getSetting('openai_api_key'),
      getSetting('openai_model'),
      getSetting('max_history_messages'),
    ]);

  const apiKey = openaiKey || process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const openai = new OpenAI({ apiKey });

  const defaultPrompt = `Você é um assistente de atendimento ao cliente prestativo e cordial.
Responda sempre em português brasileiro de forma clara, objetiva e profissional.

FORMATO OBRIGATÓRIO — suas respostas serão enviadas como mensagens do WhatsApp:
- Escreva em parágrafos curtos separados por linha em branco (\\n\\n)
- Cada parágrafo deve ter no máximo 2 frases curtas
- Use pontuação correta (ponto final, vírgula, exclamação quando adequado)
- Seja natural e conversacional, como um atendente humano experiente
- Nunca envie paredes de texto — quebre sempre em parágrafos

Quando o cliente solicitar falar com um humano, use a ferramenta notify_attendant.
Quando o cliente solicitar um vídeo, use send_video.
Quando o cliente solicitar um PDF ou documento, use send_pdf.`;

  const basePrompt = systemPromptSetting || process.env.AGENT_SYSTEM_PROMPT || defaultPrompt;

  // Adapt prompt based on contact status
  let systemContent = basePrompt;
  if (contactStatus === 'lead') {
    systemContent += '\n\n[Contexto: Este contato é um LEAD — está conhecendo seus serviços pela primeira vez. Seja acolhedor e foque em apresentar os benefícios.]';
  } else if (contactStatus === 'cliente') {
    systemContent += '\n\n[Contexto: Este contato é um CLIENTE — já utiliza seus serviços. Seja objetivo e foque em resolver a necessidade dele.]';
  }

  const limit = parseInt(historyLimitSetting || '20', 10);
  const limitedHistory = history.slice(-limit);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...limitedHistory
      .map(m => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: modelSetting || 'gpt-4o',
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
    max_tokens: 1500,
    temperature: 0.7,
  });

  const choice = completion.choices[0];
  const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? []).map(
    tc => tc.function.name as ToolCall
  );
  const text =
    choice?.message?.content ||
    (toolCalls.includes('transferir_para_humano')
      ? 'Vou acionar nosso consultor agora para te atender. Pode aguardar!'
      : toolCalls.includes('enviar_video_demonstracao')
      ? 'Segue o vídeo demonstrativo! Recomendo assistir até o final — muito mais claro do que qualquer explicação em texto.'
      : toolCalls.includes('enviar_pdf_apresentacao')
      ? 'Segue a apresentação completa em PDF com todos os detalhes. Qualquer dúvida estou aqui.'
      : 'Desculpe, não consegui processar sua mensagem no momento.');

  return { text, toolCalls };
}
