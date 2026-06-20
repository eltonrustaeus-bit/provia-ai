const { chromium } = require('playwright');
const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs   = require('fs');
const path = require('path');

const ANIM_MS = 1600 + 4000*4 + 3200 + 800 + 2000;
const OUT_DIR = path.resolve(__dirname, '../instagram');
const FRAMES  = path.join(OUT_DIR, 'frames');
const CONCAT  = path.join(OUT_DIR, 'concat.txt');
const MP4     = path.join(OUT_DIR, 'reel.mp4');
const URL     = 'http://localhost:9093/reel.html';

// Try CDP screencast first, fall back to JPEG screenshot loop
async function captureViaCDP(page, context) {
  const client = await context.newCDPSession(page);
  const frames = [];
  const times  = [];

  await new Promise((resolve, reject) => {
    let ackPending = false;

    const sendAck = (sessionId) => {
      client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    };

    client.on('Page.screencastFrame', (event) => {
      const now = Date.now();
      const idx = frames.length;
      const p = path.join(FRAMES, `f${String(idx).padStart(6,'0')}.jpg`);
      fs.writeFileSync(p, Buffer.from(event.data, 'base64'));
      frames.push(p);
      times.push(now);
      if (idx % 20 === 0) process.stdout.write(`\r  CDP: ${idx} frames`);
      sendAck(event.sessionId);
    });

    client.send('Page.startScreencast', {
      format: 'jpeg', quality: 95,
      maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1,
    }).then(() => {
      // Let caller know session is ready
      resolve(client);
    }).catch(reject);
  });

  return { client, frames, times };
}

async function captureViaScreenshots(page) {
  const frames = [];
  const times  = [];
  const deadline = Date.now() + ANIM_MS;

  // Warm up — discard first screenshot (browser init cost)
  await page.screenshot({ type: 'jpeg', quality: 95 });

  let idx = 0;
  while (Date.now() < deadline) {
    const now = Date.now();
    const p = path.join(FRAMES, `f${String(idx).padStart(6,'0')}.jpg`);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    fs.writeFileSync(p, buf);
    frames.push(p);
    times.push(now);
    idx++;
    if (idx % 20 === 0) {
      const fps = Math.round(idx / ((Date.now() - times[0]) / 1000));
      process.stdout.write(`\r  ${idx} frames (~${fps}fps)`);
    }
  }
  return { frames, times };
}

(async () => {
  if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  console.log('Launching browser...');
  const browser = await chromium.launch({
    args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });

  console.log('Waiting for fonts (3s)...');
  await page.waitForTimeout(3000);

  let frames, times, cdpClient;

  // Try CDP first
  try {
    console.log('Starting CDP screencast...');
    const result = await captureViaCDP(page, context);
    cdpClient = result.client;

    // Start animation AFTER screencast is ready
    await page.evaluate(() => window.startReel && window.startReel());
    console.log('Recording...');
    await page.waitForTimeout(ANIM_MS);

    await cdpClient.send('Page.stopScreencast').catch(() => {});
    await page.waitForTimeout(300);

    frames = result.frames;
    times  = result.times;

    if (frames.length < 10) throw new Error(`CDP only got ${frames.length} frames`);
    console.log(`\nCDP captured ${frames.length} frames.`);

  } catch (err) {
    console.log(`\nCDP failed (${err.message}) — falling back to JPEG screenshots.`);
    // Clean existing frames
    if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
    fs.mkdirSync(FRAMES, { recursive: true });

    // Start animation then immediately capture
    await page.evaluate(() => window.startReel && window.startReel());
    const result = await captureViaScreenshots(page);
    frames = result.frames;
    times  = result.times;
    console.log(`\nScreenshot loop captured ${frames.length} frames.`);
  }

  await browser.close();

  if (frames.length === 0) throw new Error('No frames captured!');

  // Build durations from actual timestamps
  const durations = frames.map((_, i) => {
    if (i === 0) return 1/30;
    return Math.max((times[i] - times[i-1]) / 1000, 1/120);
  });

  // Concat file
  const lines = frames.map((p, i) =>
    `file '${p.replace(/\\/g, '/')}'\nduration ${durations[i].toFixed(6)}`
  ).join('\n') + `\nfile '${frames[frames.length-1].replace(/\\/g, '/')}'`;
  fs.writeFileSync(CONCAT, lines);

  const elapsed = (times[times.length-1] - times[0]) / 1000;
  const realFps = Math.round(frames.length / elapsed);
  console.log(`Actual capture rate: ~${realFps}fps over ${elapsed.toFixed(1)}s`);
  console.log('Encoding → H.264 60fps CRF 13 BT.709...');

  if (fs.existsSync(MP4)) fs.unlinkSync(MP4);
  execSync(
    `"${ffmpeg}" -y ` +
    `-f concat -safe 0 -i "${CONCAT}" ` +
    `-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 ` +
    `-map 0:v -map 1:a ` +
    `-c:v libx264 -preset slow -crf 13 ` +
    `-vf "fps=60,format=yuv420p" ` +
    `-colorspace bt709 -color_primaries bt709 -color_trc bt709 ` +
    `-c:a aac -b:a 64k ` +
    `-shortest -movflags +faststart ` +
    `"${MP4}"`,
    { stdio: 'inherit' }
  );

  fs.rmSync(FRAMES, { recursive: true });
  fs.unlinkSync(CONCAT);

  const mb = (fs.statSync(MP4).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ reel.mp4 — ${mb}MB · 1080×1920 · 60fps · H.264 · BT.709`);
  console.log(`  ~${realFps}fps source → 60fps output`);
})();
