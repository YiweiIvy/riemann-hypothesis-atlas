import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {renderSourceMatches} from '../site/code-view.mjs';
import {openLocalCosmos} from '../scripts/open-local-cosmos.mjs';

const corpus = await openLocalCosmos();
const index = JSON.parse(await readFile(new URL('../site/data/lean-index.json',import.meta.url)));

test('a declaration outside the opening sample has a pinned source link and an immediate graph action', async () => {
  const name='Formalism.UG.P.conv_finDosetSupp';
  assert.ok(!index.nodes.some(row=>row.id===name));
  const view = await renderSourceMatches(index,corpus,name.toLowerCase());
  assert.match(view,/1 matching declaration</);
  assert.ok(view.includes('data-action="locate" data-id="'+name+'"'));
  assert.ok(view.includes('data-action="code-node" data-id="'+name+'"'));
  assert.ok(view.includes((await corpus.find(name)).url));
});

test('namespace pagination, exact source file lookup, and landmark-label search share the same index', async () => {
  const first = await renderSourceMatches(index,corpus,'Formalism.');
  const next = await renderSourceMatches(index,corpus,'Formalism.',18);
  assert.match(first,/1–18 of/);
  assert.match(next,/19–36 of/);
  assert.equal((first.match(/class="cv-hit"/g)||[]).length,18);
  assert.match(await renderSourceMatches(index,corpus,'src/Main.lean'),/5 matching declarations/);
  const topic = await renderSourceMatches(index,corpus,'zero-free half-plane');
  assert.ok(topic.includes('data-id="LFunction_ne_zero_of_half_lt_re"'));
  assert.equal(await renderSourceMatches(index,corpus,'  '),'');
});
