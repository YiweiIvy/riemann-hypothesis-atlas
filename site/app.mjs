import { openCosmos } from "./cosmos-data.mjs";
import { createAuditRegistry } from "./audit-registry.mjs";
import { BASELINE } from "./data/baseline.mjs";
import {
  createReview,
  exportReviews,
  importReviews,
  mergeReviews,
  evaluateGraph,
  REVIEW_CONTEXT,
} from "./trust.mjs";
import { renderCode, bindCode } from "./code-view.mjs";
import { renderLedger, bindLedger } from "./ledger.mjs";
import { renderSources } from "./sources-view.mjs";
import { prepareSubmission, verificationIssues } from "./submission.mjs";
import { reconcilePersonalReviews } from "./personal-reviews.mjs";
import { showShare } from "./atlas-share.mjs";
import { mountExplorer } from "./explorer.mjs";
import { guideHTML } from "./guide.mjs";
import { esc, external } from "./ui.mjs";

const workspace = document.querySelector("#workspace"),
  dialog = document.querySelector("#dialog"),
  // Keep saved reviews readable across the project rename.
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
  const metadataRepo = document.querySelector(
    'meta[name="atlas-repository"]',
  )?.content;
  const repository = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(
    metadataRepo || "",
  )
    ? metadataRepo
    : "https://github.com/YiweiIvy/riemann-hypothesis-atlas";
  const verificationGuide = repository + "/blob/main/docs/verification.md";
  const discussionLinks =
    '<p class="verification-links">' +
    external(verificationGuide, "How to verify") +
    external(verificationIssues(repository), "Browse submitted reports") +
    "</p>";
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
  let saved = reconcilePersonalReviews([], published),
    storageError = false,
    trust = null,
    view = null,
    page = "",
    routeVersion = 0,
    codeSearch = "";
  function all() {
    return saved.combined;
  }
  function getTrust() {
    return (trust ??= evaluateGraph(registry.nodes, all()));
  }
  async function readSaved() {
    const raw = localStorage.getItem(key);
    return reconcilePersonalReviews(raw ? await verifiedRecords(raw) : [], published);
  }
  try {
    saved = await readSaved();
  } catch {
    storageError = true;
  }
  function setHash(next, id = "", replace = false) {
    const hash =
      "#" +
      next +
      (id ? "/" + id.split("/").map(encodeURIComponent).join("/") : "");
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
  async function save(transform, restoreArchive = []) {
    const write = async () => {
      let old = saved;
      if (!storageError) {
        try {
          old = await readSaved();
        } catch {
          storageError = true;
        }
      }
      const records = transform(old.personal);
      await registry.allowReviews(records);
      const next = reconcilePersonalReviews(records, published);
      const allowedArchive = new Set([...old.archived, ...restoreArchive].map((record) => record.id));
      if (next.archived.some((record) => !allowedArchive.has(record.id))) {
        throw new Error("Published reviews are immutable. Add a separate review with a citation.");
      }
      if (!storageError) {
        try {
          localStorage.setItem(key, exportReviews(next.personal));
        } catch {
          storageError = true;
        }
      }
      saved = next;
      trust = null;
    };
    if (navigator.locks?.request) await navigator.locks.request(key, write);
    else await write();
  }
  const onReview = async (id, community = false) => {
    await registry.ensureReview(id);
    trust = null;
    showReview(id, null, community);
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
      onShare: (destination, detail) =>
        showShare(destination, detail, promptBox),
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
        localReviews: saved.personal,
        archivedReviews: saved.archived,
        communityReviews: publicRecords,
        submissions: publicEnvelope.submissions ?? {},
        issuesUrl: verificationIssues(repository),
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
  function showSubmission(id) {
    const record = saved.personal.find((review) => review.id === id);
    if (!record || publicIds.has(id) || saved.archived.some((review) => review.id === id))
      throw new Error("Choose a personal check in the ledger.");
    const draft = prepareSubmission({
      records: saved.personal,
      id,
      node: registry.byId.get(record.nodeId),
      repository,
      atlasUrl: document.querySelector('link[rel="canonical"]').href,
    });
    const instructions =
      draft.mode === "file"
        ? "This history is long. Download the selected JSON and include it in a pull request using the contribution guide."
        : draft.mode === "paste"
          ? "Copy the full report, open GitHub, and paste it into the issue body. Submitting the issue publishes it under your GitHub username."
          : "Open the draft on GitHub to review it. Clicking Submit new issue there makes the report public under your GitHub username.";
    const history =
      draft.count === 1
        ? "1 check"
        : draft.count + " records, including earlier versions of this check";
    promptBox(
      "Preview public verification",
      `<p class="verification-node">${esc(record.nodeId)}</p>
      <div class="verification-preview"><strong>${esc({ support: "Supports", challenge: "Challenges", inconclusive: "Undecided", withdrawn: "Withdrawn" }[record.outcome])} · ${esc(record.group)}</strong>
      <p>${esc(record.note)}</p><small>Evidence</small><p>${esc(record.source)}</p></div>
      <details id="submission-details"><summary>Full report · ${esc(history)}</summary>
      <textarea id="submission-body" aria-label="Full GitHub issue body" readonly>${esc(draft.body)}</textarea></details>
      <p class="fine">${esc(instructions)} A maintainer reviews the evidence before it enters the public atlas.</p>
      <div class="actions verification-actions">
      ${draft.mode === "file" ? "" : '<button type="button" id="submission-open" class="button">Open GitHub draft ↗</button>'}
      <button id="submission-copy" type="button" class="button secondary">Copy report</button>
      <button id="submission-json" type="button" class="button secondary">Download selected JSON</button></div>
      <p id="submission-status" role="status"></p>${draft.mode === "file" ? external(repository + "/blob/main/CONTRIBUTING.md", "Pull request instructions") : ""}${discussionLinks}`,
    );
    if (draft.mode !== "file") {
      document.getElementById("submission-open").onclick = () => {
        // Only this deliberate click puts the contributor's report in a GitHub URL.
        const link = document.createElement("a");
        link.href = draft.issueUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.append(link);
        link.click();
        link.remove();
      };
    }
    document.getElementById("submission-json").onclick = () =>
      download("verification.json", draft.json);
    document.getElementById("submission-copy").onclick = async () => {
      const status = document.getElementById("submission-status");
      try {
        await navigator.clipboard.writeText(draft.body);
        status.textContent = "Report copied.";
      } catch {
        document.getElementById("submission-details").open = true;
        const field = document.getElementById("submission-body");
        field.focus();
        field.select();
        status.textContent =
          "Full report selected. Use your device’s copy command.";
      }
    };
  }
  function showReview(id, previous = null, community = false) {
    const n = registry.byId.get(id);
    if (!n) return;
    const primary = community ? "Save &amp; preview submission" : "Save review";
    const other = community ? "Save locally" : "Save &amp; preview submission";
    const cited = n.sources?.[0];
    promptBox(
      previous
        ? "Amend review"
        : community
          ? "Contribute a verification"
          : "Record a check",
      `<p class="verification-node">${esc(n.id)}</p>${cited ? external(cited.url, "Inspect pinned source") : ""}
      <form id="review-form">
      <label class="field"><span>Finding</span><select name="outcome"><option value="inconclusive">Undecided</option><option value="support">Supports</option><option value="challenge">Challenges</option></select></label>
      <label class="field"><span>Evidence group</span><input required name="group" maxlength="250" placeholder="Run ID, DOI, or shared artifact"><small>Checks based on the same run share a group.</small></label>
      <label class="field"><span>Evidence source</span><input required name="source" maxlength="2000" placeholder="Log URL, commit, or paper and page"></label>
      <label class="field"><span>Method and result</span><textarea required name="note" maxlength="8000" placeholder="What did you check? Include inputs, commands or reasoning, and the result."></textarea></label>
      <p class="fine">Saved checks stay in this browser. A public submission starts with a preview.</p>
      <p class="err" role="alert" id="form-error"></p><div class="actions verification-actions">
      <button type="submit" class="button" value="${community ? "community" : "local"}">${primary}</button>
      <button type="submit" class="button secondary" value="${community ? "local" : "community"}">${other}</button></div>
      </form>${discussionLinks}`,
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
      const submitPublic =
        (e.submitter?.value ?? (community ? "community" : "local")) ===
        "community";
      const buttons = [...f.querySelectorAll('[type="submit"]')];
      buttons.forEach((button) => {
        button.disabled = true;
      });
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
        if (submitPublic) showSubmission(r.id);
        else
          notify(
            storageError ? "Saved to session. Export a copy." : "Review saved.",
          );
      } catch (error) {
        if (f.isConnected) {
          document.getElementById("form-error").textContent = error.message;
          buttons.forEach((button) => {
            button.disabled = false;
          });
        } else notify(error.message);
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
      case "community-check":
        return onReview(id, true);
      case "submit-review":
        return showSubmission(id);
      case "amend": {
        const r = saved.personal.find((r) => r.id === id);
        if (
          r &&
          !publicIds.has(id) &&
          !saved.archived.some((x) => x.id === id) &&
          !saved.personal.some((x) => x.supersedes === id)
        )
          showReview(r.nodeId, r);
        break;
      }
      case "close":
        dialog.close();
        break;
      case "guide":
        promptBox(
          "Explorer controls",
          guideHTML(document.querySelector(".tour-link").href),
        );
        break;
      case "contribute": {
        const current = route();
        const target =
          page === "map"
            ? view?.currentReviewTarget()
            : page === "code"
              ? "lean:" + (current.id || index.roots[0])
              : page === "ledger"
                ? current.id || "lean:riemannHypothesis"
                : null;
        if (target) return onReview(target, true);
        promptBox(
          "Contribute a verification",
          "<p>Select the declaration you checked, then choose Contribute verification in its inspector.</p>" +
            '<div class="actions dialog-actions"><button class="button" data-action="browse-check-target">Find a declaration</button></div>' +
            discussionLinks,
        );
        break;
      }
      case "browse-check-target":
        dialog.close();
        return navigate("code");
      case "archive-report":
        return download("archive-check.json", JSON.stringify(report, null, 2));
      case "export":
        download(
          "riemann-hypothesis-atlas-reviews.json",
          exportReviews(saved.personal),
        );
        notify("Exported " + saved.personal.length + " personal reviews.");
        break;
      case "import": {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.onchange = async () => {
          if (!input.files.length) return;
          try {
            const incoming = await verifiedRecords(await input.files[0].text());
            const { archived } = reconcilePersonalReviews(incoming, published);
            const restore = async () => {
              // A backup containing an archived amendment needs its original
              // record for a complete local history, even if that record is public.
              const fresh = archived.length ? incoming : incoming.filter((r) => !publicIds.has(r.id));
              let delta = 0;
              await save((old) => {
                const next = mergeReviews(old, fresh);
                delta = next.length - old.length;
                return next;
              }, archived);
              await update();
              notify(delta + " new entries imported.");
            };
            if (!archived.length) return await restore();
            promptBox("Restore private archive?",
              '<p>This file includes ' + archived.length + ' saved ' + (archived.length === 1 ? 'entry that overlaps' : 'entries that overlap') +
              ' with published history. Restore these as read-only notes in Evidence. The graph will keep using the public records.</p>' +
              '<div class="actions"><button class="button secondary" data-action="close">Cancel</button><button class="button" id="restore-review-backup">Restore backup</button></div>');
            document.getElementById("restore-review-backup").onclick = async () => {
              dialog.close();
              try { await restore(); } catch (error) { notify("Import failed. " + error.message); }
            };
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
            saved.personal.length +
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
        saved = await readSaved();
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
