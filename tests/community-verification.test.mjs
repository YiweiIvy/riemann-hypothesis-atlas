import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReview, exportReviews, REVIEW_CONTEXT } from "../site/trust.mjs";
import {
  publicRegistry,
  requireAppendOnly,
} from "../scripts/public-registry.mjs";
import {
  mergeRegistryRecords,
  mergeIntoRegistry,
} from "../scripts/merge-reviews.mjs";
import {
  checkNewIssueAttribution,
  issueReport,
  readGitHubIssue,
} from "../scripts/accept-verification.mjs";

const source = {
  login: "reviewer",
  issue: "https://github.com/YiweiIvy/riemann-hypothesis-atlas/issues/123",
};
function check(id, nodeId = "lean:Formalism.UG.P.conv_finDosetSupp") {
  return createReview({
    id,
    nodeId,
    group: "test-only",
    source: "Synthetic fixture",
    note: "Local fixture for registration tests.",
    outcome: "support",
    at: "2026-11-01T10:00:00Z",
  });
}
function issue(rows) {
  return {
    number: 123,
    author: { login: source.login },
    url: source.issue,
    body:
      "Review\r\n\r\n```json\r\n" +
      exportReviews(rows).trimEnd().replaceAll("\n", "\r\n") +
      "\r\n```",
  };
}

test("issue import credits the actual issue author, retains full-corpus records and preserves provenance on retries or direct PR imports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atlas-issue-test-"));
  try {
    const registry = join(dir, "registry.json"),
      added = join(dir, "extra.json"),
      raw = check("synthetic-review");
    const envelope = issue([raw]);
    const { reviews, source: fromIssue } = issueReport(envelope);
    const base = exportReviews([]);
    await writeFile(registry, base);
    assert.deepEqual(fromIssue, source);
    assert.deepEqual(
      await mergeRegistryRecords(registry, reviews, { submission: fromIssue }),
      { added: 1, total: 1 },
    );
    const after = publicRegistry(await readFile(registry, "utf8"));
    assert.equal(after.reviews[0].nodeId, raw.nodeId);
    assert.deepEqual(after.submissions.get(raw.id), source);
    requireAppendOnly(publicRegistry(base), after);
    await checkNewIssueAttribution(publicRegistry(base), after, async (url) => {
      assert.equal(url, source.issue);
      return issueReport(envelope);
    });
    await mergeRegistryRecords(registry, reviews, {
      submission: { ...source, login: "copycat" },
    });
    await writeFile(added, exportReviews([check("second", "rh")]));
    await mergeIntoRegistry(registry, [added]);
    const final = publicRegistry(await readFile(registry, "utf8"));
    assert.deepEqual(final.submissions.get(raw.id), source);
    assert.equal(final.submissions.has("second"), false);
    assert.equal(final.reviews.length, 2);
    await assert.rejects(
      mergeRegistryRecords(registry, [check("bad", "lean:Does.Not.Exist")], {
        submission: source,
      }),
      /Unknown node/,
    );
    await assert.rejects(
      mergeRegistryRecords(registry, [{ ...raw, note: "Different" }], {
        submission: source,
      }),
      /Conflicting/,
    );
    const correction = {
      ...raw,
      id: "later",
      at: "2026-11-02T10:00:00Z",
      supersedes: raw.id,
    };
    await assert.rejects(
      mergeRegistryRecords(registry, [raw, correction], { submission: source }),
      /immutable/,
    );
    assert.equal(
      publicRegistry(await readFile(registry, "utf8")).reviews.length,
      2,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("submissions accept one selected correction chain; invalid issues and snapshot mismatches reject the whole report", async () => {
  const first = check("first"),
    later = {
      ...first,
      id: "later",
      at: "2026-11-02T10:00:00Z",
      supersedes: first.id,
    };
  assert.equal(issueReport(issue([first, later])).reviews.length, 2);
  assert.throws(
    () => issueReport(issue([first, check("unrelated")])),
    /own correction history/,
  );
  assert.throws(() => issueReport(issue([])), /contains no reviews/);
  const good = issue([first]);
  assert.throws(
    () => issueReport({ ...good, body: good.body + "\n" + good.body }),
    /one fenced/,
  );
  assert.throws(
    () =>
      issueReport({
        ...good,
        body: good.body.replace(REVIEW_CONTEXT, "different"),
      }),
    /snapshot/,
  );
  assert.throws(
    () =>
      issueReport({ ...good, url: "https://github.com/owner/name/pull/123" }),
    /Invalid GitHub/,
  );
  await assert.rejects(
    readGitHubIssue("https://github.com/other/name/issues/1"),
    /must be an issue in/,
  );
});

test("registry CI rejects pruning, forged attribution, duplicate IDs, and attribution without a matching record", async () => {
  const r = check("sample"),
    envelope = JSON.parse(exportReviews([r]));
  envelope.submissions = { [r.id]: source };
  const current = publicRegistry(envelope),
    empty = publicRegistry(exportReviews([]));
  assert.throws(() => requireAppendOnly(current, empty), /removed/);
  assert.throws(
    () => publicRegistry({ ...envelope, submissions: { nonexistent: source } }),
    /no matching/,
  );
  assert.throws(
    () => publicRegistry({ ...envelope, reviews: [r, r] }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      publicRegistry({
        ...envelope,
        submissions: {
          [r.id]: { login: "user", issue: "javascript:alert(1)" },
        },
      }),
    /Invalid GitHub/,
  );
  const forged = publicRegistry({
    ...envelope,
    submissions: { [r.id]: { ...source, login: "different" } },
  });
  assert.throws(() => requireAppendOnly(current, forged), /attribution/);
  await assert.rejects(
    checkNewIssueAttribution(empty, forged, async () =>
      issueReport(issue([r])),
    ),
    /contributor differs/,
  );
  await assert.rejects(
    checkNewIssueAttribution(empty, current, async () =>
      issueReport(issue([{ ...r, source: "Different" }])),
    ),
    /contributor differs/,
  );
  const withdrawn = {
    ...r,
    id: "withdrawn",
    at: "2026-11-03T10:00:00Z",
    supersedes: r.id,
    outcome: "withdrawn",
  };
  await assert.rejects(
    checkNewIssueAttribution(empty, current, async () =>
      issueReport(issue([r, withdrawn])),
    ),
    /contributor differs/,
  );
});
