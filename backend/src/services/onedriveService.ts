import { PRF } from '../models/types';
import { executeQuery } from '../config/database';
import * as msal from '@azure/msal-node';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

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

interface SiteResponse {
  id: string;
}

interface DriveInfo {
  id: string;
  name?: string;
  driveType?: string;
}

interface DriveListResponse {
  value: DriveInfo[];
}

interface DriveSearchItemParentRef {
  driveId?: string;
}

interface DriveSearchItem {
  id: string;
  name?: string;
  parentReference?: DriveSearchItemParentRef;
}

interface DriveSearchResponse {
  value: DriveSearchItem[];
}

interface SharedRemoteParentRef {
  driveId?: string;
  siteId?: string;
}

interface SharedRemoteItem {
  id: string;
  name?: string;
  webUrl?: string;
  parentReference?: SharedRemoteParentRef;
}

interface SharedItem {
  remoteItem?: SharedRemoteItem;
}

interface SharedListResponse {
  value: SharedItem[];
}

const graphBase = 'https://graph.microsoft.com/v1.0';

function getEnv(name: string): string | undefined {
  return process.env[name];
}

const delegatedScopesReadOnly: string[] = ['Files.Read', 'offline_access'];
const delegatedScopesReadWrite: string[] = ['Files.ReadWrite', 'offline_access'];

function normalizeText(input: unknown): string {
  if (typeof input === 'string') return input.trim();
  if (input == null) return '';
  return String(input).trim();
}

function excelSerialDateToJSDate(excelDate: number): Date {
  const utcDays = Math.floor(excelDate - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = excelDate - Math.floor(excelDate);
  const totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - (hours * 3600)) / 60);
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
    hours,
    minutes,
    seconds
  );
}

function parseExcelDate(input: unknown): Date | null {
  if (input instanceof Date) return input;
  if (typeof input === 'number' && Number.isFinite(input)) return excelSerialDateToJSDate(input);
  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }
  return null;
}

function parseExcelNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const cleaned = input.replace(/,/g, '').trim();
    if (cleaned.length === 0) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeOptionalText(input: unknown): string | null {
  const t = normalizeText(input);
  return t.length > 0 ? t : null;
}

function normalizePrfStatusFromExcel(input: unknown): PRF['Status'] | null {
  return normalizeOptionalText(input);
}

function normalizeHeaderText(input: unknown): string {
  return normalizeText(input).toLowerCase().replace(/\s+/g, ' ');
}

function columnIndexToLetters(indexZeroBased: number): string {
  let n = indexZeroBased + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function lettersToColumnIndex(letters: string): number {
  const cleaned = letters.toUpperCase().replace(/[^A-Z]/g, '');
  let n = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    n = n * 26 + (cleaned.charCodeAt(i) - 64);
  }
  return Math.max(0, n - 1);
}

function parseUsedRangeStart(address: string): { startRow: number; startCol: number } {
  const afterBang = address.includes('!') ? address.split('!').pop() || address : address;
  const firstPart = afterBang.split(':')[0] || afterBang;
  const cell = firstPart.replace(/\$/g, '');
  const match = /^([A-Za-z]+)(\d+)$/.exec(cell);
  if (!match) return { startRow: 1, startCol: 0 };
  const startCol = lettersToColumnIndex(match[1]);
  const startRow = parseInt(match[2], 10);
  return { startRow: Number.isFinite(startRow) ? startRow : 1, startCol };
}

function findHeaderRowIndex(values: unknown[][]): number {
  const prfNoAliases = ['prf no', 'prf no.', 'prfno', 'prf number', 'prf #', 'pr/po no'];
  const prfNoAliasSet = new Set<string>(prfNoAliases);
  const knownHeaderHints = new Set<string>([
    'budget',
    'budget year',
    'date submit',
    'date submitted',
    'submit date',
    'submit by',
    'submitted by',
    'amount',
    'requested amount',
    'purchase cost code',
    'cost code',
    'status',
    'status in pronto',
    'description',
  ]);
  const maxScan = Math.min(values.length, 30);
  for (let r = 0; r < maxScan; r += 1) {
    const row = values[r] || [];
    const hasPrfNo = row.some((cell) => prfNoAliasSet.has(normalizeHeaderText(cell)));
    if (hasPrfNo) return r;

    let hintMatches = 0;
    for (const cell of row) {
      if (knownHeaderHints.has(normalizeHeaderText(cell))) hintMatches += 1;
      if (hintMatches >= 2) return r;
    }
  }
  return 0;
}

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

