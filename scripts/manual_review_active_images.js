const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FINAL_PATH = path.join(ROOT, 'final_questions.json');
const REPORT_PATH = path.join(ROOT, 'manual_image_review_report.md');

const SOURCE = {
  transportstyrelsenSigns: 'https://www.transportstyrelsen.se/globalassets/global/publikationer-och-rapporter/vag/vagmarken/ts_poster70x100_2021-10-01_webb.pdf',
  yield: 'https://www.transportstyrelsen.se/sv/vagtrafik/trafikregler-och-vagmarken/vagmarken/vajningspliktsmarken/vajningsplikt/',
  stop: 'https://www.transportstyrelsen.se/sv/vagtrafik/trafikregler-och-vagmarken/vagmarken/vajningspliktsmarken/stopplikt/',
  parking: 'https://www.transportstyrelsen.se/sv/vagtrafik/trafikregler-och-vagmarken/vagmarken/anvisningsmarken/parkering/',
};

const REVIEWS = {
  1: {
    status: 'approved',
    code: 'B1',
    concept: 'Väjningsplikt',
    note: 'B1 is Väjningsplikt. Question, image, correct answer and explanation match.',
  },
  2: {
    status: 'approved',
    code: 'D1-3',
    concept: 'Påbjuden körriktning rakt fram',
    note: 'D1-3 is a mandatory direction sign. The correct answer requires driving straight ahead.',
  },
  5: {
    status: 'approved',
    code: 'E19',
    concept: 'Parkering',
    note: 'E19 is parking. Question and correct answer match.',
  },
  73: {
    status: 'approved',
    code: 'B2',
    concept: 'Stopplikt',
    note: 'B2 is Stopplikt. The answer requires a full stop before entering the crossing road/area.',
  },
  143: {
    status: 'approved',
    code: 'D1-3',
    concept: 'Påbjuden körriktning rakt fram',
    note: 'D1-3 image and mandatory straight-ahead answer match.',
  },
  148: {
    status: 'approved',
    code: 'C35',
    concept: 'Förbud mot att parkera fordon',
    note: 'C35 is parking prohibition. The answer distinguishes it from C39.',
  },
  351: {
    status: 'approved',
    code: 'A1-1',
    concept: 'Varning för farlig kurva åt höger',
    note: 'A1-1 warns for a dangerous curve. The question tests speed adaptation before a curve.',
  },
  352: {
    status: 'approved',
    code: 'A1-2',
    concept: 'Varning för farlig kurva åt vänster',
    note: 'A1-2 warns for a dangerous curve. The question tests braking before the curve.',
  },
  354: {
    status: 'blocked',
    code: 'A6',
    concept: 'Varning för bro',
    note: 'A6 is Varning för bro, but the question/explanation concerns a steep downhill. Blocked instead of pretending the image fits.',
  },
  368: {
    status: 'rewrite',
    code: 'C31-3',
    concept: 'Hastighetsbegränsning 30 km/h',
    question: 'Du ser ett hastighetsmärke som anger 30 km/h. Hur länge gäller hastighetsbegränsningen?',
    option_a: 'Tills du passerar ett nytt hastighetsmärke eller ett upphörandemärke',
    option_b: 'Bara under skoltid klockan 7-16',
    option_c: 'Bara för tung trafik',
    option_d: 'Endast 500 meter framåt',
    correct: 'A',
    explanation: 'Rätt svar är A. Märket C31 anger högsta tillåtna hastighet. Hastighetsbegränsningen gäller från märket tills en ny hastighetsbegränsning eller ett upphörandemärke anger något annat. Lagrum: VMF C31.',
    note: 'Image is a C31 speed limit sign. Original wording was incomplete; rewritten to match image and concept.',
  },
  551: {
    status: 'approved',
    code: 'C39',
    concept: 'Förbud mot att stanna och parkera fordon',
    note: 'C39 forbids both stopping and parking. Question and answer match.',
  },
  556: {
    status: 'approved',
    code: 'B1',
    concept: 'Väjningsplikt',
    note: 'B1 is Väjningsplikt. Question and answer match.',
  },
  558: {
    status: 'approved',
    code: 'E19',
    concept: 'Parkering',
    note: 'E19 is parking. Question and answer match.',
  },
};

