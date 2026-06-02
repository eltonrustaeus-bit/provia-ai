const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FINAL_PATH = path.join(ROOT, 'final_questions.json');
const REPORT_PATH = path.join(ROOT, 'korkort_quality_audit.md');

const BLOCKED_IMAGE_STATUSES = new Set([
  'ai_generated',
  'irrelevant',
  'broken',
  'needs_verified_image',
]);

const REQUIRED_FIELDS = [
  'id', 'category', 'difficulty', 'question', 'options',
  'correctAnswer', 'explanation', 'requiresImage', 'imageUrl',
  'imageStatus', 'expectedConcept', 'legalTopic', 'sourceStatus',
];

function optionMap(q) {
  return {
    A: q.option_a || '',
    B: q.option_b || '',
    C: q.option_c || '',
    D: q.option_d || '',
  };
}

function isLocalGeneratedImage(url) {
  return typeof url === 'string' && /^\/?image\/korkort\/q_\d+\.svg$/i.test(url);
}

function isWikimediaRoadSign(url) {
  return typeof url === 'string' &&
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//i.test(url) &&
    /Sweden_road_sign_/i.test(url);
}

function stripDuValjer(text) {
  if (typeof text !== 'string') return text;
  const stripped = text.replace(/^Du väljer:\s*/i, '');
  if (stripped === text) return text;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function cleanQuestionOptions(q) {
  const out = { ...q };
  for (const field of ['option_a', 'option_b', 'option_c', 'option_d']) {
    if (out[field]) out[field] = stripDuValjer(out[field]);
  }
  if (out.options && typeof out.options === 'object') {
    out.options = Object.fromEntries(
      Object.entries(out.options).map(([k, v]) => [k, v ? stripDuValjer(v) : v])
    );
  }
  return out;
}

function inferLegalTopic(q) {
  return q.subcategory || q.category || 'Okategoriserat';
}

function inferExpectedConcept(q) {
  const parts = [q.category, q.subcategory, q.image_type].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Allman korkortsteori';
}

function hasPromptLikeImageDescription(q) {
  return /Bilforarperspektiv|Bilförarperspektiv|Fagelperspektiv|Fågelperspektiv|ska ritas in|#[0-9A-F]{6}|Omgivningen innehaller|Omgivningen innehåller/i
    .test(String(q.image_description || ''));
}

function hasDuValjerInOptions(q) {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d,
    q.options?.A, q.options?.B, q.options?.C, q.options?.D];
  return opts.some((o) => typeof o === 'string' && /^Du väljer:/i.test(o));
}

function hasAiSwedish(q) {
  return /Rätt handling är:/i.test(q.explanation || '') ||
    /^Du väljer:/im.test(q.question || '') ||
    /^Du kör vidare och möter denna trafiksituation/i.test(q.question || '') ||
    /^Du kör i denna vägsituation och ser förhållandena/i.test(q.question || '');
}

function hasVisualReference(q) {
  return /\bser detta märke\b|\btrafiksituationen framför\b|\bse bilden\b|\bförhållandena framför dig\b/i
    .test(q.question || '');
}

function hasShortExplanation(q) {
  return (q.explanation || '').length < 40;
}

function hasBrokenImageUrl(q) {
  const url = q.imageUrl || q.image_url;
  if (!url) return false;
  return !/^https?:\/\//i.test(url);
}

function hasRequiresImageMismatch(q) {
  // requiresImage=true but imageStatus=missing (active) → inconsistency
  if (q.requiresImage && q.imageStatus === 'missing' && !BLOCKED_IMAGE_STATUSES.has(q.imageStatus)) return true;
  // requiresImage=false but imageStatus=verified → inconsistency
  if (!q.requiresImage && q.imageStatus === 'verified') return true;
  return false;
}

