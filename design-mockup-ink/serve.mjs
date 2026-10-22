// Tiny static server for reviewing the mockup locally.
//   node serve.mjs   ->  http://localhost:8745
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The folder this file lives in, not whatever directory you happened to be
// in when you ran it.
const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = resolve(join(ROOT, rel === '/' ? 'index.html' : rel));
    // Resolve first, then refuse anything that escaped the folder.
    if (!file.startsWith(ROOT)) return res.writeHead(403).end('forbidden');
    try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch {
        res.writeHead(404).end('not found');
    }
}).listen(8745, () => console.log('ink scheme on http://localhost:8745'));
