import {evaluateGraph, reviewHistory} from './trust.mjs';

import {states} from './ui.mjs';

const verdicts = {support: 'Support', challenge: 'Challenge', inconclusive: 'Undecided', withdrawn: 'Withdraw'};
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const pct = value => Math.round(value * 1000) / 10 + '%';
function rangeText(range) {
  if (!range) return 'No evidence';
  const lower = pct(range[0]), upper = pct(range[1]);
  return lower === upper ? lower : lower + ' – ' + upper;
}
const stamp = at => at.slice(0, 10) + ' ' + at.slice(11, 16);
const name = node => node?.title || node?.id || '';
const stateMark = state => `<span class="ld-state" data-state="${html(state)}"><i aria-hidden="true"></i>${html(states[state])}</span>`;

function reference(source, title) {
  try {
    const url = new URL(source);
    if (['https:', 'http:'].includes(url.protocol)) {
      const label = title || url.hostname + (url.pathname === '/' ? '' : url.pathname) + url.hash;
      return `<a href="${html(url.href)}" target="_blank" rel="noopener noreferrer">${html(label)} <span aria-hidden="true">↗</span></a>`;
    }
  } catch {}
  return html(source);
}

function groupOptions(nodes, current) {
  const groups = new Map();
  for (const node of nodes) {
    const category = node.id.startsWith('lean:') ? 'Lean declarations'
      : node.id.startsWith('outline-') ? 'Discovery notes' : 'Mathematical landmarks';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(node);
  }
  return [...groups].map(([category, group]) => `<optgroup label="${category}">${group.map(node =>
    `<option value="${html(node.id)}"${node.id === current ? ' selected' : ''}>${html(name(node))}</option>`,
  ).join('')}</optgroup>`).join('');
}

function downstream(nodes, startId) {
  const next = new Map();
  for (const node of nodes) {
    for (const prev of new Set(node.dependsOn ?? [])) {
      if (!next.has(prev)) next.set(prev, []);
      next.get(prev).push(node.id);
    }
  }
  const reached = new Set([startId]);
  const todo = [startId];
  while (todo.length) {
    for (const id of next.get(todo.pop()) ?? []) {
      if (!reached.has(id)) { reached.add(id); todo.push(id); }
    }
  }
  return {direct: (next.get(startId) ?? []).filter(id => id !== startId), total: reached.size - 1};
}

// A step is held until the next observed review. A single timestamp creates points only.
function stepLine(points, value) {
  let path = '', started = false;
  for (const point of points) {
    const y = value(point);
    if (y === null) { started = false; continue; }
    path += started ? ` H${point.x} V${y}` : ` M${point.x} ${y}`;
    started = true;
  }
  return path;
}

function chartPoints(history) {
  const start = Date.parse(history[0].at), finish = Date.parse(history.at(-1).at);
  return history.map(event => ({
    ...event,
    x: start === finish ? 300 : Math.round((3 + 594 * (Date.parse(event.at) - start) / (finish - start)) * 100) / 100,
  }));
}
function readout(point) {
  return `${stamp(point.at)} UTC · ${point.counts.total} active groups · ${states[point.status]} · Support range ${rangeText(point.supportRange)}`;
}

const symbols = {unreviewed: '○', supported: '●', challenged: '◇', mixed: '◐', blocked: '◆', inconclusive: '△'};
function stateTimeline(points) {
  const changes = [];
  for (const [index, point] of points.entries()) {
    const previous = changes.at(-1)?.point.status;
    if (point.status !== previous) changes.push({index, point, previous});
  }
  // Records with one timestamp share one chart coordinate. The expandable list
  // preserves each transition at that instant and lets the reader select it.
  const atTime = new Map();
  for (const change of changes) atTime.set(change.point.at, change);
  const turning = [...atTime.values()];
  const label = change => (change.previous ? states[change.previous] + ' → ' : '') + states[change.point.status];
  const tag = points.length > 1 ? 'button' : 'span';
  const atEvent = index => tag === 'button' ? `type="button" data-ld-event="${index}"` : '';
  const band = turning.map(({point, index}, i) => {
    const x = point.x / 6, width = ((turning[i + 1]?.point.x ?? points.at(-1).x) - point.x) / 6;
    return `<i class="ld-phase-segment" data-state="${point.status}" style="left:${x}%;width:${width}%" aria-hidden="true"></i>
      <${tag} ${atEvent(index)} class="ld-phase-mark" data-state="${point.status}" style="left:${x}%" aria-label="${html(stamp(point.at) + ' UTC ' + states[point.status])}" title="${html(states[point.status])}">${symbols[point.status]}</${tag}>`;
  }).join('');
  const latest = changes.at(-1);
  const summary = latest.previous ? 'Last change' : 'Chain status';
  const list = changes.map(change => `<li><${tag} ${atEvent(change.index)}><time>${html(stamp(change.point.at))} UTC</time><span>${symbols[change.point.status]} ${html(label(change))}</span></${tag}></li>`).join('');
  return {
    band: `<div class="ld-phase-row"><span>Chain</span><div class="ld-phase-track">${band}</div></div>`,
    change: `<details class="ld-state-history" data-state="${latest.point.status}"><summary><span>${summary}</span><strong>${symbols[latest.point.status]} ${html(label(latest))}</strong><span class="ld-phase-time">${html(stamp(latest.point.at))} UTC</span></summary><ol>${list}</ol></details>`,
  };
}