async function getDelegatedAccessToken(scopes: string[]): Promise<string> {
  const tenantId = getEnv('AZURE_TENANT_ID') || '';
  const clientId = getEnv('AZURE_CLIENT_ID') || '';
  const authority = `https://login.microsoftonline.com/${tenantId}`;

  const cca = new msal.PublicClientApplication({ auth: { clientId, authority } });
  loadTokenCache(cca);
  const accounts = await cca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    const silent = await cca.acquireTokenSilent({ account: accounts[0], scopes });
    saveTokenCache(cca);
    return silent.accessToken;
  }

  const byDeviceCode = await cca.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (response) => {
      console.log('================ MICROSOFT DEVICE CODE ================');
      console.log(`URL : ${response.verificationUri}`);
      console.log(`CODE: ${response.userCode}`);
      if (response.message) {
        console.log(response.message);
      }
      console.log('======================================================');
      if (process.platform === 'win32') {
        exec(`start ${response.verificationUri}`);
      }
    }
  });
  saveTokenCache(cca);
  if (!byDeviceCode || !byDeviceCode.accessToken) {
    throw new Error('Device code flow did not return an access token');
  }
  return byDeviceCode.accessToken;
}

function isAuthOrPermissionErrorMessage(message: string): boolean {
  return message.includes(': 401') || message.includes(': 403') || message.toLowerCase().includes('invalidauthenticationtoken');
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
    return getDelegatedAccessToken(delegatedScopesReadWrite);
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

function parseSharePointDocLink(link: string): { host: string; sitePath: string; fileName?: string } | null {
  try {
    const url = new URL(link);
    const host = url.host;
    const pathname = url.pathname;
    const fileParam = url.searchParams.get('file') || undefined;
    const fileFromPath = (() => {
      const parts = pathname.split('/').filter((p) => p.length > 0);
      const last = parts[parts.length - 1];
      if (!last) return undefined;
      const decoded = decodeURIComponent(last);
      return decoded.toLowerCase().endsWith('.xlsx') ? decoded : undefined;
    })();
    const siteIndex = pathname.indexOf('/sites/');
    if (siteIndex === -1) return null;
    const afterSites = pathname.slice(siteIndex + '/sites/'.length);
    const segments = afterSites.split('/');
    const siteSegment = segments[0];
    const sitePath = `sites/${siteSegment}`;
    const fileName = fileParam ? decodeURIComponent(fileParam) : fileFromPath;
    return { host, sitePath, fileName };
  } catch {
    return null;
  }
}

async function getSiteByPath(accessToken: string, host: string, sitePath: string): Promise<string> {
  const siteUrl = `${graphBase}/sites/${host}:/${sitePath}`;
  const res = await fetch(siteUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Get site by path failed: ${res.status}`);
  }
  const json = (await res.json()) as SiteResponse;
  return json.id;
}

async function listSiteDrives(accessToken: string, siteId: string): Promise<DriveInfo[]> {
  const url = `${graphBase}/sites/${siteId}/drives`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`List site drives failed: ${res.status}`);
  }
  const json = (await res.json()) as DriveListResponse;
  return json.value;
}

async function searchFileInDrive(accessToken: string, driveId: string, fileName: string): Promise<{ driveId: string; itemId: string } | null> {
  const q = encodeURIComponent(fileName);
  const url = `${graphBase}/drives/${driveId}/root/search(q='${q}')`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Drive search failed: ${res.status}`);
  }
  const json = (await res.json()) as DriveSearchResponse;
  const match = json.value.find((v) => (v.name || '').toLowerCase() === fileName.toLowerCase());
  if (!match) return null;
  const foundDrive = match.parentReference?.driveId || driveId;
  return { driveId: foundDrive, itemId: match.id };
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

async function findSharedFileByName(accessToken: string, fileName: string): Promise<{ driveId: string; itemId: string } | null> {
  const url = `${graphBase}/me/drive/sharedWithMe`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`SharedWithMe failed: ${res.status}`);
  }
  const json = (await res.json()) as SharedListResponse;
  const match = json.value.find((v) => {
    const name = v.remoteItem?.name || '';
    return name.includes(fileName);
  });
  if (!match || !match.remoteItem) return null;
  const driveId = match.remoteItem.parentReference?.driveId || '';
  const itemId = match.remoteItem.id;
  if (!driveId || !itemId) return null;
  return { driveId, itemId };
}

