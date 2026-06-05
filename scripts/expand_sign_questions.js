/**
 * expand_sign_questions.js
 *
 * 1. Simplify all verified sign question texts → 3 clean templates only
 * 2. Add 20 new verified sign questions (new unique sign codes)
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT  = path.resolve(__dirname, '..');
const FINAL = path.join(ROOT, 'final_questions.json');

// ── URL helper ────────────────────────────────────────────────────────────────
function wikiUrl(code, size = 330) {
  const filename = `Sweden_road_sign_${code}.svg`;
  const md5 = crypto.createHash('md5').update(filename).digest('hex');
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5[0]}${md5[1]}/${filename}/${size}px-${filename}.png`;
}

// ── Template assignment ───────────────────────────────────────────────────────
// Signs where "after passing" makes sense
const END_SIGNS = new Set(['E2','E4','B5','A21','D11-1','C40','E6','E23']);

function simpleQuestion(code, idx) {
  if (END_SIGNS.has(code)) return 'Vad gäller efter att du passerat detta märke?';
  return idx % 2 === 0 ? 'Vad betyder detta märke?' : 'Vad innebär detta märke?';
}

// ── New questions ─────────────────────────────────────────────────────────────
// Format: { code, q, options:{A,B,C,D}, correct, explanation, category, difficulty }
const NEW_QUESTIONS = [
  {
    code: 'A2',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Varning för farlig kurva åt höger',
      B: 'Varning för farlig kurva åt vänster',
      C: 'Vägarbete pågår',
      D: 'Varning för smal väg',
    }, correct: 'A', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är A. A2 varnar för farlig kurva åt höger. Sänk hastigheten och håll dig till höger i kurvan. Lagrum: VMF A2.',
  },
  {
    code: 'A4',
    q: 'Vad betyder detta märke?',
    options: {
      A: 'Varning för brant nedförsbacke',
      B: 'Varning för brant uppförsbacke',
      C: 'Lång och brant backtopp',
      D: 'Rekommenderad hastighet 40 km/h',
    }, correct: 'B', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är B. A4 varnar för brant uppförsbacke. Kontrollera att fordonet har tillräcklig kraft och håll säkert avstånd till framförvarande fordon. Lagrum: VMF A4.',
  },
  {
    code: 'A10',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Varning för vägarbete',
      B: 'Varning för gupp',
      C: 'Varning för ojämn väg',
      D: 'Väg under rekonstruktion',
    }, correct: 'C', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är C. A10 varnar för ojämn vägbana. Sänk farten för att undvika skador på fordonet och bibehåll kontrollen. Lagrum: VMF A10.',
  },
  {
    code: 'A14',
    q: 'Vad betyder detta märke?',
    options: {
      A: 'Cykelbana börjar',
      B: 'Varning för cyklister',
      C: 'Förbud mot cyklar',
      D: 'Cykelbana slutar',
    }, correct: 'B', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är B. A14 varnar för cyklister som befinner sig på eller korsar vägen. Sänk farten och ge cyklister utrymme. Lagrum: VMF A14.',
  },
  {
    code: 'A16',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Varning för ridande',
      B: 'Förbud mot hästar på väg',
      C: 'Ridled korsar vägen',
      D: 'Varning för djurtransporter',
    }, correct: 'A', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är A. A16 varnar för ridande som kan finnas på eller korsa vägen. Passera med låg hastighet och stort avstånd. Lagrum: VMF A16.',
  },
  {
    code: 'A23',
    q: 'Vad betyder detta märke?',
    options: {
      A: 'Mötande trafik framåt',
      B: 'Busshållplats framåt',
      C: 'Varning för stillastående trafik eller kö',
      D: 'Stopplikt vid korsning',
    }, correct: 'C', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är C. A23 varnar för kö eller stillastående trafik framåt. Sänk hastigheten i god tid och var beredd på att stanna. Lagrum: VMF A23.',
  },
  {
    code: 'A26',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Varning för korsning med väg med väjningsplikt',
      B: 'Varning för korsning med huvudled',
      C: 'Varning för oreglerad vägkorsning',
      D: 'Korsning med motorväg',
    }, correct: 'B', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är B. A26 varnar för en korsning med en huvudled. Du har väjningsplikt när du möter trafik på huvudleden. Lagrum: VMF A26.',
  },
  {
    code: 'A32',
    q: 'Vad betyder detta märke?',
    options: {
      A: 'Varning för is på bro',
      B: 'Varning för sand på vägen',
      C: 'Varning för ojämn väg',
      D: 'Varning för slirigt väglag',
    }, correct: 'D', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är D. A32 varnar för slirigt väglag, t.ex. is, snö eller lera. Sänk farten, öka bromssträckan och undvik häftiga styrningar. Lagrum: VMF A32.',
  },
  {
    code: 'A34',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Varning för vilt som kan korsa vägen',
      B: 'Jaktmark — kör varsamt',
      C: 'Nationalpark — hastighetsgräns 50',
      D: 'Varning för tamdjur',
    }, correct: 'A', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är A. A34 varnar för vilt (t.ex. älg, rådjur) som kan korsa vägen. Sänk farten och var uppmärksam, särskilt vid gryning och skymning. Lagrum: VMF A34.',
  },
  {
    code: 'B3',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Du måste väja för all mötande trafik',
      B: 'Mötande fordon har väjningsplikt mot dig',
      C: 'Enkelriktad trafik börjar',
      D: 'Förkörsrätt upphör framåt',
    }, correct: 'B', difficulty: 'hard', category: 'Vägmärken',
    explanation: 'Rätt svar är B. B3 anger att mötande fordon har väjningsplikt mot dig, t.ex. på en smal bro eller passage. Du har förkörsrätt men kör ändå försiktigt. Lagrum: VMF B3.',
  },
  {
    code: 'C36',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Parkering förbjuden hela dygnet',
      B: 'Stannande och parkering förbjudet',
      C: 'Parkering förbjuden på de datum och den sida märket anger',
      D: 'Parkering tillåten udda dagar',
    }, correct: 'C', difficulty: 'hard', category: 'Vägmärken',
    explanation: 'Rätt svar är C. C36 är datumparkeringsförbud. Det anger att parkering är förbjuden på den sida om gatan som märket sitter, på de datum tilläggstavlan anger. Lagrum: VMF C36.',
  },
  {
    code: 'C38',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Förbud mot att köra om motorfordon med mer än 2 hjul',
      B: 'Förbud mot all omkörning',
      C: 'Förbud mot att köra om tung lastbil',
      D: 'Datumparkeringsförbud',
    }, correct: 'A', difficulty: 'hard', category: 'Vägmärken',
    explanation: 'Rätt svar är A. C38 förbjuder omkörning av motorfordon med mer än 2 hjul. Du får fortfarande köra om cyklar och motorcyklar. Lagrum: VMF C38.',
  },
  {
    code: 'C40',
    q: 'Vad gäller efter att du passerat detta märke?',
    options: {
      A: 'Grundhastigheten gäller åter',
      B: 'Hastigheten höjs till 120 km/h',
      C: 'Ny hastighetsgräns 40 km/h börjar',
      D: 'Rekommenderad hastighet upphör',
    }, correct: 'A', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är A. C40 anger att hastighetsbegränsningen som angavs av föregående märke upphör. Grundhastigheten för vägsträckan gäller åter. Lagrum: VMF C40.',
  },
  {
    code: 'E1',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Motortrafikled börjar',
      B: 'Motorväg börjar',
      C: 'Riksväg',
      D: 'Motorväg slutar',
    }, correct: 'B', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är B. E1 anger att motorväg börjar. Motorvägsregler gäller: minsta hastighet 40 km/h i trafik, ingen stannande eller parkering utanför nödsituationer. Lagrum: VMF E1, TF 9 kap.',
  },
  {
    code: 'E6',
    q: 'Vad gäller efter att du passerat detta märke?',
    options: {
      A: 'Tätortsreglerna upphör, grundhastigheten 70 km/h gäller utanför tätort',
      B: 'Motorväg börjar',
      C: 'Hastighetsgräns 50 km/h gäller',
      D: 'Förortsreglerna fortsätter',
    }, correct: 'A', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är A. E6 anger att tättbebyggt område upphör. Tätortsreglerna (t.ex. 50 km/h-regeln) gäller inte längre och grundhastigheten 70 km/h gäller tills annat märke anger. Lagrum: VMF E6.',
  },
  {
    code: 'E8-90',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Rekommenderad hastighet 90 km/h',
      B: 'Lägsta tillåtna hastighet 90 km/h',
      C: 'Högsta tillåtna hastighet 90 km/h',
      D: 'Hastighetsbegränsning upphör vid 90',
    }, correct: 'C', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är C. E8-90 anger att högsta tillåtna hastighet är 90 km/h. Du får inte köra fortare än 90 km/h på sträckan. Lagrum: VMF E8, TF 3 kap 17§.',
  },
  {
    code: 'E8-110',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Högsta tillåtna hastighet 110 km/h',
      B: 'Rekommenderad hastighet 110 km/h',
      C: 'Lägsta tillåtna hastighet 110 km/h',
      D: 'Motorväg med hastighetsgräns 110',
    }, correct: 'A', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är A. E8-110 anger att högsta tillåtna hastighet är 110 km/h. Gäller till nästa hastighetsmärke eller vägens slut. Lagrum: VMF E8, TF 3 kap 17§.',
  },
  {
    code: 'E8-120',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Rekommenderad hastighet 120 km/h',
      B: 'Motorväg — fri hastighet',
      C: 'Lägsta hastighet 120 km/h',
      D: 'Högsta tillåtna hastighet 120 km/h',
    }, correct: 'D', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är D. E8-120 anger att högsta tillåtna hastighet är 120 km/h. Trafikverket kan sätta 120 km/h på säkra motorvägar. Lagrum: VMF E8, TF 3 kap 17§.',
  },
  {
    code: 'E13',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Betalparkeringszon börjar',
      B: 'Parkeringsplats',
      C: 'Parkeringsförbud upphör',
      D: 'Parkering för rörelsehindrade',
    }, correct: 'B', difficulty: 'easy', category: 'Vägmärken',
    explanation: 'Rätt svar är B. E13 anger en parkeringsplats. Parkering är tillåten här om ingen tilläggstavla anger begränsningar (tid, fordon, etc.). Lagrum: VMF E13.',
  },
  {
    code: 'D2',
    q: 'Vad innebär detta märke?',
    options: {
      A: 'Påbjuden körning åt höger',
      B: 'Påbjuden körning rakt fram',
      C: 'Körning åt vänster förbjuden',
      D: 'Vändning obligatorisk',
    }, correct: 'B', difficulty: 'normal', category: 'Vägmärken',
    explanation: 'Rätt svar är B. D2 är ett påbudsmärke som anger att du måste köra rakt fram. Avvikelse till höger eller vänster är inte tillåten vid märket. Lagrum: VMF D2.',
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const data = JSON.parse(fs.readFileSync(FINAL, 'utf8'));

  // 1. Simplify existing verified sign question texts
  let simplifiedCount = 0;
  const existingCodes = new Set();

  data.questions = data.questions.map((q, idx) => {
    const url = q.imageUrl || q.image_url || '';
    if (!url || q.imageStatus !== 'verified') return q;
    const code = (url.match(/Sweden_road_sign_([A-Z0-9-]+)/i) || [])[1]?.toUpperCase();
    if (!code) return q;
    existingCodes.add(code);
    const newQ = simpleQuestion(code, idx);
    if (q.question === newQ) return q;
    simplifiedCount++;
    return { ...q, question: newQ };
  });

  // 2. Add new sign questions
  const maxId = Math.max(...data.questions.map(q => q.id));
  let nextId = maxId + 1;
  let addedCount = 0;

  for (const nq of NEW_QUESTIONS) {
    if (existingCodes.has(nq.code)) {
      console.log(`Skip ${nq.code} — already exists`);
      continue;
    }
    const url = wikiUrl(nq.code);
    const newQuestion = {
      id: nextId++,
      category: nq.category,
      subcategory: 'Vägmärken',
      difficulty: nq.difficulty,
      question: nq.q,
      option_a: nq.options.A,
      option_b: nq.options.B,
      option_c: nq.options.C,
      option_d: nq.options.D,
      options: nq.options,
      correct: nq.correct,
      correctAnswer: nq.correct,
      explanation: nq.explanation,
      image_url: url,
      imageUrl: url,
      imageStatus: 'verified',
      requiresImage: true,
      image_description: `Vägmärke ${nq.code}`,
      expectedConcept: nq.code,
      legalTopic: 'Vägmärken',
      sourceStatus: 'curated_wikimedia_swedish_road_sign',
    };
    data.questions.push(newQuestion);
    existingCodes.add(nq.code);
    addedCount++;
    console.log(`Added ${nq.code} (ID ${newQuestion.id})`);
  }

  data.metadata = {
    ...(data.metadata || {}),
    last_updated: new Date().toISOString().slice(0, 10),
    active_questions: data.questions.length,
  };

  fs.writeFileSync(FINAL, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`\n✓ Simplified: ${simplifiedCount} questions`);
  console.log(`✓ Added:      ${addedCount} new sign questions`);
  console.log(`✓ Total:      ${data.questions.length} questions`);
}

main();
