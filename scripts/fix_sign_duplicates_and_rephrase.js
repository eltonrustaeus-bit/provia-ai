/**
 * fix_sign_duplicates_and_rephrase.js
 *
 * 1. Dedup: keep best question per unique sign-code (longest explanation)
 * 2. Rephrase: rewrite any question text that reveals the sign's meaning
 * 3. Save result to final_questions.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FINAL_PATH = path.join(ROOT, 'final_questions.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractSignCode(q) {
  const url = q.imageUrl || q.image_url || '';
  if (!url) return null;
  const m = String(url).match(/Sweden_road_sign_([A-Z]\d+(?:-\d+)?)/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

function explanationLength(q) {
  return (q.explanation || '').length;
}

// True when the question-text context clues already name the sign's function
const REVEALING_PATTERNS = [
  /barn ofta r[öo]r sig/i,
  /l[äa]mnar en motorv[äa]gsstr[äa]cka/i,
  /motortrafikled tar slut/i,
  /funderar p[åa] att parkera/i,
  /letar efter en plats att parkera/i,
  /plats avsedd f[öo]r taxitrafik/i,
  /bl[åa]tt m[äa]rke som rekommenderar/i,
  /fordonsbred[de]n [äa]r begr[äa]nsad/i,
  /j[äa]rnv[äa]gskorsning med bommar/i,
  /skid[åa]kare eller kabinbana/i,
  /sp[åa]rvagnstrafik/i,
  /arbete p[åa] eller vid v[äa]gen/i,
  /sidvind kan p[åa]verka/i,
  /tv[åa]hjuliga motordrivna fordon/i,
  /mopedtrafik begr[äa]nsas/i,
  /k[öo]rf[äa]lt f[öo]r linjetrafik/i,
  /gata d[äa]r g[åa]ende har en s[äa]rskild st[äa]llning/i,
  /efter att ha k[öo]rt p[åa] huvudled/i,
  /sitter f[öo]re korsningen/i,           // B2
  /sitter vid b[öo]rjan av str[äa]ckan/i, // B4
  /vid b[öo]rjan av en v[äa]g d[äa]r fordonstrafik begr/i, // C2
  /v[äa]g d[äa]r tv[åa]hjuliga/i,
  /v[äa]g d[äa]r mopedtrafik/i,
  /ovanf[öo]r eller vid ett k[öo]rf[äa]lt/i,
];

// Question templates per sign-code prefix
function pickTemplate(code) {
  if (!code) return 'Vad betyder detta märke?';
  const letter = code[0].toUpperCase();

  // Signs that END a restriction — "after passing" phrasing makes most sense
  const endSigns = new Set(['E2', 'E4', 'B5', 'C40', 'A21']);
  if (endSigns.has(code)) return 'Vad gäller omedelbart efter att du passerat detta märke?';

  // Distribute templates within each category using the numeric part for variety
  const num = parseInt(code.slice(1)) || 0;

  const byLetter = {
    A: [
      'Vad varnar detta märke dig för?',
      'Vilket beteende kräver detta varningsmärke av dig som förare?',
      'Du ser detta märke vid sidan av vägen. Vad innebär det för din körning?',
    ],
    B: [
      'Vad innebär detta märke för din framfart?',
      'Hur påverkar detta märke din företrädesrätt?',
      'Vad kräver detta märke av dig i korsningen?',
    ],
    C: [
      'Vilket förbud eller krav gäller på en väg med detta märke?',
      'Vad är förbjudet eller begränsat enligt detta märke?',
      'Vad innebär detta förbudsmärke?',
    ],
    D: [
      'Vad anger detta märke om tillåten körning?',
      'Vilket krav ställer detta märke på din körning?',
      'Vad innebär detta märke för hur du får köra?',
    ],
    E: [
      'Vad anger detta märke?',
      'Vad innebär det att du kör förbi detta märke?',
      'Vad gäller efter att du passerat detta märke?',
    ],
    F: [
      'Vad anger detta märke om vägen?',
      'Vilka regler gäller på en väg med detta märke?',
    ],
  };

  const group = byLetter[letter] || ['Vad betyder detta märke?'];
  return group[num % group.length];
}

function isRevealing(questionText) {
  return REVEALING_PATTERNS.some(re => re.test(questionText || ''));
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const data = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8'));

  // Group verified image questions by sign-code
  const byCode = new Map(); // code -> [question, ...]
  const noCode = [];

  for (const q of data.questions) {
    const hasImage = !!(q.imageUrl || q.image_url);
    const verified = q.imageStatus === 'verified';
    if (!hasImage || !verified) continue;

    const code = extractSignCode(q);
    if (!code) { noCode.push(q.id); continue; }

    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(q);
  }

  // Decide which to keep per group, collect IDs to remove
  const toRemove = new Set();
  const rewrites = new Map(); // id -> new question text

  let dupGroupsFixed = 0;
  let questionsRemoved = 0;

  for (const [code, group] of byCode) {
    if (group.length === 1) {
      // Single question — only rewrite if revealing
      const q = group[0];
      if (isRevealing(q.question)) {
        rewrites.set(q.id, pickTemplate(code));
      }
      continue;
    }

    // Multiple questions for same sign — keep best (longest explanation)
    const sorted = [...group].sort((a, b) => explanationLength(b) - explanationLength(a));
    const keep = sorted[0];
    const remove = sorted.slice(1);

    // Always rewrite the kept question text (context may reveal or be stale)
    rewrites.set(keep.id, pickTemplate(code));

    for (const r of remove) {
      toRemove.add(r.id);
    }

    dupGroupsFixed++;
    questionsRemoved += remove.length;
  }

  // Apply removals and rewrites
  let rewriteCount = 0;
  const finalQuestions = data.questions
    .filter(q => !toRemove.has(q.id))
    .map(q => {
      if (!rewrites.has(q.id)) return q;
      rewriteCount++;
      return { ...q, question: rewrites.get(q.id) };
    });

  data.questions = finalQuestions;
  data.metadata = {
    ...(data.metadata || {}),
    last_updated: new Date().toISOString().slice(0, 10),
    active_questions: finalQuestions.length,
    sign_dedup: {
      run_at: new Date().toISOString(),
      dup_groups_fixed: dupGroupsFixed,
      questions_removed: questionsRemoved,
      questions_rewritten: rewriteCount,
      no_code_image_questions: noCode.length,
    },
  };

  fs.writeFileSync(FINAL_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log('✓ Done');
  console.log(`  Duplicate sign groups fixed : ${dupGroupsFixed}`);
  console.log(`  Questions removed           : ${questionsRemoved}`);
  console.log(`  Questions rewritten         : ${rewriteCount}`);
  console.log(`  Final question count        : ${finalQuestions.length}`);
  console.log(`  Images without sign-code    : ${noCode.join(', ') || 'none'}`);
  if (toRemove.size) {
    console.log(`  Removed IDs                 : ${[...toRemove].sort((a,b)=>a-b).join(', ')}`);
  }
}

main();
