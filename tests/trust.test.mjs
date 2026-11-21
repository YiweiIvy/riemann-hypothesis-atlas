import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  createReview, enforceReviewOwnership, evaluateGraph, exportReviews, importReviews, mergeReviews, REVIEW_CONTEXT, reviewHistory,
} from '../site/trust.mjs';
import {BASELINE} from '../site/data/baseline.mjs';
import {mergeIntoRegistry} from '../scripts/merge-reviews.mjs';

const chain = [{id: 'base'}, {id: 'step', dependsOn: ['base']}, {id: 'end', dependsOn: ['step']}];
function record(id, nodeId = 'base', outcome = 'support', group = 'report-a') {
  return createReview({id: String(id), nodeId, outcome, group, source: 'test fixture',
    note: 'Fixture for the review engine.', at: `2020-01-${String(id).padStart(2, '0')}T12:00:00Z`});
}

test('independence groups ignore repeat votes, retain conflicting findings, and count abstentions', () => {
  const records = [
    record(1), record(2, 'base', 'support', ' REPORT-A '), record(3, 'base', 'challenge'),
    record(4, 'base', 'inconclusive', 'report-b'), record(5, 'base', 'support', 'report-c'),
  ];
  const base = evaluateGraph(chain, records).base;
  assert.equal(base.status, 'mixed');
  assert.deepEqual(base.counts, {support: 1, challenge: 0, mixed: 1, inconclusive: 1, total: 3});
  assert.equal(base.score, 1);
  assert.deepEqual(base.supportRange, [1 / 3, 1]);
  assert.equal(evaluateGraph(chain, []).base.score, null);
});

test('one challenge survives multiple supporting groups and propagates to dependents', () => {
  const reviews = [record(1), record(2, 'base', 'support', 'b'), record(3, 'base', 'challenge', 'c')];
  const state = evaluateGraph(chain, reviews);
  assert.equal(state.base.status, 'mixed');
  assert.deepEqual(state.base.supportRange, [2 / 3, 2 / 3]);
  assert.equal(state.step.blockers[0].kind, 'review');
  assert.equal(state.end.blockers[0].origin, 'base');
});

test('local support requires every antecedent before the full chain can show support', () => {
  const reviews = [record(1, 'end'), record(2, 'step')];
  const partial = evaluateGraph(chain, reviews);
  assert.equal(partial.end.status, 'inconclusive');
  assert.deepEqual(partial.end.pendingDependencies, ['step']);
  assert.equal(partial.step.directStatus, 'supported');
  assert.equal(partial.base.status, 'unreviewed');
  assert.equal(evaluateGraph(chain, [...reviews, record(3)]).end.status, 'supported');
});

test('a sampled node with omitted edges stays pending without becoming a structural blocker', () => {
  const graph = [{id: 'base', omitted: 4}, ...chain.slice(1)];
  const reviews = graph.map(({id}, i) => record(i + 1, id));
  const state = evaluateGraph(graph, reviews);
  assert.equal(state.base.omitted, 4);
  assert.deepEqual(state.base.blockers, []);
  assert.equal(state.base.directStatus, 'supported');
  assert.equal(state.base.status, 'inconclusive');
  assert.equal(state.end.status, 'inconclusive');
  assert.equal(evaluateGraph(chain, reviews).end.status, 'supported');
});

test('structural blockers survive universal local support and identify a source', () => {
  const nodes = [{id: 'base', blocker: 'unproved assumption in fixture'}, ...chain.slice(1)];
  const reviews = nodes.map(({id}, i) => record(i + 1, id));
  const state = evaluateGraph(nodes, reviews);
  for (const node of nodes) assert.equal(state[node.id].status, 'blocked');
  assert.equal(state.base.directStatus, 'supported');
  assert.equal(state.end.blockers[0].origin, 'base');
});