function trend(history) {
  if (!history.length) {
    return `<div class="ld-emptyplot"><div class="ld-empty-rule" aria-hidden="true"></div><p>No reviews for this node or its prerequisites.</p></div>`;
  }
  const points = chartPoints(history);
  const first = points[0], last = points.at(-1);
  const timeline = stateTimeline(points);
  const sampleMax = Math.max(1, last.cumulativeGroups);
  const runs = [];
  let currentRun = null;
  for (const p of points) {
    if (p.supportRange) {
      if (!currentRun) { currentRun = []; runs.push(currentRun); }
      currentRun.push(p);
    } else if (currentRun) {
      currentRun.push({...currentRun.at(-1), x: p.x});
      currentRun = null;
    }
  }
  const top = p => 7 + 74 * (1 - p.supportRange[1]);
  const low = p => 7 + 74 * (1 - p.supportRange[0]);
  const band = runs.map(bounds => {
    let path = stepLine(bounds, top) + ` L${bounds.at(-1).x} ${low(bounds.at(-1))}`;
    for (let i = bounds.length - 1; i > 0; i--) path += ` V${low(bounds[i - 1])} H${bounds[i - 1].x}`;
    return path + ' Z';
  }).join(' ');
  const sampleY = p => 151 - 36 * p.cumulativeGroups / sampleMax;
  const primary = last.supportRange ? last : null;
  return `<div class="ld-chart">
    <div class="ld-chart-key"><i class="ld-swatch range"></i> Direct support <i class="ld-swatch count"></i> Groups to date</div>
    <div class="ld-chart-body">
      <div class="ld-y" aria-hidden="true"><span style="top:4.4%">100%</span><span style="top:27.5%">50%</span><span style="top:50.6%">0%</span><span style="top:72%">${sampleMax}</span><span style="top:94.4%">0</span></div>
      <div class="ld-plot" title="Select a point in time">
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="${html('Review history. Latest: ' + readout(last))}">
          <defs><pattern id="ld-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2L2 -2 M0 8 L8 0 M6 10 L10 6" stroke="currentColor" opacity=".25" fill="none"></path></pattern></defs>
          <g class="ld-grid">${[7, 44, 81, 115, 151].map(y => `<path d="M0 ${y} H600"/>`).join('')}</g>
          <path d="${band}" fill="url(#ld-hatch)"/>
          <g class="ld-range-line">${runs.map(bounds => `<path d="${stepLine(bounds, top)}"/><path d="${stepLine(bounds, low)}"/>`).join('')}</g>
          <path class="ld-count-line" d="${stepLine(points, sampleY)}"/>
        </svg>
        ${primary ? `<i class="ld-dot range" style="left:${primary.x / 6}%;top:${top(primary) / 1.6}%"></i><i class="ld-dot range" style="left:${primary.x / 6}%;top:${low(primary) / 1.6}%"></i>` : ''}
        <i class="ld-dot count" style="left:${last.x / 6}%;top:${sampleY(last) / 1.6}%"></i>
        <i class="ld-cursor" style="left:${last.x / 6}%" aria-hidden="true"></i>
      </div>
    </div>
    ${timeline.band}<div class="ld-dates"><span>${html(stamp(first.at))}</span>${first.at !== last.at ? '<span>' + html(stamp(last.at)) + '</span>' : ''}<span class="ld-zone">UTC</span></div>
    ${timeline.change}
    <div class="ld-time-control">${points.length > 1 ? `<label for="ld-cursor-input">Replay</label><input id="ld-cursor-input" type="range" min="0" max="${points.length - 1}" value="${points.length - 1}" step="1" aria-label="Replay review history">` : ''}
    <output id="ld-readout" for="ld-cursor-input" aria-live="polite">${html(readout(last))}</output></div>
  </div>`;
}

