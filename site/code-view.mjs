import { NODES } from "./data/atlas.mjs";

const targets = [
  ["riemannHypothesis", "Riemann hypothesis"],
  ["riemannZeta_eq_zero_re", "RH, expanded"],
  ["LFunction_ne_zero_of_half_lt_re", "Zero-free half-plane"],
  ["LFunction_eq_zero_re", "All characters"],
  ["LFunction_eq_zero_re_of_isPrimitive", "Primitive characters"],
];
const targetLabels = new Map(targets);
const teaching = new Map(
  NODES.flatMap((node) => node.leanIds.map((id) => [id, node])),
);
const typeLabels = {
  theorem: "Theorem",
  def: "Definition",
  axiom: "Axiom",
  opaque: "Opaque",
  inductive: "Inductive",
  constructor: "Constructor",
  recursor: "Recursor",
  instance: "Instance",
  structure: "Structure",
};
const kinds = { type: "Type", value: "Body", both: "Type + body" };
const dataset =
  "https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2";
const indexCache = new WeakMap();
const searchBatch = 18;
const displayCount = (n) => Number(n).toLocaleString("en-US");

function escape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function sourceHref(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "github.com")
      return escape(url.href);
  } catch {}
  return "";
}

function getIndex(index) {
  if (indexCache.has(index)) return indexCache.get(index);
  const byId = new Map(index.nodes.map((node) => [node.id, node]));
  const back = new Map();
  const searchable = index.nodes.map((node) => {
    node.deps.forEach((dependency, i) => {
      if (!back.has(dependency)) back.set(dependency, []);
      back.get(dependency).push({ id: node.id, via: node.refKinds[i] });
    });
    const topic = teaching.get(node.id);
    const text = [
      node.id,
      node.file,
      targetLabels.get(node.id),
      topic?.title,
      topic?.english,
      typeLabels[node.kind],
      node.kind,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return { id: node.id, text };
  });
  const result = { byId, back, searchable };
  indexCache.set(index, result);
  return result;
}

function targetLinks(index, selected) {
  return index.roots
    .map((id) => {
      const active = id === selected ? ' aria-current="true"' : "";
      return `<button type="button" data-action="code-node" data-id="${escape(id)}"${active}>${escape(targetLabels.get(id) || id)}</button>`;
    })
    .join("");
}

function nodeLinks(links, hasEdge = true) {
  return links
    .map(
      ({ id, via }) => `<li>
    <button type="button" data-action="code-node" data-id="${escape(id)}">
      <span class="cv-ref-name">${escape(id)}</span>
      ${hasEdge ? `<small>${escape(kinds[via] || "Reference")}</small>` : ""}
    </button></li>`,
    )
    .join("");
}

function resultList(catalog, search, limit) {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const matches = catalog.searchable.filter((row) =>
    words.every((word) => row.text.includes(word)),
  );
  matches.sort((a, b) => {
    const exactA = a.id.toLowerCase() === search.trim().toLowerCase();
    const exactB = b.id.toLowerCase() === search.trim().toLowerCase();
    return (
      Number(exactB) - Number(exactA) ||
      a.id.length - b.id.length ||
      a.id.localeCompare(b.id)
    );
  });
  return `<p class="cv-count" role="status">${displayCount(matches.length)} matching ${matches.length === 1 ? 'declaration' : 'declarations'} in the opening view</p>
    ${
      matches.length
        ? `<ul class="cv-list cv-hits">${hitItems(matches.slice(0, limit).map(({id}) => ({...catalog.byId.get(id), name:id})))}</ul>`
        : '<p class="cv-muted">Try a shorter name or a file path.</p>'
    }
    ${matches.length > limit ? `<button type="button" class="cv-more" data-cv-more>Show ${Math.min(searchBatch, matches.length - limit)} more</button>` : ""}`;
}

function renderDeclaration(node, catalog, pages) {
  const title = targetLabels.get(node.id) || teaching.get(node.id)?.title;
  const displayLinks = page => page.items.map(row => ({id: row.name, via: row.via}));
  const back = pages ? displayLinks(pages.callers) : catalog.back.get(node.id) || [];
  const forward = pages ? displayLinks(pages.deps) : node.deps.map((id, i) => ({ id, via: node.refKinds[i] }));
  const omitted = Math.max(0, Number(node.omitted) || 0);
  const url = sourceHref(node.url);
  const kind = typeLabels[node.kind] || node.kind;
  const fullPath = node.file || "";
  const line =
    node.line === node.endLine
      ? String(node.line)
      : `${node.line}–${node.endLine}`;
  const sourceLabel =
    fullPath && node.line ? `${fullPath} · L${line}` : "Pinned source";
  return `<article class="cv-record" aria-label="Selected Lean declaration">
    <div class="cv-ident">
      <p class="cv-kicker"><span class="cv-symbol" aria-hidden="true">λ</span>${escape(kind)}${title ? `<span class="cv-topic">${escape(title)}</span>` : ""}</p>
      <h3 lang="en" dir="ltr">${escape(node.id)}</h3>
      ${url ? `<a class="cv-source" href="${url}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">↗</span> ${escape(sourceLabel)}</a>` : `<p class="cv-source">${escape(sourceLabel)}</p>`}
    </div>
    <div class="cv-record-actions">
      <button type="button" data-action="locate" data-id="${escape(node.id)}">Locate in graph</button>
      <button type="button" data-action="review" data-id="lean:${escape(node.id)}">Add review</button>
      <button type="button" data-action="ledger-node" data-id="lean:${escape(node.id)}">Review history</button>
    </div>
    <div class="cv-relations">
      <header><h4>References</h4><span>${displayCount(pages?.deps.total ?? forward.length)} indexed</span></header>
      ${forward.length ? `<ul class="cv-list cv-branches">${nodeLinks(forward)}</ul>` : '<p class="cv-muted">No outgoing references in this selection.</p>'}
      ${pages ? pagination(pages.deps, "deps") : ""}
      <p class="cv-coverage">${
        omitted
          ? `${displayCount(omitted)} further project references outside this selection.`
          : "All outgoing project references included."
      } Lean core and Mathlib are counted separately.</p>
      <details class="cv-back"${pages?.showCallers ? " open" : ""}><summary>Referenced by <span>${displayCount(pages?.callers.total ?? back.length)} indexed</span></summary>
      ${back.length ? `<ul class="cv-list cv-branches">${nodeLinks(back)}</ul>` : '<p class="cv-muted">No incoming references in this selection.</p>'}${pages ? pagination(pages.callers, "callers") : ""}</details>
    </div>
  </article>`;
}

export function renderCode({ index, selectedId, search = "" }) {
  if (!index || !Array.isArray(index.nodes) || !index.nodes.length) {
    return `<section class="cv"><h2>Declaration index</h2><p>Index unavailable. <a href="${dataset}" target="_blank" rel="noopener noreferrer">Download dataset ↗</a></p></section>`;
  }
  const catalog = getIndex(index);
  const selected = catalog.byId.get(selectedId || index.roots[0]);
  return `<section class="cv" data-declaration="${escape(selectedId || index.roots[0])}" aria-labelledby="cv-title">
    <header class="cv-heading"><div><h2 id="cv-title">Declaration index</h2>
    <p>${displayCount(index.meta.usedProjectDeclarations)} declarations used by five targets.</p></div>
    <a class="cv-dataset" href="${dataset}" target="_blank" rel="noopener noreferrer">Full dataset · v0.2 ↗</a></header>
    <div class="cv-layout">
      <aside class="cv-tools" aria-label="Find declarations">
        <h3>Theorem targets</h3><nav class="cv-targets" aria-label="Theorem targets">${targetLinks(index, selected?.id)}</nav>
        <div class="cv-search"><label for="cv-query">Search declarations</label><div class="cv-field">
        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>
        <input id="cv-query" type="search" autocomplete="off" value="${escape(search)}" placeholder="Name prefix or source file" aria-controls="cv-search-results"></div>
        <div id="cv-search-results">${resultList(catalog, search, searchBatch)}</div></div>

      </aside>
      <div class="cv-selected">${selected ? renderDeclaration(selected, catalog) : `<article class="cv-record cv-missing" role="status">Looking up declaration…</article>`}</div>
    </div>
  </section>`;
}

function pagination(page, section) {
  if (!page.offset && !page.hasMore) return '';
  const button = (dir, disabled) => `<button type="button" class="cv-more" data-cv-page="${section}" data-dir="${dir}"${disabled ? ' disabled' : ''} aria-label="${dir < 0 ? 'Previous' : 'Next'} ${section === 'search' ? 'results' : 'references'}">${dir < 0 ? '←' : '→'}</button>`;
  return `<div class="cv-pagination">${button(-1, !page.offset)}<span>${displayCount(page.offset+1)}–${displayCount(page.offset+page.items.length)} of ${displayCount(page.total)}</span>${button(1, !page.hasMore)}</div>`;
}

function hitItems(rows) {
  return rows.map((row) => {
    const name = escape(row.name), source = sourceHref(row.url);
    const location = escape(row.file.split('/').at(-1) + ' · L' + row.line);
    return `<li class="cv-hit"><button type="button" data-action="code-node" data-id="${name}"><span class="cv-ref-name">${name}</span></button>
      <div class="cv-hit-meta">${source ? `<a href="${source}" title="${escape(row.file)}" target="_blank" rel="noopener noreferrer">${location} ↗</a>` : location}
      <button type="button" data-action="locate" data-id="${name}" aria-label="Locate ${name} in graph">Locate ↗</button></div></li>`;
  }).join('');
}

function fullResults(page) {
  const items = hitItems(page.items);
  return `<p class="cv-count" role="status">${displayCount(page.total)} matching ${page.total === 1 ? 'declaration' : 'declarations'}</p><ul class="cv-list cv-hits">${items}</ul>${pagination(page,'search')}`;
}

export async function renderSourceMatches(index, corpus, query, offset = 0, limit = searchBatch) {
  if (!query.trim()) return '';
  const options = {offset, limit:searchBatch};
  const page = query.startsWith('src/') && query.endsWith('.lean')
    ? await corpus.list(query, options)
    : await corpus.search(query, options);
  return page.total ? fullResults(page) : resultList(getIndex(index), query, limit);
}

// The router supplies the fixed release and handles code-node, locate and review actions.
export function bindCode(container, { index, corpus, onSearch } = {}) {
  const section = container.querySelector('.cv[data-declaration]');
  if (!section) return;
  const input = section.querySelector('#cv-query');
  const results = section.querySelector('#cv-search-results');
  const card = section.querySelector('.cv-selected');
  const catalog = getIndex(index);
  let searchVersion = 0, detailVersion = 0, row = null;
  let searchOffset = 0, fallbackLimit = searchBatch;
  const offsets = {deps:0, callers:0};

  async function search() {
    const query = input.value.trim(), version = ++searchVersion;
    if (!query || !corpus) {
      results.innerHTML = resultList(catalog, query, fallbackLimit);
      return;
    }
    results.setAttribute('aria-busy','true');
    try {
      const html = await renderSourceMatches(index,corpus,query,searchOffset,fallbackLimit);
      if (version !== searchVersion || !section.isConnected) return;
      results.innerHTML = html;
    } catch {
      if (version === searchVersion && section.isConnected) results.innerHTML = '<p class="cv-muted" role="status">Could not load search results.</p><button type="button" class="cv-more" data-cv-retry="search">Retry search</button>';
    } finally {
      if (version === searchVersion) results.removeAttribute('aria-busy');
    }
  }

  async function detail(keepCallers = false) {
    if (!corpus) return;
    const version = ++detailVersion;
    const id = section.dataset.declaration;
    try {
      row ??= await corpus.find(id);
      if (version !== detailVersion || !section.isConnected) return;
      if (!row) {
        card.innerHTML = '<article class="cv-record cv-missing" role="status">No declaration with that exact name in the pinned corpus.</article>';
        return;
      }
      const [deps,callers] = await Promise.all(['deps','callers'].map(direction => corpus.neighbors(row.id,{direction,offset:offsets[direction],limit:searchBatch})));
      if (version !== detailVersion || !section.isConnected) return;
      card.innerHTML = renderDeclaration({...row,id:row.name,kind:row.declKind,omitted:row.omittedProjectRefs},catalog,{deps,callers,showCallers:keepCallers});
    } catch {
      if (version === detailVersion && section.isConnected) card.innerHTML = '<article class="cv-record cv-missing" role="status">Could not load declaration details. <button type="button" class="cv-more" data-cv-retry="detail">Retry</button></article>';
    }
  }

  input.oninput = () => {
    searchOffset = 0;
    fallbackLimit = searchBatch;
    results.innerHTML = '';
    results.removeAttribute('aria-busy');
    onSearch?.(input.value);
    search();
  };
  section.onclick = async event => {
    const retry = event.target.closest('[data-cv-retry]');
    if (retry) return retry.dataset.cvRetry === 'search' ? search() : detail();
    const more = event.target.closest('[data-cv-more]');
    if (more) {
      fallbackLimit += searchBatch;
      await search();
      results.querySelectorAll('.cv-hits [data-action=code-node]')[fallbackLimit-searchBatch]?.focus();
      return;
    }
    const pageButton = event.target.closest('[data-cv-page]');
    if (!pageButton || pageButton.disabled) return;
    pageButton.disabled = true;
    const scope = pageButton.dataset.cvPage, dir = Number(pageButton.dataset.dir);
    if (scope === 'search') { searchOffset += dir*searchBatch; await search(); }
    else { offsets[scope] += dir*searchBatch; await detail(scope === 'callers' || card.querySelector('.cv-back')?.open); }
    const pagerButtons = [...section.querySelectorAll(`[data-cv-page="${scope}"]`)];
    (pagerButtons.find(b=>b.dataset.dir===String(dir)&&!b.disabled)??pagerButtons.find(b=>!b.disabled))?.focus();
  };
  if (input.value) search();
  detail();
}
