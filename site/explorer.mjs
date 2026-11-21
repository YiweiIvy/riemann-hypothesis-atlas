import { mountGalaxy } from "./galaxy.mjs";
import {
  baseGraph,
  routeGraph,
  extendGraph,
  sliceCounts,
  topicFor,
  shortestReferencePath,
  targetNames,
  declarationNode,
} from "./network-model.mjs";
import { NODES, READING_ORDER, AUTHOR_ROUTE } from "./data/atlas.mjs";
import { esc, icon, count, shortName, states, external } from "./ui.mjs";
import { mountEvidencePlayback } from "./evidence-playback.mjs";
import { shareDestination } from "./atlas-share.mjs";
import { criticalLine } from "./critical-line.mjs";

const palettes = [
  "#b991ff",
  "#6fe0da",
  "#ffb36f",
  "#799ef8",
  "#ef96d4",
  "#74e4ad",
  "#dbd58a",
  "#adabff",
  "#ff9e95",
  "#8ccff3",
];
const lenses = { network: "Network", corpus: "Corpus", route: "Proof route" };
const lensIcons = { network: "network", corpus: "corpus", route: "route" };
function tool(action, label, shape, extra = "") {
  return (
    '<button type="button" class="tool" data-x="' +
    action +
    '" aria-label="' +
    label +
    '" title="' +
    label +
    '" ' +
    extra +
    ">" +
    icon(shape) +
    "</button>"
  );
}
function button(action, label, shape, cls = "") {
  return (
    '<button type="button" class="action-btn ' +
    cls +
    '" data-x="' +
    action +
    '">' +
    (shape ? icon(shape) : "") +
    esc(label) +
    "</button>"
  );
}
function groupView(row, meta) {
  const region = meta.regions.findIndex((r) => r.id === row.region),
    color = palettes[Math.max(0, region) % palettes.length];
  return {
    id: row.id,
    label: shortName(row.name.replace(/\.lean$/, "")),
    short: shortName(row.name.replace(/\.lean$/, "")),
    group: row.region?.slice(4) ?? "Source",
    color,
    weight: row.count,
    highlight: true,
    kind: row.kind,
    raw: row,
  };
}
const namespaced = (id) => (id.startsWith("lean:") ? id.slice(5) : id);
function controls(lens) {
  return Object.keys(lenses)
    .map(
      (key) =>
        '<button data-x="lens" data-id="' +
        key +
        '" aria-pressed="' +
        (key === lens) +
        '">' +
        icon(lensIcons[key]) +
        lenses[key] +
        "</button>",
    )
    .join("");
}
function shell(meta) {
  const totals = [
    [meta.nodeCount, "declarations"],
    [meta.edgeCount, "references"],
    [meta.targets.length, "targets"],
  ]
    .map(
      ([n, label]) =>
        `<div><strong>${count(n)}</strong><small>${label}</small></div>`,
    )
    .join("");
  return `<div class="explorer">
    <div class="page-heading">
      <div><div class="observation"><span class="spectral-bar"></span>Alpöge archive <span class="sep">/</span> Lean 4.33.1</div><h1>Riemann hypothesis</h1></div>
      <div class="corpus-stats" aria-label="Complete source corpus">${totals}</div>
    </div>
    <section class="console">
      <div class="console-main">
        <div class="stage-nav">
          <div class="lens-tabs" aria-label="Graph view">${controls("network")}</div>
          <div class="stage-actions">
            <button class="evidence-toggle" data-x="evidence" aria-pressed="false" aria-label="Show evidence replay" title="Show evidence replay">${icon("evidence")}<span>Evidence</span></button>
            <button class="lookup" data-x="search" aria-label="Find a declaration">${icon("search")}<span>Find a declaration</span><kbd>/</kbd></button>
          </div>
        </div>
        <div class="plot-frame">
          <div class="plot-info"><h2 id="plot-title">Dependency network</h2><div class="plot-readout"><i></i><span id="plot-count"></span></div></div>
          <div class="plot-tools">${tool("share", "Share a public link", "share")}${tool("fullscreen", "Expand workspace", "open")}${tool("options", "Graph settings", "filter", 'aria-expanded="false"')}</div>
          <div id="galaxy-host"></div><div id="plot-flyout"></div><div id="plot-context"></div>
          <div class="zoom-dock">${tool("minus", "Zoom out", "minus")}<output id="zoom-value">100%</output>${tool("plus", "Zoom in", "plus")}<b></b>${tool("fit", "Fit graph", "fit")}</div>
          <div class="plot-help"><span class="mouse-mark"></span><span class="desktop-hint">Drag to pan · Scroll to zoom</span><span class="mobile-hint">Drag · Pinch · Double tap</span></div>
        </div>
        <div class="legend-strip" id="legend"></div><div id="evidence-playback" hidden></div>
      </div>
      <aside class="inspector" aria-label="Selected node"><div class="inspector-bar"><span>${icon("inspect")} Inspector</span>${tool("focus", "Center selection", "focus")}</div><div id="inspector-body"></div></aside>
    </section>
    <div class="below-stage"><span id="relation-key"></span><span>Shore v0.2 <i></i> Fixed source snapshot</span></div>
  </div>`;
}

