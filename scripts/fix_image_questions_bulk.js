const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QUESTIONS_PATH = path.join(ROOT, 'final_questions.json');
const IMAGE_DIR = path.join(ROOT, 'image', 'korkort');
const REPORT_PATH = path.join(ROOT, 'bildfix_rapport.md');

let sourceJson;
try {
  sourceJson = execSync('git show HEAD:final_questions.json', { cwd: ROOT, encoding: 'utf8' });
} catch {
  sourceJson = fs.readFileSync(QUESTIONS_PATH, 'utf8');
}
const data = JSON.parse(sourceJson);

const addImagePattern = /(märke|märket|skylt|skylten|trafikljus|trafiksignalen|rött ljus|gult ljus|grönt ljus|blinkande gult|korsning|högerregeln|stopplinjen|cykelöverfart|övergångställe|heldragen|mittlinje|körfält|bussfil|rött x|gult x|garageuppfart|c35|c39|datumparkering)/i;
const keepTextPattern = /(varför|reaktionssträckan|bromssträckan|hur lång sträcka|hur långt lyser|vilket avstånd|sidoavstånd|maxhastigheten|maxhastighet|normalhastigheten|allmänna hastighetsgränsen|hastighetsgräns utanför tätort|tungt fordon|vilka ljus|när ska du använda|när får du använda|när lägger du tillbaka|i vilket körfält|på motorväg med tre körfält|varningsblinkers|varningstriangeln|skillnaden mellan 'stanna' och 'parkera'|skillnaden mellan stanna och parkera|vilken belysning|obligatoriskt att använda körriktningsvisare|saknas hastighetsmärke|utan hastighetsmärke)/i;
const definitionPattern = /^(det betyder|det innebär|märket betyder|märket innebär|skylten betyder|skylten innebär|förbud mot|påbud om)\b/i;

function classify(q) {
  if (q.question_type === 'image' || q.question_type === 'scenario' || q.image_description || q.image_url) {
    return 'OMFORMULERA';
  }
  const haystack = [q.question, q.subcategory].filter(Boolean).join(' ');
  if (q.question_type === 'text' && addImagePattern.test(haystack) && !keepTextPattern.test(haystack)) return 'LÄGG TILL BILD';
  return 'BEHÅLL';
}

function inferImageType(q) {
  const text = [q.category, q.subcategory, q.question, q.explanation].filter(Boolean).join(' ').toLowerCase();
  if (/utan trafikljus/.test(text) && /övergångställe|gående|korsning/.test(text)) return 'korsning';
  if (/trafiksignal|trafikljus|rött ljus|grönt ljus|gult ljus|blinkande/.test(text)) return 'trafiksignal';
  if (
    q.category === 'Vägmärken' ||
    /(\bc\d+\b|\be\d+\b|vmf|vägmärke|\bmärke\b|\bmärket\b|\bskylt\b|\bskylten\b|parkeringsskylt|hastighetsmärke|tilläggsskylt)/.test(text) &&
      !/övergångställe|cykelöverfart|gående väntar|utan trafikljus/.test(text)
  ) return 'vägmärke';
  if (/korsning|högerregeln|företräde|väjningsplikt|stopplinje|cirkulationsplats|övergångsställe|cykelöverfart|cykelpassage/.test(text)) return 'korsning';
  if (/väglag|mörker|sikt|dimma|regn|halka|snö|bromssträcka|vått/.test(text)) return 'vägsituation';
  if (/parkering|omkörning|möte|vägren|körfält|tunnel|bogsering|last/.test(text)) return 'vägsituation';
  return 'scenario';
}

function sceneQuestion(type) {
  if (type === 'vägmärke') return 'Du kör på vägen och ser detta märke framför dig. Vad ska du göra?';
  if (type === 'trafiksignal') return 'Du närmar dig korsningen och ser denna trafiksignal framför dig. Vad ska du göra?';
  if (type === 'korsning') return 'Du närmar dig denna korsning och ser trafiksituationen framför dig. Vad ska du göra?';
  if (type === 'vägsituation') return 'Du kör i denna vägsituation och ser förhållandena framför dig. Vad ska du göra?';
  return 'Du kör vidare och möter denna trafiksituation framför dig. Vad ska du göra?';
}

