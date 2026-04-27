import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONTRACT_TEMPLATES } from '@/lib/contracts';

const DATA_FILE = path.join(process.cwd(), 'data', 'custom_templates.json');

function readCustomTemplates() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeCustomTemplates(data: object[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function checkAuth() {
  const cookieStore = await cookies();
  return !!cookieStore.get('wt_session')?.value;
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const stored = readCustomTemplates();
  const storedIds = new Set(stored.map((t: any) => t.id));

  // Default templates not overridden by stored versions
  const base = CONTRACT_TEMPLATES
    .filter(t => !storedIds.has(t.id))
    .map(t => ({ ...t, isCustom: false }));

  // Stored templates — flag whether they override a default or are truly custom
  const storedMapped = stored.map((t: any) => ({
    ...t,
    isCustom: !CONTRACT_TEMPLATES.some(d => d.id === t.id),
  }));

  return NextResponse.json([...base, ...storedMapped]);
}

export async function POST(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await req.json();
  const { name, description, installationValue, monthlyValue } = body;
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

  const custom = readCustomTemplates();
  const newTemplate = {
    id: `ctt_custom_${crypto.randomBytes(6).toString('hex')}`,
    name,
    description: description || '',
    installationValue: Number(installationValue) || 0,
    monthlyValue: Number(monthlyValue) || 0,
    isCustom: true,
  };
  writeCustomTemplates([...custom, newTemplate]);
  return NextResponse.json(newTemplate);
}

export async function PATCH(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await req.json();
  const { id, name, description, installationValue, monthlyValue } = body;
  if (!id || !name) return NextResponse.json({ error: 'ID e nome obrigatórios' }, { status: 400 });

  const custom = readCustomTemplates();
  const isDefaultOverride = CONTRACT_TEMPLATES.some(t => t.id === id);
  const updated = {
    id,
    name,
    description: description || '',
    installationValue: Number(installationValue) || 0,
    monthlyValue: Number(monthlyValue) || 0,
    isCustom: !isDefaultOverride,
  };

  const idx = custom.findIndex((t: any) => t.id === id);
  if (idx >= 0) {
    custom[idx] = updated;
  } else {
    custom.push(updated);
  }
  writeCustomTemplates(custom);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  const isDefault = CONTRACT_TEMPLATES.some(t => t.id === id);
  if (isDefault) return NextResponse.json({ error: 'Não é possível excluir um modelo padrão' }, { status: 400 });

  const custom = readCustomTemplates();
  writeCustomTemplates(custom.filter((t: any) => t.id !== id));
  return NextResponse.json({ ok: true });
}
