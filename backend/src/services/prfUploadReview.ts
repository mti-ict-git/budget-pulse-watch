import crypto from 'crypto';
import type { ExtractedPRFData } from './ocrService';
import { UploadError, type ReviewIssue, type UploadExtraction } from './localPRFParser';

type Preview = { userId: number; fileHash: string; extraction: UploadExtraction; expiresAt: number;
  state: 'preview' | 'saving' | 'saved'; approvedHash?: string; response?: unknown };
const previews = new Map<string, Preview>();
const digest = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');
export const warningIssues = (issues: ReviewIssue[]) => issues.filter(x => x.severity === 'warning');

export function createUploadPreview(extraction: UploadExtraction, userId: number, buffer: Buffer) {
  for (const [token, preview] of previews) if (preview.expiresAt <= Date.now()) previews.delete(token);
  if (previews.size >= 30) throw new UploadError('Too many active upload previews. Retry after older previews expire.', 429, 'PREVIEW_CAPACITY');
  if (Buffer.byteLength(JSON.stringify(extraction), 'utf8') > 2 * 1024 * 1024) throw new UploadError('This extraction exceeds the preview size limit. Split the PDF before processing.', 422, 'PREVIEW_SIZE_LIMIT');
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;
  previews.set(token, { userId, fileHash: digest(buffer), extraction, expiresAt, state: 'preview' });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => {
  if (typeof v !== 'string') return '';
  const value = v.trim();
  if (value.length > max) throw new UploadError('A reviewed field is too long. Shorten it before saving.', 422, 'FIELD_TOO_LONG');
  return value;
};
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const money = (v: unknown) => amount(v) && Number(v) <= 9999999999999.99 && Math.abs(Number(v)*100-Math.round(Number(v)*100)) < .001;

export function validateReviewedData(value: unknown): ExtractedPRFData {
  if (!isObject(value)) throw new UploadError('Reviewed data is required.', 422, 'REVIEW_DATA_REQUIRED');
  const data: ExtractedPRFData = {};
  const fields = ['prfNo','requestedBy','department','dateRaised','dateRequired','proposedSupplier','projectDescription','rawProjectDescription','projectArea','semanticTitle','semanticDescription','projectId','referenceDrawingNumber','generalLedgerCode','requestFor','sourceNotes'] as const;
  const limits: Partial<Record<typeof fields[number], number>> = { sourceNotes: 1500, prfNo: 50, requestedBy: 200, department: 100, proposedSupplier: 200, semanticTitle: 200, projectArea: 100, generalLedgerCode: 50, requestFor: 500 };
  for (const field of fields) data[field] = str(value[field], limits[field] || 1000);
  if (!data.prfNo || !data.department || !data.requestedBy) throw new UploadError('Enter the PR number, requested by and department before saving.', 422, 'REQUIRED_HEADER_FIELDS');
  for (const field of ['dateRaised','dateRequired'] as const) {
    if (data[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(data[field]!) || !Number.isFinite(Date.parse(data[field]!)) || new Date(data[field]!).toISOString().slice(0, 10) !== data[field])) {
      throw new UploadError('Dates must use YYYY-MM-DD.', 422, 'INVALID_DATE');
    }
  }
  if (!money(value.totalAmount)) throw new UploadError('Enter a valid document total.', 422, 'INVALID_TOTAL');
  data.totalAmount = value.totalAmount as number;
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 200) throw new UploadError('Review 1–200 item rows before saving.', 422, 'INVALID_ITEMS');
  data.items = value.items.map((v: unknown, index) => {
    if (!isObject(v)) throw new UploadError(`Item ${index + 1} is invalid.`, 422, 'INVALID_ITEM');
    if (!str(v.description, 1000) || !str(v.purchaseCostCode, 50) || !amount(v.quantity) || !Number.isInteger(v.quantity) || Number(v.quantity) <= 0 || Number(v.quantity) > 2147483647 || !money(v.unitPrice)) {
      throw new UploadError(`Item ${index + 1}: enter description, GL code, a positive whole-number quantity and a valid price with up to two decimals.`, 422, 'INVALID_ITEM');
    }
    if (v.status === 'Cancelled' || v.isStruckThrough === true) throw new UploadError(`Remove or reconcile the cancelled item ${index + 1} before saving.`, 422, 'CANCELLED_ITEM_REVIEW');
    const total = Number(v.quantity) * Number(v.unitPrice);
    if (v.totalPrice !== undefined && (!money(v.totalPrice) || Math.abs(Number(v.totalPrice) - total) > 0.01)) throw new UploadError(`Item ${index + 1}: total must equal quantity × unit price.`, 422, 'ITEM_TOTAL_MISMATCH');
    const currency = str(v.currency, 3).toUpperCase();
    if (!['IDR','USD'].includes(currency)) throw new UploadError(`Item ${index + 1}: select IDR or USD.`, 422, 'CURRENCY_REQUIRED');
    return { partNumber: str(v.partNumber, 64), description: str(v.description, 1000), quantity: Number(v.quantity), unitPrice: Number(v.unitPrice), totalPrice: total,
      currency, purchaseCostCode: str(v.purchaseCostCode, 50), uom: str(v.uom, 30), sourcePage: typeof v.sourcePage === 'number' ? v.sourcePage : undefined,
      coaid: typeof v.coaid === 'number' && Number.isInteger(v.coaid) && v.coaid > 0 ? v.coaid : undefined,
      budgetYear: typeof v.budgetYear === 'number' && Number.isInteger(v.budgetYear) && v.budgetYear >= 2000 && v.budgetYear <= 2100 ? v.budgetYear : undefined };
  });
  const currencies = new Set(data.items.map(x => x.currency));
  if (currencies.size !== 1) throw new UploadError('One PRF must use one currency. Reconcile the mixed currencies before saving.', 422, 'MIXED_CURRENCIES');
  if (currencies.has('USD') && (!amount(value.exchangeRateToIDR) || Number(value.exchangeRateToIDR) <= 0)) throw new UploadError('Enter the USD to IDR exchange rate explicitly.', 422, 'EXCHANGE_RATE_REQUIRED');
  data.exchangeRateToIDR = currencies.has('USD') ? Number(value.exchangeRateToIDR) : 1;
  const sum = data.items.reduce((s, x) => s + Number(x.totalPrice), 0);
  if (Math.abs(sum - data.totalAmount) > .01) throw new UploadError('The reviewed total must match the included item rows. Correct the values before saving.', 422, 'TOTAL_MISMATCH');
  return data;
}

