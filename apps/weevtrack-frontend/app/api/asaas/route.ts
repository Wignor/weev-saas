import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const ASAAS_URL = 'https://api.asaas.com/v3';
const API_KEY = process.env.ASAAS_API_KEY!;

const CUSTOMERS_FILE = path.join(process.cwd(), 'data', 'asaas-customers.json');

function loadCustomers(): Record<string, string> {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
  } catch { return {}; }
}

function saveCustomers(data: Record<string, string>) {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2));
}

async function asaas(method: string, endpoint: string, body?: object) {
  const res = await fetch(`${ASAAS_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', access_token: API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro Asaas');
  return data;
}

async function findOrCreateCustomer(name: string, cpfCnpj: string, email: string, phone: string): Promise<string> {
  const customers = loadCustomers();
  const key = cpfCnpj.replace(/\D/g, '');

  if (customers[key]) return customers[key];

  const search = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${key}`, {
    headers: { access_token: API_KEY },
  }).then(r => r.json());

  if (search.data?.length > 0) {
    const id = search.data[0].id;
    customers[key] = id;
    saveCustomers(customers);
    return id;
  }

  const created = await asaas('POST', '/customers', {
    name,
    cpfCnpj: key,
    email: email || undefined,
    mobilePhone: phone ? phone.replace(/\D/g, '') : undefined,
    notificationDisabled: false,
  });

  customers[key] = created.id;
  saveCustomers(customers);
  return created.id;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  if (!API_KEY) return NextResponse.json({ error: 'ASAAS_API_KEY não configurada' }, { status: 500 });

  const body = await req.json();
  const { type, clientName, clientCpfCnpj, clientEmail, clientPhone, billingType, value, dueDate, cycle, description, fine, interest } = body;

  if (!clientName || !clientCpfCnpj || !billingType || !value || !dueDate) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  try {
    const customerId = await findOrCreateCustomer(clientName, clientCpfCnpj, clientEmail, clientPhone);

    if (type === 'subscription') {
      const sub = await asaas('POST', '/subscriptions', {
        customer: customerId,
        billingType,
        value: Number(value),
        nextDueDate: dueDate,
        cycle: cycle || 'MONTHLY',
        description: description || 'Mensalidade WeevTrack',
        fine: { value: Number(fine || 10), type: 'PERCENTAGE' },
        interest: { value: Number(interest || 1) },
      });

      const payments = await fetch(`${ASAAS_URL}/subscriptions/${sub.id}/payments?limit=1`, {
        headers: { access_token: API_KEY },
      }).then(r => r.json());

      const invoiceUrl = payments.data?.[0]?.invoiceUrl || `https://app.asaas.com/i/${payments.data?.[0]?.id}`;
      return NextResponse.json({ ok: true, type: 'subscription', id: sub.id, invoiceUrl });

    } else {
      const payment = await asaas('POST', '/payments', {
        customer: customerId,
        billingType,
        value: Number(value),
        dueDate,
        description: description || 'Cobrança WeevTrack',
        fine: { value: Number(fine || 10) },
        interest: { value: Number(interest || 1) },
      });

      return NextResponse.json({ ok: true, type: 'payment', id: payment.id, invoiceUrl: payment.invoiceUrl });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar cobrança' }, { status: 500 });
  }
}
