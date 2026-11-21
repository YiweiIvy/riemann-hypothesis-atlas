import {baselineNote} from "./data/baseline.mjs";

// Change the context whenever a cited source or the meaning of a reviewable node changes.
export const REVIEW_CONTEXT = 'riemann-atlas/v1/pdf-3fc97784b71ddd44ff8aa0a177e99622a1c61b13cfa843a0989ee4a7a0cfeb8d/lean-2f097b744a6460c73f3e4cc550baa83698409876';
export const REVIEW_SCHEMA = 'riemann-atlas/reviews-v1';

const outcomes = new Set(['support', 'challenge', 'inconclusive', 'withdrawn']);
const reviewFields = new Set(['id', 'nodeId', 'group', 'outcome', 'note', 'source', 'at', 'supersedes']);
const nodeIdLimit = 4096;

function required(value, name, limit) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new Error(`Invalid ${name}. Enter 1 to ${limit} characters.`);
  }
  return value.trim();
}

function validateReview(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid review format');
  for (const key of Object.keys(input)) {
    if (!reviewFields.has(key)) throw new Error(`Unknown review field ${key}`);
  }
  const at = required(input.at, 'at', 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(at) || !Number.isFinite(Date.parse(at))) {
    throw new Error('Use an ISO timestamp with a time zone');
  }
  const date = at.slice(0, 10);
  if (new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date || Number(at.slice(11, 13)) > 23) {
    throw new Error('Invalid ISO date or hour');
  }
  if (!outcomes.has(input.outcome)) throw new Error('Unknown review outcome');
  const supersedes = input.supersedes === undefined ? undefined : required(input.supersedes, 'supersedes', 180);
  if (input.outcome === 'withdrawn' && !supersedes) throw new Error('A withdrawal must identify its original review');
  return {
    id: required(input.id, 'id', 180),
    nodeId: required(input.nodeId, 'nodeId', nodeIdLimit),
    group: required(input.group, 'group', 250).normalize('NFKC').replace(/\s+/g, ' ').toLowerCase(),
    outcome: input.outcome,
    note: baselineNote(input.id, required(input.note, 'note', 8000)),
    source: required(input.source, 'source', 2000),
    at: new Date(at).toISOString(),
    ...(supersedes ? {supersedes} : {}),
  };
}

export function createReview(input) {
  return validateReview({
    ...input,
    id: input.id ?? globalThis.crypto.randomUUID(),
    at: input.at ?? new Date().toISOString(),
  });
}

