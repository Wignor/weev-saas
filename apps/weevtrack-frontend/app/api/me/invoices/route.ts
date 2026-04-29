import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';
const ASAAS_URL = 'https://api.asaas.com/v3';
const API_KEY = process.env.ASAAS_API_KEY!;
const CUSTOMERS_FILE = path.join(process.cwd(), 'data', 'asaas-customers.json');

function loadCustomers(): Record<string, string> {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
  } catch { return {}; }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  if (!API_KEY) return NextResponse.json([]);

  try {
    // Buscar dados completos do usuário no Traccar (inclui attributes)
    const userRes = await fetch(`${TRACCAR_URL}/api/session`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!userRes.ok) return NextResponse.json([]);
    const user = await userRes.json();

    const cpfCnpj = (user.attributes?.cpfCnpj as string || '').replace(/\D/g, '');
    if (!cpfCnpj) return NextResponse.json([]);

    const customers = loadCustomers();
    let customerId = customers[cpfCnpj];

    // Se não está no mapa local, tenta buscar diretamente no Asaas
    if (!customerId) {
      const search = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cpfCnpj}`, {
        headers: { access_token: API_KEY },
      }).then(r => r.json());
      if (search.data?.length > 0) customerId = search.data[0].id;
    }

    if (!customerId) return NextResponse.json([]);

    // Buscar últimas 6 cobranças do cliente
    const res = await fetch(`${ASAAS_URL}/payments?customer=${customerId}&limit=6&sort=dueDate&order=desc`, {
      headers: { access_token: API_KEY },
    });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();

    const invoices = (data.data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      value: p.value,
      dueDate: p.dueDate,
      status: p.status,
      billingType: p.billingType,
      invoiceUrl: p.invoiceUrl || p.bankSlipUrl || null,
      description: p.description,
    }));

    return NextResponse.json(invoices);
  } catch {
    return NextResponse.json([]);
  }
}
