// Offline tests for the PRF follow-up rules (no database access).
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFollowUps } = require('../dist/services/prfFollowUp');

// 2026-11-16 10:00 WITA = 02:00 UTC. Approval times are Pronto wall-clock time stored as UTC.
const NOW = new Date('2026-11-16T02:00:00Z');
const wall = (s) => new Date(`${s}Z`);
const prf = (over = {}) => ({
  PRFID: 1,
  PRFNo: '53956',
  Title: 'Software warranty support',
  Status: 'Req. Approval Reqd',
  RequiredDate: null,
  AllocatedBuyer: 'dittag',
  ...over
});
const step = (over = {}) => ({ PRFID: 1, PONumber: '53956', ApprovalUser: 'MTI IT', ActionAt: wall('2026-11-10T08:00:00'), Status: 'Acknowledge', ...over });
const pending = (user) => step({ ApprovalUser: user, ActionAt: null, Status: '' });

test('approval waiting longer than 3 days is listed with the approver', () => {
  const [item, ...rest] = buildFollowUps([prf()], [pending('William Liem'), step()], NOW);
  assert.equal(rest.length, 0);
  assert.deepEqual(item.nextActionBy, ['William Liem']);
  assert.equal(item.reasons[0].code, 'approval_waiting');
  assert.equal(item.reasons[0].days, 6);
  assert.equal(item.lastActionAt, '2026-11-10T08:00:00');
});

test('approval waiting 3 days or less is not listed', () => {
  const items = buildFollowUps([prf()], [pending('William Liem'), step({ ActionAt: wall('2026-11-13T09:00:00') })], NOW);
  assert.equal(items.length, 0);
});

test('past Required Date is listed even without approvals', () => {
  const [item] = buildFollowUps([prf({ Status: 'On order', RequiredDate: new Date('2026-11-01T00:00:00Z') })], [], NOW);
  assert.equal(item.reasons[0].code, 'past_required_date');
  assert.equal(item.reasons[0].days, 15);
});

test('past Required Date older than 90 days is left out; 90 days is kept', () => {
  const old = buildFollowUps([prf({ Status: 'On order', RequiredDate: new Date('2026-08-17T00:00:00Z') })], [], NOW);
  assert.equal(old.length, 0); // 91 days
  const edge = buildFollowUps([prf({ Status: 'On order', RequiredDate: new Date('2026-08-18T00:00:00Z') })], [], NOW);
  assert.equal(edge[0].reasons[0].days, 90);
});

test('Req. Approved without a step for more than 7 days is listed; 7 days or less is not', () => {
  const old = buildFollowUps([prf({ Status: 'Req. Approved' })], [step({ ActionAt: wall('2026-11-01T08:00:00') })], NOW);
  assert.equal(old[0].reasons[0].code, 'requisition_approved_idle');
  const recent = buildFollowUps([prf({ Status: 'Req. Approved' })], [step({ ActionAt: wall('2026-11-12T08:00:00') })], NOW);
  assert.equal(recent.length, 0);
});

test('closed PRFs are never listed', () => {
  for (const Status of ['Completed', 'cancelled', 'Rejected']) {
    assert.equal(buildFollowUps([prf({ Status, RequiredDate: new Date('2026-01-01T00:00:00Z') })], [], NOW).length, 0);
  }
});

test('approvals waiting come first, then the longest delay', () => {
  const items = buildFollowUps(
    [
      prf({ PRFID: 1, PRFNo: 'A', Status: 'On order', RequiredDate: new Date('2026-10-01T00:00:00Z') }),
      prf({ PRFID: 2, PRFNo: 'B' })
    ],
    [step({ PRFID: 2 }), pending('X')].map((e, i) => (i === 1 ? { ...e, PRFID: 2 } : e)),
    NOW
  );
  assert.deepEqual(items.map((i) => i.prfNo), ['B', 'A']);
});
