/** A dependency map. A directed edge goes from a declaration to a declaration it uses. */
export const GALAXY_COLORS = Object.freeze({
  "Main results": "#b4d7ff",
  "Theta lifts": "#c87bff",
  "Galois theory": "#48dcf4",
  "Abelian varieties": "#7396ff",
  "Prime estimates": "#ffbd6c",
  "Analytic formalism": "#59e6c4",
  "Other arithmetic": "#ff75ae",
});
const spectrum = [
  "#ad88ff",
  "#56dfff",
  "#ff85b4",
  "#64dbbc",
  "#91a2ff",
  "#ffc477",
  "#df8bf5",
];
const trustColors = {
  supported: "#70edc4",
  support: "#70edc4",
  unreviewed: "#8393be",
  challenged: "#ff927b",
  challenge: "#ff927b",
  blocked: "#ff5d87",
  mixed: "#ffb1ed",
  inconclusive: "#eac77c",
  pending: "#eac77c",
};
const locations = [
  [0, 0],
  [173, -87],
  [-204, -81],
  [206, 100],
  [-190, 111],
  [-44, -166],
  [-10, 170],
];
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
function hash(text) {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++)
    n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}
const random = (n) => (Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0) / 4294967296;
function rgb(hex) {
  const value = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || "");
  if (!value) return [145, 171, 247];
  const h =
    value[1].length === 3 ? [...value[1]].map((c) => c + c).join("") : value[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function mix(a, b, f = 0.5) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * f));
}
function rgba(color, alpha) {
  return "rgba(" + color.join(",") + "," + clamp(alpha, 0, 1) + ")";
}
function nodeCaption(node) {
  if (node.short) return String(node.short);
  const name = String(node.label || node.id);
  return name.length <= 38 ? name : name.split(".").at(-1).replaceAll("_", " ");
}
function abbreviate(name, max = 30) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}
const emptyView = { nodes: [], edges: [] };

function prepare(data, selectedId) {
  const nodeById = new Map(),
    nodes = [],
    groups = new Map(),
    edges = [];
  for (const input of data.nodes || []) {
    const id = String(input.id ?? "");
    if (!id || nodeById.has(id)) continue;
    const group = String(input.group || "Declarations");
    if (!groups.has(group))
      groups.set(group, {
        name: group,
        nodes: [],
        color:
          input.color ||
          GALAXY_COLORS[group] ||
          spectrum[groups.size % spectrum.length],
      });
    const cluster = groups.get(group);
    const node = {
      id,
      input,
      group: cluster,
      n: nodes.length,
      seed: hash(id),
      in: [],
      out: [],
      x: 0,
      y: 0,
      sx: 0,
      sy: 0,
    };
    cluster.nodes.push(node);
    nodes.push(node);
    nodeById.set(id, node);
  }
  for (const input of data.edges || []) {
    const a = nodeById.get(String(input.from)),
      b = nodeById.get(String(input.to));
    if (!a || !b || a === b) continue;
    const edge = {
      input,
      a,
      b,
      seed: hash(a.id + "→" + b.id),
      n: edges.length,
      weight: Math.max(1, Number(input.weight) || 1),
    };
    edges.push(edge);
    a.out.push(edge);
    b.in.push(edge);
  }
  const clusters = [...groups.values()];
  for (const n of nodes) {
    n.degree = n.in.length + n.out.length;
    n.rgb = rgb(n.input.color || n.group.color);
    n.status = n.input.status || "unreviewed";
    n.trust = rgb(trustColors[n.status] || trustColors.unreviewed);
    n.mass =
      ["file", "directory"].includes(n.input.kind) &&
      Number.isFinite(n.input.raw?.count)
        ? n.input.raw.count
        : null;
    n.caption = nodeCaption(n.input);
    const size = n.input.weight > 1 ? Math.log2(1 + n.input.weight) * 0.44 : 0;
    n.radius =
      nodes.length > 50
        ? 1.25 +
          Math.min(3.4, Math.log2(1 + n.degree) * 0.48) +
          Math.min(1.7, size * 0.32)
        : 3.1 + Math.min(8, Math.max(size, Math.log2(1 + n.degree)));
    if (n.input.highlight) n.radius += 0.8;
    if (n.mass !== null)
      n.radius = 2.8 + Math.min(13, Math.log10(1 + n.mass) * 1.96);
  }
  const anchor =
    nodes.find(
      (n) => n.id === "riemannHypothesis" || n.id === "lean:riemannHypothesis",
    ) ||
    nodeById.get(selectedId) ||
    nodes.find((n) => n.input.highlight) ||
    nodes[0];
  const layoutOrder = clusters
    .slice()
    .sort(
      (a, b) =>
        (a === anchor?.group ? -1 : b === anchor?.group ? 1 : 0) ||
        b.nodes.length - a.nodes.length ||
        a.name.localeCompare(b.name),
    );
  const named = Object.keys(GALAXY_COLORS);
  for (let i = 0; i < layoutOrder.length; i++) {
    const c = layoutOrder[i];
    const namedIndex = named.indexOf(c.name);
    const angle =
      ((i - 1) * Math.PI * 2) / Math.max(1, layoutOrder.length - 1) - 0.65;
    const center =
      layoutOrder.length === 1
        ? [0, 0]
        : layoutOrder.length <= 7 && namedIndex >= 0
          ? locations[namedIndex]
          : i === 0
            ? [0, 0]
            : [Math.cos(angle) * 245, Math.sin(angle) * 164];
    c.x = center[0];
    c.y = center[1];
    c.nodes.sort((a, b) => b.degree - a.degree || a.seed - b.seed);
    c.nodes.forEach((n, index) => {
      const radius = Math.sqrt(index + 0.65) * 8.75;
      const t = index * 2.399963 + random(n.seed) * 0.35;
      n.x = c.x + Math.cos(t) * radius * 1.18;
      n.y = c.y + Math.sin(t) * radius * 0.84;
      n.sx = n.x;
      n.sy = n.y;
    });
  }
  if (nodes.length <= 28) {
    const small = [...nodes].sort(
      (a, b) =>
        (a === anchor ? -1 : b === anchor ? 1 : 0) ||
        b.degree - a.degree ||
        a.seed - b.seed,
    );
    const span = small.length <= 5 ? 112 : 168;
    small.forEach((n, i) => {
      const phi =
        (2 * Math.PI * (i - 1)) / Math.max(1, small.length - 1) - Math.PI * 0.5;
      const jitter = 0.88 + 0.16 * random(n.seed);
      n.x = i === 0 ? 0 : Math.cos(phi) * span * 1.4 * jitter;
      n.y = i === 0 ? 0 : Math.sin(phi) * span * 0.85 * jitter;
    });
  } else {
    settle(nodes, edges);
  }
  for (const n of nodes) {
    if (Number.isFinite(n.input.x) && Number.isFinite(n.input.y)) {
      n.x = n.input.x;
      n.y = n.input.y;
    }
  }
  for (const c of clusters) {
    c.rgb = rgb(c.color);
    c.links = new Map();
    c.x = c.nodes.reduce((s, n) => s + n.x, 0) / c.nodes.length;
    c.y = c.nodes.reduce((s, n) => s + n.y, 0) / c.nodes.length;
    const traffic = c.nodes.reduce((s, n) => s + 1 + n.degree, 0);
    c.coreX = c.nodes.reduce((s, n) => s + n.x * (1 + n.degree), 0) / traffic;
    c.coreY = c.nodes.reduce((s, n) => s + n.y * (1 + n.degree), 0) / traffic;
    c.rx = clamp(
      Math.sqrt(
        c.nodes.reduce((s, n) => s + (n.x - c.x) ** 2, 0) / c.nodes.length,
      ) * 2.35,
      14,
      160,
    );
    c.ry = clamp(
      Math.sqrt(
        c.nodes.reduce((s, n) => s + (n.y - c.y) ** 2, 0) / c.nodes.length,
      ) * 2.3,
      10,
      145,
    );
  }
  for (const e of edges) {
    const a = e.a.group,
      b = e.b.group;
    if (a !== b) {
      a.links.set(b, (a.links.get(b) || 0) + e.weight);
      b.links.set(a, (b.links.get(a) || 0) + e.weight);
    }
    e.rgb = mix(e.a.rgb, e.b.rgb, 0.43);
    e.trust = mix(e.a.trust, e.b.trust);
    const dx = e.b.x - e.a.x,
      dy = e.b.y - e.a.y,
      len = Math.hypot(dx, dy) || 1;
    let bend = (random(e.seed) - 0.5) * Math.min(32, len * 0.23);
    if (e.a.group !== e.b.group)
      bend += Math.sign(e.a.group.x - e.b.group.x) * Math.min(37, len * 0.11);
    e.cx = (e.a.x + e.b.x) * 0.5 - (dy / len) * bend;
    e.cy = (e.a.y + e.b.y) * 0.5 + (dx / len) * bend;
  }
  for (const c of clusters) {
    const neighbor = [...c.links].sort((a, b) => b[1] - a[1])[0]?.[0];
    // The luminous center follows reference density. The rim borrows a little
    // color from the family most strongly connected to this one.
    const high = Math.max(...c.rgb);
    c.coreColor = c.rgb.map((v) =>
      Math.round(Math.max(0, high - (high - v) * 1.8)),
    );
    c.rimColor = neighbor ? mix(c.coreColor, neighbor.rgb, 0.3) : c.coreColor;
  }
  const indexed =
    nodes.length > 0 &&
    nodes.every((n) => Number.isInteger(n.input.sequenceIndex));
  const order =
    indexed &&
    new Set(nodes.map((n) => n.input.sequenceIndex)).size === nodes.length
      ? nodes
          .slice()
          .sort((a, b) => a.input.sequenceIndex - b.input.sequenceIndex)
      : null;
  return { nodes, nodeById, edges, clusters, order };
}

