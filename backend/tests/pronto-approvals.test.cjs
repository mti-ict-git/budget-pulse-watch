// Offline tests for the Pronto approval history payload validator (no database access).
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProntoApprovalPayload } = require('../dist/services/prontoApprovalHistory');

const entry = (over = {}) => ({
  lineNo: 1,
  approvalUser: 'MTI IT',
  actionAt: '2026-09-10T08:52:28',
  actionAtRaw: '10-SEP-2026 08:52:28',
  status: 'New Order',
  comment: '',
  ...over
});

test('accepts the worker payload and keeps Pronto wall-clock time', () => {
  const r = validateProntoApprovalPayload({ poNumber: '53851', entries: [entry(), entry({ lineNo: 2, status: 'Acknowledge' })] });
  assert.equal(r.ok, true);
  assert.equal(r.value.poNumber, '53851');
  assert.equal(r.value.entries.length, 2);
  assert.equal(r.value.entries[0].actionAt.toISOString(), '2026-09-10T08:52:28.000Z');
  assert.equal(r.value.entries[0].comment, null);
  assert.equal(r.value.entries[1].entrySeq, 2);
});

test('an empty entries list is valid (clears the PO history)', () => {
  const r = validateProntoApprovalPayload({ poNumber: '51727', entries: [] });
  assert.equal(r.ok, true);
  assert.equal(r.value.entries.length, 0);
});

test('null actionAt is allowed', () => {
  const r = validateProntoApprovalPayload({ poNumber: '51727', entries: [entry({ actionAt: null })] });
  assert.equal(r.ok, true);
  assert.equal(r.value.entries[0].actionAt, null);
});

test('rejects bad input', () => {
  const cases = [
    [null, /object/],
    [{ poNumber: 'ABC', entries: [] }, /poNumber/],
    [{ poNumber: '51727' }, /entries must be an array/],
    [{ poNumber: '51727', entries: [entry({ approvalUser: '  ' })] }, /approvalUser/],
    [{ poNumber: '51727', entries: [entry({ status: '' })] }, /status/],
    [{ poNumber: '51727', entries: [entry({ actionAt: '10-SEP-2026' })] }, /actionAt/],
    [{ poNumber: '51727', entries: [entry(), entry()] }, /duplicated/],
    [{ poNumber: '51727', entries: [entry({ lineNo: 0 })] }, /positive integer/],
    [{ poNumber: '51727', entries: Array.from({ length: 201 }, (_, i) => entry({ lineNo: i + 1 })) }, /exceed/]
  ];
  for (const [body, rx] of cases) {
    const r = validateProntoApprovalPayload(body);
    assert.equal(r.ok, false, JSON.stringify(body)?.slice(0, 80));
    assert.match(r.message, rx);
  }
});

test('long text is truncated to column sizes', () => {
  const r = validateProntoApprovalPayload({ poNumber: '51727', entries: [entry({ approvalUser: 'x'.repeat(300), comment: 'c'.repeat(1200) })] });
  assert.equal(r.ok, true);
  assert.equal(r.value.entries[0].approvalUser.length, 200);
  assert.equal(r.value.entries[0].comment.length, 1000);
});
