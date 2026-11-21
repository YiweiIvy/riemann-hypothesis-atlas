// Optional release check. Install Playwright and Chrome, or point PLAYWRIGHT_MODULE
// at an existing Playwright module's entry point. Run npm run build first.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const pageFile =
  process.argv[2] ||
  fileURLToPath(new URL("../dist/critical-atlas.html", import.meta.url));
const uri = pathToFileURL(resolve(pageFile)).href;
const outsideFocus = "Formalism.UG.P.conv_finDosetSupp";
const browser = await chromium.launch({
  channel: process.env.CHROME_CHANNEL || "chrome",
  headless: true,
});
try {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1360, height: 850 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (req) => {
    if (/^https?:/.test(req.url())) requests.push(req.url());
  });
  await page.goto(uri + "#map/" + encodeURIComponent(outsideFocus));
  await page
    .locator("#inspector-body .decl-id")
    .filter({ hasText: outsideFocus })
    .waitFor();
  const pinned = await page.evaluate(async (name) => {
    const { openCosmos } = await import("atlas/cosmos-data.mjs");
    const graph = await openCosmos();
    const target = await graph.find(name);
    const direct = await graph.neighbors(target.id);
    const route = await graph.pathToTarget(target.id);
    const file = await graph.list(target.file, { limit: 128 });
    const branch = await graph.flows("src/Formalism", { limit: 5 });
    return {
      shards: document.querySelectorAll('[id^="cosmos-"]').length,
      nodes: graph.meta.nodeCount,
      edges: graph.meta.edgeCount,
      matchesFile: file.items.some((n) => n.id === target.id),
      dependencies: direct.total,
      routeLength: route.edges.length,
      flowCount: branch.links.length,
    };
  }, outsideFocus);
  assert.deepEqual(
    [pinned.shards, pinned.nodes, pinned.edges],
    [916, 804912, 7917157],
  );
  assert.ok(
    pinned.matchesFile &&
      pinned.dependencies > 0 &&
      pinned.routeLength > 0 &&
      pinned.flowCount > 0,
  );
  await page.getByRole("button", { name: "Trace to target" }).click();
  await page.waitForFunction(() =>
    /path|trace/i.test(
      document.getElementById("plot-title")?.textContent || "",
    ),
  );
  await page.locator("button.lookup").click();
  await page
    .getByRole("textbox", { name: "Search declarations" })
    .fill("UpperTheory.FinalTheorems.everyCharacter");
  const hit = page.locator("#lookup-results button").first();
  await hit.waitFor();
  await hit.click();
  await page.waitForFunction(
    () =>
      document.querySelector("#inspector-body .decl-id")?.textContent ===
      "UpperTheory.FinalTheorems.everyCharacter",
  );
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector("#inspector-body .decl-id")?.textContent ===
      "UpperTheory.FinalTheorems.everyCharacter",
  );
  const leafDirectory =
    "src/Development/AbelianVarietyTheory/Proofs/DivisorProofs";
  await page.goto(uri + "#map/" + encodeURIComponent(leafDirectory));
  const pager = page.getByRole("combobox", { name: "Jump to corpus page" });
  await pager.waitFor();
  await pager.selectOption("2600");
  await page.waitForFunction(
    () => document.querySelector("#corpus-page")?.value === "2600",
  );
  await page.getByRole("button", { name: "Previous corpus page" }).click();
  await page.waitForFunction(
    () => document.querySelector("#corpus-page")?.value === "2535",
  );
  await page.goto(uri + "#map/" + encodeURIComponent("src/Main.lean"));
  await page.waitForFunction(() =>
    document
      .querySelector("#relation-key")
      ?.textContent.includes("No in-file references"),
  );
  assert.equal(
    await page.locator(".decl-id").textContent(),
    "riemannHypothesis",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await context.close();
  console.log(
    "Offline deep link, full corpus lookup, witness path, folder flows, search and reload passed.",
    pinned,
  );
} finally {
  await browser.close();
}
