import OpenAI from 'openai';
import { getConversationHistory, getSetting } from './db';

export type ToolCall = 'send_video' | 'send_pdf' | 'notify_attendant';

export interface AgentResult {
  text: string;
  toolCalls: ToolCall[];
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'send_video',
      description: 'Envia um vídeo para o cliente quando ele solicitar ver um vídeo de apresentação, demonstração ou qualquer vídeo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_pdf',
      description: 'Envia um PDF ou documento para o cliente quando ele solicitar uma proposta, catálogo, material ou PDF.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notify_attendant',
      description: 'Notifica o atendente humano quando o cliente explicitamente solicitar falar com uma pessoa, atendente ou humano.',
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
Responda sempre em português brasileiro de forma clara e objetiva.
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
      .filter(m => m.role !== 'human')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: modelSetting || 'gpt-4o',
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
    max_tokens: 600,
    temperature: 0.7,
  });

  const choice = completion.choices[0];
  const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? []).map(
    tc => tc.function.name as ToolCall
  );
  const text =
    choice?.message?.content ||
    (toolCalls.includes('notify_attendant')
      ? 'Vou chamar um atendente para você agora mesmo! Aguarde um momento. 😊'
      : 'Desculpe, não consegui processar sua mensagem no momento.');

  return { text, toolCalls };
}
