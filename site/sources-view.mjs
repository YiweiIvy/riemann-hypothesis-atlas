import {SOURCES} from "./data/sources.mjs";

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
function link(url, label) {
  return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;
}
function sourceRow(source) {
  const links = (source.links ?? []).map(item => link(item.url, item.title)).join("");
  const fingerprints = Object.entries(source.digests ?? {}).map(([name, digest]) =>
    `<dt>${escape(name)}</dt><dd><code>${escape(digest)}</code></dd>`).join("");
  return `<article class="sv-row"><span class="sv-kind">${escape(source.kind)}</span>
    <div class="sv-entry"><h3>${link(source.url, source.title)}</h3><p>${escape(source.detail)}</p>
      ${links ? '<div class="sv-links">'+links+'</div>' : ''}
      ${fingerprints ? '<details><summary>SHA-256</summary><dl>'+fingerprints+'</dl></details>' : ''}
    </div><div class="sv-by"><span>${escape(source.publisher)}</span><time>${escape(source.date)}</time></div></article>`;
}
export function renderSources(report) {
  const parts = Object.keys(report.parts).length;
  return `<section class="sv" aria-labelledby="sv-title"><header class="sv-title"><h2 id="sv-title">Sources</h2><time>21 Nov 2026</time></header>
    <div class="sv-finding"><div class="sv-question"><h3>The 250,000-page draft</h3><p>Alpöge mentions it in footnote 2. His public release contains the Lean code and a four-page announcement.</p>${link("https://alpo.ge/remark.pdf#page=2","Read the footnote")}</div>
    <div class="sv-proof"><dl><div><dt>Archive parts</dt><dd>${parts}</dd></div><div><dt>Lean files compared</dt><dd>${report.originalFiles.toLocaleString("en-US")}</dd></div><div><dt>Mirror differences</dt><dd>${report.differences.length}</dd></div></dl>
      <details><summary>Compare fingerprints</summary><dl class="sv-digest"><dt>Archive SHA-256</dt><dd><code>${escape(report.archiveSHA256)}</code></dd><dt>Mirror commit</dt><dd><code>${escape(report.mirrorCommit)}</code></dd><dt>Scope</dt><dd><code>${escape(report.scope)}</code></dd><dt>Size</dt><dd>${report.archiveBytes.toLocaleString("en-US")} bytes</dd></dl>
      <div class="sv-links"><button data-action="archive-report">Download manifest</button>${link("https://math.mit.edu/~drew/grh/","Independent checksums")}</div></details></div></div>
    <div class="sv-list">${SOURCES.map(sourceRow).join("")}</div></section>`;
}