function mapHeaders(headers: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = normalizeText(h);
    if (key.length > 0) {
      map.set(key, i);
    }
  });
  return map;
}

function findColumnIndexByAliases(headerRow: unknown[], aliases: readonly string[]): number | undefined {
  const aliasSet = new Set<string>(aliases.map((a) => normalizeHeaderText(a)));
  for (let i = 0; i < headerRow.length; i += 1) {
    const cell = normalizeHeaderText(headerRow[i]);
    if (aliasSet.has(cell)) return i;
  }
  return undefined;
}

const prfHeaderAliases = {
  budgetYear: ['Budget', 'Budget Year'],
  dateSubmit: ['Date Submit', 'Date Submitted', 'Submit Date'],
  submitBy: ['Submit By', 'Submitted By', 'Requester'],
  prfNo: ['PRF No', 'PRF No.', 'PRFNo', 'PRF Number', 'PRF #', 'PR/PO No'],
  sumDescriptionRequested: ['Sum Description Requested', 'Summary Description Requested', 'Sum Description'],
  description: ['Description', 'Project Description'],
  purchaseCostCode: ['Purchase Cost Code', 'Cost Code', 'Purchase Cost'],
  amount: ['Amount', 'Total Amount', 'Requested Amount'],
  requiredFor: ['Required for', 'Required For', 'For'],
  status: ['Status in Pronto', 'Status'],
} as const;

function buildRowValues(headerRow: unknown[], prf: PRF): unknown[] {
  const row: unknown[] = new Array(headerRow.length).fill('');
  const setByAliases = (aliases: readonly string[], value: unknown) => {
    const idx = findColumnIndexByAliases(headerRow, aliases);
    if (idx !== undefined) row[idx] = value ?? '';
  };
  setByAliases(prfHeaderAliases.budgetYear, prf.BudgetYear ?? '');
  setByAliases(prfHeaderAliases.dateSubmit, prf.DateSubmit ?? '');
  setByAliases(prfHeaderAliases.submitBy, prf.SubmitBy ?? '');
  setByAliases(prfHeaderAliases.prfNo, prf.PRFNo ?? '');
  setByAliases(prfHeaderAliases.sumDescriptionRequested, prf.SumDescriptionRequested ?? '');
  setByAliases(prfHeaderAliases.description, prf.Description ?? '');
  setByAliases(prfHeaderAliases.purchaseCostCode, prf.PurchaseCostCode ?? '');
  setByAliases(prfHeaderAliases.amount, prf.RequestedAmount ?? '');
  setByAliases(prfHeaderAliases.requiredFor, prf.RequiredFor ?? '');
  setByAliases(prfHeaderAliases.status, prf.Status ?? '');
  return row;
}

function findRowNumber(values: unknown[][], prfNoCol: number, target: string, headerRowIndex: number, startRow: number): number {
  for (let i = headerRowIndex + 1; i < values.length; i += 1) {
    const cell = values[i]?.[prfNoCol];
    const val = normalizeText(cell);
    if (val.trim() === target.trim()) return startRow + i;
  }
  return -1;
}

