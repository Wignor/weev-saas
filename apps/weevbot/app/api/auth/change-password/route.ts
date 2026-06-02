import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, hashPassword, verifyPassword, SESSION_COOKIE } from '@/lib/auth';
import { getUserPasswordHash, updateUserPasswordByEmail } from '@/lib/db';

const ADMIN_EMAIL = () => process.env.ADMIN_EMAIL || '';

export async function POST(req: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Senha inválida (mínimo 6 caracteres)' }, { status: 400 });
  }

  const email = session.email;

  // Admin env user — compare against ADMIN_PASSWORD
  if (email === ADMIN_EMAIL()) {
    const envPass = process.env.ADMIN_PASSWORD || '';
    if (currentPassword !== envPass) {
      // Also check if admin has a DB record with different password
      const dbHash = await getUserPasswordHash(email);
      if (dbHash) {
        const ok = await verifyPassword(currentPassword, dbHash);
        if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
        const newHash = await hashPassword(newPassword);
        await updateUserPasswordByEmail(email, newHash);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }
    // Admin verified with env password — update or create DB record
    const newHash = await hashPassword(newPassword);
    const existing = await getUserPasswordHash(email);
    if (existing !== null) {
      await updateUserPasswordByEmail(email, newHash);
    } else {
      // Insert admin into users table so we can track password changes
      await import('@/lib/db').then(db => db.createUser(email, 'Admin', newHash));
    }
    return NextResponse.json({ ok: true, note: 'Senha atualizada no banco. O login de ambiente continua funcionando.' });
  }

  // DB user
  const dbHash = await getUserPasswordHash(email);
  if (!dbHash) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const ok = await verifyPassword(currentPassword, dbHash);
  if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
  const newHash = await hashPassword(newPassword);
  await updateUserPasswordByEmail(email, newHash);
  return NextResponse.json({ ok: true });
}
