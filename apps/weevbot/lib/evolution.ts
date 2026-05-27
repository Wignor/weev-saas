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

export async function sendMessage(remoteJid: string, text: string) {
  await fetch(`${BASE_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: phone(remoteJid), text }),
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

// Send notification to internal attendant number
export async function notifyAttendant(customerNumber: string, customerName: string, attendantNumber: string) {
  const text = `🔔 *Solicitação de Atendimento*\n\nCliente: *${customerName}* (${customerNumber}) está aguardando atendimento humano.`;
  await fetch(`${BASE_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: attendantNumber, text }),
  });
}
