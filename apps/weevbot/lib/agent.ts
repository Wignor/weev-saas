import OpenAI from 'openai';
import { getSetting } from './db';
import { redis } from './redis';

export type ToolCall = 'enviar_video_demonstracao' | 'enviar_pdf_apresentacao' | 'transferir_para_humano';

export interface AgentResult {
  text: string;
  toolCalls: ToolCall[];
}

const THREAD_TTL = 60 * 60 * 48; // 48h

const CHAT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'enviar_video_demonstracao',
      description: 'Envia o vídeo demonstrativo do sistema para o cliente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_pdf_apresentacao',
      description: 'Envia o PDF de apresentação ou proposta para o cliente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir_para_humano',
      description: 'Transfere o atendimento para um consultor humano.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

async function runWithAssistant(
  openai: OpenAI,
  assistantId: string,
  number: string,
  userMessage: string,
  contactStatus?: string | null,
  pushName?: string,
): Promise<AgentResult> {
  const threadKey = `thread:${number}`;
  let threadId = await redis.get(threadKey);

  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    await redis.set(threadKey, threadId, 'EX', THREAD_TTL);
  } else {
    await redis.expire(threadKey, THREAD_TTL);
  }

  const extra = [
    contactStatus === 'lead' ? '[Lead: primeiro contato, apresentar benefícios]' : '',
    contactStatus === 'cliente' ? '[Cliente existente: ser objetivo e resolver necessidade]' : '',
    pushName ? `[Nome do contato: ${pushName}]` : '',
  ].filter(Boolean).join(' ');

  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: extra ? `${extra}\n\n${userMessage}` : userMessage,
  });

  let run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  const toolCalls: ToolCall[] = [];

  if (run.status === 'requires_action') {
    const calls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];
    for (const tc of calls) toolCalls.push(tc.function.name as ToolCall);
    const outputs = calls.map(tc => ({ tool_call_id: tc.id, output: 'ok' }));
    run = await openai.beta.threads.runs.submitToolOutputsAndPoll(threadId, run.id, {
      tool_outputs: outputs,
    });
  }

  const msgs = await openai.beta.threads.messages.list(threadId, { limit: 1, order: 'desc' });
  const first = msgs.data[0];
  let text = first?.role === 'assistant' && first.content[0]?.type === 'text'
    ? first.content[0].text.value
    : '';

  if (!text && toolCalls.length) {
    if (toolCalls.includes('transferir_para_humano')) text = 'Vou acionar nosso consultor agora para te atender. Pode aguardar!';
    else if (toolCalls.includes('enviar_video_demonstracao')) text = 'Segue o vídeo demonstrativo!';
    else if (toolCalls.includes('enviar_pdf_apresentacao')) text = 'Segue a apresentação em PDF!';
  }

  return { text, toolCalls };
}

async function getRedisHistory(number: string, limit: number): Promise<{role:'user'|'assistant';content:string}[]> {
  try {
    const raw = await redis.lrange(KEYS.chatHistory(number), -limit * 2, -1);
    return raw.map(r => JSON.parse(r) as {role:'user'|'assistant';content:string});
  } catch { return []; }
}

export async function pushRedisHistory(number: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const key = KEYS.chatHistory(number);
  await redis.rpush(key, JSON.stringify({ role, content }));
  await redis.ltrim(key, -40, -1); // keep last 40 entries (20 exchanges)
  await redis.expire(key, TTL.CHAT_HISTORY);
}

async function runWithChat(
  openai: OpenAI,
  number: string,
  userMessage: string,
  contactStatus?: string | null,
  pushName?: string,
): Promise<AgentResult> {
  const [systemPromptSetting, modelSetting, historyLimitSetting] = await Promise.all([
    getSetting('system_prompt'),
    getSetting('openai_model'),
    getSetting('max_history_messages'),
  ]);

  const limit = parseInt(historyLimitSetting || '20', 10);
  const history = await getRedisHistory(number, limit);

  const defaultPrompt = 'Você é um assistente de atendimento ao cliente prestativo e cordial. Responda sempre em português brasileiro.';
  let systemContent = systemPromptSetting || process.env.AGENT_SYSTEM_PROMPT || defaultPrompt;

  if (contactStatus === 'lead') systemContent += '\n\n[Lead: primeiro contato, apresentar benefícios]';
  else if (contactStatus === 'cliente') systemContent += '\n\n[Cliente: já utiliza os serviços, ser objetivo]';
  if (pushName) systemContent += `\n[Nome do contato: ${pushName}]`;
  systemContent += '\n\nREGRA: NUNCA repita perguntas já respondidas no histórico da conversa.';

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: modelSetting || 'gpt-4o',
    messages,
    tools: CHAT_TOOLS,
    tool_choice: 'auto',
    max_tokens: 1500,
    temperature: 0.7,
  });

  const choice = completion.choices[0];
  const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? []).map(tc => tc.function.name as ToolCall);
  const text = choice?.message?.content
    || (toolCalls.includes('transferir_para_humano') ? 'Vou acionar nosso consultor agora para te atender. Pode aguardar!'
      : toolCalls.includes('enviar_video_demonstracao') ? 'Segue o vídeo demonstrativo!'
      : toolCalls.includes('enviar_pdf_apresentacao') ? 'Segue a apresentação em PDF!'
      : 'Desculpe, não consegui processar sua mensagem.');

  return { text, toolCalls };
}

export async function runAgent(
  number: string,
  userMessage: string,
  contactStatus?: string | null,
  pushName?: string,
): Promise<AgentResult> {
  const [openaiKey, assistantId] = await Promise.all([
    getSetting('openai_api_key'),
    getSetting('openai_assistant_id'),
  ]);

  const apiKey = openaiKey || process.env.OPENAI_API_KEY || '';
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const openai = new OpenAI({ apiKey });

  if (assistantId?.trim()) {
    return runWithAssistant(openai, assistantId.trim(), number, userMessage, contactStatus, pushName);
  }
  return runWithChat(openai, number, userMessage, contactStatus, pushName);
}
