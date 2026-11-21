import { AUTHOR_ROUTE, NODES } from "./data/atlas.mjs";

const keyOf = (name) => "lean:" + name;
const linkKinds = new Set(["type", "value", "both"]);
const count = (n) => Number.isSafeInteger(n) && n >= 0;

export function createAuditRegistry(index, corpus) {
  const sample = new Set(index.nodes.map((n) => n.id));
  const formal = NODES.map((node) => {
    const links = [node.leanId];
    if (node.id === "rh") links.push("riemannZeta_eq_zero_re");
    if (node.id === "every") links.push("LFunction_ne_zero_of_half_lt_re");
    return {
      ...node,
      dependsOn: [...node.dependsOn, ...links.filter((id) => sample.has(id)).map(keyOf)],
    };
  });
  const nodes = [...formal, ...AUTHOR_ROUTE];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const eligibleIds = new Set(byId.keys());
  const aliases = new Map();
  const totals = new Map();
  const dependencies = new Map();
  const hydrated = new Set();
  const pending = new Map();

  function declare(name, row, total) {
    const id = keyOf(name);
    let changed = false;
    if (!byId.has(id)) {
      const node = {
        id, title: name, section: "lean", dependsOn: [], omitted: total,
        sources: [{label: `${row.file} · L${row.line}`, url: row.url}],
        question: "Check the statement, proof body and direct references.",
      };
      nodes.push(node);
      byId.set(id, node);
      eligibleIds.add(id);
      dependencies.set(id, new Set());
      aliases.set(name, id);
      aliases.set(id, id);
      changed = true;
    }
    if (total > (totals.get(id) ?? -1)) {
      totals.set(id, total);
      byId.get(id).omitted = total - dependencies.get(id).size;
      changed = true;
    }
    return changed;
  }

  function reference(from, to) {
    const refs = dependencies.get(from);
    if (!refs || !dependencies.has(to) || refs.has(to)) return false;
    if (refs.size >= totals.get(from)) throw new Error(`Reference count exceeds the source index for ${from}`);
    refs.add(to);
    const node = byId.get(from);
    node.dependsOn.push(to);
    node.omitted = totals.get(from) - refs.size;
    return true;
  }

  for (const row of index.nodes) {
    declare(row.id, row, new Set(row.deps).size + row.omitted);
  }
  for (const row of index.nodes) {
    for (const dep of row.deps) reference(keyOf(row.id), keyOf(dep));
  }

  // Corpus rows carry the full degree. Group membership and directory flows
  // never count as proof dependencies, even when their endpoints are visible.
  function registerGraph(graphNodes, edges) {
    let changed = false;
    for (const item of graphNodes) {
      const row = item.full?.kind === "declaration" ? item.full : item.raw ?? item;
      if (row.kind !== "declaration" || typeof row.name !== "string" || !count(row.deps) || !count(row.omittedProjectRefs)) continue;
      if (declare(row.name, row, row.deps + row.omittedProjectRefs)) changed = true;
      aliases.set(row.id, keyOf(row.name));
    }
    for (const edge of edges) {
      if (!linkKinds.has(edge.kind)) continue;
      if (reference(aliases.get(edge.from), aliases.get(edge.to))) changed = true;
    }
    return changed;
  }

  async function resolveReview(id) {
    const name = id.slice(5);
    const row = await corpus.find(name);
    if (!row || row.name !== name) throw new Error(`Unknown review node ${id}`);
    const path = await corpus.pathToTarget(row.id);
    // Generated constants can interrupt the source-only path. Preserve the
    // reviewed declaration without inventing a connection to a headline.
    if (path) {
      registerGraph(path.items, path.edges);
      for (const item of path.items) hydrated.add(keyOf(item.name));
    } else {
      registerGraph([row], []);
      hydrated.add(id);
    }
    return byId.get(id);
  }

  async function ensureReview(id) {
    if (byId.has(id) && (!id.startsWith("lean:") || hydrated.has(id))) return byId.get(id);
    if (typeof id !== "string" || !id.startsWith("lean:") || id.length === 5) throw new Error(`Unknown review node ${id}`);
    if (!pending.has(id)) pending.set(id, resolveReview(id).finally(() => pending.delete(id)));
    return pending.get(id);
  }

  async function allowReviews(records) {
    const ids = [...new Set(records.map((r) => r.nodeId))];
    for (let i = 0; i < ids.length; i += 8) await Promise.all(ids.slice(i, i + 8).map(ensureReview));
    return eligibleIds;
  }

  return {nodes, byId, eligibleIds, registerGraph, ensureReview, allowReviews};
}