export function acquireUploadPreview(token: unknown, userId: number, buffer: Buffer, value: unknown, acknowledged: unknown) {
  const key = typeof token === 'string' ? token : '';
  const preview = previews.get(key);
  if (!preview || preview.expiresAt <= Date.now()) { if (preview) previews.delete(key); throw new UploadError('Preview expired or unavailable. Run Preview extraction again.', 409, 'PREVIEW_REQUIRED'); }
  if (preview.userId !== userId || preview.fileHash !== digest(buffer)) throw new UploadError('This preview does not match the user or uploaded document.', 409, 'PREVIEW_MISMATCH');
  const data = validateReviewedData(value);
  const acknowledgedIds = Array.isArray(acknowledged) ? acknowledged.filter((x): x is string => typeof x === 'string') : [];
  if (!acknowledgedIds.includes('document-reviewed') || warningIssues(preview.extraction.reviewIssues).some(x => !acknowledgedIds.includes(x.id))) throw new UploadError('Confirm that the source PDF and all review warnings have been checked.', 422, 'REVIEW_REQUIRED');
  const approvedHash = digest(JSON.stringify(data));
  if (preview.state === 'saved') {
    if (preview.approvedHash !== approvedHash) throw new UploadError('This preview was already saved with different values. Start a new preview.', 409, 'ALREADY_SAVED');
    return { preview, data, replay: preview.response };
  }
  if (preview.state === 'saving') throw new UploadError('This preview is already being saved.', 409, 'SAVE_IN_PROGRESS');
  preview.state = 'saving'; preview.approvedHash = approvedHash;
  return { preview, data, replay: undefined };
}
export function finishUploadPreview(preview: Preview, response: unknown) { preview.state = 'saved'; preview.response = response; }
export function releaseUploadPreview(preview: Preview) { if (preview.state === 'saving') preview.state = 'preview'; }

export function reviewIssues(data: ExtractedPRFData, original: ReviewIssue[] = []): ReviewIssue[] {
  const issues = [...original];
  const add = (id: string, message: string, field?: string, itemIndex?: number) => issues.push({ id, code: id, severity: 'warning', message, field, itemIndex });
  if (!data.prfNo && !original.some(x => x.field === 'prfNo')) add('missing-pr-number','Enter the PR number from the source PDF.','prfNo');
  if (!data.requestedBy) add('missing-requester','Enter the requested-by field.','requestedBy');
  if (!data.department) add('missing-department','Enter the department.','department');
  if (data.totalAmount === undefined) add('missing-total','Enter the printed document total.','totalAmount');
  const items = data.items || [];
  if (!items.length) add('no-items','No items were extracted. Reconcile the source before saving.');
  items.forEach((x,i) => {
    if (!x.purchaseCostCode) add(`missing-gl-${i}`,`Item ${i+1}: enter the GL code from the PDF.`,'purchaseCostCode',i);
    if (x.status === 'Cancelled' || x.isStruckThrough) add(`cancelled-${i}`,`Item ${i+1} is proposed as cancelled. Reconcile it before saving.`,undefined,i);
  });
  if (data.totalAmount !== undefined && Math.abs(items.reduce((s,x) => s + Number(x.totalPrice ?? Number(x.quantity || 0)*Number(x.unitPrice || 0)),0)-data.totalAmount)>.01) add('total-variance','Printed total differs from the extracted item sum. Correct the preview before saving.','totalAmount');
  return issues;
}
