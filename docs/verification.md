# Verify a declaration

Pick one claim you can check and leave enough evidence for someone else to repeat it. Levent Alpöge’s announcement credits Claude in developing and formalizing the proposed proof. James Shore published the dependency data used in YiweiIvy’s atlas. [Announcement, page 1](https://alpo.ge/remark.pdf#page=1) · [Dependency data, v0.2](https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2)

## A first check you can do in the browser

1. Open the [`riemannHypothesis` star](https://yiweiivy.github.io/riemann-hypothesis-atlas/#map/riemannHypothesis). Look at its dependencies. The atlas shows a reference to `rhOfAll` in the proof body.
2. Read line 4 in `Main.lean`. The declaration gives `RiemannHypothesis` as its type and `rhOfAll` as its proof. You have checked one edge against the source. The argument inside `rhOfAll` is a separate question you can explore by following the edge. [Pinned source, line 4](https://github.com/leanprover-community/riemann-hypothesis/blob/2f097b744a6460c73f3e4cc550baa83698409876/src/Main.lean#L4)
3. To report that comparison, select **Contribute verification** on the star. Choose **Undecided** for the theorem, paste the source permalink, and describe the edge you checked. For **Evidence group**, use `Main.lean@2f097b7:L4` if that line is the evidence. A second reading of the same line belongs to the same group.

You can also reproduce the graph lookup from a clone of the atlas with Node.js 20 or later.

```sh
node --input-type=module - <<'JS'
import { openLocalCosmos } from './scripts/open-local-cosmos.mjs';
const corpus = await openLocalCosmos();
const rh = await corpus.find('riemannHypothesis');
const deps = await corpus.neighbors(rh.id, { direction: 'deps', limit: 10 });
for (const entry of deps.items) console.log(entry.name, entry.via);
JS
```

This snapshot prints `rhOfAll value`. Here `value` means the dependency occurs in the body of the declaration.

## Check the mathematics or replay Lean

| Question | What a contributor can do |
| --- | --- |
| Does the formal statement express RH? | Read the Mathlib-only challenge and follow the definition of `RiemannHypothesis`. Compare the treatment of trivial zeros and the pole at 1 with the mathematical statement. Cite the exact clause you checked. [Challenge file](https://github.com/leanprover-community/riemann-hypothesis/blob/2f097b744a6460c73f3e4cc550baa83698409876/src/Challenge.lean) · [Clay’s statement](https://www.claymath.org/millennium/riemann-hypothesis/) |
| Which axioms does this theorem use? | In a prepared checkout where `Main` has been built, run Andrew Sutherland’s `Audit.lean` with `lake env lean /path/to/Audit.lean`. Record the toolchain, source commit, build provenance, and the output for the selected theorem. If you read Sutherland’s published log, cite his run as the evidence group. [Audit source](https://math.mit.edu/~drew/grh/Audit.lean) · [Published log](https://math.mit.edu/~drew/grh/audit.log) |
| Can another checker reproduce the result? | Follow the pinned community instructions to build the challenge and solution separately, export both, and run the comparison. Record which checker you ran, its version, input hashes, exit status and log. If the job stopped early, identify the last completed step. [Clean build and comparison](https://github.com/leanprover-community/riemann-hypothesis/blob/2f097b744a6460c73f3e4cc550baa83698409876/README.md#checking-it) · [Sutherland’s verification files](https://math.mit.edu/~drew/grh/) |

## Put your result on the map

Choose **Supports**, **Challenges** or **Undecided** for the selected claim. Include what you checked, what you expected and what you found. Choose **Save & preview submission**, then **Open GitHub draft**. Review the issue under your own GitHub account and post it when ready.

A maintainer examines the report and submits accepted evidence in a public pull request. After merge, the node’s **Evidence** view credits the issue author, links to the report and updates its timeline. Multiple checks drawn from the same artifact count as one evidence group. [Browse submitted reports](https://github.com/YiweiIvy/riemann-hypothesis-atlas/issues?q=is%3Aissue+in%3Atitle+Verification) · [Review rules and corrections](../CONTRIBUTING.md)
