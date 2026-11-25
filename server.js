const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.glb', '.bin', '.ico']);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.bin': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/' || pathname === '/games/tideline' || pathname === '/games/tideline/') {
      pathname = '/index.html';
    }

    const safePath = path.normalize(path.join(ROOT, pathname));
    if (!safePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const etag = `W/"${stats.size}-${Math.floor(stats.mtimeMs)}"`;
      const canGzip = COMPRESSIBLE.has(ext) && stats.size >= 1024 && /\bgzip\b/i.test(req.headers['accept-encoding'] || '');

      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, {
          'ETag': etag,
          'Cache-Control': 'no-cache',
          'Vary': 'Accept-Encoding'
        });
        res.end();
        return;
      }

      const headers = {
        'Content-Type': contentType,
        'ETag': etag,
        'Cache-Control': 'no-cache',
        'Vary': 'Accept-Encoding'
      };
      if (canGzip) headers['Content-Encoding'] = 'gzip';
      else headers['Content-Length'] = stats.size;

      res.writeHead(200, headers);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(safePath);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      if (canGzip) {
        const gzip = zlib.createGzip({ level: 6 });
        gzip.on('error', () => res.end());
        stream.pipe(gzip).pipe(res);
      } else {
        stream.pipe(res);
      }
    });
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`衢州古城 · 水亭门与南孔圣地 server running at http://${HOST}:${PORT}`);
});