async function updateRow(
  accessToken: string,
  driveId: string,
  itemId: string,
  worksheetName: string,
  rowNumber: number,
  startCol: number,
  rowValues: unknown[]
): Promise<void> {
  const startColLetter = columnIndexToLetters(startCol);
  const endColLetter = columnIndexToLetters(startCol + Math.max(0, rowValues.length - 1));
  const range = `${startColLetter}${rowNumber}:${endColLetter}${rowNumber}`;
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
  const { startRow, startCol } = parseUsedRangeStart(range.address);
  const nextRow = startRow + (range.rowCount || 0);
  const startColLetter = columnIndexToLetters(startCol);
  const endColLetter = columnIndexToLetters(startCol + Math.max(0, rowValues.length - 1));
  const address = `${startColLetter}${nextRow}:${endColLetter}${nextRow}`;
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
  const tokenText = (prefixEnv || worksheet).trim();
  const hasSecret = Boolean(getEnv('AZURE_CLIENT_SECRET'));
  if (!link) {
    const fileNameEnv = getEnv('ONEDRIVE_SHARED_FILE_NAME');
    if (!fileNameEnv) {
      throw new Error('ONEDRIVE_SHARED_EXCEL_LINK or ONEDRIVE_SHARED_FILE_NAME must be configured');
    }
  }

  const syncWithToken = async (token: string): Promise<{ updated: boolean; appended: boolean }> => {
    let ids: { driveId: string; itemId: string };
    if (link) {
      try {
        ids = await getDriveItemByShareLink(token, link);
      } catch (err) {
        if (hasSecret) {
          const parsed = parseSharePointDocLink(link);
          if (!parsed || !parsed.fileName) {
            throw err instanceof Error ? err : new Error('Unable to resolve share link and parse site path');
          }
          const siteId = await getSiteByPath(token, parsed.host, parsed.sitePath);
          const drives = await listSiteDrives(token, siteId);
          let found: { driveId: string; itemId: string } | null = null;
          for (const d of drives) {
            const res = await searchFileInDrive(token, d.id, parsed.fileName);
            if (res) {
              found = res;
              break;
            }
          }
          if (!found) {
            throw new Error('File not found in site drives');
          }
          ids = found;
        } else {
          throw err instanceof Error ? err : new Error('Get driveItem by share link failed');
        }
      }
    } else {
      const fileNameEnv = getEnv('ONEDRIVE_SHARED_FILE_NAME') || '';
      const found = await findSharedFileByName(token, fileNameEnv);
      if (!found) {
        throw new Error('Shared file not found via sharedWithMe');
      }
      ids = found;
    }

    const mode: 'scan' | 'single' = options?.mode ?? 'single';
    if (mode === 'scan') {
      const sheets = await listWorksheets(token, ids.driveId, ids.itemId);
      const matching = sheets.filter((s) => normalizeHeaderText(s.name).includes(normalizeHeaderText(tokenText)));
      // Try update across matching sheets
      for (const s of matching) {
        const usedScan = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, s.name);
        const { startRow: scanStartRow, startCol: scanStartCol } = parseUsedRangeStart(usedScan.address);
        const valuesScan = usedScan.values;
        if (!valuesScan || valuesScan.length === 0) {
          continue;
        }
        const headerRowIndex = findHeaderRowIndex(valuesScan);
        const headerRow = valuesScan[headerRowIndex] || [];
        const prfNoIdx = findColumnIndexByAliases(headerRow, prfHeaderAliases.prfNo);
        if (prfNoIdx === undefined) {
          continue;
        }
        const rowValues = buildRowValues(headerRow, prf);
        const rowNumber = findRowNumber(valuesScan, prfNoIdx, String(prf.PRFNo ?? ''), headerRowIndex, scanStartRow);
        if (rowNumber > 0) {
          await updateRow(token, ids.driveId, ids.itemId, s.name, rowNumber, scanStartCol, rowValues);
          return { updated: true, appended: false };
        }
      }

      const yearText = options?.year ? String(options.year) : '';
      const preferredAppendSheet = yearText
        ? matching.find((s) => normalizeHeaderText(s.name).includes(normalizeHeaderText(yearText)))
        : undefined;
      const appendSheet = preferredAppendSheet?.name || (matching[0]?.name || worksheet);

      // Not found anywhere: append to selected worksheet
      const usedBase = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, appendSheet);
      const baseValues = usedBase.values;
      if (!baseValues || baseValues.length === 0) {
        throw new Error('Worksheet has no data');
      }
      const baseHeaderRowIndex = findHeaderRowIndex(baseValues);
      const baseHeaderRow = baseValues[baseHeaderRowIndex] || [];
      const basePrfNoIdx = findColumnIndexByAliases(baseHeaderRow, prfHeaderAliases.prfNo);
      if (basePrfNoIdx === undefined) {
        throw new Error(`PRF No column not found in worksheet: ${appendSheet}`);
      }
      const rowValues = buildRowValues(baseHeaderRow, prf);
      await appendRow(token, ids.driveId, ids.itemId, appendSheet, rowValues);
      return { updated: false, appended: true };
    }

    // Single worksheet (default)
    const usedSingle = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, worksheet);
    const { startRow, startCol } = parseUsedRangeStart(usedSingle.address);
    const valuesSingle = usedSingle.values;
    if (!valuesSingle || valuesSingle.length === 0) {
      throw new Error('Worksheet has no data');
    }
    const headerRowIndex = findHeaderRowIndex(valuesSingle);
    const headerRow = valuesSingle[headerRowIndex] || [];
    const prfNoIdx = findColumnIndexByAliases(headerRow, prfHeaderAliases.prfNo);
    if (prfNoIdx === undefined) {
      throw new Error('PRF No column not found');
    }
    const rowValues = buildRowValues(headerRow, prf);
    const rowNumber = findRowNumber(valuesSingle, prfNoIdx, String(prf.PRFNo ?? ''), headerRowIndex, startRow);
    if (rowNumber > 0) {
      await updateRow(token, ids.driveId, ids.itemId, worksheet, rowNumber, startCol, rowValues);
      return { updated: true, appended: false };
    }
    await appendRow(token, ids.driveId, ids.itemId, worksheet, rowValues);
    return { updated: false, appended: true };
  };

  const token = await getAccessToken();
  try {
    return await syncWithToken(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (hasSecret && isAuthOrPermissionErrorMessage(msg)) {
      const delegatedToken = await getDelegatedAccessToken(delegatedScopesReadWrite);
      return await syncWithToken(delegatedToken);
    }
    throw err;
  }
}

