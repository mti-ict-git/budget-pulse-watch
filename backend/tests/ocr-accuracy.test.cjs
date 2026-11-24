// Offline tests for OCR accuracy checks: day-first dates, prices checked against the PDF text,
// and Date Required written as ASAP. No AI provider, database or poppler is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDocumentDate } = require('../dist/services/documentDate');
const { numberReadings, crossCheckItemNumbers } = require('../dist/services/ocrCrossCheck');
const { validateReviewedData } = require('../dist/services/prfUploadReview');
const { buildFollowUps } = require('../dist/services/prfFollowUp');

test('dates are day-first unless only month-first is possible', () => {
  assert.equal(parseDocumentDate('05/11/2026'), '2026-11-05');
  assert.equal(parseDocumentDate('17/11/2026'), '2026-11-17');
  assert.equal(parseDocumentDate('11/17/2026'), '2026-11-17'); // 17 cannot be a month
  assert.equal(parseDocumentDate('17-11-26'), '2026-11-17');
  assert.equal(parseDocumentDate('17.11.2026'), '2026-11-17');
  assert.equal(parseDocumentDate('2026-11-17'), '2026-11-17');
  assert.equal(parseDocumentDate('2026-11-17T00:00:00Z'), '2026-11-17');
});

test('dates with Indonesian and English month names', () => {
  assert.equal(parseDocumentDate('17 November 2026'), '2026-11-17');
  assert.equal(parseDocumentDate('17 Nopember 2026'), '2026-11-17');
  assert.equal(parseDocumentDate('1 Agustus 2026'), '2026-08-01');
  assert.equal(parseDocumentDate('5-Mei-26'), '2026-05-05');
  assert.equal(parseDocumentDate('17-Nov-2026'), '2026-11-17');
  assert.equal(parseDocumentDate('Desember 3, 2026'), '2026-12-03');
  assert.equal(parseDocumentDate('Nov 17, 2026'), '2026-11-17');
});

test('impossible or non-dates are not invented', () => {
  for (const v of ['31/02/2026', 'ASAP', '', null, 'next week', '13/13/2026']) assert.equal(parseDocumentDate(v), null, String(v));
});

test('number readings cover Indonesian and English separators', () => {
  assert.deepEqual(numberReadings('6,600,000'), [6600000]);
  assert.deepEqual(numberReadings('6.600.000'), [6600000]);
  assert.deepEqual(numberReadings('1,234.50'), [1234.5]);
  assert.deepEqual(numberReadings('1.234,50'), [1234.5]);
  assert.deepEqual(numberReadings('6.600').sort((a, b) => a - b), [6.6, 6600]);
  assert.deepEqual(numberReadings('15,'), [15]);
});

const pdfText = `
 No  Part Number      Description                         Qty  UOM  Cur   Unit Price     Total Price   GL Code
 7   6150-03-111      Switch 24 port                      2    Unit IDR   4.250.000      8.500.000     AMINBD43.6250
 8   6150-03-236820   UPS APC SMC1000I-2UC 1000VA Smart   1    Set  IDR   6,600,000      6,600,000     AMINBD43.6250
                                                                   Total IDR       15,100,000`;

test('a misread price is flagged on its item; correct prices are not', () => {
  const data = {
    totalAmount: 15100000,
    items: [
      { rowNo: 7, quantity: 2, unitPrice: 4250000, totalPrice: 8500000 },
      { rowNo: 8, quantity: 1, unitPrice: 6300000, totalPrice: 6300000 }
    ]
  };
  const issues = crossCheckItemNumbers(data, pdfText);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].itemIndex, 1);
  assert.equal(issues[0].severity, 'warning');
  assert.match(issues[0].message, /Item 8: unit price 6,300,000 and line total 6,300,000 not found/);
});

test('a wrong document total is flagged; a scan without text is not judged', () => {
  const data = { totalAmount: 15400000, items: [{ unitPrice: 4250000, totalPrice: 8500000 }] };
  assert.deepEqual(crossCheckItemNumbers(data, pdfText).map((i) => i.id), ['total-not-in-pdf']);
  assert.deepEqual(crossCheckItemNumbers({ totalAmount: 1, items: [{ unitPrice: 999 }] }, ''), []);
  assert.deepEqual(crossCheckItemNumbers({ totalAmount: 1, items: [{ unitPrice: 999 }] }, 'Page 1 of 2'), []);
});

const reviewed = (dateRequired) => ({
  prfNo: '55943', requestedBy: 'Widji', department: 'IT', dateRequired, totalAmount: 100,
  items: [{ description: 'Token', quantity: 1, unitPrice: 100, totalPrice: 100, currency: 'IDR', purchaseCostCode: 'MTIRMRAD496328' }]
});

test('review accepts ASAP (any spelling) as Date Required and still rejects other text', () => {
  for (const v of ['ASAP', 'asap', 'A.S.A.P']) assert.equal(validateReviewedData(reviewed(v)).dateRequired, 'ASAP');
  assert.equal(validateReviewedData(reviewed('2026-11-30')).dateRequired, '2026-11-30');
  assert.throws(() => validateReviewedData(reviewed('next week')), (e) => e.code === 'INVALID_DATE');
});

test('follow-up items carry requiredAsap', () => {
  const now = new Date('2026-11-24T02:00:00Z');
  const [item] = buildFollowUps(
    [{ PRFID: 1, PRFNo: '55943', Title: 'x', Status: 'On order', RequiredDate: new Date('2026-11-10T00:00:00Z'), RequiredASAP: true, AllocatedBuyer: null }],
    [], now
  );
  assert.equal(item.requiredAsap, true);
});
