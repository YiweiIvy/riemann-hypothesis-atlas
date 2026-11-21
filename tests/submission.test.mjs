import test from "node:test";
import assert from "node:assert/strict";
import { createReview, exportReviews, importReviews, REVIEW_CONTEXT } from "../site/trust.mjs";
import { reconcilePersonalReviews } from "../site/personal-reviews.mjs";
import { prepareSubmission } from "../site/submission.mjs";
import { renderLedger } from "../site/ledger.mjs";

const node = {
  id: "lean:riemannHypothesis",
  title: "Riemann hypothesis",
  sources: [{ url: "https://example.org/source#L4", label: "Pinned line" }],
};
const base = {
  node,
  repository: "https://github.com/example/atlas",
  atlasUrl: "https://example.github.io/atlas/",
};
const first = createReview({
  id: "first",
  nodeId: node.id,
  at: "2000-01-01T00:00:00Z",
  group: "test",
  outcome: "support",
  note: "Inspected the pinned statement.",
  source: "urn:fixture",
});
const other = createReview({
  ...first,
  id: "unrelated",
  note: "A private note from a different run.",
});
test("accepting a personal check preserves later private amendments and unrelated notes across exports", () => {
  const next = createReview({ ...first, id: "second", at: "2001-01-01T00:00:00Z", supersedes: first.id, outcome: "challenge", note: "Private correction." });
  const last = createReview({ ...next, id: "third", at: "2002-01-01T00:00:00Z", supersedes: next.id, outcome: "withdrawn" });
  const saved = reconcilePersonalReviews([last, first, other, next], [first]);
  assert.deepEqual(saved.archived, [next, last]);
  assert.deepEqual(saved.combined, [first, other]);
  const restored = importReviews(exportReviews(saved.personal));
  assert.deepEqual(reconcilePersonalReviews(restored, [first]), saved);
  assert.deepEqual(reconcilePersonalReviews(restored, [first, next]).archived, [last]);
  assert.deepEqual(reconcilePersonalReviews(restored, [first, next, last]).archived, []);
  const markup = renderLedger({ nodes: [node], reviews: saved.combined, localReviews: saved.personal, archivedReviews: saved.archived, communityReviews: [first], selectedId: node.id });
  assert.match(markup, /Private archive · 2 entries/);
  assert.match(markup, /Private correction\./);
  assert.doesNotMatch(markup, /data-action="(?:amend|submit-review)" data-id="(?:second|third)"/);
  assert.match(markup, /data-action="submit-review" data-id="unrelated"/);
});
test("ID collisions and their local successors are held privately while published history remains authoritative", () => {
  const different = createReview({ ...first, note: "A distinct private record with a colliding ID." });
  const next = createReview({ ...different, id: "amend", supersedes: different.id, at: "2001-01-01T00:00:00Z" });
  const result = reconcilePersonalReviews([different, other, next], [first]);
  assert.deepEqual(result.combined, [first, other]);
  assert.deepEqual(result.archived, [different, next]);
});
test("a short issue draft includes the exact node and selected correction chain, with no other personal records", () => {
  const next = createReview({
    ...first,
    id: "next",
    at: "2001-01-01T00:00:00Z",
    supersedes: first.id,
    note: "A correction with ```json\ncontent.",
  });
  const draft = prepareSubmission({
    ...base,
    id: next.id,
    records: [other, next, first],
  });
  assert.equal(draft.mode, "prefill");
  assert.equal(new URL(draft.issueUrl).searchParams.get("body"), draft.body);
  assert.deepEqual(
    importReviews(JSON.parse(draft.json)).map((r) => r.id),
    ["first", "next"],
  );
  assert.equal(JSON.parse(draft.json).context, REVIEW_CONTEXT);
  assert.ok(draft.body.includes(node.sources[0].url));
  assert.ok(
    draft.body.includes("\n```json\n" + draft.json.trimEnd() + "\n```"),
  );
  assert.ok(!draft.body.includes(other.note));
  assert.equal(draft.count, 2);
});
test("long or heavily amended reports keep their complete data out of the GitHub URL", () => {
  const long = createReview({ ...first, note: "界".repeat(7500) });
  const draft = prepareSubmission({ ...base, id: long.id, records: [long] });
  assert.equal(draft.mode, "paste");
  assert.ok(!new URL(draft.issueUrl).searchParams.has("body"));
  assert.equal(importReviews(draft.json)[0].note, long.note);
  const chain = [long];
  for (let i = 1; i <= 9; i++)
    chain.push(
      createReview({
        ...long,
        id: "v" + i,
        at: 2000 + i + "-01-01T00:00:00Z",
        supersedes: chain.at(-1).id,
      }),
    );
  const file = prepareSubmission({
    ...base,
    id: chain.at(-1).id,
    records: chain,
  });
  assert.equal(file.mode, "file");
  assert.equal(importReviews(file.json).length, 10);
});
test("public contribution controls show before a first check; only private current entries offer submission", () => {
  const empty = renderLedger({ nodes: [node], selectedId: node.id });
  assert.match(empty, /Contribute verification/);
  const pending = renderLedger({
    nodes: [node],
    reviews: [first],
    localReviews: [first],
    selectedId: node.id,
  });
  assert.match(pending, /data-action="submit-review" data-id="first"/);
  const accepted = renderLedger({
    nodes: [node],
    reviews: [first],
    localReviews: [first],
    communityReviews: [first],
    submissions: {
      first: {
        login: "reviewer",
        issue: "https://github.com/example/atlas/issues/7",
      },
    },
    selectedId: node.id,
  });
  assert.match(
    accepted,
    /href="https:\/\/github.com\/example\/atlas\/issues\/7"[^>]*>Submitted by @reviewer/,
  );
  assert.doesNotMatch(accepted, /data-action="submit-review"/);
});
