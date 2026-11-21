import assert from "node:assert/strict";
import test from "node:test";
import { openLocalCosmos } from "../scripts/open-local-cosmos.mjs";
import { knownNodeIds } from "../scripts/merge-reviews.mjs";

const graph = await openLocalCosmos();

test("top-level source regions account for the full used declaration cone", async () => {
  const top = await graph.list("src");
  assert.equal(top.total, 10);
  assert.equal(
    top.items.reduce((n, row) => n + row.count, 0),
    804912,
  );
  assert.equal(
    top.items.reduce((n, row) => n + row.files, 0),
    146292,
  );
  assert.equal(graph.meta.edgeCount, 7917157);
  assert.equal(
    graph.meta.links.reduce((n, l) => n + l.type, 0),
    graph.meta.typeReferences,
  );
  assert.equal(
    graph.meta.links.reduce((n, l) => n + l.value, 0),
    graph.meta.valueReferences,
  );
});

test("source listing and case-insensitive prefix search locate the original declaration", async () => {
  const root = await graph.find("riemannHypothesis");
  assert.equal(root.file, "src/Main.lean");
  assert.equal(root.line, 4);
  const file = await graph.list(root.file, { offset: 1, limit: 2 });
  assert.equal(file.total, 5);
  assert.equal(file.items.length, 2);
  const page = await graph.search("RIEMANNHYPOTHESIS", { limit: 1 });
  assert.equal(page.items[0].id, root.id);
  assert.equal(await graph.find("Not.A.Real.Declaration.0"), null);
  const empty = await graph.list("src/NoSuchDirectory");
  assert.equal(empty.total, 0);
});

test("an arbitrary source declaration uses the same public review validation as a headline", async () => {
  const name = "Formalism.UG.P.conv_finDosetSupp";
  const key = "lean:" + name,
    fake = "lean:Not.A.Real.Declaration.0";
  const known = await knownNodeIds([key, fake]);
  assert.ok(known.has(key));
  assert.ok(!known.has(fake));
  const subject = await graph.find(name);
  assert.ok(subject.deps > 0);
  const page = await graph.neighbors(subject.id, { limit: 1 });
  assert.equal(page.total, subject.deps);
  const before = page.items[0];
  const back = await graph.neighbors(before.id, {
    direction: "callers",
    limit: 2048,
  });
  if (!back.hasMore)
    assert.ok(
      back.items.some((n) => n.id === subject.id && n.via === before.via),
    );
});

test("witnesses and reachability masks reference observed direct edges in the pinned graph", async () => {
  const item = await graph.find("UpperTheory.FinalTheorems.everyCharacter");
  const path = await graph.pathToTarget(item.id);
  assert.ok(path);
  assert.ok(graph.meta.targetIds.includes(path.root));
  assert.ok(path.targetMask);
  assert.equal(path.items.at(-1).id, item.id);
  assert.equal(path.edges.length, item.rootDistance);
  for (const edge of path.edges) {
    const adjacent = await graph.neighbors(edge.from, { limit: 2048 });
    assert.ok(
      adjacent.items.some((n) => n.id === edge.to && n.via === edge.kind),
    );
  }
  const root = await graph.find("riemannHypothesis");
  const deps = await graph.neighbors(root.id);
  assert.deepEqual(
    deps.items.map((n) => [n.name, n.via]),
    [["rhOfAll", "value"]],
  );
});

test("directory flows have real child endpoints, defined direction and bounded display", async () => {
  const path = "src/Formalism";
  const { links, total, omitted } = await graph.flows(path, { limit: 8 });
  assert.ok(total >= links.length && links.length > 0);
  assert.equal(total - links.length, omitted);
  for (const link of links) {
    assert.ok(link.type + link.value > 0);
    assert.equal(link.source.slice(0, link.source.lastIndexOf("/")), path);
    assert.equal(link.target.slice(0, link.target.lastIndexOf("/")), path);
  }
  const file = await graph.flows("src/Main.lean");
  assert.equal(file.total, 0);

  const full = await graph.flows("src", { limit: 2048 });
  const last = full.links.at(-1);
  const visibleIds = new Set([last.source, last.target]);
  const visible = full.links.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  );
  const selected = await graph.flows("src", { visibleIds, limit: 1 });
  assert.deepEqual(selected.links, visible.slice(0, 1));
  assert.equal(selected.total, visible.length);

  const leaf = await graph.find("Formalism.UG.P.conv_finDosetSupp");
  const inside = await graph.flows(leaf.file, { limit: 3 });
  const edge = inside.links[0];
  const reference = (await graph.neighbors(edge.source)).items.find(
    (node) => node.id === edge.target,
  );
  assert.equal(reference.via, edge.type && edge.value ? "both" : edge.type ? "type" : "value");
});
