// Local development server for the modular site and the generated offline preview.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../site/", import.meta.url));
const portable = fileURLToPath(
  new URL("../dist/critical-atlas.html", import.meta.url),
);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".gz": "application/gzip",
};
const port = Number(process.env.PORT ?? 8765);
const server = http.createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const candidate =
      pathname === "/offline.html"
        ? portable
        : resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (candidate !== portable && !candidate.startsWith(resolve(root) + sep)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(candidate);
    if (!info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const body = req.method === "HEAD" ? null : await readFile(candidate);
    res.writeHead(200, {
      "Content-Type":
        contentTypes[extname(candidate)] ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(port, "127.0.0.1", () => console.log("http://127.0.0.1:" + port));
