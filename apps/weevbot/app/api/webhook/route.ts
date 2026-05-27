import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { upsertConversation, saveMessage, getSetting } from '@/lib/db';
import { sendMessage, sendVideo, sendDocument, notifyAttendant } from '@/lib/evolution';
import { runAgent } from '@/lib/agent';
import { getContact, insertNewContact, setContactStatus, touchContact } from '@/lib/contacts';

const CLASSIF_KEY = (n: string) => `classificacao_aguardando.${n}`;
const PENDING_KEY = (n: string) => `pending_msgs.${n}`;
const LAST_MSG_KEY = (n: string) => `last_msg_time.${n}`;
const LOCK_KEY = (n: string) => `debounce_lock.${n}`;
const DEBOUNCE_MS = 8000;

interface PendingMsg {
  text: string;
  msgId: string;
  remoteJid: string;
  pushName?: string;
}

function extractText(message: Record<string, unknown> | undefined): string {
  if (!message) return '';
  return (
    (message.conversation as string) ||
    ((message.extendedTextMessage as Record<string, string>)?.text) ||
    ((message.imageMessage as Record<string, string>)?.caption) ||
    ((message.videoMessage as Record<string, string>)?.caption) ||
    ''
  );
}

function forwardToN8n(url: string, body: unknown) {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(e => console.error('[forward-n8n]', e));
}

function classifyFromText(text: string): 'lead' | 'cliente' | null {
  const t = text.toLowerCase().trim().replace(/[*_~]/g, '');
  if (/j[aá]\s*sou\s*cliente/.test(t)) return 'cliente';
  if (/quero\s*conhecer/.test(t)) return 'lead';
  const isClient = /\b(j[aá]|sim|sou|tenho|cliente|comprei|compr[ao]u|assino)\b/.test(t);
  const isLead = /\b(n[aã]o|nunca|conhecer|primeira|novo|primeiro)\b/.test(t);
  if (isClient) return 'cliente';
  if (isLead) return 'lead';
  return null;
}

// Merge small text parts into blocks of max ~maxWords words
function mergeIntoBlocks(parts: string[], maxWords: number): string[] {
  const blocks: string[] = [];
  let current = '';
  let wc = 0;
  for (const part of parts) {
    const w = part.trim().split(/\s+/).length;
    if (wc + w > maxWords && current) {
      blocks.push(current.trim());
      current = part.trim();
      wc = w;
    } else {
      current = current ? `${current}\n\n${part.trim()}` : part.trim();
      wc += w;
    }
  }
  if (current.trim()) blocks.push(current.trim());
  return blocks.filter(Boolean);
}

// Split response into conversational message blocks (aim for 2-4 messages)
function splitIntoBlocks(text: string): string[] {
  // 1. Try double-newline paragraph split
  const byParagraph = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (byParagraph.length > 1) return mergeIntoBlocks(byParagraph, 80);

  // 2. Try single-newline split
  const byLine = text.split(/\n/).map(p => p.trim()).filter(Boolean);
  if (byLine.length > 1) return mergeIntoBlocks(byLine, 80);

  // 3. Split at sentence boundaries (. ! ?)
  const bySentence = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  if (bySentence.length > 1) return mergeIntoBlocks(bySentence, 60);

  return [text.trim()];
}