// The sequence comes from the stored witness path. A folded rail only changes
// where those declarations are drawn; the edge list still comes from the proof.
function placeSequence(graph, width, height) {
  const order = graph?.order;
  if (!order) return false;
  const count = order.length,
    portrait = width / height < 1.08,
    short = count <= 6;
  const columns = short
    ? count
    : clamp(
        Math.ceil(Math.sqrt(count * (portrait ? 0.57 : 1.48))),
        2,
        portrait ? 5 : 11,
      );
  const key = Number(portrait) + "/" + columns;
  if (graph.sequenceLayout === key) return false;
  graph.sequenceLayout = key;
  const rows = Math.ceil(count / columns);
  for (let i = 0; i < count; i++) {
    const n = order[i],
      t = count < 2 ? 0.5 : i / (count - 1);
    const row = Math.floor(i / columns),
      step = i % columns;
    n.ordinal = i + 1;
    if (short) {
      const advance = (t - 0.5) * Math.max(150, Math.min(count - 1, 4) * 95);
      const rise = Math.sin(t * Math.PI) * -35 + (t - 0.5) * 24;
      n.x = portrait ? rise : advance;
      n.y = portrait ? advance : rise;
    } else {
      const column = row % 2 ? columns - 1 - step : step;
      n.x = (column - (columns - 1) / 2) * 116;
      n.y =
        (row - (rows - 1) / 2) * 92 +
        Math.sin((column / Math.max(columns - 1, 1)) * Math.PI) *
          (row % 2 ? 8 : -8);
    }
    n.radius = count > 80 ? 4.6 : count > 40 ? 6.4 : 8.3;
  }
  for (const e of graph.edges) {
    const dx = e.b.x - e.a.x,
      dy = e.b.y - e.a.y;
    const rowA = Math.floor((e.a.ordinal - 1) / columns),
      rowB = Math.floor((e.b.ordinal - 1) / columns);
    e.cx = (e.a.x + e.b.x) / 2;
    e.cy = (e.a.y + e.b.y) / 2;
    if (!short && rowA !== rowB && Math.abs(e.a.ordinal - e.b.ordinal) === 1) {
      const turn = Math.min(rowA, rowB) % 2 === 0 ? 1 : -1;
      e.cx += turn * 44;
    } else if (short) {
      e.cx += dy * 0.06;
      e.cy -= dx * 0.06;
    }
  }
  return true;
}

function pathChevron(c, e, wx, wy, t) {
  const u = 1 - t;
  const x = wx(u * u * e.a.x + 2 * u * t * e.cx + t * t * e.b.x),
    y = wy(u * u * e.a.y + 2 * u * t * e.cy + t * t * e.b.y);
  const dx = u * (wx(e.cx) - wx(e.a.x)) + t * (wx(e.b.x) - wx(e.cx));
  const dy = u * (wy(e.cy) - wy(e.a.y)) + t * (wy(e.b.y) - wy(e.cy));
  const length = Math.hypot(dx, dy) || 1,
    vx = dx / length,
    vy = dy / length;
  c.beginPath();
  c.moveTo(x - vx * 4.0 - vy * 2.5, y - vy * 4.0 + vx * 2.5);
  c.lineTo(x, y);
  c.lineTo(x - vx * 4.0 + vy * 2.5, y - vy * 4.0 - vx * 2.5);
  c.stroke();
}

// Local repulsion preserves separation; only actual dependency links attract.
// A soft group tether keeps the same source domain legible across different degrees.
function settle(nodes, edges) {
  const cell = 16,
    rounds = nodes.length > 1800 ? 11 : 34;
  const xs = new Float64Array(nodes.length),
    ys = new Float64Array(nodes.length);
  for (let round = 0; round < rounds; round++) {
    xs.fill(0);
    ys.fill(0);
    const cells = new Map();
    for (const n of nodes) {
      const gx = Math.floor(n.x / cell),
        gy = Math.floor(n.y / cell);
      const key = (gx + 4096) * 8192 + gy;
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          for (const other of cells.get(key + ox * 8192 + oy) || []) {
            const dx = n.x - other.x,
              dy = n.y - other.y,
              dist = Math.hypot(dx, dy) || 0.01;
            const force = (11 + (n.radius + other.radius) * 0.6 - dist) * 0.22;
            if (force <= 0) continue;
            const fx = (dx / dist) * force,
              fy = (dy / dist) * force;
            xs[n.n] += fx;
            ys[n.n] += fy;
            xs[other.n] -= fx;
            ys[other.n] -= fy;
          }
        }
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(n);
    }
    for (const { a, b } of edges) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dist = Math.hypot(dx, dy) || 1;
      const within = a.group === b.group;
      const f = ((dist - (within ? 19 : 95)) / dist) * (within ? 0.028 : 0.009);
      if (f <= 0) continue;
      const fa = f / Math.sqrt(1 + a.degree * 0.26),
        fb = f / Math.sqrt(1 + b.degree * 0.26);
      xs[a.n] += dx * fa;
      ys[a.n] += dy * fa;
      xs[b.n] -= dx * fb;
      ys[b.n] -= dy * fb;
    }
    for (const n of nodes) {
      n.x += clamp(xs[n.n] + (n.sx - n.x) * 0.022, -6, 6);
      n.y += clamp(ys[n.n] + (n.sy - n.y) * 0.022, -6, 6);
    }
  }
}

function walk(start, mode, includeEdge) {
  if (!start || mode === "all") return null;
  const nodes = new Set([start.id]),
    edges = new Set();
  function expand(direction, deep) {
    const seen = new Set([start.id]),
      queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      for (const e of n[direction]) {
        if (!includeEdge(e)) continue;
        const next = direction === "out" ? e.b : e.a;
        edges.add(e.n);
        nodes.add(next.id);
        if (deep && !seen.has(next.id)) {
          seen.add(next.id);
          queue.push(next);
        }
      }
    }
  }
  if (mode === "upstream" || mode === "both" || mode === "neighbors")
    expand("out", mode !== "neighbors");
  if (mode === "downstream" || mode === "both" || mode === "neighbors")
    expand("in", mode !== "neighbors");
  return { nodes, edges };
}

