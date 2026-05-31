import OpenAI from 'openai';
import { getSetting } from './db';
import { redis, KEYS, TTL } from './redis';

const THREAD_TTL = 60 * 60 * 48; // 48h

export async function pushRedisHistory(tenantId: string, number: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const key = KEYS.chatHistory(tenantId, number);
  await redis.rpush(key, JSON.stringify({ role, content }));
  await redis.ltrim(key, -40, -1);
  await redis.expire(key, TTL.CHAT_HISTORY);
}

export async function runAgent(
  tenantId: string,
  number: string,
  message: string,
  contactStatus: string | undefined,
  pushName: string | undefined,
): Promise<{ text: string; toolCalls: string[] }> {
  const [apiKey, assistantId] = await Promise.all([
    getSetting(tenantId, 'openai_api_key'),
    getSetting(tenantId, 'openai_assistant_id'),
  ]);

  if (!apiKey) return { text: 'Agente não configurado: chave da OpenAI ausente.', toolCalls: [] };
  if (!assistantId?.trim()) return { text: 'Agente não configurado: ID do Assistente OpenAI ausente. Configure nas configurações.', toolCalls: [] };

  const client = new OpenAI({ apiKey });

  const threadKey = `t:${tenantId}:thread:${number}`;
  let threadId = await redis.get(threadKey);
  if (!threadId) {
    const thread = await client.beta.threads.create();
    threadId = thread.id;
    await redis.set(threadKey, threadId, 'EX', THREAD_TTL);
  } else {
    await redis.expire(threadKey, THREAD_TTL);
  }

  const extra = [
    contactStatus ? `[Status: ${contactStatus}]` : '',
    pushName ? `[Nome: ${pushName}]` : '',
  ].filter(Boolean).join(' ');

  await client.beta.threads.messages.create(threadId, {
    role: 'user',
    content: extra ? `${extra}\n\n${message}` : message,
  });

  let run = await client.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId.trim(),
  });

  const toolCalls: string[] = [];

  if (run.status === 'requires_action') {
    const calls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];
    for (const tc of calls) toolCalls.push(tc.function.name);
    const outputs = calls.map(tc => ({ tool_call_id: tc.id, output: 'ok' }));
    run = await client.beta.threads.runs.submitToolOutputsAndPoll(threadId, run.id, {
      tool_outputs: outputs,
    });
  }

  const msgs = await client.beta.threads.messages.list(threadId, { limit: 1, order: 'desc' });
  const first = msgs.data[0];
  let text = first?.role === 'assistant' && first.content[0]?.type === 'text'
    ? first.content[0].text.value
    : '';

  if (!text && toolCalls.length) {
    if (toolCalls.includes('notify_attendant')) text = 'Vou chamar um atendente para você agora mesmo! Aguarde um momento.';
    else if (toolCalls.includes('send_video'))  text = 'Segue o vídeo!';
    else if (toolCalls.includes('send_pdf'))    text = 'Segue o documento!';
  }

  return { text, toolCalls };
}
