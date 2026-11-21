import { NODES } from "./data/atlas.mjs";
import { landmarks } from "./landmarks.mjs";

export const families = [
  {
    name: "Main results",
    color: "#9ba5ff",
    test: (p) => /^src\/(Main\.lean|Statements\.lean|Supplements\/)/.test(p),
  },
  {
    name: "Theta lifts",
    color: "#d186ff",
    test: (p) => p.includes("/ThetaCorrespondence/"),
  },
  {
    name: "Galois theory",
    color: "#60e2f0",
    test: (p) =>
      p.includes("/Foundations/") ||
      p.includes("/ReciprocityTheory/") ||
      p.includes("/GroundTheory/"),
  },
  {
    name: "Abelian varieties",
    color: "#72a0ff",
    test: (p) => p.includes("/AbelianVarietyTheory/"),
  },
  {
    name: "Prime estimates",
    color: "#ffbd70",
    test: (p) =>
      /WeilBound|CharacterBoxes|PrimitiveCosets|MeanSquareBounds|DedekindLFunctions/.test(
        p,
      ),
  },
  {
    name: "Analytic formalism",
    color: "#75e6ac",
    test: (p) => p.includes("/Formalism/"),
  },
  { name: "Other arithmetic", color: "#f590ad", test: () => true },
];
export const familyOf = (file) => families.find((f) => f.test(file ?? ""));
const book = new Map(
  NODES.flatMap((node) => node.leanIds.map((id) => [id, node])),
);
export const topicFor = (id) => book.get(id);
export const targetNames = {
  riemannHypothesis: "Riemann hypothesis",
  riemannZeta_eq_zero_re: "Zeta zeros on the critical line",
  LFunction_ne_zero_of_half_lt_re: "Zero-free half-plane",
  LFunction_eq_zero_re: "Dirichlet zeros on the line",
  LFunction_eq_zero_re_of_isPrimitive: "Primitive Dirichlet zeros",
};
export function declarationNode(row) {
  const source = row.kind === "declaration",
    id = source ? row.name : row.id,
    topic = topicFor(id),
    family = familyOf(row.file);
  const landmark = Object.hasOwn(landmarks, id) ? landmarks[id] : null;
  const target = Object.hasOwn(targetNames, id);
  const title =
    landmark?.label ??
    (topic?.leanId === id ? topic.title : id.split(".").at(-1));
  return {
    id,
    label: title,
    short: title,
    group: family.name,
    color: family.color,
    highlight: target || topic?.leanId === id,
    weight: target ? 5 : topic?.leanId === id ? 3 : 1,
    note: landmark?.note,
    file: row.file,
    line: row.line,
    url: row.url,
    raw: row,
    kind: source ? row.declKind : row.kind,
    corpusId: source ? row.id : null,
    reviewId: "lean:" + id,
  };
}
export function baseGraph(index) {
  return {
    nodes: index.nodes.map(declarationNode),
    edges: index.nodes.flatMap((n) =>
      n.deps.map((dep, i) => ({ from: n.id, to: dep, kind: n.refKinds[i] })),
    ),
  };
}
export function routeGraph() {
  const palette = {
    result: "#ac9cff",
    analysis: "#62dce5",
    arithmetic: "#f3b778",
  };
  return {
    nodes: NODES.map((n) => ({
      id: n.id,
      label: n.title,
      short: n.title,
      group: n.section,
      color: palette[n.section],
      kind: "Proof step",
      weight: 3,
      highlight: true,
      reviewId: n.id,
      topic: n,
    })),
    edges: NODES.flatMap((n) =>
      n.dependsOn.map((d) => ({ from: n.id, to: d, kind: "step" })),
    ),
  };
}
export function extendGraph(graph, more) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n])),
    edges = new Map(graph.edges.map((e) => [e.from + "\n" + e.to, e]));
  for (const node of more.nodes)
    nodes.set(node.id, { ...nodes.get(node.id), ...node });
  for (const edge of more.edges) edges.set(edge.from + "\n" + edge.to, edge);
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
export function sliceCounts(graph, id) {
  let deps = 0,
    callers = 0;
  for (const edge of graph.edges) {
    if (edge.from === id) deps++;
    if (edge.to === id) callers++;
  }
  return { deps, callers };
}

// Each edge in the returned sequence is an observed, directed reference.
export function shortestReferencePath(graph, start, end) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodes.has(start) || !nodes.has(end)) return null;
  const outgoing = new Map();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge);
  }
  const queue = [start],
    parent = new Map([[start, null]]);
  for (let i = 0; i < queue.length && !parent.has(end); i++) {
    for (const edge of outgoing.get(queue[i]) ?? []) {
      if (parent.has(edge.to)) continue;
      parent.set(edge.to, edge);
      queue.push(edge.to);
    }
  }
  if (!parent.has(end)) return null;
  const edges = [];
  for (let id = end; id !== start; ) {
    const edge = parent.get(id);
    edges.push(edge);
    id = edge.from;
  }
  edges.reverse();
  return {
    edges,
    nodes: [nodes.get(start), ...edges.map((e) => nodes.get(e.to))],
  };
}