function findRowIndex(values: unknown[][], prfNoCol: number, target: string, headerRowIndex: number): number {
  for (let i = headerRowIndex + 1; i < values.length; i += 1) {
    const cell = values[i]?.[prfNoCol];
    const val = normalizeText(cell);
    if (val.trim() === target.trim()) return i;
  }
  return -1;
}

type PullChange = {
  field: string;
  from: string | number | null;
  to: string | number | null;
};

export async function pullPRFFromExcel(
  prf: PRF,
  options?: { mode?: 'scan' | 'single'; year?: number }
): Promise<{ updated: boolean; sheetName: string; rowNumber: number; changes: PullChange[] }> {
  const link = getEnv('ONEDRIVE_SHARED_EXCEL_LINK');
  const worksheet = getEnv('ONEDRIVE_WORKSHEET_NAME') || 'PRF Detail';
  const prefixEnv = getEnv('ONEDRIVE_WORKSHEET_PREFIX');
  const tokenText = (prefixEnv || worksheet).trim();
  const hasSecret = Boolean(getEnv('AZURE_CLIENT_SECRET'));
  if (!link) {
    const fileNameEnv = getEnv('ONEDRIVE_SHARED_FILE_NAME');
    if (!fileNameEnv) {
      throw new Error('ONEDRIVE_SHARED_EXCEL_LINK or ONEDRIVE_SHARED_FILE_NAME must be configured');
    }
  }

  const pullWithToken = async (token: string): Promise<{ updated: boolean; sheetName: string; rowNumber: number; changes: PullChange[] }> => {
    const resolveIds = async (): Promise<{ driveId: string; itemId: string } | null> => {
      if (link) {
        try {
          return await getDriveItemByShareLink(token, link);
        } catch {
          if (!hasSecret) return null;
          const parsed = parseSharePointDocLink(link);
          if (!parsed || !parsed.fileName) return null;
          const siteId = await getSiteByPath(token, parsed.host, parsed.sitePath);
          const drives = await listSiteDrives(token, siteId);
          for (const d of drives) {
            const res = await searchFileInDrive(token, d.id, parsed.fileName);
            if (res) return res;
          }
          return null;
        }
      }

      const fileNameEnv = getEnv('ONEDRIVE_SHARED_FILE_NAME') || '';
      if (!fileNameEnv) return null;
      return await findSharedFileByName(token, fileNameEnv);
    };

    const resolved = await resolveIds();
    if (!resolved) {
      throw new Error('Workbook not found via share link or sharedWithMe');
    }
    const ids = resolved;

    const mode: 'scan' | 'single' = options?.mode ?? 'single';
    const sheetNamesToSearch: string[] = [];
    if (mode === 'scan') {
      const sheets = await listWorksheets(token, ids.driveId, ids.itemId);
      const matching = sheets.filter((s) => normalizeHeaderText(s.name).includes(normalizeHeaderText(tokenText)));
      const yearText = options?.year ? String(options.year) : '';
      if (yearText) {
        const yearMatches = matching.filter((s) => normalizeHeaderText(s.name).includes(normalizeHeaderText(yearText)));
        sheetNamesToSearch.push(...yearMatches.map((s) => s.name));
      }
      sheetNamesToSearch.push(...matching.map((s) => s.name));
    } else {
      sheetNamesToSearch.push(worksheet);
    }

    const dedupedSheets = Array.from(new Set(sheetNamesToSearch));

    for (const sheetName of dedupedSheets) {
      const used = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, sheetName);
      const { startRow } = parseUsedRangeStart(used.address);
      const values = used.values;
      if (!values || values.length === 0) continue;

      const headerRowIndex = findHeaderRowIndex(values);
      const headerRow = values[headerRowIndex] || [];
      const prfNoIdx = findColumnIndexByAliases(headerRow, prfHeaderAliases.prfNo);
      if (prfNoIdx === undefined) continue;

      const rowIndex = findRowIndex(values, prfNoIdx, prf.PRFNo, headerRowIndex);
      if (rowIndex < 0) continue;

      const row = values[rowIndex] || [];
      const colIndex = (aliases: readonly string[]): number | undefined => findColumnIndexByAliases(headerRow, aliases);
      const pick = (aliases: readonly string[]): unknown => {
        const idx = colIndex(aliases);
        return idx === undefined ? undefined : row[idx];
      };

      const excelDateSubmit = parseExcelDate(pick(prfHeaderAliases.dateSubmit));
      const excelSubmitBy = normalizeOptionalText(pick(prfHeaderAliases.submitBy));
      const excelSummary = normalizeOptionalText(pick(prfHeaderAliases.sumDescriptionRequested));
      const excelDescription = normalizeOptionalText(pick(prfHeaderAliases.description));
      const excelCostCode = normalizeOptionalText(pick(prfHeaderAliases.purchaseCostCode));
      const excelRequiredFor = normalizeOptionalText(pick(prfHeaderAliases.requiredFor));
      const excelBudgetYear = parseExcelNumber(pick(prfHeaderAliases.budgetYear));
      const excelAmount = parseExcelNumber(pick(prfHeaderAliases.amount));
      const excelStatus = normalizePrfStatusFromExcel(pick(prfHeaderAliases.status));

      const changes: PullChange[] = [];
      const pushChange = (field: string, from: string | number | null, to: string | number | null) => {
        const same = from === to;
        if (!same) changes.push({ field, from, to });
      };

      pushChange('DateSubmit', prf.DateSubmit ? prf.DateSubmit.toISOString() : null, excelDateSubmit ? excelDateSubmit.toISOString() : null);
      pushChange('SubmitBy', prf.SubmitBy ?? null, excelSubmitBy);
      pushChange('SumDescriptionRequested', prf.SumDescriptionRequested ?? null, excelSummary);
      pushChange('Description', prf.Description ?? null, excelDescription);
      pushChange('PurchaseCostCode', prf.PurchaseCostCode ?? null, excelCostCode);
      pushChange('RequiredFor', prf.RequiredFor ?? null, excelRequiredFor);
      pushChange('BudgetYear', prf.BudgetYear ?? null, excelBudgetYear);
      pushChange('RequestedAmount', prf.RequestedAmount ?? null, excelAmount);
      pushChange('Status', prf.Status ?? null, excelStatus);

      const updateQuery = `
        UPDATE PRF SET
          DateSubmit = COALESCE(@DateSubmit, DateSubmit),
          SubmitBy = COALESCE(@SubmitBy, SubmitBy),
          SumDescriptionRequested = COALESCE(@SumDescriptionRequested, SumDescriptionRequested),
          Description = COALESCE(@Description, Description),
          PurchaseCostCode = COALESCE(@PurchaseCostCode, PurchaseCostCode),
          RequiredFor = COALESCE(@RequiredFor, RequiredFor),
          BudgetYear = COALESCE(@BudgetYear, BudgetYear),
          RequestedAmount = COALESCE(@RequestedAmount, RequestedAmount),
          Status = COALESCE(@Status, Status),
          UpdatedAt = GETDATE()
        WHERE PRFID = @PRFID
      `;

      await executeQuery(updateQuery, {
        PRFID: prf.PRFID,
        DateSubmit: excelDateSubmit,
        SubmitBy: excelSubmitBy,
        SumDescriptionRequested: excelSummary,
        Description: excelDescription,
        PurchaseCostCode: excelCostCode,
        RequiredFor: excelRequiredFor,
        BudgetYear: excelBudgetYear,
        RequestedAmount: excelAmount,
        Status: excelStatus,
      });

      return { updated: true, sheetName, rowNumber: startRow + rowIndex, changes };
    }

    throw new Error(`PRF ${prf.PRFNo} not found in cloud workbook`);
  };

  const token = await getAccessToken();
  try {
    return await pullWithToken(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (hasSecret && isAuthOrPermissionErrorMessage(msg)) {
      const delegatedToken = await getDelegatedAccessToken(delegatedScopesReadOnly);
      return await pullWithToken(delegatedToken);
    }
    throw err;
  }
}

