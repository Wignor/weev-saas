import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { upsertConversation, saveMessage, getSetting } from '@/lib/db';
import { sendMessage, sendVideo, sendDocument, notifyAttendant, sendPTTAudio } from '@/lib/evolution';
import { generateSpeech } from '@/lib/tts';
import { runAgent, pushRedisHistory } from '@/lib/agent';
import { getContact, insertNewContact, setContactStatus, touchContact } from '@/lib/contacts';
import { splitIntoBlocks } from '@/lib/message-utils';

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

    // Block only explicitly excluded statuses; respond to everything else
    const BLOCKED_STATUSES = ['inquilino', 'outro'];
    if (contact?.status && BLOCKED_STATUSES.includes(contact.status)) return;

    // Classification flow
    const awaitingClassif = await redis.get(CLASSIF_KEY(number));
    if (awaitingClassif === '1' || contact?.status === 'pendente_classificacao') {
      const classification = classifyFromText(combinedText);
      await redis.set(KEYS.aiBusy(number), '1', 'EX', TTL.AI_BUSY);
      if (classification) {
        await Promise.all([
          setContactStatus(number, classification, pushName),
          redis.del(CLASSIF_KEY(number)),
        ]);
        // For 'cliente': send hardcoded confirm. For 'lead': hand off to AI immediately
        // so it can start the qualification flow (ask about city, needs, etc.)
        if (classification === 'cliente') {
          const confirmMsg = '✅ Ótimo! Já registrei você como *cliente*. Como posso ajudá-lo hoje?';
          await sendMessage(remoteJid, confirmMsg, 800);
          const aiMsgId = `ai_classif_${number}_${Date.now()}`;
          await Promise.all([
            saveMessage(number, aiMsgId, 'assistant', confirmMsg),
            upsertConversation(number, 'active', confirmMsg),
          ]);
        } else {
          // Lead: run AI with the original message so it starts qualification
          const { text: aiResponse, toolCalls } = await runAgent(
            number, combinedText, 'lead', pushName
          );
          if ((await redis.get(KEYS.atendimento(number))) !== 'humano') {
            await sendBlocks(remoteJid, number, aiResponse);
            const aiMsgId = `ai_lead_${number}_${Date.now()}`;
            await Promise.all([
              saveMessage(number, aiMsgId, 'assistant', aiResponse),
              upsertConversation(number, 'active', aiResponse),
            ]);
          }
        }
      } else {
        const retryMsg = 'Não entendi bem. Você pode me dizer: você *já é nosso cliente* (responda "sim") ou está conhecendo nossos serviços pela primeira vez (responda "não")?';
        await sendMessage(remoteJid, retryMsg, 1000);
        const retryId = `ai_noclassif_${number}_${Date.now()}`;
        await Promise.all([
          saveMessage(number, retryId, 'assistant', retryMsg),
          upsertConversation(number, 'active', retryMsg),
        ]);
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
    if (toolCalls.includes('enviar_video_demonstracao')) {
      const videoUrl = await getSetting('video_url');
      if (videoUrl) {
        await sendVideo(remoteJid, videoUrl, '').catch(() => {});
        await saveMessage(number, `media_video_${number}_${Date.now()}`, 'assistant', `[MEDIA:video] ${videoUrl}`).catch(() => {});
      }
    }
    if (toolCalls.includes('enviar_pdf_apresentacao')) {
      const pdfUrl = await getSetting('pdf_url');
      if (pdfUrl) {
        await sendDocument(remoteJid, pdfUrl, 'documento.pdf').catch(() => {});
        await saveMessage(number, `media_pdf_${number}_${Date.now()}`, 'assistant', `[MEDIA:document:documento.pdf] ${pdfUrl}`).catch(() => {});
      }
    }
    if (toolCalls.includes('transferir_para_humano')) {
      const attendantNum = await getSetting('notification_number');
      if (attendantNum) await notifyAttendant(number, pushName || number, attendantNum).catch(() => {});
    }

    // TTS: send voice note instead of / in addition to text
    const ttsEnabled = await getSetting('tts_enabled');
    const ttsMode = (await getSetting('tts_mode')) || 'both'; // 'text_only' | 'audio_only' | 'both'

    if (ttsEnabled === 'true') {
      const openaiKey = await getSetting('openai_api_key');
      const ttsVoice = (await getSetting('tts_voice')) || 'nova';
      if (openaiKey) {
        const audioBuffer = await generateSpeech(openaiKey, aiResponse, ttsVoice);
        if (audioBuffer) {
          if (ttsMode !== 'audio_only') {
            await sendBlocks(remoteJid, number, aiResponse);
          }
          if ((await redis.get(KEYS.atendimento(number))) !== 'humano') {
            await redis.set(KEYS.aiBusy(number), '1', 'EX', TTL.AI_BUSY);
            await sendPTTAudio(remoteJid, audioBuffer.toString('base64'));
          }
        } else {
          await sendBlocks(remoteJid, number, aiResponse);
        }
      } else {
        await sendBlocks(remoteJid, number, aiResponse);
      }
    } else {
      // Send text response in blocks with typing simulation
      await sendBlocks(remoteJid, number, aiResponse);
    }

    const aiMsgId = `ai_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, aiMsgId, 'assistant', aiResponse),
      upsertConversation(number, 'active', aiResponse),
      pushRedisHistory(number, 'assistant', aiResponse),
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

    // Deduplicate: Evolution API sometimes fires the same event twice
    if (msgId) {
      const dedupKey = `dedup.${msgId}`;
      const isNew = await redis.set(dedupKey, '1', 'EX', 300, 'NX');
      if (isNew !== 'OK') return NextResponse.json({ ok: true });
    }

    // Outgoing (fromMe=true) → save message + pause AI if human attendant is responding
    if (fromMe) {
      const aiBusy = await redis.get(KEYS.aiBusy(number));
      const outText = extractText(data.message);
      if (aiBusy !== '1') {
        const reactivationMinutes = parseFloat((await getSetting('ai_reactivation_minutes')) || '60');
        const pauseTtl = Math.round(reactivationMinutes * 60);
        await redis.set(KEYS.atendimento(number), 'humano', 'EX', pauseTtl);
        if (outText.trim()) {
          const humanMsgId = msgId || `human_${number}_${Date.now()}`;
          await Promise.all([
            saveMessage(number, humanMsgId, 'human', outText.trim()),
            upsertConversation(number, 'paused', outText.trim()),
          ]);
        } else {
          await upsertConversation(number, 'paused');
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Incoming message
    const text = extractText(data.message);
    if (!text.trim()) return NextResponse.json({ ok: true });

    const pushName: string | undefined = data.pushName;
    const instance = process.env.EVOLUTION_INSTANCE || 'AT WT';

    // Whitelist: if set, only respond to listed numbers
    const allowedRaw = await getSetting('allowed_numbers');
    if (allowedRaw?.trim()) {
      const allowed = allowedRaw.split(',').map(n => n.trim()).filter(Boolean);
      if (!allowed.includes(number)) return NextResponse.json({ ok: true });
    }

    // Blacklist: never respond to blocked numbers
    const blockedRaw = await getSetting('blocked_numbers');
    if (blockedRaw?.trim()) {
      const blocked = blockedRaw.split(',').map(n => n.trim()).filter(Boolean);
      if (blocked.includes(number)) return NextResponse.json({ ok: true });
    }

    if ((await redis.get(KEYS.atendimento(number))) === 'humano') {
      return NextResponse.json({ ok: true });
    }

    const userMsgId = msgId || `user_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, userMsgId, 'user', text),
      upsertConversation(number, 'active', text, pushName),
      redis.set(KEYS.atendimento(number), 'true', 'EX', TTL.SESSAO_ATIVA),
      pushRedisHistory(number, 'user', text),
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
      // Set aiBusy so the fromMe webhook callback doesn't mistakenly pause the AI
      await redis.set(KEYS.aiBusy(number), '1', 'EX', TTL.AI_BUSY);
      await sendMessage(remoteJid, welcome, 1000);
      const welcomeId = `welcome_${number}_${Date.now()}`;
      await Promise.all([
        saveMessage(number, welcomeId, 'assistant', welcome),
        upsertConversation(number, 'active', welcome),
      ]);
      return NextResponse.json({ ok: true });
    }

    // Block only explicitly excluded statuses; respond to everything else
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
