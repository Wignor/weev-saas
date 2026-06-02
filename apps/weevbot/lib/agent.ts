import OpenAI from 'openai';
import { getSetting } from './db';
import { redis, KEYS, TTL } from './redis';

export type ToolCall = 'enviar_video_demonstracao' | 'enviar_pdf_apresentacao' | 'transferir_para_humano' | 'enviar_midia' | string;

export interface ToolCallResult {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentResult {
  text: string;
  toolCalls: ToolCall[];
  toolCallResults: ToolCallResult[];
}

const THREAD_TTL = 60 * 60 * 48; // 48h

export async function pushRedisHistory(number: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const key = KEYS.chatHistory(number);
  await redis.rpush(key, JSON.stringify({ role, content }));
  await redis.ltrim(key, -40, -1);
  await redis.expire(key, TTL.CHAT_HISTORY);
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
  if (!apiKey) return { text: 'Agente não configurado: chave da OpenAI ausente.', toolCalls: [] };
  if (!assistantId?.trim()) return { text: 'Agente não configurado: ID do Assistente OpenAI ausente. Configure nas configurações.', toolCalls: [] };

  const openai = new OpenAI({ apiKey });

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
    contactStatus === 'lead'    ? '[Lead: primeiro contato, apresentar benefícios]' : '',
    contactStatus === 'cliente' ? '[Cliente existente: ser objetivo e resolver necessidade]' : '',
    pushName ? `[Nome do contato: ${pushName}]` : '',
  ].filter(Boolean).join(' ');

  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: extra ? `${extra}\n\n${userMessage}` : userMessage,
  });

  let run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId.trim(),
  });

  const toolCalls: ToolCall[] = [];
  const toolCallResults: ToolCallResult[] = [];

  if (run.status === 'requires_action') {
    const calls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];
    for (const tc of calls) {
      toolCalls.push(tc.function.name as ToolCall);
      toolCallResults.push({ name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') });
    }
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
    if (toolCalls.includes('transferir_para_humano'))      text = 'Vou acionar nosso consultor agora para te atender. Pode aguardar!';
    else if (toolCalls.includes('enviar_video_demonstracao')) text = 'Segue o vídeo demonstrativo!';
    else if (toolCalls.includes('enviar_pdf_apresentacao'))   text = 'Segue a apresentação em PDF!';
    else if (toolCalls.includes('enviar_midia'))              text = 'Segue o arquivo!';
  }

  return { text, toolCalls, toolCallResults };
}
