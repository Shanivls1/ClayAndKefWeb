import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;

  let filePath;
  try {
    filePath = join(ROOT, decodeURIComponent(pathname));
  } catch {
    filePath = null; // malformed %-encoding
  }
  if (!filePath || !(filePath + sep).startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'text/plain',
      'Cache-Control': 'no-store', // dev server: always load the latest code
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Clay & Kef → http://localhost:${PORT}`));
