import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { saveRole, deleteRole, readRoles } from '@/lib/userRoles';
import { removeClientRowsByEmail, updateClientRows } from '@/lib/sheets';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  // Fetch user email before deleting (for sheet cleanup)
  let userEmail = '';
  try {
    const uRes = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
      headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
    });
    if (uRes.ok) {
      const u = await uRes.json();
      userEmail = u.email || '';
    }
  } catch { /**/ }

  const res = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: { Cookie: `JSESSIONID=${session}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: res.status });

  deleteRole(id);

  // Remove all rows for this client from Google Sheets
  if (userEmail) removeClientRowsByEmail(userEmail).catch(() => {});

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { role, name, realEmail, phone, cpfCnpj, password } = body;

  // Role-only update (no user data fields present)
  if (role && name === undefined && realEmail === undefined && phone === undefined && !cpfCnpj && !password) {
    saveRole(id, role);
    return NextResponse.json({ ok: true, id, role });
  }

  // Full user data update — fetch current user first
  const getRes = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
    headers: { Cookie: `JSESSIONID=${session}` }, cache: 'no-store',
  });
  if (!getRes.ok) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const current = await getRes.json();

  const cleanCpf = cpfCnpj ? cpfCnpj.replace(/[\.\-\/\s]/g, '').trim() : null;
  const traccarEmail = cleanCpf ? `${cleanCpf}@weevtrack.com` : current.email;

  const updateBody: Record<string, unknown> = {
    ...current,
    name: name ?? current.name,
    email: traccarEmail,
    phone: phone ?? current.phone ?? '',
    attributes: {
      ...(current.attributes || {}),
      realEmail: realEmail !== undefined ? realEmail : (current.attributes?.realEmail || ''),
      cpfCnpj: cpfCnpj ?? (current.attributes?.cpfCnpj || ''),
    },
  };
  if (password) updateBody.password = password;

  const putRes = await fetch(`${TRACCAR_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `JSESSIONID=${session}` },
    body: JSON.stringify(updateBody),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return NextResponse.json({ error: err || 'Erro ao atualizar usuário' }, { status: putRes.status });
  }
  const updated = await putRes.json();

  if (role) saveRole(id, role);

  // Sync Google Sheets — update rows matching this CPF/CNPJ
  const cpfForSheets = (cpfCnpj ?? (current.attributes?.cpfCnpj as string)) || '';
  if (cpfForSheets) {
    updateClientRows(cpfForSheets, {
      nome: name ?? current.name,
      email: realEmail !== undefined ? realEmail : (current.attributes?.realEmail as string || ''),
      telefone: phone ?? current.phone ?? '',
    }).catch(() => {});
  }

  const roles = readRoles();
  return NextResponse.json({ ...updated, role: roles[id] || 'usuario' });
}
