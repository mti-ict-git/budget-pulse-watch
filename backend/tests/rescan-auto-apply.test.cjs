// Offline tests for the bulk-rescan auto-apply rule: only previews that can do nothing but update
// matched rows are applied without review.
const test = require('node:test');
const assert = require('node:assert/strict');
const { rescanAutoApplyDecision } = require('../dist/services/rescanAutoApply');

const update = (scanned = {}) => ({ action: 'update', scanned });
const clean = { proposals: [update(), update()], preservedItems: [], warnings: [] };

test('a preview that only updates matched rows is applied', () => {
  assert.deepEqual(rescanAutoApplyDecision(clean), { eligible: true, blockers: [] });
});

test('warnings, new rows, unmatched rows or cancelled rows need review', () => {
  const cases = [
    { ...clean, warnings: ['Scanned item 1 has no cost code'] },
    { ...clean, proposals: [update(), { action: 'add', scanned: {} }] },
    { ...clean, preservedItems: [{ PRFItemID: 1 }] },
    { ...clean, proposals: [update({ status: 'Cancelled' })] },
    { ...clean, proposals: [update({ isStruckThrough: true })] },
    { ...clean, proposals: [] },
  ];
  for (const preview of cases) {
    const decision = rescanAutoApplyDecision(preview);
    assert.equal(decision.eligible, false);
    assert.ok(decision.blockers.length > 0);
  }
});

test('every reason is listed', () => {
  const decision = rescanAutoApplyDecision({
    proposals: [{ action: 'add', scanned: { status: 'Cancelled' } }],
    preservedItems: [{}, {}],
    warnings: ['a'],
  });
  assert.equal(decision.blockers.length, 4);
});