// Send each block with Evolution API's built-in "Digitando..." indicator
async function sendBlocks(remoteJid: string, number: string, text: string) {
  const blocks = splitIntoBlocks(text);
  for (let i = 0; i < blocks.length; i++) {
    if ((await redis.get(KEYS.atendimento(number))) === 'humano') break;
    // Evolution API shows "Digitando..." for 3s before delivering each message
    await sendMessage(remoteJid, blocks[i], 3000);
    if (i < blocks.length - 1) {
      if ((await redis.get(KEYS.atendimento(number))) === 'humano') break;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function processAIQueue(number: string) {
  try {
    const rawMsgs = await redis.lrange(PENDING_KEY(number), 0, -1);
    if (!rawMsgs.length) return;
    await redis.del(PENDING_KEY(number));

    const msgs: PendingMsg[] = rawMsgs.map(m => JSON.parse(m));
    const { remoteJid, pushName } = msgs[msgs.length - 1];
    const combinedText = msgs.map(m => m.text).join('\n');

    if ((await redis.get(KEYS.atendimento(number))) === 'humano') return;

    const contact = await getContact(number);

    // Skip contacts from other business lines
    const BLOCKED_STATUSES = ['inquilino', 'outro'];
    if (contact?.status && BLOCKED_STATUSES.includes(contact.status)) return;

    // Classification flow
    const awaitingClassif = await redis.get(CLASSIF_KEY(number));
    if (awaitingClassif === '1' || contact?.status === 'pendente_classificacao') {
      const classification = classifyFromText(combinedText);
      if (classification) {
        await Promise.all([
          setContactStatus(number, classification, pushName),
          redis.del(CLASSIF_KEY(number)),
        ]);
        const confirmMsg =
          classification === 'cliente'
            ? '✅ Ótimo! Já registrei você como *cliente*. Como posso ajudá-lo hoje?'
            : '✅ Perfeito! Fique à vontade para conhecer nossos serviços. Como posso ajudá-lo?';
        await sendMessage(remoteJid, confirmMsg, 800);
        const aiMsgId = `ai_classif_${number}_${Date.now()}`;
        await Promise.all([
          saveMessage(number, aiMsgId, 'assistant', confirmMsg),
          upsertConversation(number, 'active', confirmMsg),
        ]);
      } else {
        await sendMessage(
          remoteJid,
          'Não entendi bem. Você pode me dizer: você *já é nosso cliente* (responda "sim") ou está conhecendo nossos serviços pela primeira vez (responda "não")?',
          1000
        );
      }
      return;
    }

    // Normal AI flow
    const { text: aiResponse, toolCalls } = await runAgent(
      number, combinedText, contact?.status, pushName
    );
    touchContact(number, pushName).catch(() => {});

    if ((await redis.get(KEYS.atendimento(number))) === 'humano') return;

    await redis.set(KEYS.aiBusy(number), '1', 'EX', TTL.AI_BUSY);

    // Tool calls before the text response
    if (toolCalls.includes('send_video')) {
      const videoUrl = await getSetting('video_url');
      if (videoUrl) await sendVideo(remoteJid, videoUrl, '').catch(() => {});
    }
    if (toolCalls.includes('send_pdf')) {
      const pdfUrl = await getSetting('pdf_url');
      if (pdfUrl) await sendDocument(remoteJid, pdfUrl, 'documento.pdf').catch(() => {});
    }
    if (toolCalls.includes('notify_attendant')) {
      const attendantNum = await getSetting('notification_number');
      if (attendantNum) await notifyAttendant(number, pushName || number, attendantNum).catch(() => {});
    }

    // Send text response in blocks with typing simulation
    await sendBlocks(remoteJid, number, aiResponse);

    const aiMsgId = `ai_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, aiMsgId, 'assistant', aiResponse),
      upsertConversation(number, 'active', aiResponse),
    ]);
  } catch (err) {
    console.error('[processAIQueue]', err);
  } finally {
    await redis.del(LOCK_KEY(number)).catch(() => {});
    const remaining = await redis.llen(PENDING_KEY(number)).catch(() => 0);
    if (remaining > 0) {
      const relock = await redis.set(LOCK_KEY(number), '1', 'EX', 120, 'NX').catch(() => null);
      if (relock === 'OK') setTimeout(() => processAIQueue(number), 0);
    }
  }
}

function scheduleAIProcessing(number: string) {
  const check = async () => {
    try {
      const lastMs = parseInt((await redis.get(LAST_MSG_KEY(number))) || '0', 10);
      const elapsed = Date.now() - lastMs;
      if (elapsed < DEBOUNCE_MS) {
        setTimeout(check, Math.max(500, DEBOUNCE_MS - elapsed + 50));
        return;
      }
      await processAIQueue(number);
    } catch (err) {
      console.error('[scheduleAIProcessing]', err);
      await redis.del(LOCK_KEY(number)).catch(() => {});
    }
  };
  setTimeout(check, DEBOUNCE_MS);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const n8nUrl = await getSetting('n8n_forward_url');
    if (n8nUrl) forwardToN8n(n8nUrl, body);

    if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true });

    const data = body.data;
    if (!data?.key) return NextResponse.json({ ok: true });

    const { remoteJid, fromMe, id: msgId } = data.key;
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
      return NextResponse.json({ ok: true });
    }

    const number = remoteJid.split('@')[0];

    // Never process messages from the internal notification number
    const notificationNum = await getSetting('notification_number');
    if (notificationNum && number === notificationNum.replace(/\D/g, '')) {
      return NextResponse.json({ ok: true });
    }

    // Outgoing (fromMe=true) → pause AI if human attendant is responding
    if (fromMe) {
      const aiBusy = await redis.get(KEYS.aiBusy(number));
      if (aiBusy !== '1') {
        const pauseTtl = parseInt(
          (await getSetting('pause_ttl_seconds')) || String(TTL.PAUSA_HUMANO), 10
        );
        await redis.set(KEYS.atendimento(number), 'humano', 'EX', pauseTtl);
        await upsertConversation(number, 'paused');
      }
      return NextResponse.json({ ok: true });
    }

    // Incoming message
    const text = extractText(data.message);
    if (!text.trim()) return NextResponse.json({ ok: true });

    const pushName: string | undefined = data.pushName;
    const instance = process.env.EVOLUTION_INSTANCE || 'AT WT';

    if ((await redis.get(KEYS.atendimento(number))) === 'humano') {
      return NextResponse.json({ ok: true });
    }

    const userMsgId = msgId || `user_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, userMsgId, 'user', text),
      upsertConversation(number, 'active', text, pushName),
      redis.set(KEYS.atendimento(number), 'true', 'EX', TTL.SESSAO_ATIVA),
    ]);

    // Brand-new contact → send welcome immediately (no debounce)
    const contact = await getContact(number);
    if (!contact) {
      await insertNewContact(number, pushName, instance);
      await redis.set(CLASSIF_KEY(number), '1', 'EX', 1800);
      const displayName = pushName || 'amigo(a)';
      const rawWelcome = (await getSetting('welcome_message')) ||
        `Olá, {nome}! 👋\nSeja bem-vindo(a)!\n\nVocê já é nosso cliente ou está conhecendo nossos serviços pela primeira vez?\n\n👉 *JÁ SOU CLIENTE*\n👉 *QUERO CONHECER*`;
      const welcome = rawWelcome.replace(/\{nome\}/gi, displayName);
      await sendMessage(remoteJid, welcome, 1000);
      return NextResponse.json({ ok: true });
    }

    // Skip contacts from other business lines
    const BLOCKED_STATUSES = ['inquilino', 'outro'];
    if (contact.status && BLOCKED_STATUSES.includes(contact.status)) {
      return NextResponse.json({ ok: true });
    }

    // Queue message and debounce: wait 8s of silence before processing
    const pendingMsg: PendingMsg = { text, msgId: userMsgId, remoteJid, pushName };
    await redis.rpush(PENDING_KEY(number), JSON.stringify(pendingMsg));
    await redis.expire(PENDING_KEY(number), 120);
    await redis.set(LAST_MSG_KEY(number), String(Date.now()), 'EX', 120);

    const lockAcquired = await redis.set(LOCK_KEY(number), '1', 'EX', 120, 'NX');
    if (lockAcquired === 'OK') {
      scheduleAIProcessing(number);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
