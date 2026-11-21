import { esc, icon } from "./ui.mjs";

export function shareDestination({
  lens,
  subview,
  selected,
  origin,
  position,
  directory,
  offset = 0,
}) {
  if (lens === "corpus") {
    return {
      fragment:
        "#map/folder/" +
        offset +
        "/" +
        directory.split("/").map(encodeURIComponent).join("/"),
      title:
        "Share this source " +
        (directory.endsWith(".lean") ? "file" : "folder"),
    };
  }
  if (lens === "route") {
    return {
      fragment: "#map/" + encodeURIComponent("step:" + selected),
      title: "Share this proof step",
    };
  }
  if (subview === "path" && position >= 0) {
    return {
      fragment:
        "#map/trail/" + (position + 1) + "/" + encodeURIComponent(origin),
      title: "Share this proof path",
    };
  }
  if (selected === "riemannHypothesis" && !subview)
    return { fragment: "", title: "Share the atlas" };
  return {
    fragment: "#map/" + encodeURIComponent(selected),
    title: "Share this declaration",
  };
}

export function showShare(destination, detail, promptBox) {
  const base = document.querySelector('link[rel="canonical"]').href;
  const url = new URL(base);
  url.hash = destination.fragment;
  const repo =
    document.querySelector('meta[name="atlas-repository"]')?.content ||
    "https://github.com/YiweiIvy/riemann-hypothesis-atlas";
  promptBox(
    destination.title,
    `<p class="share-detail">${esc(detail)}</p>
    <div class="share-field"><input id="share-url" aria-label="Public link" value="${esc(url.href)}" readonly>
    <button id="share-copy" class="button" type="button">Copy link</button></div>
    <p class="share-feedback" role="status"></p>
    <div class="share-more"><a href="${esc(repo)}" target="_blank" rel="noopener noreferrer">${icon("star")} Star on GitHub</a>
    <a href="${esc(new URL("share/galaxy-teaser.mp4", base).href)}" download>Get the short clip ${icon("external")}</a></div>`,
  );
  const field = document.getElementById("share-url");
  const status = document.querySelector(".share-feedback");
  document.getElementById("share-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url.href);
      status.textContent = "Link copied.";
    } catch {
      field.focus();
      field.select();
      status.textContent = document.execCommand?.("copy")
        ? "Link copied."
        : "Link selected. Use your device’s copy command.";
    }
  };
}