function orderReviews(a, b) {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function mergeReviews(...collections) {
  const unique = new Map();
  for (const collection of collections) {
    if (!Array.isArray(collection)) throw new Error('Missing review array');
    for (const input of collection) {
      const review = validateReview(input);
      const existing = unique.get(review.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(review)) {
        throw new Error(`Conflicting review ID ${review.id}. Check both records.`);
      }
      unique.set(review.id, review);
    }
  }
  const replaced = new Set();
  for (const review of unique.values()) {
    if (!review.supersedes) continue;
    const prior = unique.get(review.supersedes);
    if (!prior) throw new Error(`Missing original review ${review.supersedes}`);
    if (prior.nodeId !== review.nodeId || prior.group !== review.group) throw new Error('A correction must keep the original node and original evidence group');
    if (prior.at >= review.at) throw new Error('A correction must be later than its original review');
    if (replaced.has(prior.id)) throw new Error(`Forked correction for review ${prior.id}`);
    replaced.add(prior.id);
  }
  return [...unique.values()].sort(orderReviews);
}

export function enforceReviewOwnership(local, published) {
  const protectedIds = new Set(published.map(review => review.id));
  const combined = mergeReviews(published, local);
  for (const review of combined) {
    if (!protectedIds.has(review.id) && protectedIds.has(review.supersedes)) {
      throw new Error('Published reviews are immutable. Add a separate review with a citation.');
    }
  }
  return combined;
}

export function exportReviews(reviews, context = REVIEW_CONTEXT) {
  return JSON.stringify({schema: REVIEW_SCHEMA, context, reviews: mergeReviews(reviews)}, null, 2) + '\n';
}

export function importReviews(json, context = REVIEW_CONTEXT, allowedNodeIds) {
  const envelope = typeof json === 'string' ? JSON.parse(json) : json;
  if (envelope?.schema !== REVIEW_SCHEMA) throw new Error('Unsupported review file format');
  if (envelope.context !== context) throw new Error('Source snapshot mismatch');
  const records = mergeReviews(envelope.reviews);
  if (allowedNodeIds !== undefined) {
    const ids = allowedNodeIds instanceof Set ? allowedNodeIds : new Set(allowedNodeIds);
    for (const record of records) {
      if (!ids.has(record.nodeId)) throw new Error(`Unknown node ${record.nodeId}`);
    }
  }
  return records;
}

const emptyCounts = () => ({support: 0, challenge: 0, inconclusive: 0, mixed: 0, total: 0});
function groupOutcome(tally) {
  if (tally.support && tally.challenge) return 'mixed';
  if (tally.support) return 'support';
  if (tally.challenge) return 'challenge';
  return tally.inconclusive ? 'inconclusive' : null;
}

function adjustObservation(trackers, review, delta) {
  if (review.outcome === 'withdrawn') return;
  let tracker = trackers.get(review.nodeId);
  if (!tracker) {
    tracker = {groups: new Map(), seenGroups: new Set(), counts: emptyCounts()};
    trackers.set(review.nodeId, tracker);
  }
  tracker.seenGroups.add(review.group);
  const tally = tracker.groups.get(review.group) ?? {support: 0, challenge: 0, inconclusive: 0};
  const old = groupOutcome(tally);
  tally[review.outcome] += delta;
  const next = groupOutcome(tally);
  if (next) tracker.groups.set(review.group, tally);
  else tracker.groups.delete(review.group);
  if (old === next) return;
  if (old) { tracker.counts[old]--; tracker.counts.total--; }
  if (next) { tracker.counts[next]++; tracker.counts.total++; }
}

function replay(trackers, byReviewId, review) {
  if (review.supersedes) adjustObservation(trackers, byReviewId.get(review.supersedes), -1);
  adjustObservation(trackers, review, 1);
}

function directStatus(counts) {
  if (counts.mixed || (counts.challenge && counts.support)) return 'mixed';
  if (counts.challenge) return 'challenged';
  if (counts.support) return 'supported';
  return counts.total ? 'inconclusive' : 'unreviewed';
}

// Iterative Kosaraju traversal handles deep dependency chains without call-stack recursion.
function dependencyOrder(byId) {
  const inverse = new Map();
  for (const id of byId.keys()) inverse.set(id, []);
  for (const node of byId.values()) {
    for (const dep of node.dependsOn) inverse.get(dep)?.push(node.id);
  }
  const seen = new Set();
  const finished = [];
  for (const root of byId.keys()) {
    if (seen.has(root)) continue;
    seen.add(root);
    const stack = [{id: root, index: 0}];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const deps = byId.get(frame.id).dependsOn;
      if (frame.index === deps.length) {
        finished.push(frame.id);
        stack.pop();
      } else {
        const dep = deps[frame.index++];
        if (byId.has(dep) && !seen.has(dep)) {
          seen.add(dep);
          stack.push({id: dep, index: 0});
        }
      }
    }
  }
  const visited = new Set();
  const components = [];
  while (finished.length) {
    const root = finished.pop();
    if (visited.has(root)) continue;
    visited.add(root);
    const component = [];
    const queue = [root];
    while (queue.length) {
      const id = queue.pop();
      component.push(id);
      for (const dependent of inverse.get(id)) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          queue.push(dependent);
        }
      }
    }
    components.push(component);
  }
  return components.reverse();
}

function compileGraph(nodes) {
  const byId = new Map();
  for (const node of nodes) {
    const id = required(node.id, 'node.id', nodeIdLimit);
    if (byId.has(id)) throw new Error(`Duplicate node ID ${id}`);
    const deps = node.dependsOn ?? [];
    if (!Array.isArray(deps)) throw new Error(`Invalid prerequisites ${id}`);
    const omitted = node.omitted ?? 0;
    if (!Number.isSafeInteger(omitted) || omitted < 0) throw new Error(`Invalid omitted reference count ${id}`);
    byId.set(id, {
      id, dependsOn: [...new Set(deps.map(dep => required(dep, 'dependsOn', nodeIdLimit)))],
      blocker: node.blocker ? required(node.blocker, 'blocker', 8000) : '', omitted,
    });
  }
  return {byId, components: dependencyOrder(byId)};
}

