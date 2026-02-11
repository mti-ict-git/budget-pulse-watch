import { PRF } from '../models/types';
import * as msal from '@azure/msal-node';
import path from 'path';
import fs from 'fs';

interface TokenResponse {
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
}

interface DriveItemResponse {
  id: string;
  parentReference?: { driveId?: string };
}

interface RangeResponse {
  address: string;
  values: unknown[][];
  rowCount?: number;
  columnCount?: number;
}

interface WorksheetInfo {
  id: string;
  name: string;
  position?: number;
  visibility?: string;
}

interface WorksheetListResponse {
  value: WorksheetInfo[];
}

const graphBase = 'https://graph.microsoft.com/v1.0';

function getEnv(name: string): string | undefined {
  return process.env[name];
}

const delegatedScopes: string[] = ['Files.ReadWrite', 'offline_access'];

function getTokenCachePath(): string {
  const envPath = getEnv('GRAPH_TOKEN_CACHE_PATH');
  if (envPath) return envPath;
  return path.resolve(__dirname, '../../token_cache.json');
}

function loadTokenCache(cca: msal.PublicClientApplication): void {
  const cachePath = getTokenCachePath();
  if (fs.existsSync(cachePath)) {
    const data = fs.readFileSync(cachePath, 'utf8');
    cca.getTokenCache().deserialize(data);
  }
}

function saveTokenCache(cca: msal.PublicClientApplication): void {
  const cachePath = getTokenCachePath();
  const data = cca.getTokenCache().serialize();
  fs.writeFileSync(cachePath, data, 'utf8');
}

async function getDelegatedAccessToken(): Promise<string> {
  const tenantId = getEnv('AZURE_TENANT_ID') || '';
  const clientId = getEnv('AZURE_CLIENT_ID') || '';
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  const cca = new msal.PublicClientApplication({ auth: { clientId, authority } });
  loadTokenCache(cca);
  const accounts = await cca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    const silent = await cca.acquireTokenSilent({ account: accounts[0], scopes: delegatedScopes });
    saveTokenCache(cca);
    return silent.accessToken;
  }

  const byDeviceCode = await cca.acquireTokenByDeviceCode({
    scopes: delegatedScopes,
    deviceCodeCallback: (response) => {
      // Log instructions; user completes in any browser
      // Avoid launching a browser from server
      console.log('Complete device code login:', {
        verificationUri: response.verificationUri,
        userCode: response.userCode,
        message: response.message,
      });
    }
  });
  saveTokenCache(cca);
  if (!byDeviceCode || !byDeviceCode.accessToken) {
    throw new Error('Device code flow did not return an access token');
  }
  return byDeviceCode.accessToken;
}

async function getAccessToken(): Promise<string> {
  const tenantId = getEnv('AZURE_TENANT_ID');
  const clientId = getEnv('AZURE_CLIENT_ID');
  const clientSecret = getEnv('AZURE_CLIENT_SECRET');
  if (tenantId && clientId && clientSecret) {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams();
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
    body.append('scope', 'https://graph.microsoft.com/.default');
    body.append('grant_type', 'client_credentials');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) {
      throw new Error(`Token request failed: ${res.status}`);
    }
    const json = (await res.json()) as TokenResponse;
    return json.access_token;
  }
  // Fallback: delegated device code
  if (tenantId && clientId) {
    return getDelegatedAccessToken();
  }
  throw new Error('Azure credentials not configured');
}

function toShareId(link: string): string {
  const base64 = Buffer.from(link, 'utf8').toString('base64');
  const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `u!${urlSafe}`;
}

