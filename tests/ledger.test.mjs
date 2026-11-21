import assert from 'node:assert/strict';
import test from 'node:test';
import {renderLedger} from '../site/ledger.mjs';
import {createReview} from '../site/trust.mjs';
import {NODES} from '../site/data/atlas.mjs';
import {BASELINE} from '../site/data/baseline.mjs';

const nodes = [{id: 'a', title: 'A & B <title>', omitted: 2}, {id: 'b', title: 'Next', dependsOn: ['a']}];
const review = createReview({
  id: 'fixture', nodeId: 'a', at: '2000-01-01T00:00:00Z', group: 'g',
  outcome: 'support', note: 'Look at <term> & source.', source: 'urn:example:review',
});

test('empty ledger never adds a chart trace and shows real coverage gaps', () => {
  const view = renderLedger({nodes, selectedId: 'a'});
  assert.match(view, /2 project references outside this selection/);
  assert.match(view, /No reviews/);
  assert.doesNotMatch(view, /<svg/);
  assert.match(view, /A &amp; B &lt;title&gt;/);
  assert.match(view, /data-ledger-jump="b"/);
});

test('one dated entry yields a point, quoted evidence, and correctly attributed provenance', () => {
  const view = renderLedger({nodes, selectedId: 'a', reviews: [review], baseline: [review]});
  assert.match(view, /2000-01-01 00:00 UTC/);
  assert.match(view, /Published check/);
  assert.match(view, /Look at &lt;term&gt; &amp; source/);
  assert.match(view, /<svg/);
  assert.doesNotMatch(view, /<input id="ld-cursor-input"/);
  assert.doesNotMatch(view, /href="urn:/);
});

test('the receiving node can inspect antecedent evidence without increasing its own numerator', () => {
  const view = renderLedger({nodes, selectedId: 'b', reviews: [review], communityReviews: [review]});
  assert.match(view, /0 direct records/);
  assert.match(view, /1 event/);
  assert.match(view, /Prerequisite reviews · 1/);
  assert.match(view, /Community/);
});

test('a challenge to auxiliary prime pairs visibly blocks RH despite its unchanged local support share', () => {
  const question = createReview({...review, nodeId: 'pairs', outcome: 'challenge', at: '2026-11-22T00:00:00Z'});
  const view = renderLedger({nodes: NODES, selectedId: 'rh', baseline: BASELINE, reviews: [...BASELINE, question]});
  assert.match(view, /class="ld-phase-mark" data-state="blocked"/);
  assert.match(view, /◆ Open → Blocked/);
  assert.match(view, /<b>100%<\/b>/);
});

test('simultaneous changes share a marker but retain each individual replay step', () => {
  const source = [{id: 'a', title: 'Example'}];
  const simultaneous = createReview({...review, id: 'z', outcome: 'challenge'});
  const view = renderLedger({nodes: source, selectedId: 'a', reviews: [review, simultaneous]});
  assert.equal(view.match(/class="ld-phase-mark"/g).length, 1);
  assert.match(view, /● Supported/);
  assert.match(view, /◐ Supported → Mixed/);
  assert.match(view, /id="ld-cursor-input"/);
});

test('only personal current records can be amended; the ledger retains a withdrawal and its evidence', () => {
  const withdrawal = createReview({...review, id:'followup', at:'2000-01-02T00:00:00Z', outcome:'withdrawn', supersedes:review.id});
  const reviews = [review, withdrawal];
  const own = renderLedger({nodes, selectedId:'a', reviews, localReviews:reviews});
  assert.match(own, /Withdrawn/);
  assert.match(own, /Amends Support from 2000-01-01 00:00 UTC/);
  assert.match(own, /data-action="amend" data-id="followup"/);
  assert.doesNotMatch(own, /data-action="amend" data-id="fixture"/);
  const publicCopy = renderLedger({nodes, selectedId:'a', reviews, localReviews:reviews, communityReviews:reviews});
  assert.doesNotMatch(publicCopy, /data-action="amend"/);
});
