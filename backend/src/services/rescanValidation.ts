import type { ExtractedPRFData } from './ocrService';

type ExistingItem = { ItemCode?: string | null; ItemName: string; Quantity: number };
const normalized = (value: unknown): string => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const cancelled = (item: NonNullable<ExtractedPRFData['items']>[number]): boolean =>
  item.isStruckThrough === true || normalized(item.status) === 'cancelled';

const rowTotals = (data: ExtractedPRFData) => {
  let all = 0;
  let active = 0;
  for (const item of data.items || []) {
    const total = Number(item.totalPrice ?? (Number(item.quantity) * Number(item.unitPrice)));
    if (!Number.isFinite(total)) continue;
    all += total;
    if (!cancelled(item)) active += total;
  }
  return { all, active };
};

/**
 * Warning text when the printed document total matches neither all item rows nor the active rows.
 * Null when it reconciles or the total is missing.
 */
export function printedTotalWarning(data: ExtractedPRFData): string | null {
  if (typeof data.totalAmount !== 'number' || !Number.isFinite(data.totalAmount)) return null;
  const { all, active } = rowTotals(data);
  if (Math.abs(data.totalAmount - all) <= 1 || Math.abs(data.totalAmount - active) <= 1) return null;
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `Printed document total ${fmt(data.totalAmount)} differs from the sum of the item rows ${fmt(active)} `
    + `(difference ${fmt(active - data.totalAmount)}). The item rows match the PDF text, so the printed total is likely wrong `
    + `on the form. If you update the header, the requested amount is set to the item sum.`;
}

/**
 * Reject unsafe extraction before offering proposals, and recheck signed results before apply.
 * `rowsConfirmedByPdf`: every active row's price and line total appear in the PDF text layer. Then a
 * printed total that does not reconcile is a mistake on the form, reported as a warning, not an error.
 */
export function validateRescanExtraction(
  data: ExtractedPRFData, prfNo: string, existing: ExistingItem[],
  options: { rowsConfirmedByPdf?: boolean } = {}
): string[] {
  const errors: string[] = [];
  if (!normalized(data.prfNo) || normalized(data.prfNo) !== normalized(prfNo)) {
    errors.push('The scanned PRF number is missing or does not match the selected PRF. Check the source document.');
  }
  const items = data.items || [];
  if (!items.length) errors.push('No readable item rows were extracted.');
  let allTotal = 0;
  let activeTotal = 0;
  for (const [index, item] of items.entries()) {
    const qty = item.quantity;
    const price = item.unitPrice;
    const total = item.totalPrice ?? (Number(qty) * Number(price));
    if (typeof qty !== 'number' || !Number.isSafeInteger(qty) || qty <= 0 ||
        typeof price !== 'number' || !Number.isFinite(price) || price < 0 ||
        typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
      errors.push(`Item ${index + 1} has missing or invalid quantity/price/total. No values will be guessed.`);
      continue;
    }
    if (Math.abs(qty * price - total) > 1) {
      errors.push(`Item ${index + 1}: quantity × unit price does not match the extracted line total.`);
    }
    if (cancelled(item) && (item.isStruckThrough !== true || !item.statusReason?.trim())) {
      errors.push(`Item ${index + 1}: cancellation has no explicit visual evidence.`);
    }
    allTotal += total;
    if (!cancelled(item)) activeTotal += total;
  }
  if (typeof data.totalAmount !== 'number' || !Number.isFinite(data.totalAmount) || data.totalAmount < 0) {
    errors.push('The document total is missing or invalid.');
  } else if (Math.abs(data.totalAmount - allTotal) > 1 && Math.abs(data.totalAmount - activeTotal) > 1
    && !(options.rowsConfirmedByPdf && errors.length === 0)) {
    errors.push('Document total does not reconcile with either all item rows or active item rows. Review the source and scan again.');
  }
  if (existing.length && items.length) {
    const overlap = items.some(item => existing.some(old =>
      (normalized(item.partNumber) && normalized(item.partNumber) === normalized(old.ItemCode)) ||
      (normalized(item.description) && normalized(item.description) === normalized(old.ItemName) && Number(item.quantity) === Number(old.Quantity))
    ));
    if (!overlap) errors.push('None of the scanned items match the existing PRF. The source or extraction may belong to a different document; applying is blocked.');
    for (const [index, item] of items.entries()) {
      const matches = existing.filter(old => normalized(item.partNumber)
        ? normalized(item.partNumber) === normalized(old.ItemCode)
        : normalized(item.description) === normalized(old.ItemName) && Number(item.quantity) === Number(old.Quantity));
      if (matches.length > 1) errors.push(`Item ${index + 1} matches multiple existing rows; automatic matching is ambiguous.`);
    }
  }
  return errors;
}
