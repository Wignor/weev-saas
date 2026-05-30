import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { upsertConversation, saveMessage, getSetting, getContact, insertNewContact, setContactStatus, touchContact } from '@/lib/db';
import { sendMessage, sendVideo, sendDocument, notifyAttendant, sendPTTAudio } from '@/lib/evolution';
import { generateSpeech } from '@/lib/tts';
import { runAgent } from '@/lib/agent';
import { splitIntoBlocks } from '@/lib/message-utils';
import { getTenantByInstance } from '@/lib/db';

const CLASSIF_KEY = (tid: string, n: string) => `t:${tid}:classif.${n}`;
const PENDING_KEY = (tid: string, n: string) => `t:${tid}:pending.${n}`;
const LAST_MSG_KEY = (tid: string, n: string) => `t:${tid}:lastmsg.${n}`;
const LOCK_KEY    = (tid: string, n: string) => `t:${tid}:lock.${n}`;
const DEBOUNCE_MS = 8000;

interface PendingMsg { text: string; msgId: string; remoteJid: string; pushName?: string; }

function extractText(msg: Record<string, unknown> | undefined): string {
  if (!msg) return '';
  return (msg.conversation as string) ||
    ((msg.extendedTextMessage as Record<string, string>)?.text) ||
    ((msg.imageMessage as Record<string, string>)?.caption) ||
    ((msg.videoMessage as Record<string, string>)?.caption) || '';
}

function classifyFromText(text: string): 'lead' | 'cliente' | null {
  const t = text.toLowerCase().trim().replace(/[*_~]/g, '');
  if (/j[aá]\s*sou\s*cliente/.test(t)) return 'cliente';
  if (/quero\s*conhecer/.test(t)) return 'lead';
  if (/\b(j[aá]|sim|sou|tenho|cliente|comprei)\b/.test(t)) return 'cliente';
  if (/\b(n[aã]o|nunca|conhecer|primeira|novo)\b/.test(t)) return 'lead';
  return null;
}