export async function testOneDriveAccess(): Promise<{
  connected: boolean;
  usesDelegated: boolean;
  hasSecret: boolean;
  itemResolved: boolean;
  driveId?: string;
  itemId?: string;
  worksheets?: string[];
  matching?: string[];
  worksheetSample?: string;
  headerSample?: string[];
  error?: string;
}> {
  const hasSecret = Boolean(getEnv('AZURE_CLIENT_SECRET'));
  let usesDelegated = !hasSecret;
  try {
    const link = getEnv('ONEDRIVE_SHARED_EXCEL_LINK');
    let token = await getAccessToken();

    const resolveIds = async (accessToken: string): Promise<{ driveId: string; itemId: string } | null> => {
      if (link) {
        try {
          return await getDriveItemByShareLink(accessToken, link);
        } catch {
          if (!hasSecret) return null;
          const parsed = parseSharePointDocLink(link || '');
          if (!parsed || !parsed.fileName) return null;
          const siteId = await getSiteByPath(accessToken, parsed.host, parsed.sitePath);
          const drives = await listSiteDrives(accessToken, siteId);
          for (const d of drives) {
            const res = await searchFileInDrive(accessToken, d.id, parsed.fileName);
            if (res) return res;
          }
          return null;
        }
      }

      const fileNameEnv = getEnv('ONEDRIVE_SHARED_FILE_NAME') || '';
      if (!fileNameEnv) return null;
      return await findSharedFileByName(accessToken, fileNameEnv);
    };

    let ids: { driveId: string; itemId: string } | null = null;
    let appOnlyError: string | null = null;

    try {
      ids = await resolveIds(token);
    } catch (e) {
      appOnlyError = e instanceof Error ? e.message : 'Unknown error';
    }

    if (hasSecret && (ids === null || (appOnlyError && isAuthOrPermissionErrorMessage(appOnlyError)))) {
      token = await getDelegatedAccessToken(delegatedScopesReadOnly);
      usesDelegated = true;
      ids = await resolveIds(token);
    }

    if (!ids) {
      return {
        connected: true,
        usesDelegated,
        hasSecret,
        itemResolved: false,
        error: appOnlyError || 'Workbook not found via share link or sharedWithMe'
      };
    }
    const sheets = await listWorksheets(token, ids.driveId, ids.itemId);
    const names = sheets.map((s) => s.name);
    const tokenText = (getEnv('ONEDRIVE_WORKSHEET_PREFIX') || 'PRF Detail').trim();
    const matching = names.filter((n) => normalizeHeaderText(n).includes(normalizeHeaderText(tokenText)));

    const worksheetSample = matching[0] || names[0];
    let headerSample: string[] | undefined;
    if (worksheetSample) {
      const used = await getWorksheetUsedRange(token, ids.driveId, ids.itemId, worksheetSample);
      const values = used.values;
      if (values && values.length > 0) {
        const headerRowIndex = findHeaderRowIndex(values);
        const headerRow = values[headerRowIndex];
        if (headerRow) {
          headerSample = headerRow.map((v) => normalizeText(v));
        }
      }
    }
    return {
      connected: true,
      usesDelegated,
      hasSecret,
      itemResolved: true,
      driveId: ids.driveId,
      itemId: ids.itemId,
      worksheets: names,
      matching,
      worksheetSample,
      headerSample
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return {
      connected: false,
      usesDelegated,
      hasSecret,
      itemResolved: false,
      error: msg
    };
  }
}
