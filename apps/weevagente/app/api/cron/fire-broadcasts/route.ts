import { NextResponse } from 'next/server';
import { getPendingScheduledBroadcasts, markBroadcastSent, markBroadcastFailed, getSetting } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'weev_cron_2024';

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const broadcasts = await getPendingScheduledBroadcasts();
  let processed = 0;

  for (const b of broadcasts) {
    try {
      const phoneNumberId = await getSetting(b.tenant_id, 'meta_phone_number_id');
      const accessToken   = await getSetting(b.tenant_id, 'meta_access_token');

      if (!phoneNumberId || !accessToken) {
        await markBroadcastFailed(b.id, 'Credenciais Meta não configuradas');
        continue;
      }

      let sent = 0;
      const numbers: string[] = Array.isArray(b.numbers) ? b.numbers : JSON.parse(b.numbers as unknown as string);
      const templateVars: string[] = Array.isArray(b.template_vars)
        ? b.template_vars
        : b.template_vars ? JSON.parse(b.template_vars as unknown as string) : [];

      for (const num of numbers) {
        const clean = num.replace(/\D/g, '').trim();
        if (!clean) continue;

        let payload: Record<string, unknown>;
        if (b.msg_type === 'template') {
          const vars = templateVars.filter(Boolean);
          payload = {
            messaging_product: 'whatsapp', to: clean, type: 'template',
            template: {
              name: b.template_name,
              language: { code: b.template_lang || 'pt_BR' },
              ...(vars.length ? { components: [{ type: 'body', parameters: vars.map(v => ({ type: 'text', text: v })) }] } : {}),
            },
          };
        } else {
          payload = { messaging_product: 'whatsapp', to: clean, type: 'text', text: { body: b.free_text } };
        }

        const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => null);

        if (res?.ok) sent++;
        await new Promise(r => setTimeout(r, 300));
      }

      await markBroadcastSent(b.id, sent);
      processed++;
    } catch (err) {
      await markBroadcastFailed(b.id, String(err)).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, processed, total: broadcasts.length });
}
