import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { onConnection } from './rooms.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(dir, process.env.CLIENT_DIR ?? '../client');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.json': 'application/json',
  '.map': 'application/json',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const { pathname } = new URL(req.url ?? '/', 'http://x');
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(CLIENT_DIR, rel);
  if (!file.startsWith(CLIENT_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }
  const headers: Record<string, string> = { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' };
  if (rel.startsWith('assets/')) headers['cache-control'] = 'public, max-age=31536000, immutable';
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

export function startServer(port: number) {
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', onConnection);
  return new Promise<{ server: http.Server; port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      resolve({
        server,
        port: typeof addr === 'object' && addr ? addr.port : port,
        close: () =>
          new Promise<void>((done) => {
            wss.clients.forEach((c) => c.terminate());
            wss.close(() => server.close(() => done()));
          }),
      });
    });
  });
}
