# Contributing a review

Choose a node and inspect its pinned source. Record the version, the claim you checked, the method and the result. Each record belongs to one node.

- **Source.** Cite a file and commit, theorem and page number, or a run log with its inputs.
- **Group.** Use a stable identifier for the evidence, such as a DOI or build ID. Reports based on the same run share a group. For an independent run, describe which inputs and tools it shares with earlier checks.
- **Outcome.** Choose *Support*, *Challenge* or *Undecided*. A challenge should identify a specific failed step or mismatch.

## Publish through a pull request

Export your personal reviews from the ledger. In a fork of the project, run this command.

```sh
node scripts/merge-reviews.mjs path/to/reviews.json
node --test tests/trust.test.mjs
```

Submit the change to `site/data/community-reviews.json`. Include the node, source and method in the PR. The maintainer can check the claim, check how the evidence was grouped and reproduce the result. Local entries become public through an accepted PR.

The merge checks the snapshot, node IDs, chronology and record schema. Reimporting identical IDs is idempotent. Conflicting records fail the entire merge and leave the registry intact.

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
