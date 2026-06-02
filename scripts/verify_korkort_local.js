const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;
const MIN_ACTIVE_QUESTIONS = 280;

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

async function verifyViewport(page, label) {
  const result = await page.evaluate(() => ({
    title: document.title,
    loaderHidden: document.querySelector('#pageLoader')?.classList.contains('hide') || false,
    loginVisible: getComputedStyle(document.querySelector('#loginScreen')).display !== 'none',
    questionCount: window.questions?.length || 0,
    localImageRefs: (window.questions || []).filter(q => String(q.image_url || q.imageUrl || '').includes('/image/korkort/')).length,
    blockedInPool: (window.questions || []).filter(q => ['ai_generated','irrelevant','broken','needs_verified_image'].includes(q.imageStatus)).length,
    duValjerInPool: (window.questions || []).filter(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
      return opts.some(o => typeof o === 'string' && /^Du väljer:/i.test(o));
    }).length,
  }));
  return { label, ...result };
}

async function main() {
  const server = http.createServer(serveFile);
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];

  // ── Desktop viewport ──
  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  desktopPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`[desktop] ${msg.text()}`); });
  desktopPage.on('pageerror', err => consoleErrors.push(`[desktop:pageerror] ${err.message}`));

  await desktopPage.goto(`http://127.0.0.1:${PORT}/korkortet.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await desktopPage.waitForTimeout(5000);
  const desktopResult = await verifyViewport(desktopPage, 'desktop-1280');

  // ── Mobile viewport ──
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobilePage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`); });
  mobilePage.on('pageerror', err => consoleErrors.push(`[mobile:pageerror] ${err.message}`));

  await mobilePage.goto(`http://127.0.0.1:${PORT}/korkortet.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(5000);
  const mobileResult = await verifyViewport(mobilePage, 'mobile-390');

  // ── JSON data checks ──
  const dataResult = await desktopPage.evaluate(async () => {
    const json = await fetch('/final_questions.json').then(r => r.json());
    const blockedStatuses = ['ai_generated','irrelevant','broken','needs_verified_image'];
    const blocked = json.questions.filter(q => blockedStatuses.includes(q.imageStatus));
    const REQUIRED = ['id','category','difficulty','question','options','correctAnswer','explanation','requiresImage','imageUrl','imageStatus','expectedConcept','legalTopic','sourceStatus'];
    const missingFields = json.questions.filter(q => REQUIRED.some(k => q[k] === undefined)).length;
    const localImageRefs = json.questions.filter(q => String(q.image_url || q.imageUrl || '').includes('/image/korkort/')).length;
    const duValjerOpts = json.questions.filter(q => {
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
      return opts.some(o => typeof o === 'string' && /^Du väljer:/i.test(o));
    }).length;
    const shortExpl = json.questions.filter(q => !blockedStatuses.includes(q.imageStatus) && (q.explanation||'').length < 40).length;
    const blockedButRequiresImage = json.questions.filter(q =>
      !blockedStatuses.includes(q.imageStatus) && q.requiresImage && !q.imageUrl && !q.image_url
    ).length;
    return {
      total: json.questions.length,
      active: json.questions.length - blocked.length,
      blocked: blocked.length,
      missingFields,
      localImageRefs,
      duValjerOpts,
      shortExpl,
      blockedButRequiresImage,
      metadata: json.metadata,
    };
  });

  await browser.close();
  await new Promise(resolve => server.close(resolve));

  const output = { desktopResult, mobileResult, dataResult, consoleErrors };
  console.log(JSON.stringify(output, null, 2));

  // ── Assertions ──
  const fails = [];

  if (!desktopResult.loaderHidden) fails.push('desktop: loader still visible');
  if (!desktopResult.loginVisible) fails.push('desktop: login screen not shown');
  if (!mobileResult.loaderHidden) fails.push('mobile: loader still visible');
  if (!mobileResult.loginVisible) fails.push('mobile: login screen not shown');

  if (dataResult.active < MIN_ACTIVE_QUESTIONS) fails.push(`active questions ${dataResult.active} < ${MIN_ACTIVE_QUESTIONS}`);
  if (dataResult.localImageRefs > 0) fails.push(`${dataResult.localImageRefs} local /image/korkort/ refs remain`);
  if (dataResult.missingFields > 0) fails.push(`${dataResult.missingFields} questions missing required fields`);
  if (dataResult.duValjerOpts > 0) fails.push(`${dataResult.duValjerOpts} questions still have "Du väljer:" in options`);
  if (desktopResult.blockedInPool > 0) fails.push(`${desktopResult.blockedInPool} blocked questions leaked into live pool`);
  if (desktopResult.localImageRefs > 0) fails.push(`${desktopResult.localImageRefs} local image refs in live pool`);
  if (consoleErrors.length > 0) fails.push(`${consoleErrors.length} console errors: ${consoleErrors.slice(0,3).join('; ')}`);

  if (fails.length > 0) {
    console.error('\nFAILED:');
    fails.forEach(f => console.error('  ✗', f));
    process.exit(1);
  } else {
    console.log('\nPASSED: all checks green');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
