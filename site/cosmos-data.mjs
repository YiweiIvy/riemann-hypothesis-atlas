// Static, lazy reader for James Shore's source-backed five-target cone.
// Both the hosted edition and the offline document use exactly the same shards.
const utf8 = new TextDecoder();
const encoder = new TextEncoder();
const pad = (value, digits = 4) => String(value).padStart(digits, "0");
const idOf = (n) => "d:" + n;
const viaName = ["", "type", "value", "both"];

function lowerBound(array, needle, valueOf) {
  let lo = 0,
    hi = array.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (valueOf(array[mid]) < needle) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function prefixEnd(prefix) {
  for (let i = prefix.length - 1; i >= 0; i--) {
    const unit = prefix.charCodeAt(i);
    if (unit < 65535) return prefix.slice(0, i) + String.fromCharCode(unit + 1);
  }
  return null;
}

function dirBucket(path, n) {
  let hash = 2166136261;
  for (const byte of encoder.encode(path))
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash % n;
}

function windowOf(offset, limit) {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 2048
  )
    throw new RangeError(
      "Expected a nonnegative offset and a limit between 1 and 2,048.",
    );
}

function result(items, total, offset) {
  return { items, total, offset, hasMore: offset + items.length < total };
}

function declNumber(id) {
  return typeof id === "number" && Number.isSafeInteger(id)
    ? id
    : typeof id === "string" && /^d:\d+$/.test(id)
      ? Number(id.slice(2))
      : -1;
}

function readInt(data, cursor) {
  let value = 0,
    shift = 0;
  while (cursor.at < data.length && shift <= 28) {
    const octet = data[cursor.at++];
    value += (octet & 127) * 2 ** shift;
    if (octet < 128) return value;
    shift += 7;
  }
  throw new Error("Invalid declaration reference shard.");
}

// The short offset table is computed once per adjacency shard, so jumping to
// a declaration never requires expanding the neighbors of all earlier nodes.
function edgeBlock(data) {
  const offsets = [];
  const cursor = { at: 0 };
  while (cursor.at < data.length) {
    offsets.push(cursor.at);
    const n = readInt(data, cursor);
    for (let i = 0; i < n; i++) readInt(data, cursor);
  }
  return { data, offsets };
}

async function browserRead(name) {
  const inline = globalThis.document?.getElementById("cosmos-" + name);
  if (inline)
    return Uint8Array.from(atob(inline.textContent.trim()), (ch) =>
      ch.charCodeAt(0),
    );
  const base = new URL("./data/cosmos/", document.baseURI);
  const response = await fetch(new URL(name, base));
  if (!response.ok) throw new Error("Corpus shard unavailable: " + name);
  return new Uint8Array(await response.arrayBuffer());
}

