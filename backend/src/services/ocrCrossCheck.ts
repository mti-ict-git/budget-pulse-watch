import type { ExtractedPRFData } from './ocrService';
import type { ReviewIssue } from './localPRFParser';

/**
 * Accuracy checks on AI extraction results against the PDF's own text layer.
 * The AI reads page images, and can misread digits in dense tables (PRF 54123: 6,600,000 read as
 * 6,300,000). When the PDF carries text, every price the AI returns should appear in it.
 */

const NUMBER_TOKEN_RX = /\d[\d.,]*/g;

/**
 * All values a printed number token can stand for. "6,600,000" and "6.600.000" are 6600000;
 * "1,234.50" and "1.234,50" are 1234.5; an ambiguous "6.600" or "6,600" yields both 6600 and 6.6.
 */
export const numberReadings = (token: string): number[] => {
  const t = token.replace(/[.,]+$/, '');
  if (!t) return [];
  const out = new Set<number>();
  const add = (s: string) => {
    const n = Number(s);
    if (Number.isFinite(n)) out.add(Math.round(n * 100) / 100);
  };
  const dots = (t.match(/\./g) || []).length;
  const commas = (t.match(/,/g) || []).length;
  if (!dots && !commas) add(t);
  else if (dots && commas) {
    // The separator that comes last is the decimal mark.
    if (t.lastIndexOf('.') > t.lastIndexOf(',')) add(t.replace(/,/g, ''));
    else add(t.replace(/\./g, '').replace(',', '.'));
  } else {
    const sep = dots ? '.' : ',';
    const groups = t.split(sep);
    const thousands = groups.slice(1).every((g) => g.length === 3);
    if (thousands) add(groups.join('')); // 6.600.000 / 6,600,000 / 6.600
    if (groups.length === 2) add(t.replace(sep, '.')); // 6.6 / 6,60 / 6.600 (as decimal)
  }
  return [...out];
};

/** Every number that appears in the text, under each possible reading. */
export const numbersInText = (text: string): Set<number> => {
  const out = new Set<number>();
  for (const token of text.match(NUMBER_TOKEN_RX) || []) for (const n of numberReadings(token)) out.add(n);
  return out;
};

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Below this many distinct numbers the text layer is too thin (scan, image-only PDF) to judge prices. */
const MIN_NUMBERS_IN_TEXT = 5;

/**
 * Review flags for items whose unit price, line total or GL code does not appear anywhere in the PDF text.
 * Returns no flags when the PDF has no usable text layer. Quantities are not checked: small integers
 * appear everywhere in a form and would never be flagged.
 */
export const crossCheckItemNumbers = (data: ExtractedPRFData, pdfText: string): ReviewIssue[] => {
  const numbers = numbersInText(pdfText);
  if (numbers.size < MIN_NUMBERS_IN_TEXT) return [];
  const issues: ReviewIssue[] = [];
  const compactText = pdfText.replace(/\s+/g, '').toUpperCase();
  (data.items || []).forEach((item, i) => {
    const missing: string[] = [];
    for (const [label, raw] of [['unit price', item.unitPrice], ['line total', item.totalPrice]] as const) {
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (raw === undefined || raw === null || !Number.isFinite(value) || value === 0) continue;
      if (!numbers.has(Math.round(value * 100) / 100)) missing.push(`${label} ${fmt(value)}`);
    }
    // GL codes are letter/digit mixes (AMINFO12.6250): O/0 and I/1 are easy to confuse in an image.
    const gl = (item.purchaseCostCode || '').replace(/\s+/g, '').toUpperCase();
    if (gl.length >= 5 && !compactText.includes(gl)) missing.push(`GL code ${item.purchaseCostCode}`);
    if (missing.length) {
      issues.push({
        id: `number-not-in-pdf-${i}`,
        code: 'number-not-in-pdf',
        severity: 'warning',
        itemIndex: i,
        field: 'unitPrice',
        message: `Item ${item.rowNo ?? i + 1}: ${missing.join(' and ')} not found in the PDF text. The AI may have misread it; check it against the document.`,
      });
    }
  });
  const total = typeof data.totalAmount === 'number' ? data.totalAmount : Number(data.totalAmount);
  if (data.totalAmount !== undefined && data.totalAmount !== null && Number.isFinite(total) && total > 0 && !numbers.has(Math.round(total * 100) / 100)) {
    issues.push({
      id: 'total-not-in-pdf',
      code: 'number-not-in-pdf',
      severity: 'warning',
      field: 'totalAmount',
      message: `Document total ${fmt(total)} not found in the PDF text. Check it against the printed total.`,
    });
  }
  return issues;
};