test('cycles and missing nodes are detected, including cycles with several entry routes', () => {
  const nodes = [
    {id: 'a', dependsOn: ['b']}, {id: 'b', dependsOn: ['a', 'orphan']},
    {id: 'consumer', dependsOn: ['a', 'b']}, {id: 'self', dependsOn: ['self']}, {id: 'clean'},
  ];
  for (const order of [nodes, nodes.toReversed()]) {
    const state = evaluateGraph(order);
    assert.equal(state.clean.status, 'unreviewed');
    assert.deepEqual(state.a.blockers[0].members.toSorted(), ['a', 'b']);
    assert.equal(state.b.blockers.some(b => b.kind === 'missing' && b.nodeId === 'orphan'), true);
    assert.equal(state.consumer.status, 'blocked');
    assert.equal(state.self.blockers[0].kind, 'cycle');
  }
});

test('long dependency chains avoid recursion limits', () => {
  const nodes = Array.from({length: 4200}, (_, i) => ({id: String(i), dependsOn: [String(i + 1)]}));
  assert.equal(evaluateGraph(nodes)['0'].blockers[0].origin, '4200');
});

test('long qualified Lean identifiers round-trip and propagate through dependencies', () => {
  const sourceId = 'lean:' + 'ElaboratedNamespace.'.repeat(200) + 'lemma';
  const reviews = importReviews(exportReviews([record(1, sourceId, 'challenge')]), REVIEW_CONTEXT, [sourceId]);
  const states = evaluateGraph([{id: 'target', dependsOn: [sourceId]}, {id: sourceId}], reviews);
  assert.equal(states.target.blockers[0].origin, sourceId);
  assert.throws(() => record(1, 'x'.repeat(4097)), /nodeId/);
});

test('history replays the selected node and its antecedents in chronological order', () => {
  const records = [record(4, 'unrelated'), record(3, 'base'), record(1, 'end'), record(2, 'step')];
  const history = reviewHistory([...chain, {id: 'unrelated'}], records, 'end');
  assert.deepEqual(history.map(e => [e.id, e.status]), [
    ['1', 'inconclusive'], ['2', 'inconclusive'], ['3', 'supported'],
  ]);
});

test('explicit same-group correction and withdrawal preserve history and lift a mistaken challenge', () => {
  const base = record(1, 'base', 'challenge'), end = record(2, 'end'), step = record(3, 'step');
  const fixed = createReview({...record(4), supersedes: base.id});
  const withdrawn = createReview({...record(5), outcome:'withdrawn', supersedes: fixed.id});
  const restored = createReview({...record(6), supersedes: withdrawn.id});
  const records = [restored, step, withdrawn, base, fixed, end];
  const history = reviewHistory(chain, records, 'end');
  assert.deepEqual(history.map(p => p.status), ['blocked','blocked','blocked','supported','inconclusive','supported']);
  const own = reviewHistory(chain, records, 'base');
  assert.deepEqual(own.map(p => p.counts.total), [1, 1, 0, 1]);
  assert.deepEqual(own.map(p => p.cumulativeGroups), [1, 1, 1, 1]);
  assert.equal(own[2].supportRange, null);
  assert.equal(evaluateGraph(chain, [base, end, step, {...fixed, supersedes: undefined}]).base.status, 'mixed');
  assert.equal(importReviews(exportReviews(records)).length, 6);
});

test('withdrawal removes only its predecessor while other observations in the same group stay effective', () => {
  const one = record(1), two = record(2);
  const withdrawOne = createReview({...one, id:'w', outcome:'withdrawn', supersedes:one.id, at:'2020-01-03T00:00:00Z'});
  assert.equal(evaluateGraph(chain, [one, two, withdrawOne]).base.status, 'supported');
});

