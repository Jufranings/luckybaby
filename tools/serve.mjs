#!/usr/bin/env node
/**
 * Local dev server.
 *
 *   node tools/serve.mjs                      run it, real clock
 *   node tools/serve.mjs --at 19:59:50        pretend it is 19:59:50 Manila
 *   node tools/serve.mjs --port 8080
 *
 * `python3 -m http.server` also works for plain browsing. Use this one when
 * you want to test the 20:00 reveal without waiting until 20:00.
 *
 * --at shifts the Date header this server sends, which is where the page gets
 * its clock. The offset is fixed, so time still runs forward: start at
 * 19:59:50 and the reel spins ten seconds later, for real.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const args = process.argv.slice(2);
const val = flag => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };

const ROOT = process.cwd();
const PORT = Number(val('--port') ?? 5173);
const AT = val('--at');

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No index.html in ${ROOT}. Run this from the project folder.`);
  process.exit(1);
}

/* ---------- Pretend clock ---------- */

let offset = 0;

if (AT) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(AT);
  if (!match) {
    console.error(`--at wants HH:MM or HH:MM:SS, got "${AT}".`);
    process.exit(1);
  }

  const [, h, m, s = '0'] = match;

  // Where the Manila clock actually is right now, to the second.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = t => Number(parts.find(p => p.type === t).value);
  const actual = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second');
  const wanted = Number(h) * 3600 + Number(m) * 60 + Number(s);

  offset = (wanted - actual) * 1000;

  const shown = `${String(h).padStart(2, '0')}:${m}:${String(s).padStart(2, '0')}`;
  console.log(`Pretending it is ${shown} Manila, and counting.`);
}

/* ---------- Static files ---------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = join(ROOT, normalize(rel));

  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    // The page reads its clock from this header.
    'Date': new Date(Date.now() + offset).toUTCString()
  });
  response.end(readFileSync(file));
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`);
  console.log('Stop with Ctrl+C.');
});
