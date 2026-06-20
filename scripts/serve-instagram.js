const http = require('http');
const fs   = require('fs');
const path = require('path');

const DIR  = path.resolve(__dirname, '../instagram');
const PORT = 9093;

const MIME = {
  html: 'text/html; charset=utf-8',
  css:  'text/css',
  js:   'application/javascript',
  png:  'image/png',
  jpg:  'image/jpeg',
  mp4:  'video/mp4',
  webm: 'video/webm',
  svg:  'image/svg+xml',
  ico:  'image/x-icon',
};

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Force-download endpoint — sends Content-Disposition: attachment
  // iOS Safari respects this and saves to Files
  if (url === '/dl') {
    const file = path.join(DIR, 'reel.mp4');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    const stat = fs.statSync(file);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="ProviaAi_Reel.mp4"',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  // Static files with Range support (needed for iOS video playback)
  let filePath = path.join(DIR, url === '/' ? 'download.html' : url);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('not found'); return; }
  if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'download.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('not found'); return; }
  }

  const ext  = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const total = stat.size;

  const range = req.headers['range'];
  if (range) {
    const [, s, e] = /bytes=(\d+)-(\d*)/.exec(range) || [];
    const start = parseInt(s, 10);
    const end   = e ? parseInt(e, 10) : total - 1;
    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${total}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': end - start + 1,
      'Content-Type':   mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type':   mime,
      'Content-Length': total,
      'Accept-Ranges':  'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}).listen(PORT, () => console.log(`Serving instagram/ on http://localhost:${PORT}`));
