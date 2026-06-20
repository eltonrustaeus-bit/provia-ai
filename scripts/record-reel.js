const { chromium } = require('playwright');
const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const ANIM_MS  = 1600 + 4000*4 + 3200 + 800; // animation duration
const OUT_DIR  = path.resolve(__dirname, '../instagram');
const WEBM     = path.join(OUT_DIR, 'reel_raw.webm');
const MP4      = path.join(OUT_DIR, 'reel.mp4');

// Load from HTTP server (port 9091) so Google Fonts load properly
const URL = 'http://localhost:9093/reel.html';

(async () => {
  console.log('Recording reel (high quality)...');

  const browser = await chromium.launch({
    args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1080, height: 1920 },
    },
  });

  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Wait for Google Fonts to fully render
  console.log('Waiting for fonts...');
  await page.waitForTimeout(3000);

  // Start animation via exposed function (not auto-start)
  await page.evaluate(() => window.startReel && window.startReel());

  // Record full animation
  console.log('Recording animation...');
  await page.waitForTimeout(ANIM_MS);

  const rawPath = await page.video().path();
  await context.close();
  await browser.close();

  // Move raw webm
  if (fs.existsSync(WEBM)) fs.unlinkSync(WEBM);
  fs.renameSync(rawPath, WEBM);
  console.log('Raw webm saved.');

  // Convert to high-quality MP4 (H.264, CRF 15, 8Mbps target, faststart for streaming)
  console.log('Converting to MP4 (high quality)...');
  if (fs.existsSync(MP4)) fs.unlinkSync(MP4);
  execSync(
    `"${ffmpeg}" -y -i "${WEBM}" -c:v libx264 -preset slow -crf 15 -b:v 8M -maxrate 10M -bufsize 16M -pix_fmt yuv420p -movflags +faststart -an "${MP4}"`,
    { stdio: 'inherit' }
  );

  const sizeMB = (fs.statSync(MP4).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ reel.mp4 — ${sizeMB}MB, 1080×1920, H.264 high quality`);
  console.log('  Ready to upload to Instagram Reels.');
})();
