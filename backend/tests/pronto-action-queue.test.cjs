// Offline tests for the Pronto Immediate Action queue: snapshot validation, the rejected / IT action /
// waiting classification, and matching queue rows to POMON PRFs and split POs.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateQueueSnapshot,
  classifyQueueItem,
  latestApprovalAction,
  matchQueueRows,
} = require('../dist/services/prontoActionQueue');

// Approval Status of 42300 as read from Pronto on 2026-11-26.
const approvals42300 = [
  { lineNo: 1, approvalUser: 'BUYER', actionAt: null, actionAtRaw: null, status: '', comment: null },
  { lineNo: 2, approvalUser: 'MTI IT', actionAt: null, actionAtRaw: null, status: '', comment: null },
  { lineNo: 3, approvalUser: 'Arthur Saul', actionAt: '2026-11-25T10:50:57', actionAtRaw: '25-NOV-2026 10:50:57', status: 'Rejected PO', comment: 'cek ini masih dibutuhkan ga?' },
  { lineNo: 4, approvalUser: 'Ryanda Ganesha Away', actionAt: '2026-11-25T14:34:30', actionAtRaw: '25-NOV-2026 14:34:30', status: 'Rejected', comment: 'Bug PR/PO, Please Create New PR' },
];
const nextIt = [
  { name: 'Arthur Saul', user: 'arthurs', hierarchy: '' },
  { name: 'MTI IT', user: 'itmt', hierarchy: 'MAMCHRCCIT' },
];

test('the latest dated entry decides; pending entries have no date', () => {
  assert.equal(latestApprovalAction(approvals42300).approvalUser, 'Ryanda Ganesha Away');
  assert.equal(latestApprovalAction(approvals42300.slice(0, 2)), null);
});

test('a rejection wins over MTI IT in Next Action By', () => {
  assert.equal(classifyQueueItem({ approvals: approvals42300, nextActionBy: nextIt }, 'itmt'), 'rejected');
});

test('MTI IT in Next Action By without a rejection needs IT action', () => {
  const approved = [{ lineNo: 1, approvalUser: 'MTI IT', actionAt: '2026-11-20T08:00:00', actionAtRaw: null, status: 'New Order', comment: null }];
  assert.equal(classifyQueueItem({ approvals: approved, nextActionBy: nextIt }, 'itmt'), 'it_action');
  assert.equal(classifyQueueItem({ approvals: approved, nextActionBy: nextIt }, 'ITMT'), 'it_action');
  assert.equal(classifyQueueItem({ approvals: approved, nextActionBy: [nextIt[0]] }, 'itmt'), 'waiting_other');
});

test('a re-approval after a rejection is no longer rejected', () => {
  const later = [...approvals42300, { lineNo: 5, approvalUser: 'System', actionAt: '2026-11-26T09:00:00', actionAtRaw: null, status: 'Re-Approved', comment: null }];
  assert.equal(classifyQueueItem({ approvals: later, nextActionBy: nextIt }, 'itmt'), 'it_action');
});

