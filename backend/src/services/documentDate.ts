/**
 * Dates printed on PRFs and quotations are Indonesian style: day before month (17/11/2026,
 * 17-Nov-2026, 17 November 2026, 17 Nopember 2026). `new Date()` reads 05/11/2026 as May 11,
 * so OCR dates are parsed here instead. Returns YYYY-MM-DD, or null when the text is not a date.
 */

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, pebruari: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

const iso = (y: number, m: number, d: number): string | null => {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 31/02 and the like
  return date.toISOString().slice(0, 10);
};

export const parseDocumentDate = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;

  // 2026-11-17 (ISO, possibly with a time part)
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[t ].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);

  // 17/11/2026, 17-11-26, 17.11.2026: day first, unless only the month-first reading is possible
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    return a > 12 || b <= 12 ? iso(y, b, a) : iso(y, a, b);
  }

  // 17 November 2026, 17-Nov-2026, 17 Nop 26
  m = /^(\d{1,2})[-/. ]([a-z]+)\.?[-/. ](\d{2,4})$/.exec(s);
  if (m && MONTHS[m[2]]) return iso(+m[3], MONTHS[m[2]], +m[1]);

  // November 17 2026, Nov 17 2026
  m = /^([a-z]+)\.? (\d{1,2}) (\d{4})$/.exec(s);
  if (m && MONTHS[m[1]]) return iso(+m[3], MONTHS[m[1]], +m[2]);

  return null;
};
