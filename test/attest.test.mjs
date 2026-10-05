import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrue, hasDesc, cmp, findNode, recompute, checkClaim, attest } from '../kernel/attest.mjs';

// A fixture whose every aggregate is a DISTINCT number, so one wrong filter shows up as a wrong count.
// total 5 · private 2 (a,c) → public 3 · live 2 (a,d) · pages 3 (a,b,d) · archived 2 (b,e) · forks 2 (c,e)
// withDesc 3 (a,c,e — b is whitespace, d is empty, neither counts)
const NODES = [
  { name: 'a', private: true,  live: true,  pages: true,  archived: false, fork: false, desc: 'x' },
  { name: 'b', private: false, live: false, pages: true,  archived: true,  fork: false, desc: '   ' },
  { name: 'c', private: true,  live: false, pages: false, archived: false, fork: true,  desc: 'hello' },
  { name: 'd', private: false, live: true,  pages: true,  archived: false, fork: false, desc: '' },
  { name: 'e', private: false, live: false, pages: false, archived: true,  fork: true,  desc: 'yo' },
];

// ── isTrue ─────────────────────────────────────────────────────────────────────
test('isTrue: true only for an explicit true', () => {
  assert.equal(isTrue({ private: true }, 'private'), true);
  assert.equal(isTrue({ private: false }, 'private'), false); // kills && → ||
  assert.equal(isTrue({ private: 1 }, 'private'), false);     // kills === → !== (1 is truthy but not true)
  assert.equal(isTrue({}, 'private'), false);                 // missing key
});
test('isTrue: never throws on hostile node', () => {
  assert.equal(isTrue(null, 'private'), false);
  assert.equal(isTrue(undefined, 'private'), false);
  assert.equal(isTrue(5, 'private'), false);
  const toxic = { get private() { throw new Error('boom'); } };
  assert.equal(isTrue(toxic, 'private'), false);
});

// ── hasDesc ────────────────────────────────────────────────────────────────────
test('hasDesc: non-empty trimmed string only', () => {
  assert.equal(hasDesc({ desc: 'hello' }), true);
  assert.equal(hasDesc({ desc: '' }), false);     // kills > 0 → >= 0
  assert.equal(hasDesc({ desc: '   ' }), false);  // whitespace trims to empty
  assert.equal(hasDesc({ desc: 42 }), false);     // kills === 'string' → !== 'string'
  assert.equal(hasDesc({}), false);               // missing desc
});
test('hasDesc: never throws on hostile node', () => {
  assert.equal(hasDesc(null), false);
  assert.equal(hasDesc(undefined), false);
  const toxic = { get desc() { throw new Error('boom'); } };
  assert.equal(hasDesc(toxic), false);
});

// ── cmp ──────────────────────────────────────────────────────────────────────── (boundary-equal kills each)
test('cmp: eq', () => { assert.equal(cmp('eq', 5, 5), true); assert.equal(cmp('eq', 5, 6), false); });
test('cmp: ge boundary', () => { assert.equal(cmp('ge', 5, 5), true); assert.equal(cmp('ge', 4, 5), false); });
test('cmp: le boundary', () => { assert.equal(cmp('le', 5, 5), true); assert.equal(cmp('le', 6, 5), false); });
test('cmp: gt boundary', () => { assert.equal(cmp('gt', 6, 5), true); assert.equal(cmp('gt', 5, 5), false); });
test('cmp: lt boundary', () => { assert.equal(cmp('lt', 4, 5), true); assert.equal(cmp('lt', 5, 5), false); });
test('cmp: approx within and outside tol', () => {
  assert.equal(cmp('approx', 3, 1, 2), true);   // |2| <= 2 → kills <= → <
  assert.equal(cmp('approx', 4, 1, 2), false);  // |3| <= 2 is false
  assert.equal(cmp('approx', 3, 1, 0), false);  // kills Number(tol) || 0 → && (tol would vanish)
});
test('cmp: unknown op and non-numeric are false', () => {
  assert.equal(cmp('nope', 5, 5), false);
  assert.equal(cmp('eq', 'x', 5), false);
  assert.equal(cmp('ge', 5, 'y'), false);
});

// ── findNode ───────────────────────────────────────────────────────────────────
test('findNode: case-insensitive hit and miss', () => {
  assert.equal(findNode(NODES, 'A').name, 'a');
  assert.equal(findNode(NODES, 'c').name, 'c');
  assert.equal(findNode(NODES, 'zzz'), null);
});
test('findNode: never throws on hostile input', () => {
  assert.equal(findNode(null, 'a'), null);
  assert.equal(findNode(42, 'a'), null);
  const toxic = [{ get name() { throw new Error('boom'); } }, { name: 'a' }];
  assert.equal(findNode(toxic, 'a').name, 'a'); // skips the toxic entry, still finds a
  assert.equal(findNode(NODES, null), null);
});

// ── recompute ────────────────────────────────────────────────────────────────── (distinct counts pin every filter)
test('recompute: every aggregate from the fixture', () => {
  const f = recompute(NODES);
  assert.deepEqual(f, { total: 5, public: 3, private: 2, live: 2, pages: 3, archived: 2, forks: 2, withDesc: 3 });
});
test('recompute: empty and non-array are all zero', () => {
  assert.deepEqual(recompute([]), { total: 0, public: 0, private: 0, live: 0, pages: 0, archived: 0, forks: 0, withDesc: 0 });
  assert.deepEqual(recompute(null).total, 0);
  assert.deepEqual(recompute(undefined).total, 0);
});
test('recompute: never throws on hostile nodes', () => {
  const toxic = [null, 5, { get private() { throw new Error('x'); } }, { name: 'ok', private: true, desc: 'd' }];
  const f = recompute(toxic);
  assert.equal(f.total, 4);
  assert.equal(f.private, 1);    // only the clean node counts; the toxic getter is swallowed to false
  assert.equal(f.withDesc, 1);
});

