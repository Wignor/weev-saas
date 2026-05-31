import OpenAI from 'openai';
import { getSetting, getConversationHistory } from './db';
import { redis, KEYS, TTL } from './redis';

const THREAD_TTL = 60 * 60 * 48; // 48h

export async function pushRedisHistory(tenantId: string, number: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const key = KEYS.chatHistory(tenantId, number);
  await redis.rpush(key, JSON.stringify({ role, content }));
  await redis.ltrim(key, -40, -1); // keep last 40 entries
  await redis.expire(key, TTL.CHAT_HISTORY);
}

const CHAT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  { type: 'function', function: { name: 'send_video',       description: 'Envia o vídeo de apresentação para o contato.',        parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'send_pdf',         description: 'Envia o PDF/documento de apresentação para o contato.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'notify_attendant', description: 'Notifica um atendente humano para assumir o atendimento.', parameters: { type: 'object', properties: {}, required: [] } } },
];

async function runWithAssistant(
  openai: OpenAI,
  assistantId: string,
  tenantId: string,
  number: string,
  userMessage: string,
  contactStatus?: string | null,
  pushName?: string,
): Promise<{ text: string; toolCalls: string[] }> {
  const threadKey = `t:${tenantId}:thread:${number}`;
  let threadId = await redis.get(threadKey);

  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    await redis.set(threadKey, threadId, 'EX', THREAD_TTL);
  } else {
    await redis.expire(threadKey, THREAD_TTL);
  }

  const extra = [
    contactStatus ? `[Status: ${contactStatus}]` : '',
    pushName ? `[Nome: ${pushName}]` : '',
  ].filter(Boolean).join(' ');

  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: extra ? `${extra}\n\n${userMessage}` : userMessage,
  });

  let run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  const toolCalls: string[] = [];

  if (run.status === 'requires_action') {
    const calls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];
    for (const tc of calls) toolCalls.push(tc.function.name);
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
    if (toolCalls.includes('notify_attendant')) text = 'Vou chamar um atendente para você agora mesmo! Aguarde um momento.';
    else if (toolCalls.includes('send_video'))   text = 'Segue o vídeo!';
    else if (toolCalls.includes('send_pdf'))     text = 'Segue o documento!';
  }

  return { text, toolCalls };
}

export async function runAgent(
  tenantId: string,
  number: string,
  message: string,
  contactStatus: string | undefined,
  pushName: string | undefined,
): Promise<{ text: string; toolCalls: string[] }> {
  const [apiKey, model, systemPrompt, histLimitStr, assistantId] = await Promise.all([
    getSetting(tenantId, 'openai_api_key'),
    getSetting(tenantId, 'openai_model'),
    getSetting(tenantId, 'system_prompt'),
    getSetting(tenantId, 'max_history_messages'),
    getSetting(tenantId, 'openai_assistant_id'),
  ]);

  if (!apiKey) return { text: 'Desculpe, o agente não está configurado ainda.', toolCalls: [] };

  const client = new OpenAI({ apiKey });

  if (assistantId?.trim()) {
    return runWithAssistant(client, assistantId.trim(), tenantId, number, message, contactStatus, pushName);
  }

  // Fallback: Chat Completions with Redis history
  const histLimit = parseInt(histLimitStr || '20', 10);
  const rawHistory = await redis.lrange(KEYS.chatHistory(tenantId, number), -histLimit * 2, -1).catch(() => [] as string[]);
  const history = rawHistory.map(r => JSON.parse(r) as {role:'user'|'assistant';content:string});

  const sysContent = [
    systemPrompt || 'Você é um assistente prestativo.',
    contactStatus ? `Status do contato: ${contactStatus}` : '',
    pushName ? `Nome do contato: ${pushName}` : '',
    'REGRA DE MEMÓRIA OBRIGATÓRIA: Leia TODO o histórico desta conversa antes de responder. NUNCA pergunte uma informação que o cliente já forneceu anteriormente — cidade, nome, quantidade, tipo de uso ou qualquer outro dado. Se a informação já está no histórico, use-a diretamente e avance na conversa. Repetir perguntas já respondidas é estritamente proibido.',
  ].filter(Boolean).join('\n');

  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: sysContent },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: msgs,
    tools: CHAT_TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 800,
  });

  const choice = response.choices[0];
  const toolCalls: string[] = [];
  let text = choice.message.content || '';

  if (choice.message.tool_calls?.length) {
    for (const tc of choice.message.tool_calls) toolCalls.push(tc.function.name);
  }

  if (!text && toolCalls.length) {
    if (toolCalls.includes('notify_attendant')) text = 'Vou chamar um atendente para você agora mesmo! Aguarde um momento.';
    else if (toolCalls.includes('send_video'))   text = 'Segue o vídeo!';
    else if (toolCalls.includes('send_pdf'))     text = 'Segue o documento!';
  }

  return { text, toolCalls };
}
