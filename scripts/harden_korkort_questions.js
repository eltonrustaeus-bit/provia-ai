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

function hardenQuestion(q) {
  const out = { ...q };
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

function summarize(questions) {
  const imageStatus = {};
  const sourceStatus = {};
  const blocked = [];
  const needsVerifiedImage = [];

  for (const q of questions) {
    imageStatus[q.imageStatus || '(none)'] = (imageStatus[q.imageStatus || '(none)'] || 0) + 1;
    sourceStatus[q.sourceStatus || '(none)'] = (sourceStatus[q.sourceStatus || '(none)'] || 0) + 1;
    if (BLOCKED_IMAGE_STATUSES.has(q.imageStatus)) blocked.push(q.id);
    if (q.imageStatus === 'needs_verified_image') needsVerifiedImage.push(q.id);
  }

  return {
    total: questions.length,
    active: questions.length - blocked.length,
    blocked: blocked.length,
    blockedIds: blocked,
    needsVerifiedImageIds: needsVerifiedImage,
    imageStatus,
    sourceStatus,
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
    ...Object.entries(summary.imageStatus).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Source Status',
    ...Object.entries(summary.sourceStatus).map(([key, value]) => `- ${key}: ${value}`),
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
