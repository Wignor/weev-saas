import OpenAI from 'openai';
import { getSetting, getConversationHistory } from './db';

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  { type: 'function', function: { name: 'send_video',        description: 'Envia o vídeo de apresentação para o contato.',        parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'send_pdf',          description: 'Envia o PDF/documento de apresentação para o contato.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'notify_attendant',  description: 'Notifica um atendente humano para assumir o atendimento.', parameters: { type: 'object', properties: {}, required: [] } } },
];

export async function runAgent(
  tenantId: string,
  number: string,
  message: string,
  contactStatus: string | undefined,
  pushName: string | undefined
): Promise<{ text: string; toolCalls: string[] }> {
  const [apiKey, model, systemPrompt, histLimitStr] = await Promise.all([
    getSetting(tenantId, 'openai_api_key'),
    getSetting(tenantId, 'openai_model'),
    getSetting(tenantId, 'system_prompt'),
    getSetting(tenantId, 'max_history_messages'),
  ]);

  if (!apiKey) return { text: 'Desculpe, o agente não está configurado ainda.', toolCalls: [] };

  const client = new OpenAI({ apiKey });
  const histLimit = parseInt(histLimitStr || '20', 10);
  const history = await getConversationHistory(tenantId, number, histLimit);

  const sysContent = [
    systemPrompt || 'Você é um assistente prestativo.',
    contactStatus ? `Status do contato: ${contactStatus}` : '',
    pushName ? `Nome do contato: ${pushName}` : '',
  ].filter(Boolean).join('\n');

  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: sysContent },
    ...history.map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content })),
    { role: 'user', content: message },
  ];

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: msgs,
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 800,
  });

  const choice = response.choices[0];
  const toolCalls: string[] = [];
  let text = choice.message.content || '';

  if (choice.message.tool_calls?.length) {
    for (const tc of choice.message.tool_calls) {
      toolCalls.push(tc.function.name);
    }
  }

  // Fallback text when model only returned tool calls with no content
  if (!text && toolCalls.length) {
    if (toolCalls.includes('notify_attendant')) text = 'Vou chamar um atendente para você agora mesmo! Aguarde um momento. 😊';
    else if (toolCalls.includes('send_video'))   text = 'Segue o vídeo! 🎬 Qualquer dúvida é só me chamar!';
    else if (toolCalls.includes('send_pdf'))     text = 'Segue o documento! 📄 Qualquer dúvida estou à disposição.';
  }

  return { text, toolCalls };
}