async function getDriveItemByShareLink(accessToken: string, link: string): Promise<{ driveId: string; itemId: string }> {
  const shareId = toShareId(link);
  const url = `${graphBase}/shares/${shareId}/driveItem`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Get driveItem failed: ${res.status}`);
  }
  const item = (await res.json()) as DriveItemResponse;
  const driveId = item.parentReference?.driveId || '';
  return { driveId, itemId: item.id };
}

async function getWorksheetUsedRange(accessToken: string, driveId: string, itemId: string, worksheetName: string): Promise<RangeResponse> {
  const url = `${graphBase}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange(valuesOnly=true)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Get usedRange failed: ${res.status}`);
  }
  return (await res.json()) as RangeResponse;
}

async function listWorksheets(accessToken: string, driveId: string, itemId: string): Promise<WorksheetInfo[]> {
  const url = `${graphBase}/drives/${driveId}/items/${itemId}/workbook/worksheets`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`List worksheets failed: ${res.status}`);
  }
  const json = (await res.json()) as WorksheetListResponse;
  return json.value;
}

function mapHeaders(headers: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = typeof h === 'string' ? h : String(h ?? '');
    map.set(key.trim(), i);
  });
  return map;
}

function buildRowValues(headers: Map<string, number>, prf: PRF): unknown[] {
  const row: unknown[] = [];
  const cols = Array.from(headers.values());
  const maxIndex = cols.length > 0 ? Math.max(...cols) : -1;
  for (let i = 0; i <= maxIndex; i += 1) row.push('');
  const set = (name: string, value: unknown) => {
    const idx = headers.get(name);
    if (idx !== undefined) row[idx] = value ?? '';
  };
  set('Budget', prf.BudgetYear ?? '');
  set('Date Submit', prf.DateSubmit ?? '');
  set('Submit By', prf.SubmitBy ?? '');
  set('PRF No', prf.PRFNo ?? '');
  set('Sum Description Requested', prf.SumDescriptionRequested ?? '');
  set('Description', prf.Description ?? '');
  set('Purchase Cost Code', prf.PurchaseCostCode ?? '');
  set('Amount', prf.RequestedAmount ?? '');
  set('Required for', prf.RequiredFor ?? '');
  set('Status in Pronto', prf.Status ?? '');
  return row;
}

function findRowIndex(values: unknown[][], prfNoCol: number, target: string): number {
  for (let i = 1; i < values.length; i += 1) {
    const cell = values[i]?.[prfNoCol];
    const val = typeof cell === 'string' ? cell : cell != null ? String(cell) : '';
    if (val.trim() === target.trim()) return i + 1;
  }
  return -1;
}

async function updateRow(accessToken: string, driveId: string, itemId: string, worksheetName: string, rowNumber: number, rowValues: unknown[]): Promise<void> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const endCol = letters[rowValues.length - 1] || 'A';
  const range = `A${rowNumber}:${endCol}${rowNumber}`;
  const url = `${graphBase}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/range(address='${range}')`;
  const res = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [rowValues] }) });
  if (!res.ok) {
    throw new Error(`Update range failed: ${res.status}`);
  }
}

async function appendRow(accessToken: string, driveId: string, itemId: string, worksheetName: string, rowValues: unknown[]): Promise<void> {
  const url = `${graphBase}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`UsedRange for append failed: ${res.status}`);
  }
  const range = (await res.json()) as RangeResponse;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const endCol = letters[rowValues.length - 1] || 'A';
  const nextRow = (range.rowCount || 1) + 1;
  const address = `A${nextRow}:${endCol}${nextRow}`;
  const url2 = `${graphBase}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/range(address='${address}')`;
  const res2 = await fetch(url2, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [rowValues] }) });
  if (!res2.ok) {
    throw new Error(`Append range failed: ${res2.status}`);
  }
}

export async function syncPRFToExcel(
  prf: PRF,
  options?: { mode?: 'scan' | 'single'; year?: number }
): Promise<{ updated: boolean; appended: boolean }> {
  const link = getEnv('ONEDRIVE_SHARED_EXCEL_LINK');
  const worksheet = getEnv('ONEDRIVE_WORKSHEET_NAME') || 'PRF Detail';
  const prefixEnv = getEnv('ONEDRIVE_WORKSHEET_PREFIX');
  const prefix = (prefixEnv || worksheet).trim();
  if (!link) {
    throw new Error('ONEDRIVE_SHARED_EXCEL_LINK not configured');
  }
  const token = await getAccessToken();
  const ids = await getDriveItemByShareLink(token, link);
  const mode: 'scan' | 'single' = options?.mode ?? 'single';
  if (mode === 'scan') {
    const sheets = await listWorksheets(token, ids.driveId, ids.itemId);
    const matching = sheets.filter((s) => s.name.trim().startsWith(prefix));
    // Try update across matching sheets
    for (const s of matching) {
      const used = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, s.name);
      const values = used.values;
      if (!values || values.length === 0) {
        continue;
      }
      const headers = mapHeaders(values[0] || []);
      const prfNoIdx = headers.get('PRF No');
      if (prfNoIdx === undefined) {
        continue;
      }
      const rowValues = buildRowValues(headers, prf);
      const rowNumber = findRowIndex(values, prfNoIdx, String(prf.PRFNo ?? ''));
      if (rowNumber > 0) {
        await updateRow(token, ids.driveId, ids.itemId, s.name, rowNumber, rowValues);
        return { updated: true, appended: false };
      }
    }
    // Not found anywhere: append to base worksheet
    const usedBase = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, worksheet);
    const baseValues = usedBase.values;
    if (!baseValues || baseValues.length === 0) {
      throw new Error('Worksheet has no data');
    }
    const baseHeaders = mapHeaders(baseValues[0] || []);
    const rowValues = buildRowValues(baseHeaders, prf);
    await appendRow(token, ids.driveId, ids.itemId, worksheet, rowValues);
    return { updated: false, appended: true };
  }
  // Single worksheet (default)
  const used = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, worksheet);
  const values = used.values;
  if (!values || values.length === 0) {
    throw new Error('Worksheet has no data');
  }
  const headers = mapHeaders(values[0] || []);
  const prfNoIdx = headers.get('PRF No');
  if (prfNoIdx === undefined) {
    throw new Error('PRF No column not found');
  }
  const rowValues = buildRowValues(headers, prf);
  const rowNumber = findRowIndex(values, prfNoIdx, String(prf.PRFNo ?? ''));
  if (rowNumber > 0) {
    await updateRow(token, ids.driveId, ids.itemId, worksheet, rowNumber, rowValues);
    return { updated: true, appended: false };
  }
  await appendRow(token, ids.driveId, ids.itemId, worksheet, rowValues);
  return { updated: false, appended: true };
}
