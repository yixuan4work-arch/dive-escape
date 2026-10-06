// Dive Escape: a tiny local static server with no dependencies.
// The app calls its APIs straight from the browser, so this only serves ./public.
// In production the same files are hosted on GitHub Pages.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) return res.writeHead(404).end("Not found");
    fs.readFile(file, (err, buf) => {
      if (err) return res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(buf);
    });
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") console.error(`Port ${PORT} is busy. Try: PORT=3001 npm start`);
    else console.error(err);
    process.exit(1);
  })
  .listen(PORT, () => console.log(`Dive Escape is running at http://localhost:${PORT}`));
