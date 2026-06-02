const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FINAL_PATH = path.join(ROOT, 'final_questions.json');
const TABLE_PATH = path.join(__dirname, 'road_sign_truth_table.json');
const REPORT_PATH = path.join(ROOT, 'road_sign_audit_report.md');

const BLOCKED = new Set(['ai_generated', 'irrelevant', 'broken', 'needs_verified_image']);
const table = JSON.parse(fs.readFileSync(TABLE_PATH, 'utf8')).signs;

function normalizeSwedish(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/–|—/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function codeFromQuestion(q) {
  const url = q.imageUrl || q.image_url || '';
  const match = String(url).match(/Sweden_road_sign_([A-Z]\d+(?:-\d+)?)/);
  if (!match) return null;
  return match[1].replace(/-\d+$/, '');
}

function answerText(q) {
  const correct = q.correctAnswer || q.correct;
  return {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  }[correct] || '';
}

function cleanPhrase(text) {
  return String(text || '')
    .replace(/Rätt handling är:\s*/g, '')
    .replace(/Du väljer:\s*/gi, '')
    .replace(/Du MÅSTE/g, 'Du måste')
    .replace(/Du ska köra inte in/g, 'Du ska inte köra in')
    .replace(/Du ska köra inte om/g, 'Du ska inte köra om')
    .replace(/och håller ratten/g, 'och hålla ratten')
    .replace(/och kontrollerar/g, 'och kontrollera');
}

function cleanQuestion(q) {
  const out = { ...q };
  for (const field of ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'explanation']) {
    if (out[field]) out[field] = cleanPhrase(out[field]);
  }
  out.options = {
    A: out.option_a || '',
    B: out.option_b || '',
    C: out.option_c || '',
    D: out.option_d || '',
  };
  out.correctAnswer = out.correctAnswer || out.correct;
  return out;
}

function includesAny(text, patterns) {
  return patterns.some(pattern => normalizeSwedish(text).includes(normalizeSwedish(pattern)));
}

function matchingIssues(q, truth) {
  const correctBlob = [
    q.question,
    answerText(q),
    q.explanation,
    q.expectedConcept,
    q.legalTopic,
  ].join(' ');

  const allBlob = [
    q.question,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.explanation,
    q.expectedConcept,
    q.legalTopic,
  ].join(' ');

  const issues = [];
  if (!includesAny(correctBlob, truth.required || [])) {
    issues.push(`missing required concept: ${(truth.required || []).join(' | ')}`);
  }

  for (const forbidden of truth.forbidden || []) {
    if (includesAny(correctBlob, [forbidden])) {
      issues.push(`forbidden concept in correct path: ${forbidden}`);
    }
  }

  // If the question itself names a conflicting high-signal concept, block even if a distractor is valid.
  const questionBlob = [q.question, q.expectedConcept, q.legalTopic].join(' ');
  for (const forbidden of truth.forbidden || []) {
    if (includesAny(questionBlob, [forbidden])) {
      issues.push(`forbidden concept in question metadata/text: ${forbidden}`);
    }
  }

  if (/detta märke|detta blå|detta gröna|det här märket/i.test(q.question || '') &&
      (!q.imageUrl && !q.image_url)) {
    issues.push('visual reference without image');
  }

  return issues;
}

function blockQuestion(q, code, truth, issues) {
  return {
    ...q,
    imageStatus: 'needs_verified_image',
    imageUrl: null,
    image_url: null,
    requiresImage: true,
    sourceStatus: 'blocked_road_sign_truth_table_mismatch',
    validation: {
      ...(q.validation || {}),
      qa_approved: 'NEEDS_REVIEW',
      road_sign_code: code,
      expected_sign: truth.name,
      audit_issues: issues,
    },
  };
}

function updateVerifiedMetadata(q, code, truth) {
  return {
    ...q,
    expectedConcept: `${truth.name} / ${code}`,
    legalTopic: truth.name,
    sourceStatus: q.sourceStatus || 'curated_wikimedia_swedish_road_sign',
    validation: {
      ...(q.validation || {}),
      road_sign_code: code,
      expected_sign: truth.name,
    },
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8'));
  const blocked = [];
  const passed = [];
  const unknown = [];
  const cleaned = [];

  raw.questions = raw.questions.map(original => {
    let q = cleanQuestion(original);
    if (JSON.stringify(q) !== JSON.stringify(original)) cleaned.push(q.id);

    if (q.imageStatus !== 'verified') return q;

    const code = codeFromQuestion(q);
    const truth = code && table[code];
    if (!truth) {
      unknown.push({ id: q.id, code: code || '(none)' });
      return blockQuestion(q, code || '(none)', { name: 'Unknown sign code' }, ['unknown sign code']);
    }

    const issues = matchingIssues(q, truth);
    if (issues.length) {
      blocked.push({ id: q.id, code, sign: truth.name, issues });
      return blockQuestion(q, code, truth, issues);
    }

    passed.push({ id: q.id, code, sign: truth.name });
    return updateVerifiedMetadata(q, code, truth);
  });

  const active = raw.questions.filter(q => !BLOCKED.has(q.imageStatus)).length;
  raw.metadata = {
    ...(raw.metadata || {}),
    last_updated: new Date().toISOString().slice(0, 10),
    validation_status: blocked.length || unknown.length ? 'NEEDS_REVIEW' : raw.metadata?.validation_status || 'NEEDS_REVIEW',
    active_questions: active,
    blocked_questions: raw.questions.length - active,
    road_sign_audit: {
      source: 'Transportstyrelsen vagmarkesaffisch 2021-10-01',
      passed: passed.length,
      blocked: blocked.length,
      unknown: unknown.length,
      cleaned: cleaned.length,
    },
  };

  fs.writeFileSync(FINAL_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  const report = [
    '# Road Sign Audit Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Source: Transportstyrelsen vagmarkesaffisch, TS poster 2021-10-01',
    '',
    `- Passed verified sign questions: ${passed.length}`,
    `- Blocked mismatched sign questions: ${blocked.length}`,
    `- Unknown sign-code questions: ${unknown.length}`,
    `- Cleaned language in questions: ${cleaned.length}`,
    `- Active questions after audit: ${active}`,
    '',
    '## Blocked',
    blocked.length
      ? blocked.map(x => `- ID ${x.id}: ${x.code} ${x.sign} - ${x.issues.join('; ')}`).join('\n')
      : 'None',
    '',
    '## Unknown Codes',
    unknown.length
      ? unknown.map(x => `- ID ${x.id}: ${x.code}`).join('\n')
      : 'None',
    '',
    '## Passed',
    passed.map(x => `- ID ${x.id}: ${x.code} ${x.sign}`).join('\n'),
    ''
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(JSON.stringify({ passed: passed.length, blocked, unknown, cleaned: cleaned.length, active }, null, 2));
}

main();