function hardenQuestion(q) {
  let out = cleanQuestionOptions({ ...q });
  const url = out.image_url || out.imageUrl || null;
  const imageLike = Boolean(url || out.image_description || out.question_type === 'image' || out.question_type === 'scenario');
  const localGenerated = isLocalGeneratedImage(url);
  const wikimediaRoadSign = isWikimediaRoadSign(url);

  out.options = out.options || optionMap(out);
  out.correctAnswer = out.correctAnswer || out.correct || null;
  out.requiresImage = imageLike;
  out.expectedConcept = out.expectedConcept || inferExpectedConcept(out);
  out.legalTopic = out.legalTopic || inferLegalTopic(out);

  if (localGenerated) {
    out.imageStatus = 'needs_verified_image';
    out.imageUrl = null;
    out.image_url = null;
    out.image_description = null;
    out.sourceStatus = 'blocked_unverified_generated_svg';
    out.validation = {
      ...(out.validation || {}),
      image_validator: 'BLOCKED: local generated SVG, needs verified image',
      qa_approved: 'NEEDS_REVIEW',
    };
    return out;
  }

  if (wikimediaRoadSign) {
    out.imageStatus = 'verified';
    out.imageUrl = url;
    out.sourceStatus = out.sourceStatus || 'curated_wikimedia_swedish_road_sign';
  } else if (url) {
    out.imageStatus = out.imageStatus || 'needs_verified_image';
    out.imageUrl = null;
    out.image_url = null;
    out.sourceStatus = out.sourceStatus || 'blocked_unverified_image_source';
  } else if (imageLike) {
    out.imageStatus = out.imageStatus || 'needs_verified_image';
    out.imageUrl = null;
    out.image_url = null;
    out.sourceStatus = out.sourceStatus || 'blocked_missing_verified_image';
  } else {
    out.imageStatus = out.imageStatus || 'missing';
    out.imageUrl = null;
    out.image_url = null;
    out.sourceStatus = out.sourceStatus || 'curated_text_question_needs_official_review';
  }

  if (hasPromptLikeImageDescription(out) && !wikimediaRoadSign) {
    out.image_description = null;
  }

  if (BLOCKED_IMAGE_STATUSES.has(out.imageStatus)) {
    out.validation = {
      ...(out.validation || {}),
      qa_approved: 'NEEDS_REVIEW',
    };
  }

  return out;
}

function checkDuplicateQuestions(questions) {
  const seen = new Map();
  const dups = [];
  for (const q of questions) {
    // Image questions: include imageUrl in key — same text + different sign = not a duplicate
    const imageKey = (q.imageUrl || q.image_url) ? `|img:${q.imageUrl || q.image_url}` : '';
    const key = q.question.trim().toLowerCase() + imageKey;
    if (seen.has(key)) {
      dups.push({ id: q.id, duplicateOf: seen.get(key) });
    } else {
      seen.set(key, q.id);
    }
  }
  return dups;
}

function checkDuplicateOptions(q) {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
  return new Set(opts).size < opts.length;
}

function checkMultipleCorrect(q) {
  // Heuristic: if explanation mentions "alla", "a och b", "a, b" as correct
  const expl = (q.explanation || '').toLowerCase();
  return /alla .* rätt|alla alternativen|a och b är rätt|b och c är rätt/i.test(expl);
}

