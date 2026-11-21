// Maintainer-side only. The issue body stays data; this command changes a local
// registry file and never comments, commits, pushes, or merges a pull request.
import { execFile } from "node:child_process";
import { isDeepStrictEqual, promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importReviews } from "../site/trust.mjs";
import { issueUrl, validateSubmission } from "./public-registry.mjs";
import { mergeRegistryRecords } from "./merge-reviews.mjs";
const run = promisify(execFile);

export function issueReport(issue) {
  if (
    !issue ||
    !Number.isSafeInteger(issue.number) ||
    issue.number < 1 ||
    !issueUrl.test(issue.url) ||
    !issue.url.endsWith("/" + issue.number) ||
    typeof issue.body !== "string"
  )
    throw new Error("Invalid GitHub issue response.");
  const source = validateSubmission({
    login: issue.author?.login ?? null,
    issue: issue.url,
  });
  const body = issue.body.replace(/\r\n?/g, "\n");
  const fences = [
    ...body.matchAll(/^```json[ \t]*\n([\s\S]*?)\n```[ \t]*$/gim),
  ];
  if (fences.length !== 1)
    throw new Error(
      "Expected one fenced json block containing the selected review export.",
    );
  const envelope = JSON.parse(fences[0][1]);
  const reviews = importReviews(envelope);
  if (!reviews.length) throw new Error("The issue contains no reviews.");
  if (reviews.length !== envelope.reviews.length)
    throw new Error("Duplicate review ID in issue report.");
  // One selection can include its local corrections. Unrelated records must have their own issue.
  for (let i = 1; i < reviews.length; i++)
    if (reviews[i].supersedes !== reviews[i - 1].id)
      throw new Error(
        "Submit one review and its own correction history per issue.",
      );
  return { source, reviews };
}

export async function readGitHubIssue(ref) {
  if (typeof ref !== "string" || !(/^\d+$/.test(ref) || issueUrl.test(ref)))
    throw new Error(
      "Supply a GitHub issue number or a full github.com issue URL.",
    );
  const repository =
    process.env.GITHUB_REPOSITORY || "YiweiIvy/riemann-hypothesis-atlas";
  const prefix = "https://github.com/" + repository.toLowerCase() + "/issues/";
  if (issueUrl.test(ref) && !ref.toLowerCase().startsWith(prefix))
    throw new Error("The submission must be an issue in " + repository);
  const number = ref.split("/").at(-1);
  const { stdout } = await run(
    "gh",
    [
      "issue",
      "view",
      number,
      "--repo",
      repository,
      "--json",
      "author,body,number,url",
    ],
    { maxBuffer: 1024 * 1024 },
  );
  const report = issueReport(JSON.parse(stdout));
  if (!report.source.issue.toLowerCase().startsWith(prefix))
    throw new Error("Issue returned from an unexpected repository.");
  return report;
}

// Verify only new records during PR review. Historical issues may later be edited or closed.
export async function checkNewIssueAttribution(
  before,
  after,
  readIssue = readGitHubIssue,
) {
  const oldIds = new Set(before.reviews.map((r) => r.id));
  const records = new Map(after.reviews.map((r) => [r.id, r]));
  const issues = new Set();
  for (const [id, source] of after.submissions) {
    if (!oldIds.has(id)) issues.add(source.issue);
  }
  for (const url of issues) {
    const report = await readIssue(url);
    const issueIds = new Set(report.reviews.map((r) => r.id));
    // A PR must carry the whole selected report. Cherry-picking a supporting
    // predecessor could otherwise hide the contributor's challenge or withdrawal.
    for (const member of report.reviews) {
      if (
        !isDeepStrictEqual(records.get(member.id), member) ||
        (!oldIds.has(member.id) &&
          !isDeepStrictEqual(after.submissions.get(member.id), report.source))
      ) {
        throw new Error(
          "Record or contributor differs from " + url + ": " + member.id,
        );
      }
    }
    for (const [id, source] of after.submissions) {
      if (!oldIds.has(id) && source.issue === url && !issueIds.has(id))
        throw new Error("Record missing from the cited issue: " + id);
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: node scripts/accept-verification.mjs <issue URL or number>",
      );
    const report = await readGitHubIssue(process.argv[2]);
    const registry = fileURLToPath(
      new URL("../site/data/community-reviews.json", import.meta.url),
    );
    const { added, total } = await mergeRegistryRecords(
      registry,
      report.reviews,
      { submission: report.source },
    );
    console.log(
      `Prepared ${added} new records (${total} total) from ${report.source.issue}. Review the registry diff before opening a PR.`,
    );
  } catch (error) {
    console.error(
      "Verification import failed: " + error.message.replace(/[\r\n]/g, " "),
    );
    process.exitCode = 1;
  }
}