// ── checkClaim ─────────────────────────────────────────────────────────────────
const FACTS = recompute(NODES);
test('checkClaim: count holds and drifts', () => {
  assert.equal(checkClaim({ kind: 'count', metric: 'private', op: 'eq', expected: 2 }, FACTS, NODES).holds, true);
  const d = checkClaim({ kind: 'count', metric: 'private', op: 'eq', expected: 3 }, FACTS, NODES);
  assert.equal(d.holds, false);
  assert.equal(d.actual, 2);
  assert.equal(d.claimed, 3);
});
test('checkClaim: count default op is eq', () => {
  assert.equal(checkClaim({ kind: 'count', metric: 'total', expected: 5 }, FACTS, NODES).holds, true);
  assert.equal(checkClaim({ kind: 'count', metric: 'total', expected: 4 }, FACTS, NODES).holds, false);
});
test('checkClaim: consistent (stored vs recompute)', () => {
  assert.equal(checkClaim({ kind: 'consistent', metric: 'total', stored: 5 }, FACTS, NODES).holds, true);
  assert.equal(checkClaim({ kind: 'consistent', metric: 'total', stored: 4 }, FACTS, NODES).holds, false);
});
test('checkClaim: repo existence', () => {
  assert.equal(checkClaim({ kind: 'repo', name: 'A' }, FACTS, NODES).holds, true);
  const miss = checkClaim({ kind: 'repo', name: 'zzz' }, FACTS, NODES);
  assert.equal(miss.holds, false);
  assert.equal(miss.actual.exists, false);
});
test('checkClaim: repo private-flag match and mismatch', () => {
  assert.equal(checkClaim({ kind: 'repo', name: 'a', private: true }, FACTS, NODES).holds, true);
  assert.equal(checkClaim({ kind: 'repo', name: 'a', private: false }, FACTS, NODES).holds, false); // kills ===/&& in the private branch
  assert.equal(checkClaim({ kind: 'repo', name: 'b', private: false }, FACTS, NODES).holds, true);
});
test('checkClaim: repo live-flag match and mismatch', () => {
  assert.equal(checkClaim({ kind: 'repo', name: 'a', live: true }, FACTS, NODES).holds, true);
  assert.equal(checkClaim({ kind: 'repo', name: 'c', live: true }, FACTS, NODES).holds, false); // kills the live-branch guard + ===
  assert.equal(checkClaim({ kind: 'repo', name: 'c', live: false }, FACTS, NODES).holds, true);
});
test('checkClaim: unknown kind never holds', () => {
  assert.equal(checkClaim({ kind: 'nope' }, FACTS, NODES).holds, false);
  assert.equal(checkClaim(null, FACTS, NODES).holds, false);
});

// ── attest (the boundary) ──────────────────────────────────────────────────────
const DIGEST = {
  org: 'test-org', generated: '2026-01-01', verified: '2026-01-02',
  stored: { total: 5, private: 2 },
  nodes: NODES,
};
test('attest: all claims hold → clean', () => {
  const r = attest(DIGEST, [
    { kind: 'count', metric: 'total', op: 'eq', expected: 5 },
    { kind: 'count', metric: 'private', op: 'eq', expected: 2 },
    { kind: 'consistent', metric: 'total', stored: 5 },
    { kind: 'repo', name: 'a', private: true, live: true },
  ]);
  assert.equal(r.summary.total, 4);
  assert.equal(r.summary.held, 4);     // kills r.holds === true → !==
  assert.equal(r.summary.drifted, 0);
  assert.equal(r.summary.clean, true); // kills === 0 → !== 0
  assert.equal(r.org, 'test-org');
  assert.equal(r.facts.total, 5);
});
test('attest: one drift → not clean', () => {
  const r = attest(DIGEST, [
    { kind: 'count', metric: 'total', op: 'eq', expected: 5 },      // holds
    { kind: 'count', metric: 'private', op: 'eq', expected: 99 },   // drifts
  ]);
  assert.equal(r.summary.held, 1);
  assert.equal(r.summary.drifted, 1);
  assert.equal(r.summary.clean, false); // kills && → || in clean
});
test('attest: empty manifest is never clean', () => {
  const r = attest(DIGEST, []);
  assert.equal(r.summary.total, 0);
  assert.equal(r.summary.clean, false); // kills > 0 → >= 0
});
test('attest: never throws on hostile input', () => {
  for (const bad of [null, undefined, 42, 'x', NaN, [], {}, true]) {
    const r = attest(bad);
    assert.equal(typeof r.summary.total, 'number');
    assert.equal(r.summary.clean, false);
  }
  const circular = {}; circular.self = circular;
  assert.equal(attest(circular, circular).summary.total, 0);
  const toxic = { get nodes() { throw new Error('boom'); } };
  assert.equal(attest(toxic, []).summary.total, 0);
});
test('attest: array digest is treated as nodes', () => {
  const r = attest(NODES, [{ kind: 'count', metric: 'total', op: 'eq', expected: 5 }]);
  assert.equal(r.facts.total, 5);
  assert.equal(r.summary.held, 1);
});
