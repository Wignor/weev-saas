import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const HEADERS = ['Data', 'Nome', 'Email', 'CPF/CNPJ', 'Telefone', 'Veículo', 'IMEI', 'Modelo Aparelho', 'ICCID', 'Chip'];

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function ensureHeaders(sheets: ReturnType<typeof google.sheets>) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'A1:J1',
  });
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'A1:J1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function appendClientRow(data: {
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone: string;
  veiculo: string;
  imei: string;
  modelo: string;
  iccid: string;
  chip: string;
}) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    await ensureHeaders(sheets);
    const date = new Date().toLocaleDateString('pt-BR');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'A:J',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          date,
          data.nome,
          data.email,
          data.cpfCnpj,
          data.telefone,
          data.veiculo,
          data.imei,
          data.modelo,
          data.iccid,
          data.chip,
        ]],
      },
    });
  } catch (err) {
    console.error('[Sheets] Erro ao gravar linha:', err);
  }
}