async function inflate(raw) {
  if (raw[0] !== 31 || raw[1] !== 139) return raw; // Already decoded by the host.
  const stream = new Blob([raw])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function memo(limit) {
  const values = new Map();
  return function get(key, produce) {
    if (values.has(key)) {
      const hit = values.get(key);
      values.delete(key);
      values.set(key, hit);
      return hit;
    }
    const pending = Promise.resolve().then(produce);
    values.set(key, pending);
    pending.catch(() => {
      if (values.get(key) === pending) values.delete(key);
    });
    if (values.size > limit) values.delete(values.keys().next().value);
    return pending;
  };
}

export async function openCosmos({ manifest, readBytes = browserRead } = {}) {
  if (!manifest) {
    const inline = globalThis.document?.getElementById("data-cosmos-manifest");
    manifest = inline
      ? JSON.parse(inline.textContent)
      : JSON.parse(utf8.decode(await readBytes("manifest.json")));
  }
  if (manifest.schema !== 1) throw new Error("Unrecognized graph release.");
  const { blockSize, nodeCount } = manifest;
  const cache = memo(96);
  const regionOf = (path) => path.split("/").slice(0, 2).join("/");
  const shard = (name) =>
    cache(name, async () => {
      const bytes = await inflate(await readBytes(name));
      return name.endsWith(".bin.gz")
        ? edgeBlock(bytes)
        : JSON.parse(utf8.decode(bytes));
    });
  const chunk = (name, i, ext = "json") =>
    shard(name + "-" + pad(i) + "." + ext + ".gz");
  function entry(path, [name, tag, count, files, first]) {
    const id = path + "/" + name;
    return {
      id,
      path: id,
      name,
      count,
      files,
      first,
      region: regionOf(id),
      kind: tag === "d" ? "directory" : "file",
    };
  }

  async function dirRows(path) {
    const buckets = await shard(
      "dirs-" + pad(dirBucket(path, manifest.dirBuckets), 2) + ".json.gz",
    );
    return Object.hasOwn(buckets, path) ? buckets[path] : null;
  }

  async function getDecl(num) {
    if (!Number.isSafeInteger(num) || num < 0 || num >= nodeCount) return null;
    const [paths, rows] = await chunk("nodes", Math.floor(num / blockSize));
    const [
      name,
      kind,
      f,
      line,
      endLine,
      deps,
      callers,
      typeRefs,
      valueRefs,
      omittedProjectRefs = 0,
      witness = 0,
      targetMask = 0,
      distance = 0,
    ] = rows[num % blockSize];
    const file = paths[f];
    return {
      id: idOf(num),
      name,
      kind: "declaration",
      declKind: manifest.kinds[kind],
      file,
      line,
      endLine,
      deps,
      callers,
      typeRefs,
      valueRefs,
      omittedProjectRefs,
      targetMask,
      rootDistance: targetMask ? distance : null,
      pathParent: witness ? idOf(Math.floor(witness / 4) - 1) : null,
      pathKind: viaName[witness % 4] || null,
      region: regionOf(file),
      url:
        manifest.sourceUrl +
        file.split("/").map(encodeURIComponent).join("/") +
        "#L" +
        line +
        "-L" +
        endLine,
    };
  }

  async function get(id) {
    if (id === "src")
      return {
        id: "src",
        name: "Source",
        path: "src",
        kind: "directory",
        count: nodeCount,
        files: manifest.fileCount,
      };
    if (typeof id === "string" && id.startsWith("src/")) {
      const split = id.lastIndexOf("/"),
        parent = id.slice(0, split),
        name = id.slice(split + 1);
      const row = (await dirRows(parent))?.find((row) => row[0] === name);
      return row ? entry(parent, row) : null;
    }
    return getDecl(declNumber(id));
  }

  async function list(path = "src", { offset = 0, limit = 60 } = {}) {
    windowOf(offset, limit);
    if (path.endsWith(".lean")) {
      const file = await get(path);
      if (!file) return result([], 0, offset);
      const n = Math.max(0, Math.min(limit, file.count - offset));
      const items = await Promise.all(
        Array.from({ length: n }, (_, i) => getDecl(file.first + offset + i)),
      );
      return result(items, file.count, offset);
    }
    const rows = (await dirRows(path)) || [];
    return result(
      rows.slice(offset, offset + limit).map((row) => entry(path, row)),
      rows.length,
      offset,
    );
  }

  async function neighbors(
    id,
    { direction = "deps", offset = 0, limit = 40 } = {},
  ) {
    windowOf(offset, limit);
    if (!["deps", "callers"].includes(direction))
      throw new Error("Unknown reference direction.");
    const num = declNumber(id);
    if (num < 0 || num >= nodeCount) return result([], 0, offset);
    const { offsets, data } = await chunk(
      direction,
      Math.floor(num / blockSize),
      "bin",
    );
    const cursor = { at: offsets[num % blockSize] };
    const total = readInt(data, cursor),
      hits = [];
    let n = 0;
    for (let i = 0; i < Math.min(total, offset + limit); i++) {
      const packed = readInt(data, cursor);
      n += Math.floor(packed / 4);
      if (i >= offset) hits.push([n, viaName[packed % 4]]);
    }
    const items = await Promise.all(
      hits.map(async ([id, via]) => ({ ...(await getDecl(id)), via })),
    );
    return result(items, total, offset);
  }

  async function position(name) {
    if (name === null) return nodeCount;
    const s = lowerBound(manifest.searchBounds, name, (r) => r[1]);
    if (s === manifest.searchBounds.length) return nodeCount;
    const table = await chunk("names", s);
    return s * blockSize + lowerBound(table, name, (r) => r[0].toLowerCase());
  }
  async function range(begin, end) {
    const out = [];
    while (begin < end) {
      const block = Math.floor(begin / blockSize);
      const rows = await chunk("names", block);
      const n = Math.min(end - begin, rows.length - (begin % blockSize));
      out.push(...rows.slice(begin % blockSize, (begin % blockSize) + n));
      begin += n;
    }
    return out;
  }
  async function search(prefix, { offset = 0, limit = 30 } = {}) {
    windowOf(offset, limit);
    const q = String(prefix).trim().toLowerCase();
    const [lo, hi] = await Promise.all([position(q), position(prefixEnd(q))]);
    const rows = await range(
      Math.min(hi, lo + offset),
      Math.min(hi, lo + offset + limit),
    );
    return result(
      await Promise.all(rows.map((row) => getDecl(row[1]))),
      hi - lo,
      offset,
    );
  }

  async function find(name) {
    if (typeof name !== "string" || !name) return null;
    const q = name.toLowerCase(),
      start = await position(q);
    for (let i = start; i < nodeCount; ) {
      const part = await range(i, Math.min(i + 16, nodeCount));
      for (const [candidate, id] of part) {
        if (candidate === name) return getDecl(id);
        if (candidate.toLowerCase() !== q) return null;
      }
      i += part.length;
    }
    return null;
  }

  async function pathToTarget(id) {
    const first = await getDecl(declNumber(id));
    if (!first || !first.targetMask) return null;
    const items = [first],
      edges = [];
    let current = first;
    while (current.pathParent) {
      const parent = await getDecl(declNumber(current.pathParent));
      if (!parent || parent.rootDistance !== current.rootDistance - 1)
        throw new Error("Witness path is inconsistent with the pinned graph.");
      edges.push({ from: parent.id, to: current.id, kind: current.pathKind });
      items.push(parent);
      current = parent;
    }
    return {
      items: items.reverse(),
      edges: edges.reverse(),
      root: current.id,
      targetMask: first.targetMask,
    };
  }

  async function flows(path = "src", { limit = 128, visibleIds } = {}) {
    windowOf(0, limit);
    const eligible = visibleIds ? new Set(visibleIds) : null;
    if (path.endsWith(".lean")) {
      const file = await get(path);
      if (!file) return { links: [], total: 0, omitted: 0 };
      const links = [];
      let total = 0;
      const end = file.first + file.count;
      for (let n = file.first; n < end; n++) {
        if (eligible && !eligible.has(idOf(n))) continue;
        const { data, offsets } = await chunk(
          "deps",
          Math.floor(n / blockSize),
          "bin",
        );
        const cursor = { at: offsets[n % blockSize] };
        const count = readInt(data, cursor);
        let neighbor = 0;
        for (let j = 0; j < count; j++) {
          const packed = readInt(data, cursor);
          neighbor += Math.floor(packed / 4);
          if (neighbor < file.first) continue;
          if (neighbor >= end) break;
          if (eligible && !eligible.has(idOf(neighbor))) continue;
          total++;
          if (links.length < limit)
            links.push({
              source: idOf(n),
              target: idOf(neighbor),
              type: packed & 1,
              value: (packed >> 1) & 1,
            });
        }
      }
      return { links, total, omitted: total - links.length };
    }
    const buckets = await shard(
      "flows-" + pad(dirBucket(path, manifest.dirBuckets), 2) + ".json.gz",
    );
    const rows = Object.hasOwn(buckets, path) ? buckets[path][1] : [];
    const eligibleRows = eligible
      ? rows.filter(
          ([a, b]) =>
            eligible.has(path + "/" + a) && eligible.has(path + "/" + b),
        )
      : rows;
    const total = eligibleRows.length;
    const links = eligibleRows.slice(0, limit).map(([a, b, type, value]) => ({
      source: path + "/" + a,
      target: path + "/" + b,
      type,
      value,
    }));
    return { links, total, omitted: total - links.length };
  }

  return {
    meta: manifest,
    list,
    neighbors,
    get,
    find,
    search,
    pathToTarget,
    flows,
  };
}