function summarize(questions) {
  const imageStatus = {};
  const sourceStatus = {};
  const blocked = [];
  const needsVerifiedImage = [];
  const qualityIssues = {
    missingRequiredFields: [],
    duplicateQuestions: [],
    duplicateOptions: [],
    shortExplanations: [],
    promptLikeDescriptions: [],
    aiSwedish: [],
    visualReferences: [],
    duplicateOptionsInQuestion: [],
    brokenImageUrls: [],
    requiresImageMismatch: [],
    duValjerOptions: [],
  };

  for (const q of questions) {
    imageStatus[q.imageStatus || '(none)'] = (imageStatus[q.imageStatus || '(none)'] || 0) + 1;
    sourceStatus[q.sourceStatus || '(none)'] = (sourceStatus[q.sourceStatus || '(none)'] || 0) + 1;
    if (BLOCKED_IMAGE_STATUSES.has(q.imageStatus)) blocked.push(q.id);
    if (q.imageStatus === 'needs_verified_image') needsVerifiedImage.push(q.id);

    const missing = REQUIRED_FIELDS.filter((f) => q[f] === undefined);
    if (missing.length) qualityIssues.missingRequiredFields.push({ id: q.id, missing });

    if (hasShortExplanation(q)) qualityIssues.shortExplanations.push(q.id);
    // only flag prompt-like descriptions for non-verified-image questions
    if (hasPromptLikeImageDescription(q) && q.imageStatus !== 'verified') qualityIssues.promptLikeDescriptions.push(q.id);
    if (hasAiSwedish(q)) qualityIssues.aiSwedish.push(q.id);
    // only flag visual references in non-image questions (verified images are fine)
    if (hasVisualReference(q) && q.imageStatus !== 'verified') qualityIssues.visualReferences.push(q.id);
    if (checkDuplicateOptions(q)) qualityIssues.duplicateOptionsInQuestion.push(q.id);
    if (hasBrokenImageUrl(q)) qualityIssues.brokenImageUrls.push(q.id);
    if (hasRequiresImageMismatch(q)) qualityIssues.requiresImageMismatch.push(q.id);
    if (hasDuValjerInOptions(q)) qualityIssues.duValjerOptions.push(q.id);
    if (checkMultipleCorrect(q)) qualityIssues.duplicateQuestions.push(q.id);
  }

  const dupQuestions = checkDuplicateQuestions(questions);
  qualityIssues.duplicateQuestions = dupQuestions;

  return {
    total: questions.length,
    active: questions.length - blocked.length,
    blocked: blocked.length,
    blockedIds: blocked,
    needsVerifiedImageIds: needsVerifiedImage,
    imageStatus,
    sourceStatus,
    qualityIssues,
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8'));
  const questions = raw.questions.map(hardenQuestion);
  const summary = summarize(questions);

  raw.metadata = {
    ...(raw.metadata || {}),
    last_updated: new Date().toISOString().slice(0, 10),
    validation_status: summary.blocked ? 'NEEDS_REVIEW' : 'APPROVED',
    active_questions: summary.active,
    blocked_questions: summary.blocked,
    blocked_image_statuses: [...BLOCKED_IMAGE_STATUSES],
    quality_hardening: 'blocked unverified generated/local images and added required metadata',
  };
  raw.questions = questions;

  fs.writeFileSync(FINAL_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  const qi = summary.qualityIssues;

  const report = [
    '# Korkort Quality Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- Total questions: ${summary.total}`,
    `- Active questions after safety filter: ${summary.active}`,
    `- Blocked questions: ${summary.blocked}`,
    '',
    '## Image Status',
    ...Object.entries(summary.imageStatus).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Source Status',
    ...Object.entries(summary.sourceStatus).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Quality Issues',
    `- Missing required fields: ${qi.missingRequiredFields.length} questions`,
    qi.missingRequiredFields.length
      ? qi.missingRequiredFields.slice(0, 10).map((x) => `  - ID ${x.id}: ${x.missing.join(', ')}`).join('\n')
      : '',
    `- Duplicate question text: ${qi.duplicateQuestions.length}`,
    qi.duplicateQuestions.length
      ? qi.duplicateQuestions.slice(0, 10).map((x) => `  - ID ${x.id} duplicates ID ${x.duplicateOf}`).join('\n')
      : '',
    `- Duplicate options within question: ${qi.duplicateOptionsInQuestion.length} (IDs: ${qi.duplicateOptionsInQuestion.join(', ') || 'none'})`,
    `- Short explanations (<40 chars): ${qi.shortExplanations.length} (IDs: ${qi.shortExplanations.join(', ') || 'none'})`,
    `- AI-style Swedish ("Rätt handling är:" / scenario framing): ${qi.aiSwedish.length} (IDs: ${qi.aiSwedish.join(', ') || 'none'})`,
    `- Visual references in question text: ${qi.visualReferences.length} (IDs: ${qi.visualReferences.join(', ') || 'none'})`,
    `- "Du väljer:" in options: ${qi.duValjerOptions.length} (IDs: ${qi.duValjerOptions.join(', ') || 'none'})`,
    `- Prompt-like image descriptions: ${qi.promptLikeDescriptions.length} (IDs: ${qi.promptLikeDescriptions.join(', ') || 'none'})`,
    `- Broken image URLs (non-http): ${qi.brokenImageUrls.length} (IDs: ${qi.brokenImageUrls.join(', ') || 'none'})`,
    `- requiresImage/imageStatus mismatch: ${qi.requiresImageMismatch.length} (IDs: ${qi.requiresImageMismatch.join(', ') || 'none'})`,
    '',
    '## Needs Verified Image',
    summary.needsVerifiedImageIds.length ? summary.needsVerifiedImageIds.join(', ') : 'None',
    '',
    '## Policy',
    'Questions with ai_generated, irrelevant, broken, or needs_verified_image image status are kept in the dataset for review but excluded from the live module.',
    '',
  ].join('\n');
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
}

main();
