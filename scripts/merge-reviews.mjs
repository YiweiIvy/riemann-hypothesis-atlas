import { randomUUID } from "node:crypto";
import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  enforceReviewOwnership,
  exportReviews,
  importReviews,
  mergeReviews,
  REVIEW_CONTEXT,
} from "../site/trust.mjs";
import { BASELINE } from "../site/data/baseline.mjs";
import { publicRegistry, validateSubmission } from "./public-registry.mjs";
import { openLocalCosmos } from "./open-local-cosmos.mjs";

// Serialize concurrent local writes. A rejected input leaves the entire registry untouched.
export async function mergeIntoRegistry(
  registry,
  inputs,
  allowedIds,
  context = REVIEW_CONTEXT,
  protectedReviews = BASELINE,
) {
  if (!inputs.length)
    throw new Error("Provide at least one exported review file");
  const additions = [];
  for (const input of inputs) {
    additions.push(importReviews(await readFile(input, "utf8"), context));
  }
  return mergeRegistryRecords(registry, additions.flat(), {
    allowedIds,
    context,
    protectedReviews,
  });
}

export async function mergeRegistryRecords(
  registry,
  records,
  {
    allowedIds,
    context = REVIEW_CONTEXT,
    protectedReviews = BASELINE,
    submission,
  } = {},
) {
  if (submission) validateSubmission(submission);
  const lockName = registry + ".lock";
  const lock = await open(lockName, "wx");
  const temporary = registry + "." + randomUUID() + ".tmp";
  try {
    const original = await readFile(registry, "utf8");
    const { reviews: baseline, submissions } = publicRegistry(
      original,
      context,
      protectedReviews,
    );
    const requested = new Set(
      [...baseline, ...records].map((review) => review.nodeId),
    );
    const allowed =
      allowedIds === undefined
        ? await knownNodeIds(requested)
        : new Set(allowedIds);
    for (const id of requested) {
      if (!allowed.has(id)) throw new Error("Unknown node: " + id);
    }
    const protectedIds = new Set(protectedReviews.map((review) => review.id));
    const merged = enforceReviewOwnership(
      mergeReviews(records),
      mergeReviews(protectedReviews, baseline),
    ).filter((review) => !protectedIds.has(review.id));
    const beforeIds = new Set(baseline.map((r) => r.id));
    if (submission) {
      for (const r of merged)
        if (!beforeIds.has(r.id)) submissions.set(r.id, submission);
    }
    let json = exportReviews(merged, context);
    if (submissions.size) {
      const envelope = JSON.parse(json);
      envelope.submissions = Object.fromEntries(submissions);
      json = JSON.stringify(envelope, null, 2) + "\n";
    }
    if (original !== json) {
      await writeFile(temporary, json, { flag: "wx" });
      await rename(temporary, registry);
    }
    return { added: merged.length - baseline.length, total: merged.length };
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await lock.close();
    await unlink(lockName);
  }
}

export async function knownNodeIds(requested = []) {
  const { NODES, AUTHOR_ROUTE } = await import("../site/data/atlas.mjs");
  const { nodes } = JSON.parse(
    await readFile(
      new URL("../site/data/lean-index.json", import.meta.url),
      "utf8",
    ),
  );
  const known = new Set([
    ...NODES.map((node) => node.id),
    ...AUTHOR_ROUTE.map((node) => node.id),
    ...nodes.map((node) => "lean:" + node.id),
  ]);
  const names = [...new Set(requested)].filter(
    (id) => !known.has(id) && id.startsWith("lean:"),
  );
  if (names.length) {
    const graph = await openLocalCosmos();
    for (const id of names) {
      if (await graph.find(id.slice(5))) known.add(id);
    }
  }
  return known;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const inputs = process.argv.slice(2);
    if (!inputs.length)
      throw new Error(
        "Usage: node scripts/merge-reviews.mjs <review-file.json> […]",
      );
    const registry = fileURLToPath(
      new URL("../site/data/community-reviews.json", import.meta.url),
    );
    const { added, total } = await mergeIntoRegistry(registry, inputs);
    console.log(`Added ${added} reviews (${total} total).`);
  } catch (error) {
    console.error(
      error.code === "EEXIST"
        ? "Another merge holds the lock. Check that process before retrying."
        : error.message,
    );
    process.exitCode = 1;
  }
}
