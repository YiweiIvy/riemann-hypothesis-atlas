import { openCosmos } from "./cosmos-data.mjs";
import { createAuditRegistry } from "./audit-registry.mjs";
import { BASELINE } from "./data/baseline.mjs";
import {
  createReview,
  exportReviews,
  importReviews,
  mergeReviews,
  evaluateGraph,
  enforceReviewOwnership,
  REVIEW_CONTEXT,
} from "./trust.mjs";
import { renderCode, bindCode } from "./code-view.mjs";
import { renderLedger, bindLedger } from "./ledger.mjs";
import { renderSources } from "./sources-view.mjs";
import { mountExplorer } from "./explorer.mjs";
import { guideHTML } from "./guide.mjs";
import { esc, external } from "./ui.mjs";

const workspace = document.querySelector("#workspace"),
  dialog = document.querySelector("#dialog"),
  key = "critical-atlas.v1." + REVIEW_CONTEXT;
const pages = new Set(["map", "code", "ledger", "sources"]);
async function load(name) {
  const inline = document.getElementById("data-" + name);
  if (inline) return JSON.parse(inline.textContent);
  const response = await fetch("./data/" + name + ".json");
  if (!response.ok) throw new Error("Could not load " + name);
  return response.json();
}
function download(filename, body) {
  const url = URL.createObjectURL(
    new Blob([body], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
let toastTimer;
function notify(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 4300);
}
function promptBox(title, body) {
  document.getElementById("dialog-body").innerHTML =
    '<header class="dialog-top"><h2 id="dialog-title">' +
    esc(title) +
    '</h2><button data-action="close" aria-label="Close">×</button></header>' +
    body;
  dialog.setAttribute("aria-labelledby", "dialog-title");
  if (!dialog.open) dialog.showModal();
}
function route() {
  const hash = location.hash.slice(1),
    slash = hash.indexOf("/"),
    page = slash < 0 ? hash : hash.slice(0, slash);
  let id = "";
  try {
    id = decodeURIComponent(slash < 0 ? "" : hash.slice(slash + 1));
  } catch {}
  return { page: pages.has(page) ? page : "map", id };
}
async function main() {
  const [index, corpus, publicEnvelope, report] = await Promise.all([
    load("lean-index"),
    openCosmos(),
    load("community-reviews"),
    load("archive-check"),
  ]);
  const registry = createAuditRegistry(index, corpus),
    baseline = mergeReviews(BASELINE);
  async function verifiedRecords(value) {
    const records = importReviews(value);
    await registry.allowReviews(records);
    return records;
  }
  const publicRecords = await verifiedRecords(publicEnvelope),
    published = mergeReviews(baseline, publicRecords),
    publicIds = new Set(published.map((r) => r.id));
  let personal = [],
    storageError = false,
    trust = null,
    view = null,
    page = "",
    routeVersion = 0,
    codeSearch = "";
  function all() {
    return mergeReviews(published, personal);
  }
  function getTrust() {
    return (trust ??= evaluateGraph(registry.nodes, all()));
  }
  async function readSaved() {
    const raw = localStorage.getItem(key);
    const records = raw ? await verifiedRecords(raw) : [];
    enforceReviewOwnership(records, published);
    return records;
  }
  try {
    personal = await readSaved();
  } catch {
    storageError = true;
  }
  function setHash(next, id = "", replace = false) {
    const hash = "#" + next + (id ? "/" + encodeURIComponent(id) : "");
    if (location.hash !== hash)
      history[replace ? "replaceState" : "pushState"](null, "", hash);
  }
  function navigate(next, id = "") {
    setHash(next, id);
    return update();
  }
  function registerGraph(nodes, edges) {
    if (registry.registerGraph(nodes, edges)) trust = null;
  }
  async function save(transform) {
    const write = async () => {
      let old = personal;
      if (!storageError) {
        try {
          old = await readSaved();
        } catch {
          storageError = true;
        }
      }
      const next = transform(old);
      await registry.allowReviews(next);
      enforceReviewOwnership(next, published);
      if (!storageError) {
        try {
          localStorage.setItem(key, exportReviews(next));
        } catch {
          storageError = true;
        }
      }
      personal = next;
      trust = null;
    };
    if (navigator.locks?.request) await navigator.locks.request(key, write);
    else await write();
  }
  const onReview = async (id) => {
    await registry.ensureReview(id);
    trust = null;
    showReview(id);
  };
  const onLedger = async (id) => {
    await registry.ensureReview(id);
    trust = null;
    return navigate("ledger", id);
  };
  function mount() {
    return mountExplorer(workspace, {
      index,
      corpus,
      getTrust,
      getAuditSnapshot: () => ({ nodes: registry.nodes, reviews: all() }),
      onRecords: registerGraph,
      onReview,
      onLedger,
      notify,
      onRoute: (id) => setHash("map", id, true),
      onOutline: (n) =>
        promptBox(
          n.title,
          "<p>" +
            esc(n.plain) +
            '</p><p class="fine">' +
            esc(n.detail) +
            "</p>" +
            n.sources.map((s) => external(s.url, s.label)).join(" "),
        ),
    });
  }
  async function update() {
    const version = ++routeVersion,
      { page: next, id } = route(),
      changed = page !== next;
    if (changed) {
      view?.destroy();
      view = null;
      page = next;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    document.querySelectorAll("[data-page]").forEach((a) => {
      const active = a.dataset.page === next;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (page === "map") {
      if (!view) view = mount();
      if (id) await view.locate(id, { focus: false });
      else if (!changed)
        await view.locate("riemannHypothesis", { focus: false });
    } else if (page === "ledger") {
      const selected = id || "lean:riemannHypothesis";
      try {
        await registry.ensureReview(selected);
      } catch {
        if (!registry.byId.has(selected)) notify("Unknown review target.");
      }
      if (version !== routeVersion) return;
      const ctx = {
        nodes: registry.nodes,
        reviews: all(),
        localReviews: personal,
        communityReviews: publicRecords,
        baseline,
        selectedId: registry.byId.has(selected)
          ? selected
          : "lean:riemannHypothesis",
      };
      workspace.innerHTML = renderLedger(ctx);
      bindLedger(workspace, ctx);
    } else if (page === "code") {
      workspace.innerHTML = renderCode({
        index,
        selectedId: id || index.roots[0],
        search: codeSearch,
      });
      bindCode(workspace, {
        index,
        corpus,
        onSearch: (q) => {
          codeSearch = q;
        },
      });
    } else workspace.innerHTML = renderSources(report);
    if (version !== routeVersion) return;
    workspace.setAttribute("aria-busy", "false");
    if (storageError && !workspace.querySelector(".storage-notice")) {
      const p = document.createElement("p");
      p.className = "storage-notice";
      p.textContent =
        "Browser storage is unavailable. Export session reviews to keep them.";
      workspace.append(p);
    }
  }
  function showReview(id, previous = null) {
    const n = registry.byId.get(id);
    if (!n) return;
    promptBox(
      previous ? "Amend review" : "Record a check",
      '<p class="fine">' +
        esc(n.title) +
        '</p><form id="review-form"><label class="field"><span>Finding</span><select name="outcome"><option value="inconclusive">Undecided</option><option value="support">Supports</option><option value="challenge">Challenges</option></select></label><label class="field"><span>Evidence group</span><input required name="group" maxlength="250" placeholder="Run ID, DOI, or shared artifact"><small>Use the same group for checks based on the same run.</small></label><label class="field"><span>Source</span><input required name="source" maxlength="2000" placeholder="Log URL, commit, or paper and page"></label><label class="field"><span>What did you check?</span><textarea required name="note" maxlength="8000" placeholder="Method and result"></textarea></label><p class="err" role="alert" id="form-error"></p><div class="actions"><button type="submit" class="button">Save review</button><button type="button" class="button secondary" data-action="close">Cancel</button></div></form>',
    );
    const f = document.getElementById("review-form");
    if (previous) {
      f.elements.group.value = previous.group;
      f.elements.group.readOnly = true;
      f.elements.source.value = previous.source;
      f.elements.outcome.add(new Option("Withdraw", "withdrawn"));
      f.elements.outcome.value = previous.outcome;
    }
    f.onsubmit = async (e) => {
      e.preventDefault();
      const b = f.querySelector("[type=submit]");
      b.disabled = true;
      try {
        const r = createReview({
          ...Object.fromEntries(new FormData(f)),
          nodeId: id,
          ...(previous
            ? { supersedes: previous.id, group: previous.group }
            : {}),
        });
        await save((old) => mergeReviews(old, [r]));
        dialog.close();
        if (page === "map" && view) view.showEvidence();
        else await navigate("ledger", id);
        notify(
          storageError ? "Saved to session. Export a copy." : "Review saved.",
        );
      } catch (error) {
        document.getElementById("form-error").textContent = error.message;
        b.disabled = false;
      }
    };
  }
  async function handle(action, el) {
    const id = el.dataset.id;
    switch (action) {
      case "locate":
        return navigate("map", id);
      case "code-node":
        return navigate("code", id);
      case "ledger-node":
        return onLedger(id);
      case "sources":
        return navigate("sources");
      case "review":
        return onReview(id);
      case "amend": {
        const r = personal.find((r) => r.id === id);
        if (
          r &&
          !publicIds.has(id) &&
          !personal.some((x) => x.supersedes === id)
        )
          showReview(r.nodeId, r);
        break;
      }
      case "close":
        dialog.close();
        break;
      case "guide":
        promptBox("Explorer controls", guideHTML());
        break;
      case "contribute": {
        const repo = document.querySelector(
          'meta[name="atlas-repository"]',
        )?.content;
        const link = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(
          repo || "",
        )
          ? external(repo + "/blob/main/CONTRIBUTING.md", "Contribution guide")
          : "";
        promptBox(
          "Contribute a review",
          '<p>Export your reviews from Evidence. In a project fork, merge the file and open a pull request with your source.</p><pre class="command">node scripts/merge-reviews.mjs reviews.json</pre>' +
            link,
        );
        break;
      }
      case "archive-report":
        return download("archive-check.json", JSON.stringify(report, null, 2));
      case "export":
        download("critical-atlas-reviews.json", exportReviews(personal));
        notify("Exported " + personal.length + " personal reviews.");
        break;
      case "import": {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.onchange = async () => {
          if (!input.files.length) return;
          try {
            const incoming = await verifiedRecords(await input.files[0].text());
            mergeReviews(published, incoming);
            const fresh = incoming.filter((r) => !publicIds.has(r.id));
            let delta = 0;
            await save((old) => {
              const next = mergeReviews(old, fresh);
              delta = next.length - old.length;
              return next;
            });
            await update();
            notify(delta + " new reviews imported.");
          } catch (e) {
            notify("Import failed. " + e.message);
          }
        };
        input.click();
        break;
      }
      case "reset":
        promptBox(
          "Clear personal reviews?",
          "<p>Remove " +
            personal.length +
            ' saved entries from this browser. Export a backup from Evidence first if needed.</p><div class="actions dialog-actions"><button class="button secondary" data-action="close">Cancel</button><button class="button" data-action="reset-confirm">Clear personal reviews</button></div>',
        );
        break;
      case "reset-confirm":
        await save(() => []);
        dialog.close();
        await update();
        notify("Personal reviews cleared.");
        break;
    }
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest(".skip")) {
      e.preventDefault();
      document.getElementById("work").focus();
      return;
    }
    const a = e.target.closest("[data-action]");
    if (a && !a.disabled) {
      handle(a.dataset.action, a).catch((e) => notify(e.message));
    }
    if (e.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (
        e.clientX < b.left ||
        e.clientX > b.right ||
        e.clientY < b.top ||
        e.clientY > b.bottom
      )
        dialog.close();
    }
  });
  workspace.addEventListener("change", (e) => {
    if (e.target.id === "ledger-node")
      navigate("ledger", e.target.value).catch((err) => notify(err.message));
  });
  window.addEventListener("hashchange", () =>
    update().catch((err) => notify(err.message)),
  );
  window.addEventListener("storage", async (event) => {
    if (event.key === key || event.key === null) {
      try {
        personal = await readSaved();
        trust = null;
        storageError = false;
        view?.refresh();
        await update();
      } catch {
        storageError = true;
        await update();
      }
    }
  });
  await update();
}
main().catch((error) => {
  console.error(error);
  workspace.setAttribute("aria-busy", "false");
  workspace.innerHTML =
    '<p class="storage-notice">Could not open the proof graph. ' +
    esc(error.message) +
    "</p>";
});