async function sendBlocks(instance: string, remoteJid: string, tenantId: string, number: string, text: string) {
  const blocks = splitIntoBlocks(text);
  for (let i = 0; i < blocks.length; i++) {
    if ((await redis.get(KEYS.atendimento(tenantId, number))) === 'humano') break;
    await sendMessage(instance, remoteJid, blocks[i], 3000);
    if (i < blocks.length - 1) {
      if ((await redis.get(KEYS.atendimento(tenantId, number))) === 'humano') break;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function processAIQueue(tenantId: string, instance: string, number: string) {
  try {
    const rawMsgs = await redis.lrange(PENDING_KEY(tenantId, number), 0, -1);
    if (!rawMsgs.length) return;
    await redis.del(PENDING_KEY(tenantId, number));

    const msgs: PendingMsg[] = rawMsgs.map(m => JSON.parse(m));
    const { remoteJid, pushName } = msgs[msgs.length - 1];
    const combinedText = msgs.map(m => m.text).join('\n');

    if ((await redis.get(KEYS.atendimento(tenantId, number))) === 'humano') return;

    const contact = await getContact(tenantId, number);
    const BLOCKED = ['inquilino', 'outro'];
    if (contact?.status && BLOCKED.includes(contact.status)) return;

    const awaitingClassif = await redis.get(CLASSIF_KEY(tenantId, number));
    if (awaitingClassif === '1' || contact?.status === 'pendente_classificacao') {
      const classification = classifyFromText(combinedText);
      await redis.set(KEYS.aiBusy(tenantId, number), '1', 'EX', TTL.AI_BUSY);
      if (classification) {
        await Promise.all([setContactStatus(tenantId, number, classification, pushName), redis.del(CLASSIF_KEY(tenantId, number))]);
        if (classification === 'cliente') {
          const confirmMsg = '✅ Ótimo! Já registrei você como *cliente*. Como posso ajudá-lo hoje?';
          await sendMessage(instance, remoteJid, confirmMsg, 800);
          const id = `ai_classif_${number}_${Date.now()}`;
          await Promise.all([saveMessage(tenantId, number, id, 'assistant', confirmMsg), upsertConversation(tenantId, number, 'active', confirmMsg)]);
        } else {
          // Lead: run AI immediately so it starts the qualification flow
          const { text: aiResponse, toolCalls: _ } = await runAgent(tenantId, number, combinedText, 'lead', pushName);
          if ((await redis.get(KEYS.atendimento(tenantId, number))) !== 'humano') {
            await sendBlocks(instance, remoteJid, tenantId, number, aiResponse);
            const id = `ai_lead_${number}_${Date.now()}`;
            await Promise.all([saveMessage(tenantId, number, id, 'assistant', aiResponse), upsertConversation(tenantId, number, 'active', aiResponse)]);
          }
        }
      } else {
        const retry = 'Não entendi bem. Você pode me dizer: você *já é nosso cliente* (responda "sim") ou está conhecendo nossos serviços pela primeira vez (responda "não")?';
        await sendMessage(instance, remoteJid, retry, 1000);
        const id = `ai_retry_${number}_${Date.now()}`;
        await Promise.all([saveMessage(tenantId, number, id, 'assistant', retry), upsertConversation(tenantId, number, 'active', retry)]);
      }
      return;
    }

    const { text: aiResponse, toolCalls } = await runAgent(tenantId, number, combinedText, contact?.status, pushName);
    touchContact(tenantId, number, pushName).catch(() => {});
    if ((await redis.get(KEYS.atendimento(tenantId, number))) === 'humano') return;

    await redis.set(KEYS.aiBusy(tenantId, number), '1', 'EX', TTL.AI_BUSY);

    if (toolCalls.includes('send_video')) {
      const url = await getSetting(tenantId, 'video_url');
      if (url) { await sendVideo(instance, remoteJid, url, '').catch(() => {}); await saveMessage(tenantId, number, `media_video_${number}_${Date.now()}`, 'assistant', `[MEDIA:video] ${url}`).catch(() => {}); }
    }
    if (toolCalls.includes('send_pdf')) {
      const url = await getSetting(tenantId, 'pdf_url');
      if (url) { await sendDocument(instance, remoteJid, url, 'documento.pdf').catch(() => {}); await saveMessage(tenantId, number, `media_pdf_${number}_${Date.now()}`, 'assistant', `[MEDIA:document:documento.pdf] ${url}`).catch(() => {}); }
    }
    if (toolCalls.includes('notify_attendant')) {
      const num = await getSetting(tenantId, 'notification_number');
      if (num) await notifyAttendant(instance, number, pushName || number, num).catch(() => {});
    }

    const ttsEnabled = await getSetting(tenantId, 'tts_enabled');
    const ttsMode = (await getSetting(tenantId, 'tts_mode')) || 'both';

    if (ttsEnabled === 'true') {
      const openaiKey = await getSetting(tenantId, 'openai_api_key');
      const ttsVoice = (await getSetting(tenantId, 'tts_voice')) || 'nova';
      if (openaiKey) {
        const audioBuffer = await generateSpeech(openaiKey, aiResponse, ttsVoice);
        if (audioBuffer) {
          if (ttsMode !== 'audio_only') await sendBlocks(instance, remoteJid, tenantId, number, aiResponse);
          if ((await redis.get(KEYS.atendimento(tenantId, number))) !== 'humano') {
            await redis.set(KEYS.aiBusy(tenantId, number), '1', 'EX', TTL.AI_BUSY);
            await sendPTTAudio(instance, remoteJid, audioBuffer.toString('base64'));
          }
        } else {
          await sendBlocks(instance, remoteJid, tenantId, number, aiResponse);
        }
      } else {
        await sendBlocks(instance, remoteJid, tenantId, number, aiResponse);
      }
    } else {
      await sendBlocks(instance, remoteJid, tenantId, number, aiResponse);
    }

    const aiId = `ai_${number}_${Date.now()}`;
    await Promise.all([saveMessage(tenantId, number, aiId, 'assistant', aiResponse), upsertConversation(tenantId, number, 'active', aiResponse)]);
  } catch (err) {
    console.error('[processAIQueue]', err);
  } finally {
    await redis.del(LOCK_KEY(tenantId, number)).catch(() => {});
    const rem = await redis.llen(PENDING_KEY(tenantId, number)).catch(() => 0);
    if (rem > 0) {
      const relock = await redis.set(LOCK_KEY(tenantId, number), '1', 'EX', 120, 'NX').catch(() => null);
      if (relock === 'OK') setTimeout(() => processAIQueue(tenantId, instance, number), 0);
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true });

    const data = body.data;
    if (!data?.key) return NextResponse.json({ ok: true });

    const instance = body.instance as string;
    if (!instance) return NextResponse.json({ ok: true });

    const tenant = await getTenantByInstance(instance);
    if (!tenant || tenant.status !== 'active') return NextResponse.json({ ok: true });

    const tenantId = tenant.id;
    const { remoteJid, fromMe, id: msgId } = data.key;
    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) return NextResponse.json({ ok: true });

    const number = remoteJid.split('@')[0];

    // Deduplicate: Evolution API sometimes fires the same event twice
    if (msgId) {
      const dedupKey = `t:${tenantId}:dedup:${msgId}`;
      const isNew = await redis.set(dedupKey, '1', 'EX', 300, 'NX');
      if (isNew !== 'OK') return NextResponse.json({ ok: true });
    }

    // Outgoing (fromMe)
    if (fromMe) {
      const aiBusy = await redis.get(KEYS.aiBusy(tenantId, number));
      const outText = extractText(data.message);
      if (aiBusy !== '1' && outText.trim()) {
        const reactivationMinutes = parseFloat((await getSetting(tenantId, 'ai_reactivation_minutes')) || '60');
        const pauseTtl = Math.round(reactivationMinutes * 60);
        await redis.set(KEYS.atendimento(tenantId, number), 'humano', 'EX', pauseTtl);
        const humanId = msgId || `human_${number}_${Date.now()}`;
        await Promise.all([saveMessage(tenantId, number, humanId, 'human', outText.trim()), upsertConversation(tenantId, number, 'paused', outText.trim())]);
      }
      return NextResponse.json({ ok: true });
    }

    const text = extractText(data.message);
    if (!text.trim()) return NextResponse.json({ ok: true });

    const pushName: string | undefined = data.pushName;

    if ((await redis.get(KEYS.atendimento(tenantId, number))) === 'humano') return NextResponse.json({ ok: true });

    const userMsgId = msgId || `user_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(tenantId, number, userMsgId, 'user', text),
      upsertConversation(tenantId, number, 'active', text, pushName),
      redis.set(KEYS.sessaoAtiva(tenantId, number), 'true', 'EX', TTL.SESSAO_ATIVA),
    ]);

    // New contact
    const contact = await getContact(tenantId, number);
    if (!contact) {
      await insertNewContact(tenantId, number, pushName);
      await redis.set(CLASSIF_KEY(tenantId, number), '1', 'EX', 1800);
      const displayName = pushName || 'amigo(a)';
      const rawWelcome = (await getSetting(tenantId, 'welcome_message')) ||
        `Olá, {nome}! 👋\nSeja bem-vindo(a)!\n\nVocê já é nosso cliente ou está conhecendo nossos serviços pela primeira vez?\n\n👉 *JÁ SOU CLIENTE*\n👉 *QUERO CONHECER*`;
      const welcome = rawWelcome.replace(/\{nome\}/gi, displayName);
      await redis.set(KEYS.aiBusy(tenantId, number), '1', 'EX', TTL.AI_BUSY);
      await sendMessage(instance, remoteJid, welcome, 1000);
      const wId = `welcome_${number}_${Date.now()}`;
      await Promise.all([saveMessage(tenantId, number, wId, 'assistant', welcome), upsertConversation(tenantId, number, 'active', welcome)]);
      return NextResponse.json({ ok: true });
    }

    const BLOCKED = ['inquilino', 'outro'];
    if (contact.status && BLOCKED.includes(contact.status)) return NextResponse.json({ ok: true });

    const pendingMsg: PendingMsg = { text, msgId: userMsgId, remoteJid, pushName };
    await redis.rpush(PENDING_KEY(tenantId, number), JSON.stringify(pendingMsg));
    await redis.expire(PENDING_KEY(tenantId, number), 120);
    await redis.set(LAST_MSG_KEY(tenantId, number), String(Date.now()), 'EX', 120);

    const lockAcquired = await redis.set(LOCK_KEY(tenantId, number), '1', 'EX', 120, 'NX');
    if (lockAcquired === 'OK') {
      const check = async () => {
        try {
          const lastMs = parseInt((await redis.get(LAST_MSG_KEY(tenantId, number))) || '0', 10);
          if (Date.now() - lastMs < DEBOUNCE_MS) { setTimeout(check, 500); return; }
          await processAIQueue(tenantId, instance, number);
        } catch { await redis.del(LOCK_KEY(tenantId, number)).catch(() => {}); }
      };
      setTimeout(check, DEBOUNCE_MS);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
