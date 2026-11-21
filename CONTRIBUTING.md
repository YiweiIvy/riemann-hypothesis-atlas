# Contributing a review

Choose a node and inspect its pinned source. Record the version, the claim you checked, the method and the result. Each record belongs to one node.

- **Source.** Cite a file and commit, theorem and page number, or a run log with its inputs.
- **Group.** Use a stable identifier for the evidence, such as a DOI or build ID. Reports based on the same run share a group. For an independent run, describe which inputs and tools it shares with earlier checks.
- **Outcome.** Choose *Support*, *Challenge* or *Undecided*. A challenge should identify a specific failed step or mismatch.

## Submit from the atlas

Select a declaration in the explorer and choose **Contribute verification**. Fill in your evidence, then choose **Save & preview submission**. **Open GitHub draft** lets you inspect and post the issue under your own account. The draft contains the selected check and its correction history. You can also submit a previously saved check from **Evidence**. [Open the explorer](https://yiweiivy.github.io/riemann-hypothesis-atlas/) · [Try a worked example](docs/verification.md)

An issue opens a discussion. A maintainer checks the evidence and proposes an update to the public ledger in a pull request. After that update reaches `main` and the Pages checks pass, the finding appears on the site. The ledger credits the GitHub issue’s author and links back to the report. Checks that use the same build or artifact should name the same evidence group. [Submitted reports](https://github.com/YiweiIvy/riemann-hypothesis-atlas/issues?q=is%3Aissue+in%3Atitle+Verification)

If a report is too long for a prefilled link, copy the Markdown draft into a [verification issue](https://github.com/YiweiIvy/riemann-hypothesis-atlas/issues/new?template=verification.md). Keep its single fenced JSON block intact. For a correction chain larger than an issue can hold, use the scoped JSON download and submit a PR as described below.

## Accept a report

Review the source, the specific statement, the independence group and the reproducibility of the finding. Inspect or rerun the check before accepting the result. A node-level check can establish a property of that statement or build; the evidence ledger records precisely that scope.

In a clean checkout of the atlas, open a branch for the report. Replace `123` with its issue number. The importer requires Node.js 20+ and the GitHub CLI.

```sh
git switch -c review/verification-123
node scripts/accept-verification.mjs 123
git diff -- site/data/community-reviews.json
npm test
```

The command reads the issue from GitHub and validates its snapshot and exact node against the source corpus. It prepares a local change to `site/data/community-reviews.json` and records the originating issue and its author from GitHub. Commit the diff, open a pull request, and reference the submission with `Closes #123`. CI checks an issue-backed addition against the public report and prevents changing previous records or their attribution. A maintainer reviews and merges the PR. On a fork, set `GITHUB_REPOSITORY=OWNER/REPO` when importing issues belonging to that fork.

## Submit a review file by pull request

Export the selected record and its history. In a fork, merge that file into the registry, inspect the result and open a PR with the public source and reproduction steps.

```sh
node scripts/merge-reviews.mjs path/to/reviews.json
npm test
```

The merge checks the snapshot, node IDs, chronology and record schema. Reimporting identical IDs is idempotent. Conflicting IDs reject the entire update. Direct PRs retain their submission history in Git.

## Amend or withdraw

Select **Amend review** on a personal entry. The successor keeps the node and evidence group, points to the previous record with `supersedes`, and receives a new ID and later timestamp. Each record can have one successor. Export the full chain to preserve its history.

Only the latest effective outcome in each correction chain counts. Withdrawing a record removes its contribution. Other observations from the same group remain active. The cumulative group count includes all groups ever observed.

Public and baseline records are immutable in the local editor and merge tool. To dispute one, add a separate review that cites it. Maintainers can review explicit corrections to the upstream registry.

## How to read the ledger

Let S, C, M and U be the numbers of supporting, challenging, mixed and undecided evidence groups at the selected node. Let T be their sum. A group with both support and challenge counts as mixed. Repeated findings from a group count once.

| Measure | Calculation |
| --- | --- |
| Support among single-direction groups | S / (S + C) |
| Bounds on support across recorded groups | [S / T, (S + M + U) / T] |

Empty denominators have no value. The bounds describe a collection of checks. They cannot supply a probability that RH is true.

The timeline includes reviews of the selected node and its prerequisites. Its state band shows when a challenged prerequisite blocks a dependent with direct support. A missing prerequisite, an explicit structural blocker or a cycle also blocks the chain. Unreviewed prerequisites and omitted references keep a directly supported chain open. A reviewer can inspect the supporting evidence and unresolved prerequisites separately.

For a declaration outside the opening view, the ledger rebuilds a shortest path of recorded source references to a target whenever you reopen the review file. Expanding a neighborhood adds its direct references to the current session. Some paths pass through compiler-generated constants with no source span. The ledger retains their omitted-reference count. [Graph coverage](docs/corpus.md)

## Snapshots

Each export binds its evidence to `REVIEW_CONTEXT`, the announcement digest and a pinned Lean commit. If the source or the meaning of an existing node changes, start a new context and public registry. Recheck earlier evidence before moving it to that snapshot. For the same source, the indexed selection can grow without changing the meaning of a declaration. [Data guide](docs/lean-data.md)
