const BASE = process.env.EVOLUTION_API_URL || 'https://api.weevzap.pro';
const KEY  = process.env.EVOLUTION_API_KEY  || '';

async function evol(method: string, path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Evolution ${method} ${path} → ${r.status}`);
  return r.json();
}

export async function createInstance(instanceName: string, webhookUrl: string) {
  await evol('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
  });
  await evol('POST', `/webhook/set/${instanceName}`, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      events: ['MESSAGES_UPSERT'],
    },
  });
}

export async function getQrCode(instanceName: string) {
  return evol('GET', `/instance/connect/${instanceName}`);
}

export async function getInstanceStatus(instanceName: string) {
  try {
    return await evol('GET', `/instance/connectionState/${instanceName}`);
  } catch { return { state: 'close' }; }
}

export async function deleteInstance(instanceName: string) {
  return evol('DELETE', `/instance/delete/${instanceName}`);
}

export async function logoutInstance(instanceName: string) {
  return evol('DELETE', `/instance/logout/${instanceName}`);
}

export async function sendMessage(instance: string, remoteJid: string, text: string, delay = 0) {
  const body: Record<string, unknown> = { number: remoteJid, text };
  if (delay > 0) body.options = { delay, presence: 'composing' };
  return evol('POST', `/message/sendText/${instance}`, body);
}

export async function sendVideo(instance: string, remoteJid: string, url: string, caption = '') {
  return evol('POST', `/message/sendMedia/${instance}`, {
    number: remoteJid,
    mediatype: 'video',
    media: url,
    caption,
  });
}

export async function sendDocument(instance: string, remoteJid: string, url: string, fileName: string) {
  return evol('POST', `/message/sendMedia/${instance}`, {
    number: remoteJid,
    mediatype: 'document',
    media: url,
    fileName,
  });
}

export async function sendPTTAudio(instance: string, remoteJid: string, audioBase64: string) {
  return evol('POST', `/message/sendWhatsAppAudio/${instance}`, {
    number: remoteJid,
    audio: audioBase64,
    encoding: true,
  });
}

export async function notifyAttendant(instance: string, contactNumber: string, contactName: string, attendantNumber: string) {
  const jid = `${attendantNumber}@s.whatsapp.net`;
  const text = `🔔 *Novo atendimento solicitado*\n\nContato: *${contactName}*\nNúmero: ${contactNumber}\n\nAcesse o painel para atender.`;
  return sendMessage(instance, jid, text);
}
