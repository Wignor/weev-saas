import { NextResponse } from 'next/server';
import { createTenant, activateTenant, suspendTenant, getTenantByEmail, incrementMaxInstancesByEmail } from '@/lib/db';
import crypto from 'crypto';

const KIWIFY_TOKEN = process.env.KIWIFY_TOKEN || '';

function randomToken(): string {
  return crypto.randomBytes(20).toString('hex');
}

async function sendSetupEmail(email: string, name: string, setupUrl: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`[setup-email] URL para ${email}: ${setupUrl}`);
    return;
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'WeevZap <noreply@weevzap.pro>',
      to: [email],
      subject: '🤖 Configure sua conta WeevZap',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#7c3aed">Bem-vindo ao WeevZap, ${name}!</h2>
          <p>Sua compra foi confirmada. Clique no botão abaixo para criar sua senha e conectar seu WhatsApp:</p>
          <a href="${setupUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
            Configurar minha conta
          </a>
          <p style="color:#888;font-size:12px">Link válido por 7 dias. Se não foi você, ignore este e-mail.</p>
        </div>`,
    }),
  }).catch(e => console.error('[resend]', e));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate Kiwify token
    if (body.token !== KIWIFY_TOKEN) {
      console.warn('[kiwify] token inválido');
      return NextResponse.json({ ok: true }); // silently ignore
    }

    const event    = body.event as string;
    const customer = body.Customer ?? body.customer ?? {};
    const email    = (customer.email ?? '').toLowerCase().trim();
    const name     = customer.full_name ?? customer.name ?? email;
    const subscriptionId = body.Subscription?.id ?? body.subscription?.id ?? body.order_id ?? '';
    const subscriberId   = body.Customer?.id   ?? body.customer?.id   ?? email;

    console.log(`[kiwify] event=${event} email=${email}`);

    if (event === 'order_approved' || event === 'purchase_approved' || event === 'subscription_active') {
      const existing = await getTenantByEmail(email);
      if (!existing) {
        // Novo cliente → criar conta
        const setupToken = randomToken();
        const tenant = await createTenant(email, name, subscriberId, subscriptionId, setupToken);
        const setupUrl = `${process.env.NEXT_PUBLIC_URL || 'https://agente.weevzap.pro'}/setup?token=${setupToken}`;
        await sendSetupEmail(email, name, setupUrl);
        console.log(`[kiwify] tenant criado: ${tenant.id} → ${email}`);
      } else if (existing.status === 'active') {
        // Cliente já ativo → compra de conexão extra
        await incrementMaxInstancesByEmail(email);
        console.log(`[kiwify] extra instance liberada: ${email}`);
      } else if (existing.status === 'suspended' || existing.status === 'cancelled') {
        // Cliente suspenso → reativar
        await activateTenant(subscriptionId);
        console.log(`[kiwify] tenant reativado: ${email}`);
      }
    } else if (event === 'subscription_renewed') {
      await activateTenant(subscriptionId);
    } else if (event === 'subscription_cancelled' || event === 'subscription_overdue' || event === 'refund') {
      await suspendTenant(subscriptionId);
      console.log(`[kiwify] tenant suspenso: ${email}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[kiwify]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