function evaluateCompiled(graph, trackers) {
  const result = Object.create(null);
  for (const component of graph.components) {
    const peers = new Set(component);
    for (const id of component) {
      const node = graph.byId.get(id);
      const counts = {...(trackers.get(id)?.counts ?? emptyCounts())};
      const direct = directStatus(counts);
      const blockers = [];
      const pendingDependencies = [];
      if (node.blocker) blockers.push({kind: 'premise', nodeId: id, origin: id, detail: node.blocker});
      if (peers.size > 1 || node.dependsOn.includes(id)) {
        blockers.push({kind: 'cycle', nodeId: id, origin: id, members: component, detail: 'Dependency cycle'});
      }
      for (const dep of node.dependsOn) {
        if (peers.has(dep)) continue;
        const upstream = result[dep];
        if (!upstream) {
          blockers.push({kind: 'missing', nodeId: dep, origin: dep, detail: 'Missing prerequisite'});
        } else if (upstream.status === 'blocked') {
          blockers.push({kind: 'dependency', nodeId: dep, origin: upstream.blockers[0].origin, detail: 'Blocked prerequisite'});
        } else if (['challenged', 'mixed'].includes(upstream.status)) {
          blockers.push({kind: 'review', nodeId: dep, origin: dep, detail: 'Disputed prerequisite'});
        } else if (upstream.status !== 'supported') {
          pendingDependencies.push(dep);
        }
      }
      let status = direct;
      if (blockers.length) status = 'blocked';
      else if (direct === 'supported' && (pendingDependencies.length || node.omitted)) status = 'inconclusive';
      const decided = counts.support + counts.challenge;
      result[id] = {
        status, directStatus: direct, blockers, pendingDependencies, omitted: node.omitted, counts,
        cumulativeGroups: trackers.get(id)?.seenGroups.size ?? 0,
        score: decided ? counts.support / decided : null,
        // Bounds include mixed and inconclusive groups as unresolved support shares.
        supportRange: counts.total ? [counts.support / counts.total, (counts.total - counts.challenge) / counts.total] : null,
      };
    }
  }
  return result;
}

export function evaluateGraph(nodes, reviews = []) {
  const graph = compileGraph(nodes);
  const trackers = new Map();
  const ordered = mergeReviews(reviews);
  const byReviewId = new Map(ordered.map(review => [review.id, review]));
  for (const review of ordered) {
    if (graph.byId.has(review.nodeId)) replay(trackers, byReviewId, review);
  }
  return evaluateCompiled(graph, trackers);
}

export function reviewHistory(nodes, reviews, nodeId) {
  const graph = compileGraph(nodes);
  if (!graph.byId.has(nodeId)) throw new Error(`Unknown node ${nodeId}`);
  const ancestors = new Set([nodeId]);
  const stack = [nodeId];
  while (stack.length) {
    for (const dep of graph.byId.get(stack.pop()).dependsOn) {
      if (graph.byId.has(dep) && !ancestors.has(dep)) {
        ancestors.add(dep);
        stack.push(dep);
      }
    }
  }
  const relevant = {byId: graph.byId, components: graph.components.filter(ids => ancestors.has(ids[0]))};
  const trackers = new Map();
  const history = [];
  const ordered = mergeReviews(reviews);
  const byReviewId = new Map(ordered.map(review => [review.id, review]));
  for (const record of ordered) {
    if (!ancestors.has(record.nodeId)) continue;
    replay(trackers, byReviewId, record);
    const {status, score, counts, supportRange, cumulativeGroups} = evaluateCompiled(relevant, trackers)[nodeId];
    history.push({at: record.at, id: record.id, status, score, counts, supportRange, cumulativeGroups});
  }
  return history;
}
