/**
 * Check all image URLs in final_questions.json — report broken ones.
 * Usage: node scripts/check_images.js
 * Fix:   node scripts/check_images.js --fix
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const dataPath = path.join(__dirname, '../final_questions.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const questions = data.questions;

function wikimediaUrl(filename, size = 200) {
  const md5 = crypto.createHash('md5').update(filename).digest('hex');
  const p = md5[0] + '/' + md5[0] + md5[1] + '/' + filename;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${p}/${size}px-${filename}.png`;
}

function headUrl(url) {
  return new Promise(resolve => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProviaImageCheck/1.0)',
        'Accept': '*/*'
      },
      timeout: 10000
    };
    const req = https.request(options, res => {
      resolve({ status: res.statusCode, ok: res.statusCode < 400 });
    });
    req.on('error', () => resolve({ status: 0, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false }); });
    req.end();
  });
}

// Rate-limit: check N at a time
async function checkBatch(urls, batchSize = 5) {
  const results = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(u => headUrl(u)));
    results.push(...batchResults);
    if (i + batchSize < urls.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

async function main() {
  const fix = process.argv.includes('--fix');
  const withImages = questions.filter(q => q.image_url);
  console.log(`Checking ${withImages.length} questions with images…\n`);

  const urls = withImages.map(q => q.image_url);
  const results = await checkBatch(urls, 5);

  const broken = [];
  withImages.forEach((q, i) => {
    const r = results[i];
    if (!r.ok) {
      broken.push({ q, status: r.status, url: q.image_url });
      console.log(`❌ Q${q.id} [${q.category}] status=${r.status}`);
      console.log(`   URL: ${q.image_url}`);
      // Try to extract filename and recompute
      const fnMatch = q.image_url.match(/\/([^/]+\.svg)\/\d+px-/);
      if (fnMatch) console.log(`   Filename: ${fnMatch[1]} → recomputed: ${wikimediaUrl(fnMatch[1])}`);
      console.log();
    }
  });

  const ok = withImages.length - broken.length;
  console.log(`\n✅ OK: ${ok}/${withImages.length}`);
  console.log(`❌ Broken: ${broken.length}`);

  if (fix && broken.length > 0) {
    console.log('\n--- FIXING ---');
    let fixed = 0, removed = 0;
    broken.forEach(({ q, url }) => {
      const fnMatch = url.match(/\/([^/]+\.svg)\/\d+px-/);
      if (fnMatch) {
        const newUrl = wikimediaUrl(fnMatch[1]);
        if (newUrl !== url) {
          q.image_url = newUrl;
          console.log(`Fixed Q${q.id}: ${fnMatch[1]}`);
          fixed++;
        } else {
          // URL is correctly computed but still broken — remove image
          q.image_url = null;
          q.image_description = null;
          q.imageUrl = null;
          q.imageStatus = 'broken';
          console.log(`Removed Q${q.id} (URL correct but broken)`);
          removed++;
        }
      } else {
        // Non-Wikimedia URL or can't parse — remove
        q.image_url = null;
        q.imageUrl = null;
        q.imageStatus = 'broken';
        console.log(`Removed Q${q.id} (non-standard URL)`);
        removed++;
      }
    });
    data.metadata.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\nFixed: ${fixed}, Removed: ${removed}`);
  } else if (!fix && broken.length > 0) {
    console.log('\nRun with --fix to auto-fix recomputable URLs and remove truly broken ones.');
  }
}

main().catch(console.error);
