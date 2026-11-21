import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NODES } from "../site/data/atlas.mjs";
import { knownNodeIds } from "../scripts/merge-reviews.mjs";
import { BASELINE } from "../site/data/baseline.mjs";
import { importReviews, mergeReviews } from "../site/trust.mjs";
import {
  baseGraph,
  routeGraph,
  shortestReferencePath,
} from "../site/network-model.mjs";

const json = async (name) =>
  JSON.parse(
    await readFile(
      new URL("../site/data/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
const index = await json("lean-index");
const ids = new Set(index.nodes.map((n) => n.id));

test("every teaching anchor resolves to a sampled, source-addressable declaration", () => {
  for (const n of NODES) {
    assert.ok(ids.has(n.leanId));
    assert.ok(
      n.sources.some((s) => s.url.includes("/blob/") && s.url.includes("#L")),
    );
    for (const d of n.dependsOn) assert.ok(NODES.some((node) => node.id === d));
  }
  for (const n of index.nodes) {
    assert.equal(n.deps.length, n.refKinds.length);
    for (const dep of n.deps) assert.ok(ids.has(dep));
  }
  assert.equal(
    index.nodes.reduce((sum, n) => sum + n.deps.length, 0),
    index.meta.edgeCount,
  );
});
test("the default galaxy and its guided paths preserve direct Lean references", () => {
  const graph = baseGraph(index);
  assert.equal(graph.nodes.length, 639);
  assert.equal(graph.edges.length, 3129);
  assert.equal(
    new Set(graph.nodes.map((node) => node.id)).size,
    graph.nodes.length,
  );
  const actual = new Set(
    graph.edges.map((e) => JSON.stringify([e.from, e.to, e.kind])),
  );
  for (const root of index.roots) {
    const path = shortestReferencePath(graph, root, index.anchors.gm);
    assert.equal(path.nodes[0].id, root);
    assert.equal(path.nodes.at(-1).id, index.anchors.gm);
    assert.ok(path.nodes.length > 2);
    assert.ok(path.nodes.every((n) => n.label && n.note));
    assert.equal(path.edges.length, path.nodes.length - 1);
    path.edges.forEach((edge, i) => {
      assert.equal(path.nodes[i].id, edge.from);
      assert.equal(path.nodes[i + 1].id, edge.to);
      assert.ok(actual.has(JSON.stringify([edge.from, edge.to, edge.kind])));
    });
  }
  assert.equal(
    shortestReferencePath(graph, index.anchors.gm, index.roots[0]),
    null,
  );
  const route = routeGraph();
  assert.equal(route.nodes.length, NODES.length);
  assert.ok(route.nodes.every((n) => ids.has(n.topic.leanId)));
});
test("all baseline and community evidence refers to known snapshot nodes", async () => {
  const publicRecords = importReviews(await json("community-reviews"));
  const known = await knownNodeIds(
    publicRecords.map((record) => record.nodeId),
  );
  for (const review of mergeReviews(BASELINE, publicRecords))
    assert.ok(known.has(review.nodeId));
});
