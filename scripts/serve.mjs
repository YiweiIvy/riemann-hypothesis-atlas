// Local development server for the modular site and the generated offline preview.
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../site/", import.meta.url));
const portable = fileURLToPath(
  new URL("../dist/riemann-hypothesis-atlas.html", import.meta.url),
);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8",
  ".jpg": "image/jpeg",
  ".gz": "application/gzip",
};
const port = Number(process.env.PORT ?? 8765);

// Ignore unsupported units and multipart requests. A valid single range that
// contains no bytes yields 416, including a zero-length suffix.
function videoRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header?.trim() ?? "");
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return start <= end ? { start, end } : false;
}

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
        : resolve(
            root,
            "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
          );
    if (candidate !== portable && !candidate.startsWith(resolve(root) + sep)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(candidate);
    if (!info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const extension = extname(candidate);
    const headers = {
      "Content-Type": contentTypes[extension] ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
    };
    let range = null;
    if (extension === ".mp4") {
      headers["Accept-Ranges"] = "bytes";
      if (!req.headers["if-range"])
        range = videoRange(req.headers.range, info.size);
      if (range === false) {
        res
          .writeHead(416, {
            ...headers,
            "Content-Range": "bytes */" + info.size,
            "Content-Length": 0,
          })
          .end();
        return;
      }
      if (range) {
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${info.size}`;
        headers["Content-Length"] = range.end - range.start + 1;
      }
    }
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === "HEAD") res.end();
    else await pipeline(createReadStream(candidate, range ?? {}), res);
  } catch {
    if (res.headersSent) res.destroy();
    else res.writeHead(404).end();
  }
});
server.listen(port, "127.0.0.1", () => console.log("http://127.0.0.1:" + port));
