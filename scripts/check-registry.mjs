import { readFile } from "node:fs/promises";
import { publicRegistry, requireAppendOnly } from "./public-registry.mjs";
import { checkNewIssueAttribution } from "./accept-verification.mjs";
import { knownNodeIds } from "./merge-reviews.mjs";

try {
  const candidate = publicRegistry(
    await readFile(
      new URL("../site/data/community-reviews.json", import.meta.url),
      "utf8",
    ),
  );
  const requested = new Set(candidate.reviews.map((r) => r.nodeId));
  const known = await knownNodeIds(requested);
  for (const id of requested)
    if (!known.has(id)) throw new Error("Unknown node: " + id);
  const [baseFile, flag] = process.argv.slice(2);
  if (baseFile) {
    const base = publicRegistry(await readFile(baseFile, "utf8"));
    requireAppendOnly(base, candidate);
    if (flag === "--verify-issues")
      await checkNewIssueAttribution(base, candidate);
  }
  console.log("Validated " + candidate.reviews.length + " community records.");
} catch (error) {
  console.error(
    "Public registry check failed: " + error.message.replace(/[\r\n]/g, " "),
  );
  process.exitCode = 1;
}
