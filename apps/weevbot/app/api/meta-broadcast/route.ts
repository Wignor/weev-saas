import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export async function POST(req: Request) {
  const { msgType, freeText, templateName, templateLang, templateVars, numbers } = await req.json();

  const phoneNumberId = await getSetting('meta_phone_number_id');
  const accessToken   = await getSetting('meta_access_token');

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: 'Configure o Phone Number ID e o Token de Acesso da Meta nas Configurações antes de enviar.' },
      { status: 400 }
    );
  }

  const results: { number: string; ok: boolean; error?: string }[] = [];

  for (const num of (numbers as string[])) {
    const clean = num.replace(/\D/g, '').trim();
    if (!clean) continue;

    let payload: Record<string, unknown>;

    if (msgType === 'template') {
      const vars = (templateVars as string[]).filter(Boolean);
      payload = {
        messaging_product: 'whatsapp',
        to: clean,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang || 'pt_BR' },
          ...(vars.length
            ? { components: [{ type: 'body', parameters: vars.map(v => ({ type: 'text', text: v })) }] }
            : {}),
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        to: clean,
        type: 'text',
        text: { body: freeText },
      };
    }

    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res) {
      results.push({ number: clean, ok: false, error: 'Falha de conexão com a Meta API' });
    } else if (res.ok) {
      results.push({ number: clean, ok: true });
    } else {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      results.push({ number: clean, ok: false, error: err?.error?.message || `Erro HTTP ${res.status}` });
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json({ results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
}