test('snapshot validation', () => {
  const ok = validateQueueSnapshot({
    checkedAt: '2026-11-26T01:00:00.000Z',
    prontoUser: 'itmt',
    rows: [{
      orderNo: '42300', reqTotal: 28165000, dueDate: '2026-03-20', nextActionBy: nextIt,
      approvals: [{ line_no: 3, approval_user: 'Arthur Saul', action_at: '2026-11-25T10:50:57', action_at_raw: '25-NOV-2026 10:50:57', status: 'Rejected PO', comment: 'x' }],
      errors: [],
    }],
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.rows[0].approvals[0].approvalUser, 'Arthur Saul');
  assert.equal(ok.value.rows[0].approvals[0].lineNo, 3);

  const failed = validateQueueSnapshot({ error: 'Pronto login failed', rows: null });
  assert.equal(failed.ok, true);
  assert.equal(failed.value.rows, null);

  assert.equal(validateQueueSnapshot({ rows: null }).ok, false);
  assert.equal(validateQueueSnapshot({ rows: [{ orderNo: 'ABC' }] }).ok, false);
  assert.equal(validateQueueSnapshot({ rows: [{ orderNo: '1' }, { orderNo: '1' }] }).ok, false);
});

test('rows match a PRF number or a split PO; others are listed apart', () => {
  const dbRow = (orderNo) => ({
    OrderNo: orderNo, Supplier: null, Warehouse: null, DueDate: null, RequestUser: null, CostCategory: null,
    ReqTotal: null, Currency: null, LocalValue: null, Auth: null, ActionGroup: null, Buyer: null, StockGroup: null,
    Priority: null, NextActionByJson: JSON.stringify(nextIt), ApprovalsJson: '[]', ReadErrors: null,
    CheckedAt: new Date('2026-11-26T01:00:00Z'),
  });
  const { items, unmatched, counts } = matchQueueRows(
    [dbRow('53956'), dbRow('42300'), dbRow('99999')],
    [
      { OrderNo: '53956', PRFID: 10, PRFNo: '53956', IsSplit: 0 },
      { OrderNo: '42300', PRFID: 11, PRFNo: '41436', IsSplit: 1 },
    ],
    'itmt'
  );
  assert.deepEqual(items.map((i) => [i.orderNo, i.prfNo, i.isSplit]), [['42300', '41436', true], ['53956', '53956', false]]);
  assert.deepEqual(unmatched.map((i) => i.orderNo), ['99999']);
  assert.equal(counts.total, 2);
  assert.equal(counts.itAction, 2);
});

test('a direct PRF match wins over a split match', () => {
  const row = { OrderNo: '50000', NextActionByJson: '[]', ApprovalsJson: '[]', DueDate: null, ReqTotal: null, LocalValue: null, CheckedAt: new Date() };
  const { items } = matchQueueRows([row], [
    { OrderNo: '50000', PRFID: 2, PRFNo: '49999', IsSplit: 1 },
    { OrderNo: '50000', PRFID: 1, PRFNo: '50000', IsSplit: 0 },
  ], 'itmt');
  assert.equal(items[0].prfNo, '50000');
  assert.equal(items[0].isSplit, false);
});

// --- Acknowledge requests (Phase 30) ---
const { checkAcknowledgeRequest, validateActionResult } = require('../dist/services/prontoQueueActions');

test('an acknowledge can be requested only for a queued IT-action item without an open request', () => {
  const queue = {
    items: [
      { orderNo: '60001', category: 'it_action', prfId: 7 },
      { orderNo: '42300', category: 'rejected', prfId: 11 },
      { orderNo: '53956', category: 'waiting_other', prfId: 10 },
    ],
  };
  assert.deepEqual(checkAcknowledgeRequest('60001', queue, []), { ok: true, prfId: 7 });
  assert.equal(checkAcknowledgeRequest('42300', queue, []).status, 409);
  assert.match(checkAcknowledgeRequest('42300', queue, []).message, /rejected/);
  assert.equal(checkAcknowledgeRequest('53956', queue, []).status, 409);
  assert.equal(checkAcknowledgeRequest('99999', queue, []).status, 404);
  assert.equal(checkAcknowledgeRequest('abc', queue, []).status, 400);
  assert.equal(checkAcknowledgeRequest('60001', queue, [{ OrderNo: '60001', Status: 'pending' }]).status, 409);
  assert.equal(checkAcknowledgeRequest('60001', queue, [{ OrderNo: '60001', Status: 'running' }]).status, 409);
  assert.equal(checkAcknowledgeRequest('60001', queue, [{ OrderNo: '60001', Status: 'done' }]).ok, true);
});

test('worker results must use a final status', () => {
  assert.deepEqual(validateActionResult({ status: 'done', message: ' ok ' }), { ok: true, status: 'done', message: 'ok' });
  assert.equal(validateActionResult({ status: 'unverified' }).ok, true);
  assert.equal(validateActionResult({ status: 'running' }).ok, false);
  assert.equal(validateActionResult({ status: 'approved' }).ok, false);
  assert.equal(validateActionResult(null).ok, false);
});
