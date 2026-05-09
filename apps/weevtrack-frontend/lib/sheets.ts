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

async function deleteSheetRows(rowIndices: number[]): Promise<void> {
  if (rowIndices.length === 0) return;
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  // Delete from bottom to top so earlier indices don't shift
  for (const rowIdx of [...rowIndices].sort((a, b) => b - a)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: 0, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 },
          },
        }],
      },
    });
  }
}

// Remove row(s) where IMEI column (G, index 6) matches
export async function removeClientRowByImei(imei: string): Promise<void> {
  if (!imei) return;
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'A:J' });
    const rows = res.data.values || [];
    const toDelete: number[] = [];
    // i=0 is header row — skip it; sheet row index (0-based) = i
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][6] || '') === imei) toDelete.push(i);
    }
    await deleteSheetRows(toDelete);
  } catch (err) {
    console.error('[Sheets] Erro ao remover linha por IMEI:', err);
  }
}

// Update rows where CPF/CNPJ column (D, index 3) matches
export async function updateClientRows(cpfCnpj: string, updates: {
  nome?: string; email?: string; telefone?: string;
}): Promise<void> {
  if (!cpfCnpj) return;
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'A:J' });
    const rows = res.data.values || [];
    const cleanInput = cpfCnpj.replace(/[\.\-\/\s]/g, '');
    for (let i = 1; i < rows.length; i++) {
      const cleanRow = (rows[i][3] || '').replace(/[\.\-\/\s]/g, '');
      if (cleanRow !== cleanInput) continue;
      const updatedRow = [...rows[i]];
      if (updates.nome !== undefined) updatedRow[1] = updates.nome;
      if (updates.email !== undefined) updatedRow[2] = updates.email;
      if (updates.telefone !== undefined) updatedRow[4] = updates.telefone;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `A${i + 1}:J${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [updatedRow] },
      });
    }
  } catch (err) {
    console.error('[Sheets] Erro ao atualizar linha:', err);
  }
}

// Remove all rows where Email column (C, index 2) matches
export async function removeClientRowsByEmail(email: string): Promise<void> {
  if (!email) return;
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'A:J' });
    const rows = res.data.values || [];
    const toDelete: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][2] || '').toLowerCase() === email.toLowerCase()) toDelete.push(i);
    }
    await deleteSheetRows(toDelete);
  } catch (err) {
    console.error('[Sheets] Erro ao remover linhas por email:', err);
  }
}