function recordList(records, localIds, communityIds, baselineIds, nodeById) {
  if (!records.length) return '<p class="ld-muted ld-log-empty">No direct reviews.</p>';
  const successors = new Map(records.filter(r => r.supersedes).map(r => [r.supersedes, r]));
  const byId = new Map(records.map(r => [r.id, r]));
  const row = review => {
    const origin = baselineIds.has(review.id) ? 'Published check' : communityIds.has(review.id) ? 'Community' : localIds.has(review.id) ? 'Personal' : 'Review';
    const successor = successors.get(review.id);
    const amendable = !successor && localIds.has(review.id) && !baselineIds.has(review.id) && !communityIds.has(review.id);
    const prior = byId.get(review.supersedes);
    const lineage = [
      prior ? `Amends ${verdicts[prior.outcome]} from ${stamp(prior.at)} UTC` : '',
      successor ? `${successor.outcome === 'withdrawn' ? 'Withdrawn' : 'Amended'} · ${stamp(successor.at)} UTC` : '',
    ].filter(Boolean).join(' ');
    return `<li class="ld-logrow"><div class="ld-record-meta"><time datetime="${html(review.at)}">${html(stamp(review.at))} UTC</time><span>${origin}</span></div>
      <div><strong class="ld-outcome" data-outcome="${html(review.outcome)}">${html(verdicts[review.outcome])}</strong><span class="ld-record-node">${html(name(nodeById.get(review.nodeId)))}</span>
      ${lineage ? '<div class="ld-lineage">' + html(lineage) + '</div>' : ''}
      <p>${html(review.note)}</p><small>Evidence group · ${html(review.group)}</small><div class="ld-ref">Source · ${reference(review.source)}</div>
      ${amendable ? `<button type="button" class="ld-amend" data-action="amend" data-id="${html(review.id)}">Amend review</button>` : ''}</div></li>`;
  };
  const ordered = [...records].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return `<ol class="ld-log">${ordered.slice(0, 8).map(row).join('')}</ol>${ordered.length > 8 ? `<details class="ld-more"><summary>${ordered.length - 8} earlier records</summary><ol class="ld-log">${ordered.slice(8).map(row).join('')}</ol></details>` : ''}`;
}

function jumps(ids, byId, result) {
  return ids.map(id => {
    if (!byId.has(id)) return `<div class="ld-jump ld-missing"><span>${html(id)}</span><span>Missing node</span></div>`;
    return `<button type="button" class="ld-jump" data-ledger-jump="${html(id)}"><span>${html(name(byId.get(id)))}</span>${stateMark(result[id].status)}</button>`;
  }).join('');
}

