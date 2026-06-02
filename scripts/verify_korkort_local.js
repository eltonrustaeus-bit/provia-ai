const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serveFile(req, res) {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.resolve(ROOT, pathname.replace(/^\/+/, '') || 'index.html');
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function main() {
  const server = http.createServer(serveFile);
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto(`http://127.0.0.1:${PORT}/korkortet.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  const result = await page.evaluate(() => ({
    title: document.title,
    loaderHidden: document.querySelector('#pageLoader')?.classList.contains('hide') || false,
    loginVisible: getComputedStyle(document.querySelector('#loginScreen')).display !== 'none',
    questionCount: window.questions?.length || 0,
    localImageRefs: (window.questions || []).filter(q => String(q.image_url || q.imageUrl || '').includes('/image/korkort/')).length,
    blockedInPool: (window.questions || []).filter(q => ['ai_generated','irrelevant','broken','needs_verified_image'].includes(q.imageStatus)).length,
    visibleImages: document.querySelectorAll('.qImg').length,
    visibleText: document.body.innerText.slice(0, 300),
  }));
  const dataResult = await page.evaluate(async () => {
    const json = await fetch('/final_questions.json').then(r => r.json());
    const blockedStatuses = ['ai_generated','irrelevant','broken','needs_verified_image'];
    const blocked = json.questions.filter(q => blockedStatuses.includes(q.imageStatus));
    return {
      total: json.questions.length,
      active: json.questions.length - blocked.length,
      blocked: blocked.length,
      missingRequired: json.questions.filter(q => ['id','category','difficulty','question','options','correctAnswer','explanation','requiresImage','imageUrl','imageStatus','expectedConcept','legalTopic','sourceStatus'].some(k => q[k] === undefined)).length,
      localImageRefs: json.questions.filter(q => String(q.image_url || q.imageUrl || '').includes('/image/korkort/')).length,
    };
  });

  await browser.close();
  await new Promise(resolve => server.close(resolve));

  console.log(JSON.stringify({ result, dataResult, consoleErrors }, null, 2));
  if (!result.loaderHidden || !result.loginVisible || dataResult.active < 250 || dataResult.localImageRefs || dataResult.missingRequired || consoleErrors.length) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
