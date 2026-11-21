export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const paths = {
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 11 7-4M8 13l7 4"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6L2.5 9.4l6.6-.9z"/>',
  play: '<path d="m7 4 12 8-12 8z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  network:
    '<circle cx="5" cy="7" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="15" cy="18" r="2"/><path d="m7 7 9-2M6 9l8 7m2-1 2-8"/>',
  corpus:
    '<path d="m12 2 9 5.2v9.6L12 22l-9-5.2V7.2zM3 7.2l9 5.2 9-5.2M12 12.4V22M7.5 4.6l9 5.2"/>',
  route:
    '<circle cx="5" cy="17" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17h6a3 3 0 0 0 0-6h-2a2.5 2.5 0 0 1 0-5h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  focus:
    '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  trace:
    '<path d="M5 18h4a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h4m-7 7h7"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="20" cy="13" r="2"/>',
  filter:
    '<path d="M3 7h6m4 0h8M3 17h10m4 0h4"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  external: '<path d="M8 5H5v14h14v-3m-8-5 8-8m-6 0h6v6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6 6-6-6 6-6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  book: '<path d="M3 4h6a4 4 0 0 1 3 2c1-1 2-2 4-2h5v14h-5c-2 0-3 1-4 2-1-1-2-2-4-2H3zM12 6v14"/>',
  scope:
    '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="3"/>',
  open: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5M8 8l-4-4m12 4 4-4m-4 12 4 4M8 16l-4 4"/>',
  inspect:
    '<path d="M4 7V4h4m8 0h4v3M4 17v3h4m8 0h4v-3"/><circle cx="12" cy="12" r="3"/>',
  folder: '<path d="M3 6h6l2 2h10v12H3z"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  link: '<path d="m10 14 4-4m-6 2-2 2a3 3 0 0 0 4 4l3-3m-2-6 3-3a3 3 0 0 1 4 4l-2 2"/>',
  spark:
    '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  label: '<path d="M3 4h9l9 9-8 8-10-10z"/><circle cx="7.5" cy="8" r="1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  evidence: '<path d="M2 13h5l3-7 4 12 3-6h5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
};
export function icon(key) {
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (paths[key] ?? "") +
    "</svg>"
  );
}
export const count = (n) => Number(n ?? 0).toLocaleString("en-US");
export const states = {
  supported: "Supported",
  inconclusive: "Open",
  unreviewed: "Unreviewed",
  challenged: "Challenged",
  mixed: "Mixed",
  blocked: "Blocked",
};
export function shortName(name) {
  return (name?.split(".").pop() ?? "")
    .replace(/\.lean$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ");
}
export function external(url, title) {
  if (!/^https?:\/\//.test(url || "")) return "";
  return (
    '<a target="_blank" rel="noopener noreferrer" class="source-link" href="' +
    esc(url) +
    '">' +
    esc(title) +
    " " +
    icon("external") +
    "</a>"
  );
}
