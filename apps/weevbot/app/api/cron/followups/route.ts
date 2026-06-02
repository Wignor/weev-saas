import { NextResponse } from 'next/server';
import { getPendingFollowups, markFollowupSent } from '@/lib/db';
import { sendMessage, sendVideo, sendDocument } from '@/lib/evolution';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'weev_cron_2024';
const INSTANCE = process.env.EVOLUTION_INSTANCE!;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const followups = await getPendingFollowups();
  let processed = 0;

  for (const f of followups) {
    try {
      const remoteJid = `${f.conversation_id}@s.whatsapp.net`;

      if (f.followup_message?.trim()) {
        await sendMessage(remoteJid, f.followup_message, 1000);
      }

      if (f.file_url) {
        if (f.file_type === 'video') {
          await sendVideo(remoteJid, f.file_url, '').catch(() => {});
        } else if (f.file_type === 'document') {
          await sendDocument(remoteJid, f.file_url, f.file_name || 'documento.pdf').catch(() => {});
        }
      }

      await markFollowupSent(f.id);
      processed++;
    } catch (err) {
      console.error('[cron/followups]', f.id, err);
    }
  }

  return NextResponse.json({ ok: true, processed, total: followups.length });
}
