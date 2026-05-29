import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'http://localhost:8765/korkortet.html';
const NEW_CATS = ['Vägtunnlar', 'Bogsering & Lastsäkring', 'Fordon & Besiktning', 'Körning med Släp', 'Nödsituationer'];

const log = (...a) => console.log(...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', m => { if (m.type() === 'error') log('CONSOLE ERR:', m.text()); });
page.on('pageerror', e => log('PAGE ERR:', e.message));

log('1. Navigating to', URL);
await page.goto(URL, { timeout: 20000 });

// Wait for questions to load (spinner disappears or categories appear)
await page.waitForTimeout(4000);

const screenshot1 = 'scripts/verify_1_loaded.png';
await page.screenshot({ path: screenshot1, fullPage: false });
log('Screenshot 1:', screenshot1);

// Check if questions loaded — look for category selector or question count
const bodyText = await page.textContent('body');

// Check new categories appear in the UI
log('\n2. Checking new categories in UI...');
for (const cat of NEW_CATS) {
  const found = bodyText.includes(cat);
  log(`  ${found ? 'OK' : 'MISSING'} "${cat}"`);
}

// Find category selector
const catSelect = page.locator('select').first();
const catOptions = await catSelect.locator('option').allTextContents().catch(() => []);
log('\n3. Category options in selector:', catOptions.length, 'total');
for (const cat of NEW_CATS) {
  const found = catOptions.some(o => o.includes(cat));
  log(`  ${found ? 'OK' : 'MISSING'} "${cat}"`);
}

// Try selecting Vägtunnlar and starting a quiz
log('\n4. Selecting Vägtunnlar category...');
const tunnelOption = catOptions.find(o => o.includes('Vägtunnlar'));
if (tunnelOption) {
  await catSelect.selectOption({ label: tunnelOption });
  await page.waitForTimeout(500);

  // Click Start/Starta button
  const startBtn = page.locator('button').filter({ hasText: /starta|start|börja/i }).first();
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForTimeout(2000);
    log('  Clicked start button');
  }

  const screenshot2 = 'scripts/verify_2_question.png';
  await page.screenshot({ path: screenshot2, fullPage: false });
  log('  Screenshot 2:', screenshot2);

  // Check question text appeared
  const qText = await page.locator('[id*="qText"], .question-text, h2, h3').first().textContent().catch(() => '');
  log('  Question text:', qText.slice(0, 80));

  // Check category label
  const catLabel = await page.locator('[id*="qCat"], .cat-label').first().textContent().catch(() => '');
  log('  Category label:', catLabel);

  // Click an answer (option A)
  const optBtns = page.locator('button').filter({ hasText: /^[A-D]|option/i });
  const optCount = await optBtns.count();
  log('  Answer buttons found:', optCount);

  if (optCount > 0) {
    await optBtns.first().click();
    await page.waitForTimeout(1500);

    const screenshot3 = 'scripts/verify_3_answered.png';
    await page.screenshot({ path: screenshot3, fullPage: false });
    log('  Screenshot 3 (after answer):', screenshot3);

    // Check explanation appeared
    const bodyAfter = await page.textContent('body');
    const hasExplanation = bodyAfter.length > bodyText.length + 50;
    log('  Explanation/feedback appeared:', hasExplanation);
  }
} else {
  log('  WARN: Vägtunnlar not found in dropdown');
}

// Probe: check a Nödsituationer question
log('\n5. PROBE - Selecting Nödsituationer...');
const nodOption = catOptions.find(o => o.includes('Nödsituationer'));
if (nodOption) {
  await catSelect.selectOption({ label: nodOption });
  await page.waitForTimeout(300);
  const countText = bodyText.match(/(\d+)\s*fråg/i);
  log('  Nödsituationer found in selector: OK');
} else {
  log('  WARN: Nödsituationer missing from selector');
}

// Check total question count
log('\n6. Checking total question count in DB via Supabase...');
const dbCount = await page.evaluate(async () => {
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubW90ZGx1aWd6ZWVoZGpiaGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMzcwODQsImV4cCI6MjA4NTkxMzA4NH0.pEV4zBWqxnrPVyvrenPVArXxvXr1eRU1eRaXhl7AIY8';
  const r = await fetch('https://mnmotdluigzeehdjbhbu.supabase.co/rest/v1/driving_questions?select=count', {
    headers: { apikey: KEY, 'Prefer': 'count=exact' }
  });
  return r.headers.get('content-range');
}).catch(() => 'unavailable');
log('  DB Content-Range:', dbCount);

await browser.close();
log('\nDone.');
