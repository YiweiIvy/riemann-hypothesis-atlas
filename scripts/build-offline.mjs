// The portable atlas embeds the same compressed shards as the hosted application.
// Write the corpus sequentially, keeping peak build memory independent of its size.
import { createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { once } from "node:events";
import { finished } from "node:stream/promises";
import { dirname, extname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const site = resolve(root, "site");
const outDir = resolve(root, "dist");
const out = resolve(outDir, "riemann-hypothesis-atlas.html");
// Earlier local releases linked directly to this filename in dist/.
const legacy = resolve(outDir, "critical-atlas.html");
const read = (path, encoding = "utf8") =>
  readFile(resolve(site, path), encoding);
const modules = {};
const safeJSON = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const mime = {
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
};
const dataURL = (type, bytes) =>
  "data:" + type + ";base64," + Buffer.from(bytes).toString("base64");
const scriptRef = (path) => "atlas/" + path;

async function addModule(path) {
  const key = scriptRef(path);
  if (Object.hasOwn(modules, key)) return;
  modules[key] = "";
  const imports = [];
  const source = (await read(path)).replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)['"](\.\.?\/[^'"]+\.mjs)['"]/g,
    (_, prefix, relative) => {
      const target = posix.normalize(posix.join(posix.dirname(path), relative));
      imports.push(target);
      return prefix + JSON.stringify(scriptRef(target));
    },
  );
  for (const child of imports) await addModule(child);
  modules[key] = dataURL("text/javascript", source);
}

async function asset(path) {
  const type = mime[extname(path)];
  if (!type) throw new Error("Unrecognized local media: " + path);
  return dataURL(type, await read(path, null));
}

async function packStyle(file) {
  let css = await read(file);
  // Leave SVG fragment references and pre-inlined images untouched.
  const matches = [
    ...css.matchAll(/url\(\s*["']?((?!data:|#|https?:)[^)'"]+?)["']?\s*\)/g),
  ];
  for (const match of matches) {
    const path = posix.normalize(posix.join(posix.dirname(file), match[1]));
    if (!inlined.has(path)) inlined.set(path, await asset(path));
    css = css.replace(match[0], () => 'url("' + inlined.get(path) + '")');
  }
  return css;
}
const inlined = new Map();
// The portable graph is self-contained. Its optional film opens the hosted player.
let html = (await read("index.html")).replace(
  'href="./tour/"',
  'href="https://yiweiivy.github.io/riemann-hypothesis-atlas/tour/"',
);
const styles = [
  ...html.matchAll(
    /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
  ),
];
for (const [tag, file] of styles) {
  const css = await packStyle(file);
  html = html.replace(tag, () => "<style>" + css + "</style>");
}
for (const match of [
  ...html.matchAll(
    /\b(src|href)=(["'])([^"'#?:]+\.(?:svg|woff2?|png|webp))\2/g,
  ),
]) {
  const reference = match[3];
  const uri = inlined.get(reference) ?? (await asset(reference));
  html = html.replace(match[0], () => match[1] + '="' + uri + '"');
}
const entry =
  /<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/i.exec(
    html,
  );
if (!entry) throw new Error("Atlas module entry point missing");
await addModule(entry[1]);

const manifest = JSON.parse(await read("data/cosmos/manifest.json"));
const corpus = (await readdir(resolve(site, "data/cosmos")))
  .filter((name) => /^[a-z]+-\d+\.(bin|json)\.gz$/.test(name))
  .sort();
const chunks = Math.ceil(manifest.nodeCount / manifest.blockSize);
const expectedFiles = 4 * chunks + 2 * manifest.dirBuckets;
if (corpus.length !== expectedFiles)
  throw new Error(
    "Corpus is incomplete; expected " + expectedFiles + " shards.",
  );

await mkdir(outDir, { recursive: true });
const temp = out + "." + process.pid + ".building";
const stream = createWriteStream(temp, { flags: "wx" });
const end = finished(stream);
end.catch(() => {});
async function emit(value) {
  if (!stream.write(value)) await once(stream, "drain");
}
try {
  await emit(html.slice(0, entry.index));
  await emit(
    '<script type="application/json" id="atlas-licenses">' +
      safeJSON({
        project: await readFile(resolve(root, "LICENSE"), "utf8"),
        instrumentSans: await read("fonts/OFL.txt"),
        graphData:
          "James Shore, rh-proof-dependencies v0.2, CC0-1.0. https://github.com/james-shore/rh-proof-dependencies/releases/tag/v0.2",
      }) +
      "</script>\n",
  );
  for (const name of ["archive-check", "community-reviews", "lean-index"]) {
    await emit(
      '<script type="application/json" id="data-' +
        name +
        '">' +
        safeJSON(JSON.parse(await read("data/" + name + ".json"))) +
        "</script>\n",
    );
  }
  await emit(
    '<script type="application/json" id="data-cosmos-manifest">' +
      safeJSON(manifest) +
      "</script>\n",
  );
  for (const name of corpus) {
    const bytes = await read("data/cosmos/" + name, null);
    await emit(
      '<script type="application/octet-stream" id="cosmos-' +
        name +
        '">' +
        bytes.toString("base64") +
        "</script>\n",
    );
  }
  await emit(
    '<script type="importmap">' +
      safeJSON({ imports: modules }) +
      '</script>\n<script type="module">import ' +
      JSON.stringify(scriptRef(entry[1])) +
      ";</script>",
  );
  await emit(html.slice(entry.index + entry[0].length));
  stream.end();
  await end;
  await rename(temp, out);
  const aliasTemp = legacy + "." + process.pid + ".building";
  try {
    await copyFile(out, aliasTemp);
    await rename(aliasTemp, legacy);
  } finally {
    await rm(aliasTemp, { force: true });
  }
} catch (error) {
  stream.destroy();
  await end.catch(() => {});
  await rm(temp, { force: true });
  throw error;
}
console.log(
  out +
    " (" +
    manifest.nodeCount.toLocaleString("en-US") +
    " declarations, " +
    corpus.length +
    " embedded data shards)",
);