export function mountExplorer(container, options) {
  const {
    index,
    corpus,
    getTrust,
    getAuditSnapshot,
    onRecords,
    onReview,
    onLedger,
    onRoute,
    notify,
  } = options;
  const meta = corpus.meta,
    starter = baseGraph(index),
    lookup = new Map(index.nodes.map((x) => [x.id, x]));
  let lens = "network",
    data = starter,
    selected = "riemannHypothesis",
    selectionVersion = 0,
    operation = 0,
    searchVersion = 0,
    disposed = false,
    subview = "",
    path = "src",
    trace = "all",
    color = "group",
    labels = true,
    motion = !matchMedia("(prefers-reduced-motion:reduce)").matches,
    excluded = new Set(),
    edgeFilter = null;
  let routeIds = [],
    trailOrigin = null,
    pathTimer = null,
    playback = null,
    frameModel = null;
  const corpusPageSize = 65;
  let corpusPage = { offset: 0, total: 0 };
  let g,
    registry = new Map(),
    picked = null,
    neighbors = null,
    expanded = new Map(),
    searchRows = [],
    settings = false,
    searchOpen = false;
  container.innerHTML = shell(meta);
  const el = (id) => container.querySelector("#" + id);
  const isGroup = (node) => node?.kind === "directory" || node?.kind === "file";
  function bindData(value, id, { preserve = false } = {}) {
    stopTrail();
    playback?.destroy();
    playback = null;
    frameModel = null;
    data = value;
    registry = new Map(data.nodes.map((n) => [n.id, n]));
    selected = registry.has(id) ? id : data.nodes[0]?.id;
    excluded.clear();
    edgeFilter = null;
    trace = "all";
    el("plot-flyout").innerHTML = "";
    settings = false;
    searchOpen = false;
    const trust = getTrust();
    const values = {
      nodes: data.nodes.map((n) => ({
        ...n,
        status: trust[n.reviewId]?.status ?? "unreviewed",
      })),
      edges: data.edges,
    };
    if (g) {
      g.setFilter({ groups: null, edgeKinds: null, query: "" });
      g.setTrace("all");
      g.setData(values, { selectedId: selected, preserveView: preserve });
    } else
      g = mountGalaxy(el("galaxy-host"), values, {
        selectedId: selected,
        onSelect: (id) => choose(id, true),
        onActivate: (id) => {
          choose(id, true);
          Promise.resolve(activate()).catch(fail);
        },
        onStats: ({ visibleNodes, visibleEdges }) => {
          el("plot-count").textContent =
            count(visibleNodes) +
            (visibleNodes === 1 ? " node  /  " : " nodes  /  ") +
            count(visibleEdges) +
            (visibleEdges === 1 ? " link" : " links");
        },
        onViewport: ({ zoom }) => {
          el("zoom-value").value = Math.round(zoom * 100) + "%";
        },
      });
    g.setColorMode(color);
    g.setLabels(labels);
    g.setMotion(motion);
    el("plot-title").textContent =
      lens === "route"
        ? "Proof route"
        : lens === "corpus"
          ? path === "src"
            ? "Source corpus"
            : shortName(path.split("/").pop())
          : subview === "path"
            ? "Reference path"
            : subview === "local"
              ? "Declaration neighborhood"
              : "Dependency network";
    container.querySelector(".lens-tabs").innerHTML = controls(lens);
    el("relation-key").innerHTML =
      icon("link") +
      (lens === "corpus"
        ? "File tree & cross-group references"
        : lens === "route"
          ? "A step points to its mathematical inputs"
          : "A declaration points to the declarations it uses");
    setEvidence(color);
    renderContext();
    choose(selected, false);
  }
  function setEvidence(mode) {
    const available = data.nodes.some((n) => n.reviewId);
    color = available && mode === "trust" ? "trust" : "group";
    const active = color === "trust",
      control = container.querySelector("[data-x=evidence]"),
      host = el("evidence-playback");
    control.disabled = !available;
    control.setAttribute("aria-pressed", active);
    control.title = available
      ? active
        ? "Hide evidence replay"
        : "Show evidence replay"
      : "Select a source file to review its declarations";
    control.setAttribute("aria-label", control.title);
    g.setColorMode(color);
    playback?.destroy();
    playback = null;
    frameModel = null;
    host.hidden = !active;
    if (active) {
      playback = mountEvidencePlayback(host, {
        ...getAuditSnapshot(),
        onFrame: ({ model }) => {
          frameModel = model;
          g.setStatuses(
            new Map(
              data.nodes.map((n) => [
                n.id,
                model[n.reviewId]?.status ?? "unreviewed",
              ]),
            ),
          );
          if (picked && registry.get(picked.id) === picked) drawInspector();
        },
      });
    } else if (picked && registry.get(picked.id) === picked) drawInspector();
    renderLegend();
  }
  function stopTrail() {
    if (pathTimer !== null) {
      clearInterval(pathTimer);
      pathTimer = null;
    }
  }
  function selectionRoute() {
    if (lens === "route") return "step:" + selected;
    if (subview === "path")
      return "trail/" + (routeIds.indexOf(selected) + 1) + "/" + trailOrigin;
    return selected;
  }
  function stepTrail(pos) {
    if (!routeIds[pos]) return;
    choose(routeIds[pos], false);
    g.select(selected);
    onRoute(selectionRoute());
  }
  function playTrail() {
    if (pathTimer !== null) {
      stopTrail();
      renderContext();
      return;
    }
    if (selected === routeIds.at(-1)) stepTrail(0);
    pathTimer = setInterval(() => {
      const next = routeIds.indexOf(selected) + 1;
      if (next >= routeIds.length - 1) stopTrail();
      stepTrail(next);
    }, 1400);
    renderContext();
  }
  function renderLegend() {
    const list = [
      ...new Map(data.nodes.map((n) => [n.group, n.color])).entries(),
    ];
    el("legend").innerHTML =
      color === "trust"
        ? '<span class="legend-title">Review state</span>' +
          Object.entries({
            Supported: "#70edc4",
            Open: "#eac77c",
            Unreviewed: "#8393be",
            Blocked: "#ff5d87",
            Challenged: "#ff927b",
            Mixed: "#ffb1ed",
          })
            .map(
              ([t, c]) =>
                '<span class="legend-key"><i style="--dot:' +
                c +
                '"></i>' +
                t +
                "</span>",
            )
            .join("")
        : '<span class="legend-title">' +
          (lens === "corpus"
            ? "Regions"
            : lens === "route"
              ? "Stages"
              : "Families") +
          "</span>" +
          list
            .map(
              ([name, c]) =>
                '<button type="button" class="legend-key" data-x="group" data-id="' +
                esc(name) +
                '" aria-pressed="' +
                !excluded.has(name) +
                '"><i style="--dot:' +
                c +
                '"></i>' +
                esc(name) +
                "</button>",
            )
            .join("");
  }
  function renderContext() {
    if (lens === "corpus") {
      const bits = path.split("/");
      el("plot-context").innerHTML =
        '<div class="crumbs">' +
        bits
          .map(
            (b, i) =>
              '<button data-x="directory" data-id="' +
              esc(bits.slice(0, i + 1).join("/")) +
              '">' +
              esc(b === "src" ? "Source" : b) +
              "</button>",
          )
          .join("<span>›</span>") +
        "</div>";
      if (corpusPage.total > corpusPageSize) {
        const { offset, total } = corpusPage;
        const pages = Array.from(
          { length: Math.ceil(total / corpusPageSize) },
          (_, i) => {
            const start = i * corpusPageSize,
              end = Math.min(total, start + corpusPageSize);
            return (
              '<option value="' +
              start +
              '"' +
              (offset === start ? " selected" : "") +
              ">" +
              count(start + 1) +
              "–" +
              count(end) +
              " / " +
              count(total) +
              "</option>"
            );
          },
        ).join("");
        el("plot-context").insertAdjacentHTML(
          "beforeend",
          '<div class="trail-bar" aria-label="Corpus pages">' +
            tool(
              "corpus-prev",
              "Previous corpus page",
              "back",
              offset === 0 ? "disabled" : "",
            ) +
            '<select class="return-btn" id="corpus-page" aria-label="Jump to corpus page">' +
            pages +
            "</select>" +
            tool(
              "corpus-next",
              "Next corpus page",
              "arrow",
              offset + corpusPageSize >= total ? "disabled" : "",
            ) +
            "</div>",
        );
      }
    } else if (lens === "route") {
      const pos = READING_ORDER.indexOf(selected);
      el("plot-context").innerHTML =
        '<div class="trail-bar">' +
        tool("prev", "Previous step", "back", pos <= 0 ? "disabled" : "") +
        "<span>" +
        Math.max(1, pos + 1) +
        " / " +
        READING_ORDER.length +
        "</span>" +
        tool(
          "next",
          "Next step",
          "arrow",
          pos === READING_ORDER.length - 1 ? "disabled" : "",
        ) +
        "</div>";
    } else if (subview === "path") {
      const pos = routeIds.indexOf(selected);
      el("plot-context").innerHTML =
        '<div class="path-controls"><button class="return-btn" data-x="reset">' +
        icon("back") +
        ' Overview</button><div class="trail-bar" aria-label="Reference path">' +
        tool(
          "hop-prev",
          "Previous declaration",
          "back",
          pos <= 0 ? "disabled" : "",
        ) +
        tool(
          "hop-play",
          pathTimer === null ? "Play reference path" : "Pause reference path",
          pathTimer === null ? "play" : "pause",
        ) +
        "<span>" +
        count(pos + 1) +
        " / " +
        count(routeIds.length) +
        "</span>" +
        tool(
          "hop-next",
          "Next declaration",
          "arrow",
          pos >= routeIds.length - 1 ? "disabled" : "",
        ) +
        "</div></div>";
    } else
      el("plot-context").innerHTML = subview
        ? '<button class="return-btn" data-x="reset">' +
          icon("back") +
          " Overview</button>"
        : "";
  }
  function choose(id, updateHash) {
    if (!registry.has(id)) return;
    selected = id;
    picked = registry.get(id);
    neighbors = null;
    const seq = ++selectionVersion;
    if (updateHash) {
      stopTrail();
      operation++;
      g.select(id);
      onRoute(selectionRoute());
    }
    drawInspector();
    renderContext();
    if (isGroup(picked) || lens === "route") return;
    const original = picked;
    const locate = original.corpusId
      ? Promise.resolve(original.raw)
      : corpus.find(id);
    locate
      .then(async (full) => {
        if (disposed || seq !== selectionVersion || !full) return;
        original.full = full;
        const [deps, callers] = await Promise.all([
          corpus.neighbors(full.id, { direction: "deps", limit: 5 }),
          corpus.neighbors(full.id, { direction: "callers", limit: 5 }),
        ]);
        if (disposed || seq !== selectionVersion) return;
        neighbors = { deps, callers };
        drawInspector();
      })
      .catch(() => {
        if (seq === selectionVersion && !disposed)
          notify("Could not load reference details.");
      });
  }
  function relList(rows, heading, direction) {
    const items = rows?.items ?? [];
    if (!items.length) return "";
    return (
      '<section class="linked"><div class="row-title">' +
      heading +
      "<span>" +
      count(rows.total) +
      "</span></div>" +
      items
        .slice(0, 3)
        .map(
          (n) =>
            '<button data-x="neighbor" data-id="' +
            esc(n.name) +
            '" data-via="' +
            esc(n.via) +
            '" data-direction="' +
            direction +
            '" title="' +
            esc(n.name) +
            '"><i style="--dot:' +
            declarationNode(n).color +
            '"></i><code>' +
            esc(n.name.split(".").pop()) +
            "</code>" +
            icon("arrow") +
            "</button>",
        )
        .join("") +
      "</section>"
    );
  }
  function drawInspector() {
    const n = picked;
    if (!n) {
      el("inspector-body").innerHTML = "";
      return;
    }
    const group = isGroup(n),
      step = lens === "route",
      topic = n.topic ?? topicFor(n.id),
      full = n.full ?? (n.raw?.kind === "declaration" ? n.raw : null),
      qty = sliceCounts(data, n.id);
    const audit = n.reviewId ? (frameModel ?? getTrust())[n.reviewId] : null;
    const singular = {
      dependencies: "dependency",
      dependents: "dependent",
      declarations: "declaration",
      files: "file",
    };
    const degree = (...metrics) =>
      '<div class="node-metrics">' +
      metrics
        .map(
          ([v, t]) =>
            "<div><b>" +
            count(v) +
            "</b><small>" +
            (v === 1 ? singular[t] : t) +
            "</small></div>",
        )
        .join("") +
      "</div>";
    const fileLink = group
      ? n.kind === "file"
        ? meta.sourceUrl + n.id
        : null
      : (n.url ?? topic?.sources?.[0]?.url);
    const formula = [
      "rh",
      "riemannHypothesis",
      "riemannZeta_eq_zero_re",
    ].includes(n.id);
    const title = n.label;
    const types = group ? n.kind : step ? "Proof step" : n.kind;
    let html =
      '<div class="inspector-content" style="--node:' +
      n.color +
      '"><div class="type-line"><i></i>' +
      esc(types) +
      "<span>" +
      esc(n.group) +
      "</span></div><h2>" +
      esc(title) +
      "</h2>";
    if (!group && !step)
      html += '<code class="decl-id">' + esc(n.id) + "</code>";
    if (group)
      html += degree([n.raw.count, "declarations"], [n.raw.files, "files"]);
    else if (step) html += '<p class="step-desc">' + esc(topic.plain) + "</p>";
    else
      html += degree(
        [full?.deps ?? qty.deps, "dependencies"],
        [full?.callers ?? qty.callers, "dependents"],
      );
    if (formula) html += criticalLine();
    if (group) html += button("open", "Open " + n.kind, "folder", "primary");
    else if (step)
      html += button("open", "Explore declaration", "network", "primary");
    else {
      const root = index.roots.includes(n.id);
      const actions =
        subview === "path"
          ? button("local", "Explore neighbors", "network", "primary")
          : root
            ? button("path", "Trace a proof path", "route", "primary") +
              button("local", "Show neighbors", "network")
            : button("expand", "Expand neighbors", "network", "primary") +
              button("path", "Trace to target", "route");
      html += '<div class="inspect-actions">' + actions + "</div>";
      const note = n.note ?? topic?.plain;
      if (!formula && note)
        html += '<p class="step-desc">' + esc(note) + "</p>";
    }
    if (fileLink)
      html += external(
        fileLink,
        group
          ? "Open source file"
          : step
            ? "Read source"
            : (n.file?.split("/").pop() ?? "Source") + " · L" + (n.line ?? ""),
      );
    if (!group) {
      const chip = (label, status) =>
        '<div class="review-mini"><span>' +
        icon("evidence") +
        " " +
        label +
        '</span><button data-x="ledger" class="state-chip ' +
        esc(status) +
        '">' +
        esc(states[status] ?? "Unreviewed") +
        "</button></div>";
      html +=
        '<div class="inspector-rule"></div>' +
        chip("Direct checks", audit?.directStatus ?? "unreviewed");
      if (frameModel)
        html += chip("Dependency chain", audit?.status ?? "unreviewed");
      html +=
        '<button class="record-btn" data-x="review">' +
        icon("plus") +
        " Record check</button>";
    }
    if (full) {
      const symbols = ["RH", "ζ", "½+", "L", "L*"];
      const marks = meta.targets
        .map((name, i) => {
          const reached = (full.targetMask & (1 << i)) !== 0,
            title =
              targetNames[name] +
              (reached
                ? " · Reaches this declaration"
                : " · No source-only path");
          return (
            '<button type="button" data-x="target" data-id="' +
            esc(name) +
            '" aria-label="' +
            esc(title) +
            '" title="' +
            esc(title) +
            '" class="' +
            (reached ? "reached" : "") +
            '">' +
            symbols[i] +
            "</button>"
          );
        })
        .join("");
      html +=
        '<section class="target-reach"><div class="row-title">Reachable from<span>' +
        count(symbols.filter((_, i) => full.targetMask & (1 << i)).length) +
        " / 5 targets</span></div><div>" +
        marks +
        "</div></section>";
    }
    if (neighbors)
      html +=
        relList(neighbors.deps, "Depends on", "deps") +
        relList(neighbors.callers, "Used by", "callers");
    if (step)
      html +=
        '<section class="linked"><div class="row-title">Inputs</div>' +
        n.topic.dependsOn
          .map(
            (id) =>
              '<button data-x="pick" data-id="' +
              esc(id) +
              '">' +
              esc(NODES.find((x) => x.id === id).title) +
              icon("arrow") +
              "</button>",
          )
          .join("") +
        "</section>";
    if (group && n.raw.count)
      html +=
        '<div class="node-path">' +
        icon("folder") +
        "<code>" +
        esc(n.id) +
        "</code></div>";
    el("inspector-body").innerHTML = html + "</div>";
  }
  async function directory(dir, offset = 0) {
    const token = ++operation;
    const [item, listing] = await Promise.all([
      corpus.get(dir),
      corpus.list(dir, { offset, limit: corpusPageSize }),
    ]);
    if (token !== operation || disposed) return;
    if (!item) {
      notify("Unknown source path.");
      return;
    }
    const nodes = listing.items.map((row) =>
      row.kind === "declaration" ? declarationNode(row) : groupView(row, meta),
    );
    const visible = new Map(nodes.map((n) => [n.corpusId ?? n.id, n.id]));
    const flows = await corpus.flows(dir, {
      visibleIds: visible.keys(),
      limit: 2048,
    });
    if (token !== operation || disposed) return;
    const edges = flows.links.map((flow) => ({
      from: visible.get(flow.source),
      to: visible.get(flow.target),
      weight: flow.type + flow.value,
      typeReferences: flow.type,
      valueReferences: flow.value,
      kind: flow.type && flow.value ? "both" : flow.type ? "type" : "value",
    }));
    if (item.kind === "file") onRecords(nodes, edges);
    lens = "corpus";
    path = dir;
    corpusPage = { offset, total: listing.total };
    subview = "";
    expanded.clear();
    bindData({ nodes, edges }, nodes[0]?.id);
    const edgeLabel =
      item.kind === "file" ? "in-file references" : "cross-group flows";
    const summary = edges.length
      ? count(edges.length) +
        " " +
        edgeLabel +
        (flows.omitted
          ? " · " + count(flows.omitted) + " additional connections"
          : "")
      : "No " + edgeLabel + " between the displayed nodes";
    el("relation-key").innerHTML = icon("link") + summary;
    onRoute(offset ? "folder/" + offset + "/" + dir : dir);
  }
  async function expand(id = selected, replace = false) {
    const seq = ++operation;
    const row = await corpus.find(id);
    if (seq !== operation || disposed) return;
    if (!row) {
      notify("No source declaration found.");
      return;
    }
    const prev = replace
      ? { deps: 0, callers: 0 }
      : (expanded.get(id) ?? { deps: 0, callers: 0 });
    const [out, inc] = await Promise.all([
      corpus.neighbors(row.id, {
        direction: "deps",
        offset: prev.deps,
        limit: 45,
      }),
      corpus.neighbors(row.id, {
        direction: "callers",
        offset: prev.callers,
        limit: 35,
      }),
    ]);
    if (disposed || seq !== operation) return;
    const set = [row, ...out.items, ...inc.items],
      edges = [
        ...out.items.map((n) => ({ from: id, to: n.name, kind: n.via })),
        ...inc.items.map((n) => ({ from: n.name, to: id, kind: n.via })),
      ];
    lens = "network";
    if (replace) {
      subview = "local";
      expanded.clear();
    } else if (subview === "path") subview = "local";
    expanded.set(id, {
      deps: prev.deps + out.items.length,
      callers: prev.callers + inc.items.length,
    });
    const base = replace ? { nodes: [], edges: [] } : data,
      more = { nodes: set.map(declarationNode), edges };
    const next = extendGraph(base, more);
    onRecords(more.nodes, edges);
    bindData(next, id, { preserve: !replace });
    onRoute(id);
    if (
      !replace &&
      next.nodes.length === base.nodes.length &&
      next.edges.length === base.edges.length
    )
      notify(
        out.hasMore || inc.hasMore
          ? "Those references are visible. Expand again for the next set."
          : "All direct references are already visible.",
      );
  }
  async function tracePath(id = selected, indexInPath = null) {
    const seq = ++operation;
    let chain;
    if (index.roots.includes(id)) {
      // These are source-anchored mathematical landmarks in the starting graph.
      for (const anchor of [
        index.anchors.gm,
        index.anchors.zero,
        index.anchors.every,
      ]) {
        chain = shortestReferencePath(starter, id, anchor);
        if (chain?.edges.length) break;
      }
    } else {
      const row = await corpus.find(id);
      if (!row || seq !== operation || disposed) return;
      const route = await corpus.pathToTarget(row.id);
      if (seq !== operation || disposed) return;
      if (route?.items.length) {
        const byId = new Map(route.items.map((n) => [n.id, n.name]));
        chain = {
          nodes: route.items.map(declarationNode),
          edges: route.edges.map((e) => ({
            from: byId.get(e.from),
            to: byId.get(e.to),
            kind: e.kind,
          })),
        };
      }
    }
    if (!chain?.edges.length) {
      notify("No path through named source declarations in this release.");
      return;
    }
    const nodes = chain.nodes.map((node, sequenceIndex) => ({
        ...node,
        sequenceIndex,
      })),
      edges = chain.edges;
    trailOrigin = id;
    routeIds = nodes.map((n) => n.id);
    lens = "network";
    subview = "path";
    expanded.clear();
    onRecords(nodes, edges);
    const hop =
      indexInPath === null
        ? id
        : routeIds[Math.max(0, Math.min(routeIds.length - 1, indexInPath))];
    bindData({ nodes, edges }, hop);
    onRoute(selectionRoute());
  }
  async function locate(input, { focus = true } = {}) {
    let id = namespaced(input || "riemannHypothesis");
    const trail = /^trail\/([1-9]\d*)\/(.+)$/.exec(id);
    if (trail) {
      await tracePath(trail[2], Number(trail[1]) - 1);
      return;
    }
    const folder = /^folder\/(\d+)\/(src(?:\/.+)?)$/.exec(id);
    if (folder && Number.isSafeInteger(Number(folder[1]))) {
      await directory(folder[2], Number(folder[1]));
      return;
    }
    if (id.startsWith("src/") || id === "src") {
      await directory(id);
      return;
    }
    if (id.startsWith("step:")) {
      const step = id.slice(5);
      lens = "route";
      subview = "";
      bindData(routeGraph(), step);
      return;
    }
    const teaching = NODES.find((n) => n.id === id),
      outline = AUTHOR_ROUTE.find((n) => n.id === id);
    if (teaching) id = teaching.leanId;
    if (outline) {
      options.onOutline(outline);
      return;
    }
    if (registry.has(id) && lens === "network") {
      choose(id, false);
      g.select(id, { focus });
      return;
    }
    if (lookup.has(id)) {
      lens = "network";
      subview = "";
      bindData(starter, id);
      if (focus) g.select(id, { focus: true });
      return;
    }
    await expand(id, true);
  }
  function switchLens(key) {
    operation++;
    if (key === "corpus") {
      return directory("src");
    }
    lens = key;
    subview = "";
    expanded.clear();
    if (key === "route") {
      bindData(routeGraph(), "rh");
      onRoute("step:rh");
    } else {
      bindData(starter, "riemannHypothesis");
      onRoute("riemannHypothesis");
    }
  }
  function activate() {
    if (!picked) return;
    if (isGroup(picked)) return directory(picked.id);
    if (lens === "route")
      return locate(picked.topic.leanId).then(() => onRoute(selected));
    return expand(picked.id, lens === "corpus");
  }
  function settingsMenu() {
    searchOpen = false;
    settings = !settings;
    container
      .querySelector("[data-x=options]")
      .setAttribute("aria-expanded", settings);
    if (!settings) {
      el("plot-flyout").innerHTML = "";
      return;
    }
    const select = (name, items, value) =>
      '<select id="opt-' +
      name +
      '">' +
      items
        .map(
          ([v, t]) =>
            '<option value="' +
            v +
            '" ' +
            (v === value ? "selected" : "") +
            ">" +
            t +
            "</option>",
        )
        .join("") +
      "</select>";
    el("plot-flyout").innerHTML =
      '<div class="settings-pop"><h3>Graph settings</h3><label>Color ' +
      select(
        "color",
        [
          ["group", "Source family"],
          ["trust", "Evidence state"],
        ],
        color,
      ) +
      "</label><label>Trace " +
      select(
        "trace",
        [
          ["all", "All visible links"],
          ["upstream", "Dependencies"],
          ["downstream", "Dependents"],
          ["neighbors", "Direct neighbors"],
        ],
        trace,
      ) +
      "</label><label>References " +
      select(
        "kind",
        [
          ["all", "All kinds"],
          ["type", "Type references"],
          ["value", "Proof / body"],
        ],
        edgeFilter ?? "all",
      ) +
      '</label><label>Node labels <input type="checkbox" id="opt-labels" ' +
      (labels ? "checked" : "") +
      '></label><label>Flow animation <input type="checkbox" id="opt-motion" ' +
      (motion ? "checked" : "") +
      "></label></div>";
  }
  async function searchFor(q) {
    const seq = ++searchVersion;
    const results = el("lookup-results");
    if (!results) return;
    searchRows = [];
    results.replaceChildren();
    const matches = q
      ? starter.nodes
          .filter((n) =>
            (n.id + " " + n.label).toLowerCase().includes(q.toLowerCase()),
          )
          .slice(0, 6)
      : starter.nodes.filter((n) => index.roots.includes(n.id));
    let hits = matches.map((n) => ({
      name: n.id,
      title: n.label,
      kind: n.kind,
    }));
    if (q) {
      const extra = await corpus.search(q, { limit: 18 });
      if (seq !== searchVersion || !searchOpen || disposed) return;
      const unique = new Map(hits.map((n) => [n.name, n]));
      for (const r of extra.items)
        if (!unique.has(r.name))
          unique.set(r.name, { name: r.name, title: r.name, kind: r.declKind });
      hits = [...unique.values()].slice(0, 20);
    }
    searchRows = hits;
    results.innerHTML = hits.length
      ? hits
          .map(
            (r, i) =>
              '<button data-x="result" data-i="' +
              i +
              '"><span>' +
              esc(r.title) +
              "</span><small>" +
              esc(r.kind) +
              "</small></button>",
          )
          .join("")
      : "<p>No matching declaration. Try a qualified-name prefix.</p>";
  }
  function closePopover() {
    searchOpen = false;
    settings = false;
    searchVersion++;
    el("plot-flyout").innerHTML = "";
    container
      .querySelector("[data-x=options]")
      .setAttribute("aria-expanded", "false");
  }
  function openSearch() {
    closePopover();
    searchOpen = true;
    el("plot-flyout").innerHTML =
      '<div class="search-pop"><label>' +
      icon("search") +
      '<input id="lookup-input" aria-label="Search declarations" placeholder="Name or namespace prefix" autocomplete="off">' +
      tool("close-pop", "Close search", "close") +
      '</label><div class="results" id="lookup-results"></div></div>';
    el("lookup-input").focus();
    searchFor("").catch(fail);
  }
  function fail(error) {
    if (!disposed) notify(error.message ?? "Unable to load graph data.");
  }
  async function action(ev) {
    const target = ev.target.closest("[data-x]");
    if (!target) {
      if ((settings || searchOpen) && !ev.target.closest("#plot-flyout"))
        closePopover();
      return;
    }
    const a = target.dataset.x,
      id = target.dataset.id;
    if (
      !["search", "options", "result", "close-pop"].includes(a) &&
      (settings || searchOpen)
    )
      closePopover();
    if (a === "share") {
      stopTrail();
      renderContext();
      const destination = shareDestination({
        lens,
        subview,
        selected,
        origin: trailOrigin,
        position: routeIds.indexOf(selected),
        directory: path,
        offset: corpusPage.offset,
      });
      const detail =
        lens === "corpus"
          ? path
          : subview === "path"
            ? `Step ${routeIds.indexOf(selected) + 1} of ${routeIds.length} · ${picked.label}`
            : picked?.label;
      options.onShare(destination, detail);
    }
    if (a === "lens") await switchLens(id);
    if (a === "reset") await switchLens("network");
    if (a === "directory") await directory(id);
    if (a === "corpus-prev")
      await directory(path, Math.max(0, corpusPage.offset - corpusPageSize));
    if (
      a === "corpus-next" &&
      corpusPage.offset + corpusPageSize < corpusPage.total
    )
      await directory(path, corpusPage.offset + corpusPageSize);
    if (a === "open") await activate();
    if (a === "expand") await expand(selected, lens !== "network");
    if (a === "path") await tracePath();
    if (a === "local") await expand(selected, true);
    if (a === "target") {
      await locate(id);
      onRoute(id);
    }
    if (a === "evidence") setEvidence(color === "group" ? "trust" : "group");
    if (a === "hop-play") playTrail();
    if (a === "hop-next" || a === "hop-prev") {
      stopTrail();
      stepTrail(routeIds.indexOf(selected) + (a === "hop-next" ? 1 : -1));
    }
    if (a === "focus") g.focus(selected);
    if (a === "fit") g.fit();
    if (a === "plus" || a === "minus") g.zoomBy(a === "plus" ? 1.35 : 1 / 1.35);
    if (a === "options") settingsMenu();
    if (a === "group") {
      excluded.has(id) ? excluded.delete(id) : excluded.add(id);
      g.setFilter({
        groups: [...new Set(data.nodes.map((n) => n.group))].filter(
          (key) => !excluded.has(key),
        ),
      });
      renderLegend();
    }
    if (a === "search") openSearch();
    if (a === "close-pop") closePopover();
    if (a === "result") {
      const hit = searchRows[Number(target.dataset.i)];
      closePopover();
      if (hit) {
        await locate(hit.name);
        onRoute(hit.name);
      }
    }
    if (a === "pick") {
      choose(id, true);
      g.select(id, { focus: true });
    }
    if (a === "neighbor") {
      if (!registry.has(id) && (subview === "path" || lens === "corpus")) {
        await expand(id, true);
        return;
      }
      const from = selected;
      const row = [
        ...(neighbors?.deps?.items ?? []),
        ...(neighbors?.callers?.items ?? []),
      ].find((n) => n.name === id);
      if (row && !registry.has(id)) {
        const edge =
          target.dataset.direction === "deps"
            ? { from, to: id, kind: row.via }
            : { from: id, to: from, kind: row.via };
        const added = declarationNode(row);
        onRecords([added], [edge]);
        bindData(extendGraph(data, { nodes: [added], edges: [edge] }), id, {
          preserve: true,
        });
      }
      choose(id, true);
      g.select(id, { focus: true });
    }
    if (a === "prev" || a === "next") {
      const pos = READING_ORDER.indexOf(selected);
      choose(READING_ORDER[pos + (a === "next" ? 1 : -1)], true);
      g.select(selected);
    }
    if (a === "fullscreen") {
      const scene = container.querySelector(".console");
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (scene.requestFullscreen) await scene.requestFullscreen();
      else scene.classList.toggle("expanded");
    }
    if (a === "review" || a === "ledger") {
      if (!picked?.reviewId) return;
      if (!isGroup(picked) && lens !== "route") onRecords([picked], []);
      if (a === "review") await onReview(picked.reviewId);
      else await onLedger(picked.reviewId);
    }
  }
  function onClick(e) {
    action(e).catch(fail);
  }
  function onChange(e) {
    const k = e.target.id,
      v = e.target.value;
    if (k === "corpus-page") {
      directory(path, Number(v)).catch(fail);
      return;
    }
    if (k === "opt-color") setEvidence(v);
    if (k === "opt-trace") {
      trace = v;
      g.setTrace(v);
    }
    if (k === "opt-labels") {
      labels = e.target.checked;
      g.setLabels(labels);
    }
    if (k === "opt-motion") {
      motion = e.target.checked;
      g.setMotion(motion);
    }
    if (k === "opt-kind") {
      edgeFilter = v === "all" ? null : v;
      g.setFilter({ edgeKinds: edgeFilter ? [v, "both"] : null });
    }
  }
  function onInput(e) {
    if (e.target.id === "lookup-input")
      searchFor(e.target.value.trim()).catch(fail);
  }
  function onKeys(e) {
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "Escape" && (settings || searchOpen)) {
      closePopover();
      container.querySelector(".lookup")?.focus();
      return;
    }
    if (e.target.id === "lookup-input" && e.key === "Enter") {
      e.preventDefault();
      el("lookup-results")?.querySelector("button")?.click();
      return;
    }
    if (
      (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
    ) {
      e.preventDefault();
      openSearch();
    }
  }
  container.addEventListener("click", onClick);
  container.addEventListener("input", onInput);
  container.addEventListener("change", onChange);
  document.addEventListener("keydown", onKeys);
  bindData(starter, "riemannHypothesis");
  return {
    locate,
    openSearch,
    showEvidence() {
      setEvidence("trust");
    },
    refresh() {
      bindData(data, selected, { preserve: true });
    },
    destroy() {
      stopTrail();
      playback?.destroy();
      disposed = true;
      operation++;
      selectionVersion++;
      g.destroy();
      container.removeEventListener("click", onClick);
      container.removeEventListener("change", onChange);
      container.removeEventListener("input", onInput);
      document.removeEventListener("keydown", onKeys);
    },
  };
}
