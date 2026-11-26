// Offline tests: a printed total that does not add up (PRF 55690) is a warning on rescan when the
// PDF text confirms every item row, and still blocks when it does not (scan, or a misread row).
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRescanExtraction, printedTotalWarning } = require('../dist/services/rescanValidation');
const { pdfConfirmsItemRows } = require('../dist/services/ocrCrossCheck');

// PRF 55690 as printed: TOTAL 76,245,000 leaves out row 3 (8,670,000); the rows add up to 84,915,000.
const pdfText = `PRF No: 55690
  1  5998-03-149373  Falco Package Carpark Standard - 1DR Controller  3 SET IDR 18,915,000  56,745,000
  2  6695-03-147848  HID iClass SE card reader  6 EACH IDR 3,250,000  19,500,000  AMINFO10.6250
  3  7125-03-272616  Rack Wallmount Indorack 12u  3 UNT IDR 2,890,000  8,670,000
  TOTAL  76,245,000  8386950`;
const data = {
  prfNo: '55690', totalAmount: 76245000,
  items: [
    { partNumber: '5998-03-149373', description: 'Falco Package Carpark Standard - 1DR Controller', quantity: 3, unitPrice: 18915000, totalPrice: 56745000 },
    { partNumber: '6695-03-147848', description: 'HID iClass SE card reader', quantity: 6, unitPrice: 3250000, totalPrice: 19500000 },
    { partNumber: '7125-03-272616', description: 'Rack Wallmount Indorack 12u', quantity: 3, unitPrice: 2890000, totalPrice: 8670000 },
  ],
};
const existing = [{ ItemCode: '5998-03-149373', ItemName: 'Falco Package Carpark Standard', Quantity: 3 }];

test('PRF 55690: rows confirmed by the PDF text, wrong printed total is a warning', () => {
  assert.equal(pdfConfirmsItemRows(data, pdfText), true);
  assert.deepEqual(validateRescanExtraction(data, '55690', existing, { rowsConfirmedByPdf: true }), []);
  const warning = printedTotalWarning(data);
  assert.match(warning, /76,245,000/);
  assert.match(warning, /84,915,000/);
  assert.match(warning, /8,670,000/);
});

test('without PDF confirmation the wrong total still blocks', () => {
  assert.ok(validateRescanExtraction(data, '55690', existing).some((e) => e.includes('Document total')));
  assert.equal(pdfConfirmsItemRows(data, ''), false); // scan without text layer
});

test('a misread row is not confirmed, so the total check keeps blocking', () => {
  const misread = { ...data, items: data.items.map((item, i) => (i === 2 ? { ...item, unitPrice: 2690000, totalPrice: 8070000 } : item)) };
  assert.equal(pdfConfirmsItemRows(misread, pdfText), false);
});

test('a row arithmetic error still blocks even when rows are confirmed', () => {
  const bad = { ...data, items: data.items.map((item, i) => (i === 0 ? { ...item, totalPrice: 19500000 } : item)) };
  assert.ok(validateRescanExtraction(bad, '55690', existing, { rowsConfirmedByPdf: true }).some((e) => e.includes('Document total')));
});

test('a total that reconciles gives no warning', () => {
  assert.equal(printedTotalWarning({ ...data, totalAmount: 84915000 }), null);
});
