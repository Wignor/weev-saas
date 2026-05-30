const BASE_URL = process.env.EVOLUTION_API_URL!;
const INSTANCE = process.env.EVOLUTION_INSTANCE!;
const API_KEY = process.env.EVOLUTION_API_KEY!;

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: API_KEY,
});

function phone(remoteJid: string): string {
  return remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
}

// delayMs: Evolution API shows "Digitando..." for this duration before delivering
export async function sendMessage(remoteJid: string, text: string, delayMs = 0) {
  const body: Record<string, unknown> = { number: phone(remoteJid), text };
  if (delayMs > 0) {
    body.options = { delay: delayMs, presence: 'composing' };
  }
  await fetch(`${BASE_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
}

export async function sendTyping(remoteJid: string) {
  await fetch(`${BASE_URL}/chat/updatePresence/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: phone(remoteJid),
      options: { delay: 1200, presence: 'composing' },
    }),
  }).catch(() => {});
}

export async function sendVideo(remoteJid: string, mediaUrl: string, caption = '') {
  await fetch(`${BASE_URL}/message/sendMedia/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: phone(remoteJid),
      mediatype: 'video',
      mimetype: 'video/mp4',
      media: mediaUrl,
      caption,
    }),
  });
}

export async function sendDocument(remoteJid: string, mediaUrl: string, fileName = 'documento.pdf') {
  await fetch(`${BASE_URL}/message/sendMedia/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: phone(remoteJid),
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: mediaUrl,
      fileName,
    }),
  });
}

export async function sendImage(remoteJid: string, mediaUrl: string, caption = '') {
  const ext = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase();
  const mimetype = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  await fetch(`${BASE_URL}/message/sendMedia/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: phone(remoteJid),
      mediatype: 'image',
      mimetype,
      media: mediaUrl,
      caption,
    }),
  });
}

export async function sendAudio(remoteJid: string, mediaUrl: string) {
  const ext = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase();
  const mimetype = ext === 'ogg' ? 'audio/ogg' : ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
  await fetch(`${BASE_URL}/message/sendMedia/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: phone(remoteJid),
      mediatype: 'audio',
      mimetype,
      media: mediaUrl,
    }),
  });
}

// Send PTT (voice note) audio from base64-encoded opus data
export async function sendPTTAudio(remoteJid: string, audioBase64: string) {
  await fetch(`${BASE_URL}/message/sendWhatsAppAudio/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: phone(remoteJid),
      audio: audioBase64,
      encoding: true,
    }),
  });
}

export async function getProfilePictureUrl(number: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/chat/fetchProfilePictureUrl/${encodeURIComponent(INSTANCE)}`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ number }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.profilePictureUrl as string) ?? null;
  } catch {
    return null;
  }
}

export async function notifyAttendant(customerNumber: string, customerName: string, attendantNumber: string) {
  const text = `🔔 *Solicitação de Atendimento*\n\nCliente: *${customerName}* (${customerNumber}) está aguardando atendimento humano.`;
  await fetch(`${BASE_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: attendantNumber, text }),
  });
}
