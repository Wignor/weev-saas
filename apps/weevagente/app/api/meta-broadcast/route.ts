import { NextResponse } from 'next/server';
import { getSetting, createScheduledBroadcast, getRecentScheduledBroadcasts } from '@/lib/db';
import { getTenantId } from '@/lib/tenant-context';

async function sendToMeta(phoneNumberId: string, accessToken: string, num: string, msgType: string, opts: {
  freeText?: string; templateName?: string; templateLang?: string; templateVars?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const clean = num.replace(/\D/g, '').trim();
  if (!clean) return { ok: false, error: 'Número inválido' };

  let payload: Record<string, unknown>;
  if (msgType === 'template') {
    const vars = (opts.templateVars || []).filter(Boolean);
    payload = {
      messaging_product: 'whatsapp', to: clean, type: 'template',
      template: {
        name: opts.templateName,
        language: { code: opts.templateLang || 'pt_BR' },
        ...(vars.length ? { components: [{ type: 'body', parameters: vars.map(v => ({ type: 'text', text: v })) }] } : {}),
      },
    };
  } else {
    payload = { messaging_product: 'whatsapp', to: clean, type: 'text', text: { body: opts.freeText } };
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!res) return { ok: false, error: 'Falha de conexão com a Meta API' };
  if (res.ok) return { ok: true };
  const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
  return { ok: false, error: err?.error?.message || `Erro HTTP ${res.status}` };
}

export async function GET() {
  try {
    const tenantId = await getTenantId().catch(() => null);
    if (!tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const broadcasts = await getRecentScheduledBroadcasts(tenantId);
    return NextResponse.json({ broadcasts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const tenantId = await getTenantId().catch(() => null);
  if (!tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { msgType, freeText, templateName, templateLang, templateVars, numbers, scheduledAt } = await req.json();

  const phoneNumberId = await getSetting(tenantId, 'meta_phone_number_id');
  const accessToken   = await getSetting(tenantId, 'meta_access_token');

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: 'Configure o Phone Number ID e o Token de Acesso da Meta nas Configurações antes de enviar.' },
      { status: 400 }
    );
  }

  const parsedNumbers = (numbers as string[]).map(n => n.replace(/\D/g, '').trim()).filter(Boolean);
  if (!parsedNumbers.length) return NextResponse.json({ error: 'Nenhum número válido.' }, { status: 400 });

  // Scheduled send — save to DB
  if (scheduledAt) {
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return NextResponse.json({ error: 'Data de agendamento inválida ou no passado.' }, { status: 400 });
    }
    const broadcast = await createScheduledBroadcast(tenantId, msgType, parsedNumbers, date, {
      templateName, templateLang, templateVars, freeText,
    });
    return NextResponse.json({ scheduled: true, id: broadcast.id, scheduledAt: broadcast.scheduled_at });
  }

  // Immediate send
  const results: { number: string; ok: boolean; error?: string }[] = [];
  for (const num of parsedNumbers) {
    const r = await sendToMeta(phoneNumberId, accessToken, num, msgType, { freeText, templateName, templateLang, templateVars });
    results.push({ number: num.replace(/\D/g, ''), ...r });
    await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json({ results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
}