test('corrections must have a unique earlier record, matching scope and no fork', () => {
  const old = record(1), edit = createReview({...record(2), supersedes:old.id});
  assert.throws(() => mergeReviews([edit]), /Missing original/);
  assert.throws(() => mergeReviews([old, {...edit, at:old.at}]), /later than/);
  assert.throws(() => mergeReviews([old, {...edit, group:'other'}]), /original evidence group/);
  assert.throws(() => mergeReviews([old, {...edit, nodeId:'end'}]), /original node/);
  assert.throws(() => mergeReviews([old, edit, {...edit, id:'fork'}]), /Forked/);
  assert.throws(() => createReview({...old, outcome:'withdrawn'}), /must identify/);
  assert.throws(() => enforceReviewOwnership([old, edit], [old]), /Published/);
  assert.deepEqual(enforceReviewOwnership([old, edit], [old, edit]), mergeReviews([old, edit]));
});

test('exports are stable, snapshot-bound, append-only, and reject unknown nodes', () => {
  const a = record(1), b = record(2);
  const text = exportReviews([b, a]);
  assert.equal(exportReviews(mergeReviews([a], importReviews(text, REVIEW_CONTEXT, ['base']))), text);
  assert.throws(() => importReviews(text, 'different context'), /snapshot/);
  assert.throws(() => importReviews(text, REVIEW_CONTEXT, ['unrelated']), /Unknown node/);
  assert.throws(() => importReviews(JSON.stringify([a, b])), /format/);
  assert.throws(() => createReview({...a, at: '2020-01-01'}), /ISO/);
  assert.throws(() => createReview({...a, at: '2021-02-29T12:00:00Z'}), /ISO/);
  assert.throws(() => mergeReviews([a], [{...a, outcome: 'challenge'}]), /Conflicting/);
  assert.equal(evaluateGraph([{id: '__proto__'}], [record(1, '__proto__')]).__proto__.status, 'supported');
});

test('registry merge is atomic, rejects collisions, serializes writers and remains idempotent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'riemann-review-test-'));
  try {
    const registry = join(dir, 'registry.json'), first = join(dir, 'a.json'), broken = join(dir, 'b.json');
    const r = record(1);
    await writeFile(registry, exportReviews([]));
    await writeFile(first, exportReviews([r]));
    await writeFile(broken, exportReviews([{...r, note: 'conflicting content'}]));
    await assert.rejects(mergeIntoRegistry(registry, [first, broken], ['base']), /Conflicting/);
    assert.equal(await readFile(registry, 'utf8'), exportReviews([]));
    assert.deepEqual(await mergeIntoRegistry(registry, [first], ['base']), {added: 1, total: 1});
    assert.deepEqual(await mergeIntoRegistry(registry, [first], ['base']), {added: 0, total: 1});
    await writeFile(broken, exportReviews([r, {...record(2), supersedes:r.id}]));
    await assert.rejects(mergeIntoRegistry(registry, [broken], ['base']), /Published/);
    await writeFile(registry + '.lock', '');
    await assert.rejects(mergeIntoRegistry(registry, [broken], ['base']), {code: 'EEXIST'});
    assert.equal(await readFile(registry, 'utf8'), exportReviews([r]));
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('the English edition accepts an exact historic baseline note and preserves personal text', () => {
  const published = BASELINE.find(r => r.id === 'public-nanoda-lean:riemannHypothesis');
  const historic = {...published, note: 'riemannHypothesis。Sutherland 报告 nanoda 接受含此目标的完整导出，日志退出码为 0。此项检查覆盖内核重放。'};
  const envelope = JSON.stringify({schema:'riemann-atlas/reviews-v1',context:REVIEW_CONTEXT,reviews:[historic]});
  const [restored] = importReviews(envelope);
  assert.equal(restored.note,published.note);
  assert.equal(mergeReviews([restored], [published]).length,1);
  const privateNote = {...historic, id:'earlier-personal-review'};
  assert.equal(mergeReviews([privateNote])[0].note, privateNote.note);
  assert.throws(() => mergeReviews([{...historic,note:historic.note + '!'}], [published]), /Conflicting/);
});
