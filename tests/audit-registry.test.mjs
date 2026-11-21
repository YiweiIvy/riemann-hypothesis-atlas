import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openLocalCosmos } from "../scripts/open-local-cosmos.mjs";
import { createAuditRegistry } from "../site/audit-registry.mjs";
import { AUTHOR_ROUTE, NODES } from "../site/data/atlas.mjs";
import { declarationNode } from "../site/network-model.mjs";
import { createReview, evaluateGraph } from "../site/trust.mjs";

const index = JSON.parse(await readFile(new URL('../site/data/lean-index.json', import.meta.url)));
const source = await openLocalCosmos();
const lean = (name) => 'lean:' + name;
const review = (nodeId, outcome) => createReview({id:'fixture',nodeId,outcome,group:'test',source:'test',note:'Fixture',at:'2026-01-01T12:00:00Z'});

test('starter registry preserves every teaching bridge, author route, and sampled reference', () => {
  const r = createAuditRegistry(index, source);
  assert.equal(r.nodes.length, NODES.length + AUTHOR_ROUTE.length + index.nodes.length);
  assert.equal(r.eligibleIds.size, r.nodes.length);
  assert.deepEqual(r.byId.get('rh').dependsOn, ['every',lean('riemannHypothesis'),lean('riemannZeta_eq_zero_re')]);
  assert.ok(r.byId.get('every').dependsOn.includes(lean('LFunction_ne_zero_of_half_lt_re')));
  for (const row of index.nodes) {
    const node = r.byId.get(lean(row.id));
    assert.deepEqual(node.dependsOn, row.deps.map(lean));
    assert.equal(node.omitted, row.omitted);
  }
});

test('actual edges reduce omitted counts once, while generated references remain unreviewed', async () => {
  const r = createAuditRegistry(index, source);
  const row = await source.find('Formalism.UG.P.conv_finDosetSupp');
  const {items: deps} = await source.neighbors(row.id);
  const nodes = [row, ...deps].map(declarationNode);
  const edges = deps.map(d => ({from:row.name,to:d.name,kind:d.via}));
  assert.ok(r.registerGraph(nodes, []));
  const node = r.byId.get(lean(row.name));
  assert.equal(node.omitted, row.deps + row.omittedProjectRefs);
  assert.equal(r.registerGraph(nodes, [{...edges[0],kind:'step'}]), false);
  assert.ok(r.registerGraph(nodes, edges));
  assert.equal(r.registerGraph(nodes, edges), false);
  assert.equal(node.omitted, row.omittedProjectRefs);
  assert.ok(node.omitted > 0);
  assert.deepEqual(node.dependsOn, deps.map(d => lean(d.name)));
  assert.equal(evaluateGraph(r.nodes, [review(node.id,'support')])[node.id].status, 'inconclusive');
});

test('rehydrating a deep review from disk rebuilds a real witness to a public target', async () => {
  const name = 'Formalism.UG.P.conv_finDosetSupp';
  const id = lean(name);
  const leaf = await source.find(name);
  const path = await source.pathToTarget(leaf.id);
  const records = [review(id,'challenge')];
  for (const preOpened of [true,false]) {
    const r = createAuditRegistry(index, source);
    if (preOpened) r.registerGraph([declarationNode(leaf)], []);
    const allowed = await r.allowReviews(records);
    assert.equal(allowed, r.eligibleIds);
    assert.ok(allowed.has(id));
    for (let i=1;i<path.items.length;i++) {
      assert.ok(r.byId.get(lean(path.items[i-1].name)).dependsOn.includes(lean(path.items[i].name)));
    }
    const states = evaluateGraph(r.nodes, records);
    assert.equal(states[lean(path.items[0].name)].blockers[0].origin,id);
    assert.equal(states.rh.blockers[0].origin,id);
    const nodeCount = r.nodes.length;
    assert.equal(await r.ensureReview(id),r.byId.get(id));
    assert.equal(r.nodes.length,nodeCount);
    await assert.rejects(r.allowReviews([{nodeId:'lean:Does.Not.Exist'}]), /Unknown review node/);
    await assert.rejects(r.ensureReview('src/Main.lean'), /Unknown review node/);
    assert.ok(!r.eligibleIds.has('lean:Does.Not.Exist'));
  }
});

test('a reviewed row beyond a generated proof constant gains no fabricated route', async () => {
  const row = { id:'d:999999',name:'Untraced',kind:'declaration',declKind:'theorem',deps:0,omittedProjectRefs:2,file:'src/X.lean',line:5,url:'#fixture' };
  let lookups=0;
  const r = createAuditRegistry(index, {async find(){lookups++;return row;}, async pathToTarget(){return null;}});
  const id = lean(row.name);
  const [one,two] = await Promise.all([r.ensureReview(id),r.ensureReview(id)]);
  assert.equal(one,two);
  assert.equal(lookups,1);
  assert.equal(one.omitted,2);
  assert.deepEqual(one.dependsOn,[]);
  assert.ok(!r.nodes.some(n=>n.dependsOn.includes(id)));
});
