import { exportReviews } from "./trust.mjs";
import { SOURCE_COMMIT } from "./data/atlas.mjs";

// A correction must travel with its predecessors to remain independently
// importable. A report never sweeps in unrelated records from the same node.
export function submissionChain(records, id) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const chain = [],
    seen = new Set();
  for (let current = id; current; ) {
    const record = byId.get(current);
    if (!record || seen.has(current))
      throw new Error("The selected review history is incomplete.");
    seen.add(current);
    chain.push(record);
    current = record.supersedes;
  }
  return chain.reverse();
}

export function prepareSubmission({ records, id, node, repository, atlasUrl }) {
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error("The atlas is missing its public GitHub repository.");
  }
  const chain = submissionChain(records, id);
  const review = chain.at(-1);
  if (node.id !== review.nodeId)
    throw new Error("The report and selected node do not match.");
  const json = exportReviews(chain);
  const location = new URL(atlasUrl);
  location.hash = "ledger/" + encodeURIComponent(node.id);
  const source = node.sources?.[0]?.url;
  const findings = {
    support: "Supports",
    challenge: "Challenges",
    inconclusive: "Undecided",
    withdrawn: "Withdrawn",
  };
  // Keep contributors' text literal in the public Markdown preview. The full
  // note is preserved in the snapshot-bound record, including for long reports.
  const excerpt = Array.from(review.note);
  const summary =
    excerpt.length > 350 ? excerpt.slice(0, 349).join("") + "…" : review.note;
  const lines = [
    "Verification of a step in Levent Alpöge’s proposed proof, developed with Claude. [Original announcement](https://alpo.ge/remark.pdf#page=1)",
    "",
    "**Finding · " + findings[review.outcome] + "**",
    "",
    ...summary.split(/\r\n?|\n/).map((line) => "    " + line),
    "",
    "Atlas node: " + location.href,
    "Snapshot: https://github.com/leanprover-community/riemann-hypothesis/tree/" +
      SOURCE_COMMIT,
  ];
  if (source && /^https?:\/\//.test(source))
    lines.push("Node source: " + source);
  lines.push("", "```json", json.trimEnd(), "```");
  const body = lines.join("\n");
  const title = ("Verification · " + node.id).slice(0, 170);
  const issueUrl = new URL(repository + "/issues/new");
  issueUrl.searchParams.set("title", title);
  const shortUrl = issueUrl.href;
  issueUrl.searchParams.set("body", body);

  // Prefer a pasteable draft for long URLs, and a scoped file when an entire
  // correction chain would exceed a comfortable GitHub issue-body size.
  const mode =
    body.length > 60000
      ? "file"
      : issueUrl.href.length > 4000
        ? "paste"
        : "prefill";
  return {
    body,
    json,
    mode,
    issueUrl: mode === "prefill" ? issueUrl.href : shortUrl,
    count: chain.length,
    review,
    repository,
  };
}

export function verificationIssues(repository) {
  const url = new URL(repository + "/issues");
  url.searchParams.set("q", "is:issue in:title Verification");
  return url.href;
}
