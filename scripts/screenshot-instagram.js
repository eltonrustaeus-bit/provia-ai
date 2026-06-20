const { chromium } = require('playwright');
const path = require('path');

const posts = [
  'post_01_stats',
  'post_02_ai',
  'post_03_adaptive',
  'post_04_exam',
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });

  for (const name of posts) {
    const file = path.resolve(__dirname, `../instagram/${name}.html`);
    await page.goto(`file:///${file.replace(/\\/g, '/')}`);
    await page.waitForTimeout(800); // wait for Google Fonts
    const out = path.resolve(__dirname, `../instagram/${name}.png`);
    await page.screenshot({ path: out, type: 'png' });
    console.log(`✓ ${name}.png`);
  }

  await browser.close();
  console.log('Done — PNG files in instagram/');
})();