function optionMap(q) {
  return { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
}

function applyApproved(q, review) {
  return {
    ...q,
    expectedConcept: `${review.concept} / ${review.code}`,
    legalTopic: review.concept,
    manualReview: {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Codex manual QA',
      evidence: ['Transportstyrelsen vägmärkesaffisch', 'Wikimedia Sweden road sign image'],
      note: review.note,
    },
  };
}

function applyRewrite(q, review) {
  const out = {
    ...q,
    question: review.question,
    option_a: review.option_a,
    option_b: review.option_b,
    option_c: review.option_c,
    option_d: review.option_d,
    correct: review.correct,
    correctAnswer: review.correct,
    explanation: review.explanation,
    law_reference: 'VMF C31',
    expectedConcept: `${review.concept} / ${review.code}`,
    legalTopic: review.concept,
    manualReview: {
      status: 'approved_after_rewrite',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Codex manual QA',
      evidence: ['Transportstyrelsen vägmärkesaffisch', 'Wikimedia Sweden road sign image'],
      note: review.note,
    },
  };
  out.options = optionMap(out);
  return out;
}

function applyBlocked(q, review) {
  return {
    ...q,
    imageStatus: 'needs_verified_image',
    imageUrl: null,
    image_url: null,
    requiresImage: true,
    sourceStatus: 'blocked_manual_image_review_mismatch',
    manualReview: {
      status: 'blocked',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Codex manual QA',
      evidence: ['Transportstyrelsen vägmärkesaffisch', 'Wikimedia Sweden road sign image'],
      note: review.note,
    },
    validation: {
      ...(q.validation || {}),
      qa_approved: 'NEEDS_REVIEW',
      manual_image_review: 'blocked',
    },
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8'));
  const reviewed = [];
  const blocked = [];
  const rewritten = [];

  raw.questions = raw.questions.map((q) => {
    const review = REVIEWS[q.id];
    if (!review) return q;
    reviewed.push(q.id);
    if (review.status === 'approved') return applyApproved(q, review);
    if (review.status === 'rewrite') {
      rewritten.push(q.id);
      return applyRewrite(q, review);
    }
    if (review.status === 'blocked') {
      blocked.push(q.id);
      return applyBlocked(q, review);
    }
    return q;
  });

  const active = raw.questions.filter(q => !['ai_generated', 'irrelevant', 'broken', 'needs_verified_image'].includes(q.imageStatus)).length;
  raw.metadata = {
    ...(raw.metadata || {}),
    last_updated: new Date().toISOString().slice(0, 10),
    active_questions: active,
    blocked_questions: raw.questions.length - active,
    manual_image_review: {
      reviewed: reviewed.length,
      approved: reviewed.length - blocked.length,
      blocked: blocked.length,
      rewritten: rewritten.length,
      source: SOURCE.transportstyrelsenSigns,
    },
  };

  fs.writeFileSync(FINAL_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  const report = [
    '# Manual Image Review Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Sources',
    `- Transportstyrelsen vägmärkesaffisch: ${SOURCE.transportstyrelsenSigns}`,
    `- B1 Väjningsplikt: ${SOURCE.yield}`,
    `- B2 Stopplikt: ${SOURCE.stop}`,
    `- E19 Parkering: ${SOURCE.parking}`,
    '',
    '## Reviewed Active Image Questions',
    ...Object.entries(REVIEWS).map(([id, review]) => `- ID ${id}: ${review.status.toUpperCase()} - ${review.code} ${review.concept}. ${review.note}`),
    '',
    `Active questions after manual image review: ${active}`,
    ''
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(JSON.stringify({ reviewed: reviewed.length, blocked, rewritten, active }, null, 2));
}

main();
