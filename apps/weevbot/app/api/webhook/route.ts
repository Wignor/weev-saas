import { NextResponse } from 'next/server';
import { redis, KEYS, TTL } from '@/lib/redis';
import { upsertConversation, saveMessage, getSetting } from '@/lib/db';
import { sendMessage, sendTyping, sendVideo, sendDocument, notifyAttendant } from '@/lib/evolution';
import { runAgent } from '@/lib/agent';
import { getContact, insertNewContact, setContactStatus, touchContact } from '@/lib/contacts';

// Redis key for pending classification
const CLASSIF_KEY = (n: string) => `classificacao_aguardando.${n}`;

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

// Classify contact based on their response to the welcome question
function classifyFromText(text: string): 'lead' | 'cliente' | null {
  const t = text.toLowerCase().trim().replace(/[*_~]/g, '');
  // Explicit options from the welcome message
  if (/j[aá]\s*sou\s*cliente/.test(t)) return 'cliente';
  if (/quero\s*conhecer/.test(t)) return 'lead';
  // Natural language fallback
  const isClient = /\b(j[aá]|sim|sou|tenho|cliente|comprei|compr[ao]u|assino)\b/.test(t);
  const isLead = /\b(n[aã]o|nunca|conhecer|primeira|novo|primeiro)\b/.test(t);
  if (isClient) return 'cliente';
  if (isLead) return 'lead';
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Always forward to n8n if configured
    const n8nUrl = await getSetting('n8n_forward_url');
    if (n8nUrl) forwardToN8n(n8nUrl, body);

    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ ok: true });
    }

    const data = body.data;
    if (!data?.key) return NextResponse.json({ ok: true });

    const { remoteJid, fromMe, id: msgId } = data.key;

    if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
      return NextResponse.json({ ok: true });
    }

    const number = remoteJid.split('@')[0];

    // ── Outgoing message (fromMe=true) ─────────────────────────────────────
    if (fromMe) {
      const aiBusy = await redis.get(KEYS.aiBusy(number));
      if (aiBusy !== '1') {
        const pauseTtl = parseInt(
          (await getSetting('pause_ttl_seconds')) || String(TTL.PAUSA_HUMANO),
          10
        );
        await redis.set(KEYS.atendimento(number), 'humano', 'EX', pauseTtl);
        await upsertConversation(number, 'paused');
      }
      return NextResponse.json({ ok: true });
    }

    // ── Incoming message ────────────────────────────────────────────────────
    const text = extractText(data.message);
    if (!text.trim()) return NextResponse.json({ ok: true });

    const pushName: string | undefined = data.pushName;
    const instance = process.env.EVOLUTION_INSTANCE || 'AT WT';

    // Check if AI is paused (human attendant active)
    const pauseState = await redis.get(KEYS.atendimento(number));
    if (pauseState === 'humano') return NextResponse.json({ ok: true });

    // Save message + set session active
    const userMsgId = msgId || `user_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, userMsgId, 'user', text),
      upsertConversation(number, 'active', text, pushName),
      redis.set(KEYS.atendimento(number), 'true', 'EX', TTL.SESSAO_ATIVA),
    ]);

    // ── Classification flow ────────────────────────────────────────────────
    const contact = await getContact(number);

    // STEP 1: Brand-new contact — never seen before
    if (!contact) {
      await insertNewContact(number, pushName, instance);
      await redis.set(CLASSIF_KEY(number), '1', 'EX', 1800);

      const displayName = pushName || 'amigo(a)';
      const rawWelcome = (await getSetting('welcome_message')) ||
        `Olá, {nome}! 👋\nSeja bem-vindo(a)!\n\nVocê já é nosso cliente ou está conhecendo nossos serviços pela primeira vez?\n\n👉 *JÁ SOU CLIENTE*\n👉 *QUERO CONHECER*`;

      // Replace {nome} placeholder with actual contact name
      const welcome = rawWelcome.replace(/\{nome\}/gi, displayName);

      await sendTyping(remoteJid);
      await new Promise(r => setTimeout(r, 1000));
      await sendMessage(remoteJid, welcome);

      return NextResponse.json({ ok: true });
    }

    // STEP 2: Awaiting classification response
    const awaitingClassif = await redis.get(CLASSIF_KEY(number));
    if (awaitingClassif === '1' || contact.status === 'pendente_classificacao') {
      const classification = classifyFromText(text);

      if (classification) {
        // Classified!
        await Promise.all([
          setContactStatus(number, classification, pushName),
          redis.del(CLASSIF_KEY(number)),
        ]);

        const confirmMsg =
          classification === 'cliente'
            ? '✅ Ótimo! Já registrei você como *cliente*. Como posso ajudá-lo hoje?'
            : '✅ Perfeito! Fique à vontade para conhecer nossos serviços. Como posso ajudá-lo?';

        await sendTyping(remoteJid);
        await new Promise(r => setTimeout(r, 800));
        await sendMessage(remoteJid, confirmMsg);

        // Update conversation + save AI reply
        const aiMsgId = `ai_classif_${number}_${Date.now()}`;
        await Promise.all([
          saveMessage(number, aiMsgId, 'assistant', confirmMsg),
          upsertConversation(number, 'active', confirmMsg),
        ]);
      } else {
        // Can't classify — ask again
        const retry =
          'Não entendi bem. Você pode me dizer: você *já é nosso cliente* (responda "sim") ou está conhecendo nossos serviços pela primeira vez (responda "não")?';
        await sendMessage(remoteJid, retry);
      }

      return NextResponse.json({ ok: true });
    }

    // ── Normal AI flow (contact is classified) ─────────────────────────────
    const { text: aiResponse, toolCalls } = await runAgent(
      number,
      text,
      contact.status,
      pushName
    );

    // Touch Supabase timestamps
    touchContact(number, pushName).catch(() => {});

    // Pre-send check
    const preCheck = await redis.get(KEYS.atendimento(number));
    if (preCheck === 'humano') return NextResponse.json({ ok: true });

    await redis.set(KEYS.aiBusy(number), '1', 'EX', TTL.AI_BUSY);

    await sendTyping(remoteJid);
    await new Promise(r => setTimeout(r, 1500));

    const finalCheck = await redis.get(KEYS.atendimento(number));
    if (finalCheck === 'humano') return NextResponse.json({ ok: true });

    // Execute tool calls
    if (toolCalls.includes('send_video')) {
      const videoUrl = await getSetting('video_url');
      if (videoUrl) await sendVideo(remoteJid, videoUrl, 'Aqui está o vídeo! 🎬').catch(() => {});
    }
    if (toolCalls.includes('send_pdf')) {
      const pdfUrl = await getSetting('pdf_url');
      if (pdfUrl) await sendDocument(remoteJid, pdfUrl, 'documento.pdf').catch(() => {});
    }
    if (toolCalls.includes('notify_attendant')) {
      const attendantNum = await getSetting('notification_number');
      if (attendantNum) {
        await notifyAttendant(number, pushName || number, attendantNum).catch(() => {});
      }
    }

    // Send AI text response
    await sendMessage(remoteJid, aiResponse);

    const aiMsgId = `ai_${number}_${Date.now()}`;
    await Promise.all([
      saveMessage(number, aiMsgId, 'assistant', aiResponse),
      upsertConversation(number, 'active', aiResponse),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
