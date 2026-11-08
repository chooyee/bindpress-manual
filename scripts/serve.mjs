/**
 * A small static server for the documentation and examples, with no dependencies.
 *   npm run docs    →  http://localhost:8000/docs/
 * Browsers do not load ES modules from file:// addresses, so the docs' live demo needs this.
 * scripts/browser-check.mjs uses it too, through startServer().
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rootWithSep = root.endsWith(sep) ? root : root + sep;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8'
};

/**
 * Serves the repository's files.
 * @param {number} port  0 for any free port
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export function startServer(port) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    let file = normalize(join(root, path));
    // Never serve anything outside the repository.
    if (!file.startsWith(rootWithSep) && file !== root) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({ url: `http://localhost:${actualPort}`, close: () => server.close() });
    });
  });
}

// Run as a script (not imported by browser-check.mjs). Drive letters may differ in case on Windows.
if (process.argv[1] && pathToFileURL(process.argv[1]).href.toLowerCase() === import.meta.url.toLowerCase()) {
  const { url } = await startServer(Number(process.env.PORT) || 8000);
  console.log(`Docs:     ${url}/docs/\nExamples: ${url}/examples/`);
}