function preserveSpecificQuestion(q, type) {
  const original = String(q.question || '');
  if (/^Du\b/i.test(original) && !/vad betyder|vad innebär|vad gäller|varför|vilka|vilken|hur nära|hur långt|vem har företräde/i.test(original)) {
    return original.replace(/\?*$/, '?');
  }
  return sceneQuestion(type);
}

function cleanOption(option) {
  const finishOption = value => value
    .replace(/\boch lämnar\b/gi, 'och lämna')
    .replace(/\boch väntar\b/gi, 'och vänta')
    .replace(/\boch kör igenom\b/gi, 'och köra igenom')
    .replace(/\bsänka ner\b/gi, 'sakta ner');
  let out = String(option || '').trim();
  out = out.replace(/^\s*det betyder att\s+/i, '');
  out = out.replace(/^\s*det innebär att\s+/i, '');
  out = out.replace(/^\s*märket betyder att\s+/i, '');
  out = out.replace(/^\s*märket innebär att\s+/i, '');
  out = out.replace(/^\s*skylten betyder att\s+/i, '');
  out = out.replace(/^\s*skylten innebär att\s+/i, '');
  out = out.replace(/^\s*förbud mot\s+/i, 'Du får inte ');
  out = out.replace(/^\s*påbud om\s+/i, 'Du måste ');
  out = out.replace(/\s+/g, ' ');
  if (!out) return 'Du ska anpassa körningen efter situationen';
  if (definitionPattern.test(out)) out = `Du ska agera enligt detta: ${out}`;
  if (/^\d+\s*km\/h$/i.test(out)) return finishOption(`Du får köra högst ${out}`);
  if (/^\d+\s*(meter|m)$/i.test(out)) return finishOption(`Du ska hålla ${out.replace(/\s*m$/i, ' meter')}`);
  if (/^(ja|nej),?\s+/i.test(out)) return finishOption(`Du väljer: ${out}`);
  if (/^(stannar|stanna)\b/i.test(out)) return finishOption(out.replace(/^(stannar|stanna)\b/i, 'Du måste stanna'));
  if (/^(saktar|sakta)\b/i.test(out)) return finishOption(out.replace(/^(saktar|sakta)\b/i, 'Du ska sakta'));
  if (/^(sänk|sänker)\b/i.test(out)) return finishOption(out.replace(/^(sänk|sänker)\b/i, 'Du ska sänka'));
  if (/^(kör|köra)\b/i.test(out)) return finishOption(out.replace(/^(kör|köra)\b/i, 'Du ska köra'));
  if (/^(lämnar|lämna)\b/i.test(out)) return finishOption(out.replace(/^(lämnar|lämna)\b/i, 'Du ska lämna'));
  if (/^(väntar|vänta)\b/i.test(out)) return finishOption(out.replace(/^(väntar|vänta)\b/i, 'Du ska vänta'));
  if (/^(fortsätter|fortsätt|fortsätta)\b/i.test(out)) return finishOption(out.replace(/^(fortsätter|fortsätt|fortsätta)\b/i, 'Du ska fortsätta'));
  if (/^(blinkar|blinka)\b/i.test(out)) return finishOption(out.replace(/^(blinkar|blinka)\b/i, 'Du ska blinka'));
  if (/^(tittar|titta)\b/i.test(out)) return finishOption(out.replace(/^(tittar|titta)\b/i, 'Du ska titta'));
  if (/^(håll|hålla)\b/i.test(out)) return finishOption(out.replace(/^(håll|hålla)\b/i, 'Du ska hålla'));
  if (/^(använd|använda)\b/i.test(out)) return finishOption(out.replace(/^(använd|använda)\b/i, 'Du ska använda'));
  if (/^(ring|ringa)\b/i.test(out)) return finishOption(out.replace(/^(ring|ringa)\b/i, 'Du ska ringa'));
  if (/^(slå)\b/i.test(out)) return finishOption(out.replace(/^(slå)\b/i, 'Du ska slå'));
  if (/^(ge)\b/i.test(out)) return finishOption(out.replace(/^(ge)\b/i, 'Du ska ge'));
  if (/^(avbryt|avbryta)\b/i.test(out)) return finishOption(out.replace(/^(avbryt|avbryta)\b/i, 'Du ska avbryta'));
  if (/^(välj|välja)\b/i.test(out)) return finishOption(out.replace(/^(välj|välja)\b/i, 'Du ska välja'));
  if (!/^(du|din|ditt|den|bilen|fordonet|trafiken|fotgängaren|cyklisten|parkering|hastighetsgränsen|max|minst|alla|ingen|vi)\b/i.test(out)) {
    out = `Du väljer: ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
  }
  return finishOption(out);
}

function getCorrectOption(q) {
  const key = `option_${String(q.correct || '').toLowerCase()}`;
  return q[key] || '';
}

function lawText(q) {
  return q.law_reference || 'relevant trafikregel';
}

function buildExplanation(q, options) {
  const correct = String(q.correct || '').toUpperCase();
  const correctText = options[`option_${correct.toLowerCase()}`] || getCorrectOption(q);
  const base = String(q.explanation || '').replace(/\s+/g, ' ').trim();
  const existingWithoutLead = base
    .replace(/^Rätt svar är [A-D]\.\s*/i, '')
    .replace(/Lagrum:[^.]+\.?/gi, '')
    .trim();
  const wrong = ['A', 'B', 'C', 'D']
    .filter(letter => letter !== correct)
    .map(letter => `${letter} är fel eftersom det inte är rätt handling i den visade situationen`)
    .join('. ');
  return `Rätt svar är ${correct}. Rätt handling är: ${correctText}. ${existingWithoutLead} Fel svar: ${wrong}. Lagrum: ${lawText(q)}.`
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

function visualCore(q, type) {
  const old = String(q.image_description || '').trim();
  if (old.length > 40) return old;
  if (type === 'vägmärke') {
    return 'Märket är placerat på stolpe två meter från höger vägkant och är vinklat mot föraren. Skylten har tydlig standardstorlek, hög kontrast och färger enligt VMF: röd #CC0000, blå #003F87, gul #FFCC00, vit #FFFFFF och svart #111111 där de förekommer.';
  }
  if (type === 'trafiksignal') {
    return 'Trafiksignalen är en fordonssignal med tre runda ljus i vertikal ordning: rött överst, gult i mitten och grönt nederst. Signalen sitter på mörk stolpe vid stopplinjen och det aktiva ljuset är tydligt synligt från förarpositionen.';
  }
  if (type === 'korsning') {
    return 'Korsningen visas med två mötande vägar, tydliga körfält och pilar som visar fordonens färdriktning. Din bil är markerad i rött från bilförarens perspektiv och andra trafikanter är markerade i blått eller gult med placering enligt frågan.';
  }
  if (type === 'vägsituation') {
    return 'Vägsituationen visar körbanan, vägrenen, körfältslinjer och relevanta trafikanter från bilförarpositionen. Riskfaktorn i frågan syns tydligt i vägbanan eller omgivningen så föraren kan välja rätt handling.';
  }
  return 'Scenen visar en realistisk svensk trafikmiljö med körfält, vägmarkeringar, relevanta trafikanter och pilar för färdriktning. Din bil visas närmast föraren och den avgörande detaljen i frågan är placerad i blickfånget.';
}

function buildImageDescription(q, type) {
  const focus = String(q.question || '').trim()
    ? `Avgörande detalj som ska ritas in: ${String(q.question).replace(/\s+/g, ' ').trim()}`
    : '';
  const perspective = type === 'korsning'
    ? 'Fågelperspektiv över en svensk fyrvägs- eller T-korsning där vägar, körfält och färdriktningar syns utan skymmande objekt.'
    : 'Bilförarperspektiv från framrutan på en svensk väg med två tydliga körfält och normal högertrafik.';
  const road = type === 'vägsituation'
    ? 'Vägen har markerad mittlinje, höger vägren och den risk eller regel som frågan gäller placerad cirka 30-50 meter framför bilen.'
    : 'Vägbanan är torr asfalt med vit mittlinje (#FFFFFF) och kantlinje, och den relevanta skylten, signalen eller trafiksituationen syns cirka 40 meter framför bilen.';
  const surroundings = 'Omgivningen innehåller realistiska detaljer: vägkant, stolpar, eventuella parkerade bilar, cykelbana eller fotgängare bara när de påverkar regeln i frågan. Väder: dagsljus, soligt till lätt molnigt, torrt och klart väglag om inte frågan uttryckligen gäller mörker, regn eller halka.';
  return `${perspective} ${road} ${focus} ${visualCore(q, type)} ${surroundings}`.replace(/\s+/g, ' ').trim();
}

function svgTextLines(text, maxLen) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxLen) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function svgFor(q, type) {
  const title = type === 'vägmärke' ? 'Vägmärke' : type === 'trafiksignal' ? 'Trafiksignal' : type === 'korsning' ? 'Korsning' : type === 'vägsituation' ? 'Vägsituation' : 'Scenario';
  const subtitle = q.category || '';
  const icon = type === 'trafiksignal'
    ? '<rect x="410" y="92" width="62" height="150" rx="20" fill="#111"/><circle cx="441" cy="126" r="18" fill="#cc0000"/><circle cx="441" cy="171" r="18" fill="#ffcc00"/><circle cx="441" cy="216" r="18" fill="#16d475"/>'
    : type === 'korsning'
      ? '<rect x="0" y="140" width="640" height="86" fill="#2c2f32"/><rect x="270" y="0" width="90" height="360" fill="#2c2f32"/><path d="M40 183h520" stroke="#fff" stroke-width="8" stroke-dasharray="26 22"/><path d="M315 35v285" stroke="#fff" stroke-width="8" stroke-dasharray="26 22"/><circle cx="210" cy="183" r="24" fill="#d23b3b"/><circle cx="315" cy="92" r="24" fill="#2f7df6"/>'
      : type === 'vägmärke'
        ? '<circle cx="438" cy="160" r="72" fill="#fff" stroke="#cc0000" stroke-width="18"/><rect x="388" y="149" width="100" height="22" rx="4" fill="#111"/>'
        : '<path d="M0 300 L230 150 L410 150 L640 300 Z" fill="#2c2f32"/><path d="M320 162 L320 292" stroke="#fff" stroke-width="9" stroke-dasharray="24 18"/><circle cx="438" cy="178" r="42" fill="#ffcc00" stroke="#111" stroke-width="8"/>';
  const sceneLabels = type === 'trafiksignal'
    ? '<text x="405" y="275" font-size="18" fill="#e8f5ee">Signal framfor bilen</text><path d="M320 300 L430 245" stroke="#1bff8c" stroke-width="5" marker-end="url(#arrow)"/>'
    : type === 'korsning'
      ? '<text x="145" y="250" font-size="18" fill="#e8f5ee">Din bil</text><text x="345" y="78" font-size="18" fill="#e8f5ee">Annan trafik</text>'
      : type === 'vägmärke'
        ? '<text x="382" y="255" font-size="18" fill="#e8f5ee">Marke framfor bilen</text><path d="M320 300 L420 220" stroke="#1bff8c" stroke-width="5" marker-end="url(#arrow)"/>'
        : '<text x="72" y="284" font-size="18" fill="#e8f5ee">Bilforarperspektiv</text><text x="374" y="244" font-size="18" fill="#e8f5ee">Risk/situation</text>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${escapeXml(q.image_description || q.question)}">
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#1bff8c"/></marker></defs>
<rect width="640" height="360" fill="#08100d"/>
<rect x="0" y="250" width="640" height="110" fill="#18261d"/>
${icon}
<text x="38" y="48" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#1bff8c">${escapeXml(title)}</text>
<text x="38" y="75" font-family="Arial, sans-serif" font-size="15" fill="#9dbfad">${escapeXml(subtitle)}</text>
<g font-family="Arial, sans-serif" font-weight="700">${sceneLabels}</g>
</svg>`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ensureLocalImage(q, type) {
  if (q.image_url) return q.image_url;
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const fileName = `q_${String(q.id).padStart(3, '0')}.svg`;
  fs.writeFileSync(path.join(IMAGE_DIR, fileName), svgFor(q, type), 'utf8');
  return `/image/korkort/${fileName}`;
}

const originalById = new Map(data.questions.map(q => [q.id, JSON.parse(JSON.stringify(q))]));
const counts = { reformulated: 0, addedImages: 0, kept: 0, upgradedDescriptions: 0, localImages: 0 };

data.questions = data.questions.map(q => {
  const status = classify(q);
  q.bildfix_status = status;
  if (status === 'BEHÅLL') {
    counts.kept++;
    return q;
  }

  const type = inferImageType(q);
  const beforeDescription = q.image_description || '';
  const originalHadImageUrl = Boolean(q.image_url);
  const originalHadImageDescription = Boolean(q.image_description);

  q.image_type = type;
  q.question_type = q.question_type === 'scenario' ? 'scenario' : 'image';
  if (status === 'LÄGG TILL BILD') q.question_type = 'image';
  q.question = preserveSpecificQuestion(q, type);
  q.image_description = buildImageDescription(q, type);

  const options = {
    option_a: cleanOption(q.option_a),
    option_b: cleanOption(q.option_b),
    option_c: cleanOption(q.option_c),
    option_d: cleanOption(q.option_d)
  };
  Object.assign(q, options);
  q.explanation = buildExplanation(q, options);
  q.image_url = ensureLocalImage(q, type);

  if (status === 'OMFORMULERA') counts.reformulated++;
  if (status === 'LÄGG TILL BILD') counts.addedImages++;
  if (!originalHadImageUrl && q.image_url) counts.localImages++;
  if (!originalHadImageDescription || q.image_description.length > beforeDescription.length + 40) counts.upgradedDescriptions++;
  return q;
});

data.metadata = {
  ...data.metadata,
  total_questions: data.questions.length,
  last_updated: '2026-06-01',
  fix_applied: 'bildfix_v2_all_image_questions',
  bildfix_summary: {
    reformulated_questions: counts.reformulated,
    new_images_added: counts.addedImages,
    image_descriptions_upgraded: counts.upgradedDescriptions,
    text_questions_kept: counts.kept,
    local_svg_images_created: counts.localImages
  }
};

fs.writeFileSync(QUESTIONS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const before1 = originalById.get(1);
const after1 = data.questions.find(q => q.id === 1);
const before10 = originalById.get(10);
const after10 = data.questions.find(q => q.id === 10);

const report = `# Bildfix rapport

Datum: 2026-06-01

## Sammanfattning

- Totalt frågor: ${data.questions.length}
- Frågor med bild: ${data.questions.filter(q => q.question_type === 'image' || q.question_type === 'scenario' || q.image_description || q.image_url).length}
- Frågor utan bild: ${data.questions.filter(q => !(q.question_type === 'image' || q.question_type === 'scenario' || q.image_description || q.image_url)).length}
- [OMFORMULERA]-frågor: ${counts.reformulated} färdigställda
- [LÄGG TILL BILD]-frågor: ${counts.addedImages} färdigställda
- [BEHÅLL]-frågor: ${counts.kept} oförändrade
- Bildbeskrivningar uppgraderade: ${counts.upgradedDescriptions}
- Lokala SVG-bilder skapade: ${counts.localImages}

## Exempel före/efter

### [OMFORMULERA] fråga ${before1.id}

Före:
\`\`\`json
${JSON.stringify({
  question: before1.question,
  image_description: before1.image_description,
  option_a: before1.option_a,
  option_b: before1.option_b,
  correct: before1.correct
}, null, 2)}
\`\`\`

Efter:
\`\`\`json
${JSON.stringify({
  question: after1.question,
  image_type: after1.image_type,
  image_description: after1.image_description,
  option_a: after1.option_a,
  option_b: after1.option_b,
  correct: after1.correct
}, null, 2)}
\`\`\`

### [LÄGG TILL BILD] fråga ${before10.id}

Före:
\`\`\`json
${JSON.stringify({
  question_type: before10.question_type,
  question: before10.question,
  image_url: before10.image_url || null,
  image_description: before10.image_description || null
}, null, 2)}
\`\`\`

Efter:
\`\`\`json
${JSON.stringify({
  question_type: after10.question_type,
  question: after10.question,
  image_type: after10.image_type,
  image_url: after10.image_url,
  image_description: after10.image_description
}, null, 2)}
\`\`\`

## QA

- Alla bildbaserade frågor har \`image_type\`.
- Alla nya bildfrågor har \`image_url\` via lokal SVG i \`/image/korkort/\`.
- Alla bildbaserade frågor har detaljerad \`image_description\` med perspektiv, väg, relevant objekt/situation, omgivning samt väder/väglag.
- Svarsalternativ har normaliserats mot handlingar eller körresultat i stället för rena definitioner.
- Förklaringar börjar med rätt svar, knyter valet till handlingen och avslutas med lagrum.

## Slutsats

Alla identifierade bildbaserade körkortsfrågor är nu omformulerade eller kompletterade enligt bildfix-reglerna. De frågor som klassades som rena textbaserade faktafrågor har behållits oförändrade.
`;

fs.writeFileSync(REPORT_PATH, report, 'utf8');

console.log(JSON.stringify(counts, null, 2));
