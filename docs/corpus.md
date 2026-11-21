# Graph data

The galaxy covers all 804,912 used project declarations with source locations in James Shore’s v0.2 union of five Lean targets. They occupy 146,292 files. Every declaration links to a specific line range in the pinned CocoSgt mirror. The upstream CSV tables are CC0. [Release and tables](https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2)

## Reading an edge

A directed edge points from the declaration that makes a reference to its dependency. A reference may occur in its type, proof or definition body, or both. The atlas contains **7,917,157 distinct directed source-declaration pairs**. The upstream table’s 20,372,294 rows also include unused project symbols, shared compiler-generated constants and separate rows for type and value references.

Opening a source folder reveals its immediate children. Their sizes count used declarations, and their directional flows count typed references crossing between these children. A pair appearing in both the type and the body contributes once to each column. All cross-child flows are stored. The reader filters to visible endpoints before drawing the strongest flows, with an explicit count for any further omitted connections. Opening a file reveals its declarations; file-internal edges are decoded from the same direct adjacency data as the reference inspector.

A target trace follows a shortest path of observed direct references from one of the five targets. A declaration’s target mask records which of the five can reach it in this source-backed graph, in the order listed in the manifest. The reachability search follows all published edges. A member of the larger proof cone can have no source-only trace if the kernel route passes through a generated or external constant. Each source declaration carries a count of project dependencies whose destination falls outside this source-backed graph. Lean core and Mathlib references are in separate upstream tables.

## Rebuild

The SQLite tool reads the SHA-256-pinned original release tables. The corpus builder checks the database’s recorded input identities, preserves distinct source spans and creates both reference directions, search shards, folder inventories, cluster flows and theorem traces. Gzip timestamps and sort orders are fixed.

```sh
python3 scripts/lean-db.py --db /tmp/riemann-full.sqlite build --cache /tmp/riemann-atlas-shore-v02
python3 scripts/build-cosmos.py --db /tmp/riemann-full.sqlite
node --test tests/cosmos.test.mjs
```

Hosted clients fetch bounded gzip chunks from `site/data/cosmos/`. The release is static and works on GitHub Pages. The offline edition embeds the same compressed bytes. Both clients decompress on demand in the browser using `DecompressionStream`. The manifest lists the source version, input hashes, targets, graph statistics and the region-to-region reference matrix.

The Node reader can also inspect any declared name without rebuilding or opening the original database.

```js
import {openLocalCosmos} from "./scripts/open-local-cosmos.mjs";
const graph = await openLocalCosmos();
const declaration = await graph.find("UpperTheory.FinalTheorems.everyCharacter");
const dependencies = await graph.neighbors(declaration.id, { direction: "deps", limit: 20 });
const witness = await graph.pathToTarget(declaration.id);
```

To exercise the portable edition in Chrome, build it and run the offline browser check from a checkout with Playwright installed. Set `PLAYWRIGHT_MODULE` to its entry point if it is installed elsewhere.

```sh
npm run build
node scripts/smoke-offline.mjs
```
