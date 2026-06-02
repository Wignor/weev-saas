import { NextResponse } from 'next/server';
import { listOperators, createOperator } from '@/lib/db';
import { requireAdmin } from '@/lib/tenant-context';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const { tenantId } = await requireAdmin();
    return NextResponse.json(await listOperators(tenantId));
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireAdmin();
    const { name, email, password, sectorId } = await req.json();
    if (!name?.trim() || !email?.trim() || !password?.trim()) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    const hash = await hashPassword(password);
    const op = await createOperator(tenantId, name.trim(), email.trim().toLowerCase(), hash, sectorId ?? null);
    return NextResponse.json(op, { status: 201 });
  } catch (err) {
    const msg = String(err);
    if (msg.includes('duplicate') || msg.includes('unique')) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    return NextResponse.json({ error: msg.includes('Forbidden') ? 'Forbidden' : String(err) }, { status: msg.includes('Forbidden') ? 403 : 500 });
  }
}
