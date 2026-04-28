import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readCredits, addCredits } from '@/lib/licenses';

async function requireAdmin() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('wt_user')?.value;
  if (!raw) return null;
  try {
    const u = JSON.parse(decodeURIComponent(raw));
    return u.administrator ? u : null;
  } catch { return null; }
}

/* GET — mapa de créditos de todos os distribuidores */
export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  return NextResponse.json(readCredits());
}

/* POST — admin adiciona créditos a um distribuidor */
export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { distributorId, amount } = await req.json();
  if (!distributorId || typeof amount !== 'number' || amount < 1) {
    return NextResponse.json({ error: 'distributorId e amount (>0) são obrigatórios' }, { status: 400 });
  }

  const newTotal = addCredits(String(distributorId), amount);
  return NextResponse.json({ distributorId: String(distributorId), credits: newTotal });
}
