import { esc, icon } from "./ui.mjs";

export function guideHTML(tourUrl) {
  const views = [
    [
      "network",
      "Network",
      "Select a star. Double-click or double-tap to expand its references.",
    ],
    [
      "corpus",
      "Corpus",
      "Open a directory or file. Inspect a connecting arc to see its reference counts.",
    ],
    [
      "route",
      "Proof route",
      "Follow twelve mathematical steps. Open a step to see its Lean declarations.",
    ],
    [
      "evidence",
      "Evidence",
      "Scrub through dated checks. Colors show the state of each dependency chain.",
    ],
  ];
  return `<div class="key-guide">${views.map(([symbol, title, hint]) => `<div>${icon(symbol)}<b>${title}</b><span>${hint}</span></div>`).join("")}</div>
    <div class="shortcuts"><span><kbd>/</kbd> Find</span><span><kbd>+</kbd> <kbd>−</kbd> Zoom</span><span><kbd>E</kbd> Inspect a link</span><span><kbd>[</kbd> <kbd>]</kbd> Step through a path</span><span>Alt-hover to inspect dense links</span></div>
    <p class="guide-film"><a href="${esc(tourUrl)}">Watch the captioned walkthrough ↗</a></p>`;
}
