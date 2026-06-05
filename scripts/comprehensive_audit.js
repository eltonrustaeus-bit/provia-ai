/**
 * Comprehensive audit script for Provia körkortsfrågor
 * Checks: duplicates, formulation quality, answer correctness hints, image coverage
 */

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../final_questions.json'), 'utf8'));
const questions = data.questions;

const issues = {
  duplicates: [],
  formulation: [],
  imageMissing: [],
  imageUrlSuspect: [],
  answerSuspect: [],
  explanationMissing: [],
  shortExplanation: []
};

// ── 1. Duplicate detection (exact + near-exact) ──────────────────────────────
const qTextMap = {};
const qNormMap = {};

function normalize(str) {
  return str.toLowerCase()
    .replace(/[^a-zåäö0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

questions.forEach(q => {
  const text = q.question || '';
  const norm = normalize(text);

  if (qTextMap[text]) {
    issues.duplicates.push({
      type: 'EXACT',
      ids: [qTextMap[text], q.id],
      text: text.slice(0, 80)
    });
  } else {
    qTextMap[text] = q.id;
  }

  if (qNormMap[norm] && qNormMap[norm] !== q.id) {
    const existing = questions.find(x => x.id === qNormMap[norm]);
    if (existing && normalize(existing.question) === norm) {
      issues.duplicates.push({
        type: 'NEAR_EXACT',
        ids: [qNormMap[norm], q.id],
        text: norm.slice(0, 80)
      });
    }
  } else {
    qNormMap[norm] = q.id;
  }
});

// ── 2. Formulation issues ────────────────────────────────────────────────────
const badPhrases = [
  /vilket påstående är korrekt\?/i,       // vagt, undvika
  /vilket av följande stämmer\?/i,
  /vad är sant\?/i,
  /välj rätt svar/i,
  /^fråga:/i,
];

const tooShort = 20;
const tooLong = 200;

questions.forEach(q => {
  const text = q.question || '';

  if (text.length < tooShort) {
    issues.formulation.push({ id: q.id, type: 'TOO_SHORT', text });
  }
  if (text.length > tooLong) {
    issues.formulation.push({ id: q.id, type: 'TOO_LONG', text: text.slice(0,100)+'...' });
  }

  badPhrases.forEach(p => {
    if (p.test(text)) {
      issues.formulation.push({ id: q.id, type: 'VAGUE_PHRASING', text: text.slice(0,100) });
    }
  });

  // Options check - all 4 must exist
  const opts = [
    q.option_a || q.options?.A,
    q.option_b || q.options?.B,
    q.option_c || q.options?.C,
    q.option_d || q.options?.D
  ];
  if (opts.some(o => !o || o.trim().length < 2)) {
    issues.formulation.push({ id: q.id, type: 'MISSING_OPTION', opts });
  }

  // Correct answer must be A/B/C/D
  const correct = (q.correct || q.correctAnswer || '').toString().trim().toUpperCase();
  if (!['A','B','C','D'].includes(correct)) {
    issues.formulation.push({ id: q.id, type: 'INVALID_CORRECT_ANSWER', correct });
  }
});

// ── 3. Missing explanations ──────────────────────────────────────────────────
questions.forEach(q => {
  if (!q.explanation || q.explanation.trim().length === 0) {
    issues.explanationMissing.push({ id: q.id, cat: q.category, q: q.question?.slice(0,60) });
  } else if (q.explanation.trim().length < 30) {
    issues.shortExplanation.push({ id: q.id, explanation: q.explanation });
  }
});

// ── 4. Image coverage analysis ──────────────────────────────────────────────
const catImageCounts = {};
const catTotals = {};
const noImageButShouldHave = [];

// Categories that benefit most from images
const visualCategories = [
  'Korsningar', 'Möte & Omkörning', 'Väglag & Bromssträcka',
  'Mörker & Sikt', 'Parkering', 'Vägmärken'
];

questions.forEach(q => {
  catTotals[q.category] = (catTotals[q.category] || 0) + 1;
  const hasImg = !!(q.image_url || q.imageUrl);
  if (hasImg) catImageCounts[q.category] = (catImageCounts[q.category] || 0) + 1;

  if (!hasImg && visualCategories.includes(q.category)) {
    noImageButShouldHave.push({ id: q.id, cat: q.category, q: q.question?.slice(0,80) });
  }
});

issues.imageMissing = noImageButShouldHave;

// ── 5. Suspect image URLs ────────────────────────────────────────────────────
questions.forEach(q => {
  const url = q.image_url || q.imageUrl;
  if (!url) return;

  // Check URL-to-content consistency
  const questionText = (q.question || '').toLowerCase();
  const imgDesc = (q.image_description || q.imageDescription || '').toLowerCase();
  const urlLower = url.toLowerCase();

  // If question mentions a specific sign code, check URL roughly matches
  const signCodeMatch = questionText.match(/märke[t]?\s+([\w\d]+)/i) ||
                        questionText.match(/\b([A-Z]\d+)\b/);
  if (signCodeMatch) {
    const code = signCodeMatch[1].toLowerCase();
    if (!urlLower.includes(code) && !imgDesc.includes(code)) {
      issues.imageUrlSuspect.push({
        id: q.id,
        code,
        url: url.slice(0,80),
        q: q.question?.slice(0,80)
      });
    }
  }
});

// ── 6. Answer sanity checks ──────────────────────────────────────────────────
// Known answer facts from Swedish traffic law
const answerChecks = [
  // Speed limits
  { pattern: /grundhastighet.*?tättbebyggt/i, keyword: '50', note: '50 km/h i tättbebyggt' },
  { pattern: /grundhastighet.*?landsv/i, keyword: '70', note: '70 km/h på landsväg' },
  { pattern: /promillegräns.*?rattonyk/i, keyword: '0,2', note: 'Rattonykterhet >0,2 promille' },
  { pattern: /grov rattonyk/i, keyword: '1,0', note: 'Grov rattonykterhet >=1,0 promille' },
  { pattern: /bälteskrav.*?bak/i, keyword: 'ja', note: 'Bälteskrav gäller baksäte' },
  { pattern: /reaktionstid.*?sekund/i, keyword: '1', note: 'Normal reaktionstid ~1 sekund' },
  { pattern: /säkerhetss.*?framåt.*?barn/i, keyword: 'bakåt', note: 'Spädbarn ska sitta bakåtvänt' },
  { pattern: /däck.*?vinterdäck.*?december/i, keyword: 'december', note: 'Vinterdäckskrav 1 dec - 31 mars' },
];

questions.forEach(q => {
  const allText = (q.question + ' ' + (q.explanation || '')).toLowerCase();
  answerChecks.forEach(check => {
    if (check.pattern.test(allText)) {
      const correct = (q.correct || q.correctAnswer || '').toString().toUpperCase();
      const correctOpt = (q['option_' + correct.toLowerCase()] || q.options?.[correct] || '').toLowerCase();
      if (!correctOpt.includes(check.keyword)) {
        issues.answerSuspect.push({
          id: q.id,
          note: check.note,
          correctOpt,
          q: q.question?.slice(0,80)
        });
      }
    }
  });
});

// ── Report ───────────────────────────────────────────────────────────────────
const report = {
  summary: {
    total: questions.length,
    withImage: questions.filter(q => q.image_url || q.imageUrl).length,
    issues: {
      duplicates: issues.duplicates.length,
      formulation: issues.formulation.length,
      imageMissing: issues.imageMissing.length,
      answerSuspect: issues.answerSuspect.length,
      explanationMissing: issues.explanationMissing.length,
      shortExplanation: issues.shortExplanation.length
    }
  },
  imageCoverage: Object.keys(catTotals).map(cat => ({
    category: cat,
    total: catTotals[cat],
    withImage: catImageCounts[cat] || 0,
    pct: Math.round(((catImageCounts[cat]||0)/catTotals[cat])*100) + '%'
  })),
  issues
};

fs.writeFileSync(
  path.join(__dirname, '../audit_report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log('=== AUDIT COMPLETE ===');
console.log('Total questions:', report.summary.total);
console.log('With images:', report.summary.withImage);
console.log('\nISSUES FOUND:');
Object.entries(report.summary.issues).forEach(([k,v]) => console.log(' ', k+':', v));
console.log('\nIMAGE COVERAGE BY CATEGORY:');
report.imageCoverage.forEach(c => console.log(`  ${c.category}: ${c.withImage}/${c.total} (${c.pct})`));
console.log('\nFull report: audit_report.json');