export function mountGalaxy(container, data = emptyView, options = {}) {
  if (!container) throw new Error("A graph container is required.");
  const layer = document.createElement("div");
  layer.className = "galaxy-surface";
  layer.tabIndex = 0;
  layer.setAttribute("role", "group");
  layer.setAttribute(
    "aria-label",
    "Interactive dependency graph. Drag to pan, scroll or pinch to zoom. Arrow keys select a nearby node. Enter inspects it. E cycles through its visible links. Home fits the graph.",
  );
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    touchAction: "none",
    outlineOffset: "-3px",
  });
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    width: "100%",
    height: "100%",
    display: "block",
    touchAction: "none",
    cursor: "grab",
  });
  layer.append(canvas);
  const live = document.createElement("span");
  live.setAttribute("aria-live", "polite");
  Object.assign(live.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(100%)",
  });
  layer.append(live);
  const tip = document.createElement("div");
  tip.className = "galaxy-edge-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  const tipNames = document.createElement("strong");
  const tipKind = document.createElement("small");
  tip.append(tipNames, tipKind);
  layer.append(tip);
  if (getComputedStyle(container).position === "static")
    container.style.position = "relative";
  container.append(layer);
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduced = matchMedia("(prefers-reduced-motion:reduce)");
  let graph,
    selectedId = options.selectedId || "",
    hoveredId = "",
    trace = "all",
    colorMode = "group",
    labelsOn = true;
  let groups = null,
    kinds = null,
    query = "",
    visibleNodes = [],
    visibleEdges = [],
    allowed = new Set(),
    visibleSet = new Set();
  let viewport = { width: 1, height: 1, cx: 0, cy: 0, fit: 1, zoom: 1 },
    dpr = 1,
    bounds;
  let motion = !reduced.matches,
    redraw = 0,
    frame = 0,
    decor = null,
    disposed = false;
  let labelOrder = null;
  let drawEdgesCache = null,
    edgeCacheTransform = null;
  let drag = null,
    pinch = null,
    singleTap = null;
  let miniDrag = null;
  let arrivals = null;
  let edgeIndex = null,
    pickedEdge = null,
    tipWidth = 0,
    tipHeight = 0;
  const pointers = new Map();
  const small = () => viewport.width < 610;
  function sx(x) {
    return (
      (x - viewport.cx) * viewport.fit * viewport.zoom + viewport.width / 2
    );
  }
  function yStretch() {
    return bounds &&
      !graph?.order &&
      viewport.width < 610 &&
      viewport.height > viewport.width * 0.85
      ? clamp((viewport.height - 82) / (viewport.fit * bounds.h), 1, 2.25)
      : 1;
  }
  function sy(y) {
    return (
      (y - viewport.cy) * viewport.fit * viewport.zoom * yStretch() +
      viewport.height / 2
    );
  }
  function world(x, y) {
    const f = viewport.fit * viewport.zoom;
    return [
      viewport.cx + (x - viewport.width / 2) / f,
      viewport.cy + (y - viewport.height / 2) / (f * yStretch()),
    ];
  }
  function radius(n) {
    return clamp(
      n.radius * Math.pow(viewport.zoom, 0.4) * (small() ? 0.94 : 1),
      1.15,
      17,
    );
  }
  function color(n) {
    return colorMode === "trust" ? n.trust : n.rgb;
  }
  function notifyViewport() {
    options.onViewport?.({
      zoom: viewport.zoom,
      x: viewport.cx,
      y: viewport.cy,
    });
  }
  function invalidate() {
    showEdge(null);
    edgeCacheTransform = null;
    requestPaint();
  }
  function updateVisible() {
    labelOrder = null;
    edgeIndex = null;
    const route = walk(
      graph.nodeById.get(selectedId),
      trace,
      (e) => !kinds || kinds.has(String(e.input.kind || "value")),
    );
    allowed = new Set(
      graph.nodes
        .filter(
          (n) =>
            (!groups || groups.has(n.group.name)) &&
            (!query ||
              (n.id + " " + n.caption + " " + n.group.name)
                .toLowerCase()
                .includes(query)),
        )
        .map((n) => n.id),
    );
    visibleNodes = graph.nodes.filter(
      (n) => allowed.has(n.id) && (!route || route.nodes.has(n.id)),
    );
    visibleSet = new Set(visibleNodes.map((n) => n.id));
    visibleEdges = graph.edges.filter(
      (e) =>
        visibleSet.has(e.a.id) &&
        visibleSet.has(e.b.id) &&
        (!kinds || kinds.has(String(e.input.kind || "value"))) &&
        (!route || route.edges.has(e.n)),
    );
    options.onStats?.({
      visibleNodes: visibleNodes.length,
      visibleEdges: visibleEdges.length,
    });
    invalidate();
  }
  function selectedNode() {
    return graph.nodeById.get(selectedId);
  }
  function select(id, { focus = false } = {}) {
    if (!graph.nodeById.has(id)) return;
    showEdge(null);
    selectedId = id;
    if (trace !== "all") updateVisible();
    const n = selectedNode();
    live.textContent =
      (graph.order
        ? "Step " + n.ordinal + " of " + graph.order.length + ". "
        : "") +
      n.caption +
      ", " +
      n.group.name +
      ", " +
      n.out.length +
      " direct dependencies, " +
      n.in.length +
      " direct dependents.";
    if (focus) focusNode(id);
    else requestPaint();
  }
  function userSelect(id, focus = false) {
    if (!id) return;
    select(id, { focus });
    options.onSelect?.(id);
  }
  function activate(id) {
    if (!id) return;
    if (options.onActivate) options.onActivate(id);
    else focusNode(id);
  }
  function hover(id) {
    if (hoveredId === id) return;
    hoveredId = id;
    options.onHover?.(id || null);
    canvas.style.cursor = id ? "pointer" : "grab";
    requestPaint();
  }
  function showEdge(edge, x, y, announce = false) {
    if (pickedEdge !== edge) {
      pickedEdge = edge;
      tip.hidden = !edge;
      requestPaint();
      if (edge) {
        const input = edge.input;
        const counts = [];
        for (const [name, key, rawKey] of [
          ["type", "typeReferences", "type"],
          ["body", "valueReferences", "value"],
        ]) {
          const total = input[key] ?? input.raw?.[rawKey];
          if (Number.isSafeInteger(total))
            counts.push(total.toLocaleString("en-US") + " " + name);
        }
        const wording = {
          type: "Type reference",
          value: "Body reference",
          both: "Type and body references",
        };
        tipNames.textContent =
          (edge.a.input.short || edge.a.input.label || edge.a.id) +
          " → " +
          (edge.b.input.short || edge.b.input.label || edge.b.id);
        tipKind.textContent = counts.length
          ? counts.join(" · ")
          : wording[input.kind] || input.kind || "Reference";
        tip.style.setProperty(
          "--edge-color",
          rgba(colorMode === "trust" ? edge.trust : edge.rgb, 1),
        );
        tipWidth = tip.offsetWidth;
        tipHeight = tip.offsetHeight;
        if (announce)
          live.textContent = tipNames.textContent + ". " + tipKind.textContent;
      }
    }
    if (edge) {
      const left = clamp(x + 13, 5, Math.max(5, viewport.width - tipWidth - 5));
      const top =
        y - tipHeight - 12 < 5
          ? Math.min(y + 11, viewport.height - tipHeight - 5)
          : y - tipHeight - 12;
      tip.style.transform =
        "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
    }
  }
  // Coarse bins are in graph coordinates and survive pan and zoom. Each candidate
  // is measured against its displayed Bézier in screen pixels.
  function hitEdge(x, y, dense = false) {
    if (!visibleEdges.length || (!dense && visibleEdges.length > 250))
      return null;
    if (!edgeIndex) {
      const span = Math.max(bounds.w, bounds.h, 60) / 16;
      const bins = new Map();
      for (const e of visibleEdges) {
        const x0 = Math.floor(Math.min(e.a.x, e.b.x, e.cx) / span);
        const x1 = Math.floor(Math.max(e.a.x, e.b.x, e.cx) / span);
        const y0 = Math.floor(Math.min(e.a.y, e.b.y, e.cy) / span);
        const y1 = Math.floor(Math.max(e.a.y, e.b.y, e.cy) / span);
        for (let i = x0; i <= x1; i++)
          for (let j = y0; j <= y1; j++) {
            const key = i + "," + j;
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key).push(e);
          }
      }
      edgeIndex = { span, bins };
    }
    const [l, t] = world(x - 5, y - 5),
      [r, b] = world(x + 5, y + 5);
    const { span, bins } = edgeIndex;
    const candidates = new Set();
    for (let i = Math.floor(l / span); i <= Math.floor(r / span); i++)
      for (let j = Math.floor(t / span); j <= Math.floor(b / span); j++) {
        const bin = bins.get(i + "," + j);
        if (bin)
          for (let s = bin.length - 1; s >= Math.max(0, bin.length - 950); s--)
            candidates.add(bin[s]);
      }
    let best = null,
      bestSq = 25;
    for (const edge of candidates) {
      const ax = sx(edge.a.x),
        ay = sy(edge.a.y),
        cx = sx(edge.cx),
        cy = sy(edge.cy),
        bx = sx(edge.b.x),
        by = sy(edge.b.y);
      if (
        x < Math.min(ax, bx, cx) - 5 ||
        x > Math.max(ax, bx, cx) + 5 ||
        y < Math.min(ay, by, cy) - 5 ||
        y > Math.max(ay, by, cy) + 5
      )
        continue;
      const steps = clamp(
        Math.ceil(Math.sqrt(Math.hypot(ax - 2 * cx + bx, ay - 2 * cy + by))),
        2,
        30,
      );
      let px = ax,
        py = ay;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps,
          u = 1 - t;
        const qx = u * u * ax + 2 * u * t * cx + t * t * bx,
          qy = u * u * ay + 2 * u * t * cy + t * t * by;
        const vx = qx - px,
          vy = qy - py,
          k = clamp(
            ((x - px) * vx + (y - py) * vy) / (vx * vx + vy * vy || 1),
            0,
            1,
          );
        const d = (x - px - k * vx) ** 2 + (y - py - k * vy) ** 2;
        if (d < bestSq) {
          bestSq = d;
          best = edge;
        }
        px = qx;
        py = qy;
      }
    }
    return best;
  }
  function setData(
    next,
    { selectedId: newSelection, preserveView = false } = {},
  ) {
    const previous = graph?.nodeById;
    graph = prepare(next || emptyView, newSelection);
    placeSequence(graph, viewport.width, viewport.height);
    layer.setAttribute(
      "aria-keyshortcuts",
      graph.order
        ? "ArrowLeft ArrowRight ArrowUp ArrowDown Home [ ] E Enter"
        : "ArrowLeft ArrowRight ArrowUp ArrowDown Home E Enter",
    );
    arrivals = null;
    if (previous && motion && !reduced.matches) {
      const additions = graph.nodes.filter((node) => !previous.has(node.id));
      if (additions.length && additions.length < graph.nodes.length)
        arrivals = { at: performance.now(), nodes: additions };
    }
    selectedId = graph.nodeById.has(newSelection)
      ? newSelection
      : graph.nodeById.has(selectedId)
        ? selectedId
        : graph.nodes[0]?.id || "";
    hoveredId = "";
    bounds = null;
    calcBounds();
    if (!preserveView) fit(false);
    updateVisible();
    requestPaint();
  }
  function calcBounds() {
    if (!graph?.nodes.length) {
      bounds = { x: -80, y: -55, w: 160, h: 110 };
      return;
    }
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const n of graph.nodes) {
      left = Math.min(left, n.x);
      right = Math.max(right, n.x);
      top = Math.min(top, n.y);
      bottom = Math.max(bottom, n.y);
    }
    if (graph.order) {
      for (const e of graph.edges) {
        left = Math.min(left, e.cx);
        right = Math.max(right, e.cx);
        top = Math.min(top, e.cy);
        bottom = Math.max(bottom, e.cy);
      }
    }
    const minSpan = graph.nodes.length <= 3 ? 85 : 24;
    bounds = {
      x: left,
      y: top,
      w: Math.max(minSpan, right - left),
      h: Math.max(minSpan, bottom - top),
      cx: (left + right) / 2,
      cy: (top + bottom) / 2,
    };
  }
  function baseScale() {
    const padx = graph?.order
      ? small()
        ? 42
        : Math.min(110, viewport.width * 0.11)
      : small()
        ? 30
        : 44;
    const pady = graph?.order ? (small() ? 88 : 78) : small() ? 46 : 48;
    return Math.max(
      0.035,
      Math.min(
        (viewport.width - 2 * padx) / bounds.w,
        (viewport.height - 2 * pady) / bounds.h,
      ),
    );
  }
  function fit(emit = true) {
    if (!bounds) return;
    viewport.fit = baseScale();
    viewport.zoom = 1;
    viewport.cx = bounds.cx ?? 0;
    viewport.cy = bounds.cy ?? 0;
    if (graph?.order && small()) viewport.cy -= 37 / viewport.fit;
    if (emit) notifyViewport();
    invalidate();
  }
  function fitVisible() {
    if (!visibleNodes.length || visibleNodes.length === graph.nodes.length) {
      fit();
      return;
    }
    let l = Infinity,
      r = -Infinity,
      t = Infinity,
      b = -Infinity;
    for (const n of visibleNodes) {
      l = Math.min(l, n.x);
      r = Math.max(r, n.x);
      t = Math.min(t, n.y);
      b = Math.max(b, n.y);
    }
    viewport.cx = (l + r) / 2;
    viewport.cy = (t + b) / 2;
    const kx = (viewport.width - 80) / (Math.max(r - l, 36) * viewport.fit);
    const ky =
      (viewport.height - 82) /
      (Math.max(b - t, 28) * viewport.fit * yStretch());
    viewport.zoom = clamp(Math.min(kx, ky), 0.34, 7);
    notifyViewport();
    invalidate();
  }
  function focusNode(id) {
    const n = graph.nodeById.get(id);
    if (!n) return;
    viewport.cx = n.x;
    viewport.cy = n.y;
    viewport.zoom = clamp(
      Math.max(viewport.zoom, graph.nodes.length > 100 ? 2.1 : 1.5),
      0.35,
      24,
    );
    notifyViewport();
    invalidate();
  }
  function zoomBy(factor, x = viewport.width / 2, y = viewport.height / 2) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const [wx, wy] = world(x, y);
    viewport.zoom = clamp(viewport.zoom * factor, 0.34, 20);
    const f = viewport.fit * viewport.zoom;
    viewport.cx = wx - (x - viewport.width / 2) / f;
    viewport.cy = wy - (y - viewport.height / 2) / (f * yStretch());
    notifyViewport();
    invalidate();
  }
  function resize() {
    const box = layer.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width)),
      height = Math.max(1, Math.round(box.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width === Math.round(width * dpr) &&
      canvas.height === Math.round(height * dpr)
    )
      return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    viewport.width = width;
    viewport.height = height;
    if (placeSequence(graph, width, height)) {
      edgeIndex = null;
      calcBounds();
      fit(false);
    } else if (bounds) viewport.fit = baseScale();
    decor = null;
    invalidate();
  }
  function requestPaint() {
    if (disposed || redraw) return;
    redraw = requestAnimationFrame((t) => {
      redraw = 0;
      paint(t);
    });
  }
  function hit(x, y) {
    let winner = null,
      best = Infinity;
    const threshold = small() ? 13 : 9;
    for (const n of visibleNodes) {
      const d = Math.hypot(sx(n.x) - x, sy(n.y) - y);
      if (d <= Math.max(threshold, radius(n) + 4) && d < best) {
        winner = n;
        best = d;
      }
    }
    return winner;
  }

  // Stars below the graph are unlinked, neutral specks. The colored fog follows
  // the density of true declarations in each source domain.
  function background() {
    if (!decor) {
      decor = document.createElement("canvas");
      decor.width = canvas.width;
      decor.height = canvas.height;
      const c = decor.getContext("2d");
      c.scale(dpr, dpr);
      const count = Math.min(
        270,
        Math.round((viewport.width * viewport.height) / 2200),
      );
      for (let i = 0; i < count; i++) {
        const x = random(hash("gx" + i)) * viewport.width,
          y = random(hash("gy" + i)) * viewport.height;
        const a = 0.12 + random(hash("ga" + i)) * 0.43;
        c.fillStyle = "rgba(198,212,252," + a + ")";
        const size = i % 13 === 0 ? 1.2 : 0.74;
        c.fillRect(x, y, size, size);
        if (i % 47 === 0) {
          c.fillStyle = "rgba(169,192,242,.19)";
          c.fillRect(x - 1.4, y + 0.35, 3.8, 0.45);
          c.fillRect(x + 0.35, y - 1.4, 0.45, 3.8);
        }
      }
    }
    ctx.drawImage(decor, 0, 0, viewport.width, viewport.height);
    if (graph.order || graph.nodes.length < 32) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const c of graph.clusters) {
      if (groups && !groups.has(c.name)) continue;
      const f = viewport.fit * viewport.zoom,
        rx = Math.max(34, c.rx * f * 1.35),
        ry = Math.max(27, c.ry * f * 1.4 * yStretch());
      const x = sx(c.x),
        y = sy(c.y);
      if (
        x + rx < 0 ||
        y + ry < 0 ||
        x - rx > viewport.width ||
        y - ry > viewport.height
      )
        continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx, ry);
      const coreX = clamp(((c.coreX - c.x) * f) / rx, -0.35, 0.35);
      const coreY = clamp(((c.coreY - c.y) * f * yStretch()) / ry, -0.35, 0.35);
      const grad = ctx.createRadialGradient(coreX, coreY, 0, 0, 0, 1);
      if (colorMode === "trust") {
        grad.addColorStop(0, "rgba(112,132,170,.115)");
        grad.addColorStop(0.44, "rgba(112,132,170,.061)");
        grad.addColorStop(1, "rgba(112,132,170,0)");
      } else {
        grad.addColorStop(0, rgba(c.coreColor, 0.29));
        grad.addColorStop(0.25, rgba(c.coreColor, 0.18));
        grad.addColorStop(0.58, rgba(c.rimColor, 0.082));
        grad.addColorStop(1, rgba(c.rimColor, 0));
      }
      ctx.fillStyle = grad;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    ctx.restore();
  }
  function line(c, e) {
    c.moveTo(sx(e.a.x), sy(e.a.y));
    c.quadraticCurveTo(sx(e.cx), sy(e.cy), sx(e.b.x), sy(e.b.y));
  }
  function onScreen(e) {
    const xx = [sx(e.a.x), sx(e.b.x), sx(e.cx)],
      yy = [sy(e.a.y), sy(e.b.y), sy(e.cy)];
    return (
      Math.max(...xx) >= -2 &&
      Math.max(...yy) >= -2 &&
      Math.min(...xx) <= viewport.width + 2 &&
      Math.min(...yy) <= viewport.height + 2
    );
  }
  function edgeLayer() {
    const signature = [
      viewport.cx,
      viewport.cy,
      viewport.zoom,
      viewport.width,
      viewport.height,
      colorMode,
      trace,
    ].join("/");
    if (drawEdgesCache && edgeCacheTransform === signature)
      return drawEdgesCache;
    const sheet = drawEdgesCache || document.createElement("canvas");
    if (sheet.width !== canvas.width || sheet.height !== canvas.height) {
      sheet.width = canvas.width;
      sheet.height = canvas.height;
    }
    const c = sheet.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, viewport.width, viewport.height);
    c.lineCap = "round";
    c.globalCompositeOperation = "screen";
    const dense = visibleEdges.length > 500,
      superDense = visibleEdges.length > 8500;
    for (const e of visibleEdges) {
      if (!onScreen(e)) continue;
      const width = superDense ? 0.34 : dense ? 0.5 : 0.8;
      const combined = e.a.group !== e.b.group;
      const a = superDense ? 0.064 : dense ? (combined ? 0.158 : 0.245) : 0.43;
      if (graph.order) {
        const shade = colorMode === "trust" ? e.trust : e.rgb;
        c.lineWidth = 1.5;
        c.strokeStyle = rgba(shade, 0.8);
        if (e.input.kind === "type") c.setLineDash([3, 3]);
        c.beginPath();
        line(c, e);
        c.stroke();
        c.setLineDash([]);
        pathChevron(c, e, sx, sy, 0.55);
        continue;
      }
      c.lineWidth = width + Math.min(2.4, Math.log2(e.weight) * 0.19);
      c.strokeStyle = rgba(colorMode === "trust" ? e.trust : e.rgb, a);
      c.beginPath();
      line(c, e);
      c.stroke();
    }
    drawEdgesCache = sheet;
    edgeCacheTransform = signature;
    return sheet;
  }
  function activeEdges(n, time) {
    if (!n || !visibleSet.has(n.id)) return [];
    const edges = [...n.out, ...n.in].filter(
      (e) =>
        visibleSet.has(e.a.id) &&
        visibleSet.has(e.b.id) &&
        (!kinds || kinds.has(String(e.input.kind || "value"))),
    );
    const unique = new Set(edges.map((e) => e.n));
    const chosen = visibleEdges.filter((e) => unique.has(e.n));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const animate =
      motion &&
      !reduced.matches &&
      !document.hidden &&
      (hoveredId || trace !== "all");
    const budget = chosen.length > 100 ? 16 : 32;
    chosen.forEach((e, i) => {
      const base = colorMode === "trust" ? e.trust : e.rgb;
      ctx.lineWidth = hoveredId ? 1.3 : 1.14;
      ctx.strokeStyle = rgba(
        mix(base, [222, 240, 255], 0.21),
        hoveredId ? 0.76 : 0.68,
      );
      if (graph.order && e.input.kind === "type") ctx.setLineDash([3, 3]);
      ctx.beginPath();
      line(ctx, e);
      ctx.stroke();
      if (graph.order) ctx.setLineDash([]);
      if (
        !graph.order &&
        i < budget &&
        Math.hypot(sx(e.a.x) - sx(e.b.x), sy(e.a.y) - sy(e.b.y)) > 34
      ) {
        pathChevron(ctx, e, sx, sy, 0.67);
      }
      if (!animate || i >= budget) return;
      // Pulses follow the cited-reference direction: declaration to prerequisite.
      const t = (time * 0.00014 + random(e.seed)) % 1,
        u = 1 - t;
      const wx = u * u * e.a.x + 2 * u * t * e.cx + t * t * e.b.x,
        wy = u * u * e.a.y + 2 * u * t * e.cy + t * t * e.b.y;
      ctx.beginPath();
      ctx.arc(sx(wx), sy(wy), 1.4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(mix(base, [255, 255, 255], 0.7), 0.94);
      ctx.fill();
    });
    ctx.restore();
    if (animate && chosen.length)
      frame = requestAnimationFrame(() => {
        frame = 0;
        requestPaint();
      });
    return chosen;
  }
  function overlaps(r, rects) {
    return rects.some(
      (a) =>
        r.x < a.x + a.w &&
        r.x + r.w > a.x &&
        r.y < a.y + a.h &&
        r.y + r.h > a.y,
    );
  }
  function haloNode(n, x, y, r, highlighted) {
    const tone = color(n);
    if (graph.order) {
      const rim = rgba(mix(tone, [238, 239, 255], 0.22), 0.96);
      if (r > 6) {
        ctx.fillStyle = rgba(tone, 0.115);
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = "#10162a";
      ctx.strokeStyle = rim;
      ctx.lineWidth = highlighted ? 1.65 : 1.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (r > 5.4 || n === selectedNode()) {
        ctx.font =
          "600 " +
          Math.max(8, Math.min(12, r * 0.98)) +
          "px ui-monospace,Menlo,monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#edf1ff";
        ctx.fillText(String(n.ordinal), x, y + 0.4);
      }
      return;
    }
    if (n.mass !== null) {
      const reach = r * 2.9;
      const star = ctx.createRadialGradient(x, y, 0, x, y, reach);
      star.addColorStop(0, rgba(mix(tone, [252, 250, 255], 0.72), 1));
      star.addColorStop(0.19, rgba(mix(tone, [249, 249, 255], 0.27), 0.98));
      star.addColorStop(0.34, rgba(tone, 0.91));
      star.addColorStop(0.38, rgba(tone, 0.29));
      star.addColorStop(0.7, rgba(tone, 0.11));
      star.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = star;
      ctx.fillRect(x - reach, y - reach, 2 * reach, 2 * reach);
      return;
    }
    if (r >= 2.1 || highlighted) {
      ctx.fillStyle = rgba(tone, highlighted ? 0.2 : 0.1);
      ctx.beginPath();
      ctx.arc(x, y, r * (highlighted ? 2.9 : 2.04), 0, Math.PI * 2);
      ctx.fill();
      if (r > 3.65 || highlighted) {
        ctx.fillStyle = rgba(tone, 0.064);
        ctx.beginPath();
        ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const brightness = highlighted ? 0.58 : n.degree > 19 ? 0.31 : 0.03;
    ctx.fillStyle = rgba(mix(tone, [247, 250, 255], brightness), 0.92);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (n.degree > 22 || highlighted) {
      ctx.fillStyle = "rgba(247,251,255,.86)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.75, r * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function selectedMark(n) {
    if (!n || !visibleSet.has(n.id)) return;
    const x = sx(n.x),
      y = sy(n.y),
      r = radius(n),
      outer = Math.max(n.id === selectedId ? 12.5 : 9.5, r + 6);
    ctx.save();
    if (n.id === selectedId && !graph.order) {
      const lift = Math.max(16, outer * 1.38);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, lift * 1.48);
      glow.addColorStop(0, "rgba(251,251,255,.85)");
      glow.addColorStop(0.16, rgba(mix(color(n), [250, 245, 255], 0.62), 0.67));
      glow.addColorStop(0.52, rgba(color(n), 0.22));
      glow.addColorStop(1, rgba(color(n), 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - lift * 1.5, y - lift * 1.5, lift * 3, lift * 3);
      ctx.fillStyle = "rgba(247,249,255,.94)";
      ctx.beginPath();
      ctx.moveTo(x, y - lift);
      ctx.lineTo(x + 1.8, y - 1.7);
      ctx.lineTo(x + lift * 0.85, y);
      ctx.lineTo(x + 1.8, y + 1.7);
      ctx.lineTo(x, y + lift);
      ctx.lineTo(x - 1.8, y + 1.7);
      ctx.lineTo(x - lift * 0.85, y);
      ctx.lineTo(x - 1.8, y - 1.7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = rgba(mix(color(n), [230, 251, 255], 0.52), 0.93);
    ctx.lineWidth = 1.12;
    ctx.beginPath();
    ctx.arc(x, y, outer, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(color(n), 0.55);
    ctx.lineWidth = 0.85;
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(x, y, outer + 3.5, angle - 0.16, angle + 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }
  function label(n, used, isPriority) {
    const x = sx(n.x),
      y = sy(n.y),
      r = radius(n);
    if (x < -3 || y < -3 || x > viewport.width + 3 || y > viewport.height + 3)
      return;
    const name = n.caption;
    const text = abbreviate(name, small() ? 22 : 34);
    if (!text) return;
    const emphasized = n.id === selectedId || n.id === hoveredId;
    ctx.font =
      (emphasized ? "600 " : "500 ") +
      (small() ? 10 : 11) +
      'px "Inter",system-ui,sans-serif';
    const showCount =
      n.id === hoveredId || (n.mass !== null && graph.nodes.length <= 32);
    const countText =
      n.mass !== null
        ? n.mass.toLocaleString("en-US") +
          (n.mass === 1 ? " declaration" : " declarations")
        : "In view: " + n.out.length + " deps · " + n.in.length + " uses";
    const nameWidth = ctx.measureText(text).width;
    const nameFont = ctx.font;
    if (showCount) ctx.font = "9px ui-monospace,Menlo,monospace";
    const w =
        Math.max(nameWidth, showCount ? ctx.measureText(countText).width : 0) +
        13,
      h = showCount ? 32 : 18,
      gap = Math.max(10, r + 6);
    ctx.font = nameFont;
    const sideLabels = [
      { x: x + gap + 4, y: y - h - 3, side: 1 },
      { x: x - w - gap - 4, y: y - h - 3, side: -1 },
      { x: x + gap + 4, y: y + 2, side: 1 },
      { x: x - w - gap - 4, y: y + 2, side: -1 },
    ];
    const centeredLabels = [
      { x: x - w / 2, y: y - h - gap - 2, side: 0 },
      { x: x - w / 2, y: y + gap + 2, side: 0 },
    ];
    const choices =
      graph.order && (graph.order.length > 6 || !small())
        ? [...centeredLabels, ...sideLabels]
        : [...sideLabels, ...centeredLabels];
    let box = choices.find(
      (b) =>
        b.x > 4 &&
        b.y > 4 &&
        b.x + w < viewport.width - 4 &&
        b.y + h < viewport.height - 4 &&
        !overlaps({ ...b, w, h }, used),
    );
    if (!box && isPriority && emphasized)
      box = choices.find(
        (b) =>
          b.x > 3 &&
          b.y > 3 &&
          b.x + w < viewport.width - 3 &&
          b.y + h < viewport.height - 3,
      );
    if (!box) return;
    used.push({ ...box, w, h });
    const tone = color(n);
    ctx.strokeStyle = rgba(tone, emphasized ? 0.8 : 0.42);
    ctx.lineWidth = 0.65;
    const attachX =
        box.side === 1 ? box.x : box.side === -1 ? box.x + w : box.x + w / 2,
      attachY =
        box.side === 0 ? (box.y < y ? box.y + h : box.y) : box.y + h / 2;
    const dx = attachX - x,
      dy = attachY - y,
      len = Math.hypot(dx, dy) || 1;
    ctx.beginPath();
    ctx.moveTo(x + (dx / len) * (r + 2), y + (dy / len) * (r + 2));
    ctx.lineTo(attachX, attachY);
    ctx.stroke();
    if (emphasized) {
      ctx.fillStyle = "rgba(13,22,43,.94)";
      ctx.fillRect(box.x, box.y, w, h);
      ctx.strokeStyle = rgba(tone, 0.58);
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, w - 1, h - 1);
    }
    ctx.fillStyle = emphasized ? "#f0f7ff" : "#d5def3";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (!emphasized) {
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(6,12,27,.88)";
      ctx.strokeText(text, box.x + 6.5, box.y + 9.35);
    }
    ctx.fillText(text, box.x + 6.5, box.y + 9.35);
    if (showCount) {
      ctx.fillStyle = "#bbc8e2";
      ctx.font = "9px ui-monospace,Menlo,monospace";
      if (!emphasized) {
        ctx.strokeStyle = "rgba(7,12,27,.92)";
        ctx.lineWidth = 2.8;
        ctx.strokeText(countText, box.x + 6.5, box.y + 23.4);
      }
      ctx.fillText(countText, box.x + 6.5, box.y + 23.4);
    }
  }
  function miniBox() {
    const moved =
      Math.abs(viewport.cx - (bounds?.cx || 0)) +
      Math.abs(viewport.cy - (bounds?.cy || 0));
    if (
      options.minimap === false ||
      graph.nodes.length < 8 ||
      viewport.width < 690 ||
      viewport.height < 315 ||
      (!miniDrag &&
        Math.abs(viewport.zoom - 1) < 0.14 &&
        moved < 22 &&
        trace === "all")
    )
      return null;
    const w = 117,
      h = 72;
    const scale = Math.min((w - 14) / bounds.w, (h - 14) / bounds.h);
    return {
      x: viewport.width - w - 15,
      y: viewport.height - h - 62,
      w,
      h,
      scale,
    };
  }
  function insideBox(x, y, box) {
    return (
      box &&
      x >= box.x &&
      x <= box.x + box.w &&
      y >= box.y &&
      y <= box.y + box.h
    );
  }
  function miniPan(x, y, box) {
    viewport.cx =
      (bounds.cx || 0) +
      (clamp(x, box.x, box.x + box.w) - box.x - box.w / 2) / box.scale;
    viewport.cy =
      (bounds.cy || 0) +
      (clamp(y, box.y, box.y + box.h) - box.y - box.h / 2) / box.scale;
    hover("");
    notifyViewport();
    invalidate();
  }
  function paintMini(box) {
    if (!box) return;
    const { x, y, w, h, scale } = box;
    const mx = (wx) => x + w / 2 + (wx - (bounds.cx || 0)) * scale;
    const my = (wy) => y + h / 2 + (wy - (bounds.cy || 0)) * scale;
    ctx.save();
    ctx.fillStyle = "rgba(8,13,29,.94)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(157,181,234,.34)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, w - 6, h - 6);
    ctx.clip();
    const stride = Math.max(1, Math.floor(graph.nodes.length / 2200));
    for (let i = 0; i < graph.nodes.length; i += stride) {
      const n = graph.nodes[i];
      ctx.fillStyle = rgba(color(n), visibleSet.has(n.id) ? 0.76 : 0.21);
      const size = n.degree > 18 ? 1.4 : 0.95;
      ctx.fillRect(mx(n.x), my(n.y), size, size);
    }
    const [left, top] = world(0, 0),
      [right, bottom] = world(viewport.width, viewport.height);
    const l = clamp(mx(left), x + 3, x + w - 3),
      r = clamp(mx(right), x + 3, x + w - 3);
    const t = clamp(my(top), y + 3, y + h - 3),
      b = clamp(my(bottom), y + 3, y + h - 3);
    ctx.fillStyle = "rgba(177,206,255,.08)";
    ctx.fillRect(l, t, r - l, b - t);
    ctx.strokeStyle = "#aabfe8";
    ctx.lineWidth = 0.85;
    ctx.strokeRect(l, t, r - l, b - t);
    const selected = selectedNode();
    if (selected) {
      ctx.beginPath();
      ctx.arc(mx(selected.x), my(selected.y), 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#f5f6ff";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }
  function paintArrivals(time) {
    if (!arrivals || !motion || reduced.matches) return;
    const t = (time - arrivals.at) / 610;
    if (t >= 1) {
      arrivals = null;
      return;
    }
    for (const n of arrivals.nodes) {
      if (!visibleSet.has(n.id)) continue;
      ctx.beginPath();
      ctx.arc(
        sx(n.x),
        sy(n.y),
        radius(n) + 2 + Math.max(0, t) * 6,
        0,
        2 * Math.PI,
      );
      ctx.strokeStyle = rgba(color(n), 0.54 * (1 - t));
      ctx.lineWidth = 0.85;
      ctx.stroke();
    }
    requestPaint();
  }
  function labels(reserved, activeNode, mini) {
    const selected = selectedNode(),
      used = mini ? [mini] : [];
    if (graph.order) {
      for (const n of visibleNodes) {
        const r = radius(n) + 3;
        used.push({ x: sx(n.x) - r, y: sy(n.y) - r, w: 2 * r, h: 2 * r });
      }
    }
    if (activeNode && visibleSet.has(activeNode.id))
      label(activeNode, used, true);
    if (selected && selected !== activeNode && visibleSet.has(selected.id))
      label(selected, used, true);
    if (!labelsOn) return;
    if (graph.order) {
      const order = graph.order,
        capacity = small() ? 11 : 22;
      const spacing = Math.max(
        1,
        Math.ceil(order.length / (capacity * Math.max(1, viewport.zoom))),
      );
      const endpoints = [order[0], order[order.length - 1]];
      const others = order.filter(
        (n, i) => i % spacing === 0 && !endpoints.includes(n),
      );
      for (const node of [...new Set([...endpoints, ...others])]) {
        if (node !== selected && node !== activeNode && visibleSet.has(node.id))
          label(node, used, false);
      }
      return;
    }
    if (graph.nodes.length >= 36 && colorMode !== "trust") {
      const ranked = graph.clusters
        .slice()
        .sort((a, b) => b.nodes.length - a.nodes.length);
      let added = 0;
      for (const c of ranked) {
        if (
          c.nodes.length < 6 ||
          !c.nodes.some((n) => visibleSet.has(n.id)) ||
          added >= (small() ? 4 : 7)
        )
          continue;
        const f = viewport.fit * viewport.zoom;
        const text = c.name.toUpperCase();
        ctx.font =
          "600 " +
          (small() ? 9 : 10) +
          "px ui-monospace,Menlo,Consolas,monospace";
        const w = ctx.measureText(text).width + 17,
          h = 13;
        const cx = sx(c.x),
          cy = sy(c.y);
        const positions = [
          [-0.29, -0.99],
          [0.05, -0.84],
          [-0.66, 0.82],
          [-0.28, -0.62],
          [0.18, 0.85],
        ];
        const box = positions
          .map(([a, b]) => ({
            x: cx + c.rx * f * a - w * 0.4,
            y: cy + c.ry * f * b * yStretch() - h / 2,
            w,
            h,
          }))
          .find(
            (b) =>
              b.x > 6 &&
              b.y > 5 &&
              b.x + w < viewport.width - 5 &&
              b.y + h < viewport.height - 5 &&
              !overlaps(b, used),
          );
        if (!box) continue;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(7,13,31,.86)";
        ctx.strokeText(text, box.x + 12, box.y + h / 2);
        ctx.fillStyle = rgba(mix(c.rgb, [225, 234, 252], 0.34), 0.91);
        ctx.fillText(text, box.x + 12, box.y + h / 2);
        ctx.fillStyle = rgba(c.rgb, 0.86);
        ctx.fillRect(box.x, box.y + h / 2 - 0.6, 7, 1.2);
        used.push(box);
        added++;
      }
    }
    const room =
      graph.nodes.length < 36
        ? 28
        : Math.min(
            small() ? 14 : 27,
            Math.floor((small() ? 2 : 5) + viewport.zoom * 2.3),
          );
    if (
      !labelOrder ||
      labelOrder.selected !== selected ||
      labelOrder.active !== activeNode
    ) {
      const importance = (node) =>
        (node.input.highlight ? 180 : 0) +
        (reserved.has(node.id) ? 70 : 0) +
        Math.log2(1 + node.degree) * 7 +
        (node.input.weight > 1 ? Math.log2(node.input.weight) : 0);
      const ranked = visibleNodes
        .filter((node) => node !== selected && node !== activeNode)
        .map((node) => ({ node, score: importance(node) }))
        .sort((a, b) => b.score - a.score || a.node.seed - b.node.seed)
        .map((row) => row.node);
      labelOrder = { selected, active: activeNode, ranked };
    }
    const priority = labelOrder.ranked;
    const perGroup = new Map();
    const groupLimit =
      graph.nodes.length >= 36 && viewport.zoom < 1.5
        ? small()
          ? 1
          : 2
        : Infinity;
    let count = 0;
    for (const n of priority) {
      if (count >= room) break;
      if (
        !n.input.highlight &&
        viewport.zoom < 1.5 &&
        graph.nodes.length > 35 &&
        !reserved.has(n.id)
      )
        continue;
      const already = perGroup.get(n.group) || 0;
      if (already >= groupLimit) continue;
      const before = used.length;
      label(n, used, false);
      if (used.length > before) {
        count++;
        perGroup.set(n.group, already + 1);
      }
    }
  }
  function paint(time) {
    if (disposed || !graph || !ctx) return;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    background();
    const sheet = edgeLayer();
    ctx.save();
    ctx.globalAlpha = hoveredId ? 0.76 : 1;
    ctx.drawImage(sheet, 0, 0, viewport.width, viewport.height);
    ctx.restore();
    const active = graph.nodeById.get(hoveredId) || selectedNode();
    const activeLinks = activeEdges(active, time),
      related = new Set();
    for (const e of activeLinks) {
      related.add(e.a.id);
      related.add(e.b.id);
    }
    if (pickedEdge) {
      ctx.save();
      ctx.strokeStyle = rgba(
        mix(
          colorMode === "trust" ? pickedEdge.trust : pickedEdge.rgb,
          [244, 249, 255],
          0.44,
        ),
        0.98,
      );
      ctx.lineWidth = 2;
      ctx.beginPath();
      line(ctx, pickedEdge);
      ctx.stroke();
      pathChevron(ctx, pickedEdge, sx, sy, 0.55);
      ctx.restore();
    }
    for (const n of visibleNodes) {
      const x = sx(n.x),
        y = sy(n.y),
        r = radius(n);
      if (
        x < -20 ||
        y < -20 ||
        x > viewport.width + 20 ||
        y > viewport.height + 20
      )
        continue;
      haloNode(n, x, y, r, n === active);
    }
    selectedMark(selectedNode());
    if (hoveredId && active !== selectedNode()) selectedMark(active);
    const mini = miniBox();
    paintArrivals(time);
    labels(related, active, mini);
    paintMini(mini);
    if (!visibleNodes.length) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#aab9d1";
      ctx.font = "13px system-ui";
      ctx.fillText(
        "No matching nodes",
        viewport.width / 2,
        viewport.height / 2,
      );
    }
  }
  function xy(event) {
    const r = canvas.getBoundingClientRect();
    return [event.clientX - r.left, event.clientY - r.top];
  }
  function pointerdown(e) {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    showEdge(null);
    const [x, y] = xy(e);
    const mini = miniBox();
    if (insideBox(x, y, mini) && pointers.size === 0) {
      canvas.setPointerCapture(e.pointerId);
      miniDrag = { id: e.pointerId, box: mini };
      miniPan(x, y, mini);
      canvas.style.cursor = "crosshair";
      return;
    }
    pointers.set(e.pointerId, [x, y]);
    canvas.setPointerCapture(e.pointerId);
    drag = { x, y, originX: x, originY: y, moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        dist: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      };
      drag.moved = true;
    }
    if (e.pointerType !== "touch") layer.focus({ preventScroll: true });
    canvas.style.cursor = "grabbing";
  }
  function pointermove(e) {
    const [x, y] = xy(e);
    if (miniDrag?.id === e.pointerId) {
      miniPan(x, y, miniDrag.box);
      return;
    }
    if (!pointers.has(e.pointerId)) {
      if (insideBox(x, y, miniBox())) {
        hover("");
        showEdge(null);
        canvas.style.cursor = "crosshair";
        return;
      }
      if (e.pointerType === "mouse" || e.pointerType === "pen") {
        const nextHover = hit(x, y)?.id || "";
        hover(nextHover);
        const edge = nextHover ? null : hitEdge(x, y, e.altKey);
        showEdge(edge, x, y);
        canvas.style.cursor = nextHover
          ? "pointer"
          : edge
            ? "crosshair"
            : "grab";
      }
      return;
    }
    pointers.set(e.pointerId, [x, y]);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()],
        dist = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const f = viewport.fit * viewport.zoom;
      viewport.cx -= (mid[0] - pinch.mid[0]) / f;
      viewport.cy -= (mid[1] - pinch.mid[1]) / (f * yStretch());
      zoomBy(dist / pinch.dist, mid[0], mid[1]);
      pinch = { dist, mid };
      return;
    }
    if (!drag) return;
    if (Math.hypot(x - drag.originX, y - drag.originY) > 3) drag.moved = true;
    if (drag.moved) {
      const f = viewport.fit * viewport.zoom;
      viewport.cx -= (x - drag.x) / f;
      viewport.cy -= (y - drag.y) / (f * yStretch());
      hover("");
      canvas.style.cursor = "grabbing";
      notifyViewport();
      invalidate();
    }
    drag.x = x;
    drag.y = y;
  }
  function pointerup(e) {
    if (miniDrag?.id === e.pointerId) {
      miniDrag = null;
      canvas.style.cursor = "grab";
      requestPaint();
      return;
    }
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = xy(e);
    const tap =
      drag && !drag.moved && pointers.size === 1 && e.type !== "pointercancel";
    pointers.delete(e.pointerId);
    if (tap) {
      const n = hit(x, y);
      if (n) {
        const now = performance.now();
        const twice =
          singleTap && singleTap.id === n.id && now - singleTap.at < 330;
        if (twice) {
          singleTap = null;
          activate(n.id);
        } else {
          singleTap = { id: n.id, at: now };
          userSelect(n.id);
        }
      } else if (e.pointerType === "touch") {
        showEdge(hitEdge(x, y), x, y, true);
      }
    }
    if (pointers.size === 1) {
      const p = [...pointers.values()][0];
      drag = { x: p[0], y: p[1], originX: p[0], originY: p[1], moved: true };
    } else drag = null;
    pinch = null;
    canvas.style.cursor = hoveredId ? "pointer" : "grab";
  }
  function wheel(e) {
    e.preventDefault();
    const [x, y] = xy(e);
    const normalized =
      e.deltaY *
      (e.deltaMode === 1 ? 15 : e.deltaMode === 2 ? viewport.height : 1);
    zoomBy(Math.exp(-clamp(normalized, -140, 140) * 0.0024), x, y);
  }
  function keydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key.toLowerCase() === "e") {
      const related = visibleEdges.filter(
        (edge) => edge.a.id === selectedId || edge.b.id === selectedId,
      );
      if (related.length) {
        e.preventDefault();
        const current = related.indexOf(pickedEdge);
        const index =
          current < 0
            ? 0
            : (current + (e.shiftKey ? -1 : 1) + related.length) %
              related.length;
        const edge = related[index];
        showEdge(
          edge,
          sx((edge.a.x + 2 * edge.cx + edge.b.x) / 4),
          sy((edge.a.y + 2 * edge.cy + edge.b.y) / 4),
          true,
        );
      }
      return;
    }
    if (e.key === "Escape" && pickedEdge) {
      e.preventDefault();
      showEdge(null);
      return;
    }
    if (graph.order && (e.key === "[" || e.key === "]")) {
      e.preventDefault();
      const i = graph.order.findIndex((n) => n.id === selectedId),
        next =
          graph.order[
            clamp(i + (e.key === "[" ? -1 : 1), 0, graph.order.length - 1)
          ];
      if (next) {
        userSelect(next.id);
        if (
          sx(next.x) < 8 ||
          sy(next.y) < 8 ||
          sx(next.x) > viewport.width - 8 ||
          sy(next.y) > viewport.height - 8
        )
          focusNode(next.id);
      }
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      fitVisible();
      return;
    }
    if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      zoomBy(e.key === "-" ? 1 / 1.28 : 1.28);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      activate(selectedId);
      return;
    }
    const directions = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[e.key];
    if (!direction) return;
    e.preventDefault();
    const current = selectedNode();
    if (!current) return;
    let best = null,
      score = Infinity;
    for (const node of visibleNodes) {
      if (node === current) continue;
      const dx = node.x - current.x,
        dy = node.y - current.y,
        along = dx * direction[0] + dy * direction[1],
        across = Math.abs(dx * direction[1] - dy * direction[0]);
      const distance = Math.hypot(dx, dy);
      if (along <= 0 || along / distance < 0.32) continue;
      const cost = distance + across * 2;
      if (cost < score) {
        score = cost;
        best = node;
      }
    }
    if (best) {
      userSelect(best.id);
      if (
        sx(best.x) < 8 ||
        sy(best.y) < 8 ||
        sx(best.x) > viewport.width - 8 ||
        sy(best.y) > viewport.height - 8
      )
        focusNode(best.id);
    }
  }
  const leave = () => {
    if (!drag) {
      hover("");
      showEdge(null);
    }
  };
  const motionPreference = () => {
    motion = !reduced.matches;
    requestPaint();
  };
  const visibility = () => requestPaint();
  const observer = new ResizeObserver(resize);
  observer.observe(layer);
  canvas.addEventListener("pointerdown", pointerdown);
  canvas.addEventListener("pointermove", pointermove);
  canvas.addEventListener("pointerup", pointerup);
  canvas.addEventListener("pointercancel", pointerup);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("wheel", wheel, { passive: false });
  layer.addEventListener("keydown", keydown);
  reduced.addEventListener("change", motionPreference);
  document.addEventListener("visibilitychange", visibility);
  resize();
  setData(data, { selectedId: options.selectedId });
  function setFilter(filter = {}) {
    if ("groups" in filter)
      groups = filter.groups == null ? null : new Set(filter.groups);
    if ("edgeKinds" in filter)
      kinds = filter.edgeKinds == null ? null : new Set(filter.edgeKinds);
    if ("query" in filter)
      query = String(filter.query || "")
        .trim()
        .toLowerCase();
    updateVisible();
  }
  return {
    setData,
    select,
    focus: focusNode,
    fit: fitVisible,
    zoomBy,
    setFilter,
    setStatuses(values = {}) {
      const changed = [];
      for (const n of graph.nodes) {
        const item =
          values instanceof Map
            ? values.get(n.id)
            : Object.hasOwn(values, n.id)
              ? values[n.id]
              : undefined;
        const state =
          (typeof item === "string" ? item : item?.status) || "unreviewed";
        if (n.status === state) continue;
        n.status = state;
        n.trust = rgb(trustColors[state] || trustColors.unreviewed);
        changed.push(n);
      }
      if (!changed.length) return;
      for (const e of graph.edges) e.trust = mix(e.a.trust, e.b.trust);
      if (colorMode === "trust") {
        if (motion && !reduced.matches && changed.length <= 128)
          arrivals = { at: performance.now(), nodes: changed };
        invalidate();
      }
    },
    setTrace(mode = "all") {
      trace = ["all", "upstream", "downstream", "both", "neighbors"].includes(
        mode,
      )
        ? mode
        : "all";
      updateVisible();
    },
    setColorMode(mode) {
      colorMode = mode === "trust" ? "trust" : "group";
      invalidate();
    },
    setLabels(on) {
      labelsOn = Boolean(on);
      requestPaint();
    },
    setMotion(on) {
      motion = Boolean(on);
      requestPaint();
    },
    getPosition(id) {
      const n = graph.nodeById.get(id);
      return n ? { x: sx(n.x), y: sy(n.y) } : null;
    },
    getViewport() {
      return { zoom: viewport.zoom, x: viewport.cx, y: viewport.cy };
    },
    destroy() {
      disposed = true;
      observer.disconnect();
      if (redraw) cancelAnimationFrame(redraw);
      if (frame) cancelAnimationFrame(frame);
      reduced.removeEventListener("change", motionPreference);
      document.removeEventListener("visibilitychange", visibility);
      layer.remove();
    },
  };
}