export function renderLedger({nodes, reviews = [], localReviews = [], communityReviews = [], baseline = [], selectedId}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const current = byId.get(selectedId) || nodes[0];
  if (!current) return '<section class="ld-page"><h2>Evidence ledger</h2><p>No reviewable nodes.</p></section>';
  const result = evaluateGraph(nodes, reviews);
  const model = result[current.id];
  const own = reviews.filter(r => r.nodeId === current.id);
  const history = reviewHistory(nodes, reviews, current.id);
  const children = downstream(nodes, current.id);
  const list = (title, count) => `<div><dt>${title}</dt><dd>${count}</dd></div>`;
  const baseIds = new Set(baseline.map(r => r.id)), localIds = new Set(localReviews.map(r => r.id)), publicIds = new Set(communityReviews.map(r => r.id));
  const relatedEvents = new Set(history.map(event => event.id));
  const inherited = reviews.filter(r => r.nodeId !== current.id && relatedEvents.has(r.id));
  return `<section class="ld-page" aria-labelledby="ld-title">
    <header class="ld-heading"><div><h2 id="ld-title">Evidence ledger</h2></div>
      <div class="ld-tools actions"><button class="button secondary" data-action="import">Import JSON</button><button class="button secondary" data-action="export">Export JSON</button></div></header>
    <div class="ld-selector"><label for="ledger-node">Node</label><select id="ledger-node">${groupOptions(nodes, current.id)}</select>
      <button class="button" data-action="review" data-id="${html(current.id)}">Add review</button>
      ${current.id.startsWith('outline-') ? '' : '<button class="button secondary" data-action="locate" data-id="'+html(current.id)+'">Locate in graph</button>'}</div>
    <aside class="ld-scope"><b>Coverage</b><span>Percentages describe the reviews recorded here.</span></aside>
    <div class="ld-top-grid">
      <section class="panel ld-timeline"><div class="ld-panel-heading"><h3>Evidence over time</h3><span>${history.length} ${history.length === 1 ? 'event' : 'events'}</span></div>
        ${trend(history)}
        <p class="ld-footnote">Hatching marks unresolved groups. The lower band tracks the chain.</p>
      </section>
      <section class="panel ld-summary"><h3>Current status</h3><div class="ld-summary-line"><span>Dependency chain</span>${stateMark(model.status)}</div>${model.omitted ? '<p class="ld-omitted">' + model.omitted + ' project references outside this selection.</p>' : ''}<div class="ld-summary-line"><span>Direct reviews</span>${stateMark(model.directStatus)}</div>
        <div class="ld-support"><span>Support range</span><b>${html(rangeText(model.supportRange))}</b></div>
        <dl class="ld-counts">${list('Supporting', model.counts.support)}${list('Challenging', model.counts.challenge)}${list('Mixed', model.counts.mixed)}${list('Undecided', model.counts.inconclusive)}</dl>
      </section>
    </div>
    <section class="panel ld-flow"><div class="ld-panel-heading"><h3>Dependency impact</h3><span>${children.total} downstream</span></div>
      <div class="ld-flow-grid"><div><h4>Prerequisites · ${(current.dependsOn ?? []).length}</h4>${(current.dependsOn ?? []).length ? jumps(current.dependsOn, byId, result) : '<p class="ld-muted">None in this selection.</p>'}${model.omitted ? '<p class="ld-omitted">' + model.omitted + ' project references outside this selection.</p>' : ''}</div>
      <div class="ld-pivot"><h4>Selected node</h4><strong>${html(name(current))}</strong>${stateMark(model.status)}</div>
      <div><h4>Direct dependents · ${children.direct.length}</h4>${children.direct.length ? jumps(children.direct.slice(0, 6), byId, result) : '<p class="ld-muted">None in this selection.</p>'}${children.direct.length > 6 ? '<details><summary>Show ' + (children.direct.length - 6) + ' more</summary>' + jumps(children.direct.slice(6), byId, result) + '</details>' : ''}</div></div>
      ${model.blockers.length ? '<ul class="ld-reasons">' + model.blockers.map(b => '<li>' + html(b.detail) + ' · ' + html(name(byId.get(b.nodeId)) || b.nodeId) + '</li>').join('') + '</ul>' : ''}
    </section>
    <section class="panel ld-records"><div class="ld-panel-heading"><h3>Review log</h3><span>${own.length} direct ${own.length === 1 ? 'record' : 'records'}</span></div>
      ${recordList(own, localIds, publicIds, baseIds, byId)}
      ${inherited.length ? '<details class="ld-more"><summary>Prerequisite reviews · ' + inherited.length + '</summary>' + recordList(inherited, localIds, publicIds, baseIds, byId) + '</details>' : ''}
      ${current.sources?.length ? '<div class="ld-source-links"><b>Sources</b>' + current.sources.map(s => reference(s.url, s.label)).join('') + '</div>' : ''}
    </section>
    <div class="ld-bottom"><details><summary>How support is counted</summary><p>Repeated checks of the same evidence count once. The lower bound counts supporting groups. The upper bound also includes mixed and undecided groups. Challenges to a prerequisite block its dependents.</p></details>
      <button type="button" class="ld-reset" data-action="reset"${localReviews.length ? '' : ' disabled'}>Clear personal reviews</button></div>
  </section>`;
}

export function bindLedger(container, {nodes, reviews = []}) {
  const select = container.querySelector('#ledger-node');
  if (!select) return;
  container.querySelectorAll('[data-ledger-jump]').forEach(button => {
    button.onclick = () => {
      select.value = button.dataset.ledgerJump;
      if (select.value) select.dispatchEvent(new Event('change', {bubbles: true}));
    };
  });
  const slider = container.querySelector('#ld-cursor-input');
  if (!slider) return;
  const points = chartPoints(reviewHistory(nodes, reviews, select.value));
  const cursor = container.querySelector('.ld-cursor');
  const output = container.querySelector('#ld-readout');
  function selectPoint(index) {
    const point = points[index];
    slider.value = String(index);
    slider.setAttribute('aria-valuetext', readout(point));
    cursor.style.left = point.x / 6 + '%';
    output.textContent = readout(point);
  }
  selectPoint(points.length - 1);
  slider.oninput = () => selectPoint(Number(slider.value));
  container.querySelectorAll('[data-ld-event]').forEach(button => {
    button.onclick = () => selectPoint(Number(button.dataset.ldEvent));
  });
  container.querySelector('.ld-plot').onclick = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 600 / rect.width;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) <= Math.abs(points[nearest].x - x)) nearest = i;
    }
    selectPoint(nearest);
  };
}
