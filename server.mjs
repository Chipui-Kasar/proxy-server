import { createServer } from "node:http";
import next from "next";

/**
 * Custom server wrapper around Next.js.
 *
 * Next.js unconditionally 308-redirects any path containing "//", which breaks
 * "/api/proxy/https://host/..." (CORS preflights can't follow redirects).
 * Collapse repeated slashes in proxy paths before Next sees them; the route
 * handler repairs "https:/" back to "https://".
 */
const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();
await app.prepare();

createServer((req, res) => {
  if (req.url?.startsWith("/api/proxy/")) {
    const q = req.url.indexOf("?");
    const path = q === -1 ? req.url : req.url.slice(0, q);
    const search = q === -1 ? "" : req.url.slice(q);
    req.url = path.replace(/\/{2,}/g, "/") + search;
  }
  handle(req, res);
}).listen(port, () => {
  console.log(`> SPD Proxy ready on http://localhost:${port}`);
});
