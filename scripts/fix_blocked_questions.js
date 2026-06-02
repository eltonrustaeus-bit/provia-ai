// scripts/fix_blocked_questions.js
// Converts 65 of 68 blocked questions to text-based questions.
// 3 questions (501, 505, 524) are genuine duplicates and stay blocked.
//
// Strategy:
//   - Remove image dependency from rule/knowledge questions that don't need visuals
//   - Clean "Du väljer: " prefix from option text
//   - Set requiresImage=false, imageStatus="missing" → becomes active in live module
//   - Duplicates: mark with sourceStatus="duplicate_removed_blocked", stay blocked

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FINAL_PATH = path.join(ROOT, 'final_questions.json');

// Genuine duplicates — keep blocked, update sourceStatus for clarity
const DUPLICATE_IDS = new Set([501, 505, 524]);

// New question text for each blocked ID (removes visual/scenario framing)
const QUESTION_REWRITES = {
  6:   'Gula rektangulära skyltar som används för vägvisning tillhör vilken märkeskategori?',
  9:   'Hur nära framför ett övergångställe (i körriktningen) är det förbjudet att parkera?',
  10:  'Vilken regel gäller i en korsning utan vägmärken?',
  12:  'Vad ska du göra när trafikljuset visar gult och du kan bromsa på ett säkert sätt?',
  17:  'Du ska lämna en parkeringsplats och köra in på gatan. Vem har företräde?',
  19:  'Vad innebär en heldragen gul mittlinje på en väg?',
  20:  'Vad gäller vid en cykelöverfart markerad med blå skylt?',
  21:  'Du har precis passerat stopplinjen när trafikljuset slår om till rött. Vad gör du?',
  22:  'Trafikljuset är grönt. Måste du ändå väja för fotgängare/cyklister som tänker korsa?',
  34:  'Vad innebär ett runt vägmärke med röd kant och hastighetssiffran 70?',
  84:  'Vilken högsta hastighet gäller utanför tättbebyggt område om ingen gräns är skyltat?',
  87:  'Du lämnar en parkeringsplats. Vem behöver INTE väja — du eller trafiken på gatan?',
  88:  'Hur nära en korsning är parkering förbjudet?',
  90:  'Vad gäller för en cyklist vid ett vanligt övergångställe (inte cykelöverfart)?',
  91:  'Vilka regler gäller på en gårdsgata?',
  96:  'Högerregeln: du och ett fordon till vänster om dig möts i en korsning. Vem har företräde?',
  97:  'Vad gäller när ett körfält avsmalnar och fordon ska foga in i ett kvarvarande körfält?',
  98:  'Du kör på en huvudled. Ett fordon från en korsande väg ska komma in. Vem har företräde?',
  99:  'Vad ska du göra när trafikljuset visar rött?',
  100: 'Vad innebär blinkande gult trafikljus i en korsning?',
  106: 'Vad innebär märket C38 (runt märke med bild av bil som kör om ett annat fordon)?',
  110: 'Du kör i 90 km/h. Hur lång sträcka tillryggalägger bilen under 1 sekunds reaktionstid?',
  123: 'Vilka åtgärder kan polisen vidta om de misstänker att du kör påverkad av narkotika?',
  125: 'Vad är obligatorisk utrustning i alla personbilar i Sverige?',
  142: 'Du kör bakom ett tungt fordon. Hur bör du anpassa ditt säkerhetsavstånd jämfört med en personbil?',
  159: 'Vad gäller vid dubbla heldragna gula mittlinjer?',
  163: 'Vad innebär ett gult X upplyst ovanför ett körfält (körfältssignal på motorväg)?',
  164: 'Är det tillåtet att parkera framför en garageuppfart?',
  165: 'Vilka fordon är normalt tillåtna att använda ett kollektivtrafikfält (bussfil)?',
  170: 'Vad är din skyldighet som förare vid ett obevakat övergångställe?',
  171: 'Du har av misstag kört in på en motorväg i fel riktning. Vad ska du göra?',
  173: 'Du svänger i en korsning. Vem ska du alltid lämna företräde åt?',
  174: 'Är det tillåtet att svänga höger mot rött ljus i Sverige?',
  175: 'Du kör rakt fram i en korsning. En mötande bil svänger vänster. Vem har företräde?',
  177: 'Du genomför en manöver i en korsning och ett utryckningsfordon med blåljus/larm närmar sig. Vad gör du?',
  178: 'Du möter en spårvagn i en korsning och högerregeln ger dig företräde. Vad bör du tänka på?',
  179: 'I vilken del av körfältet håller du dig när du väntar på att svänga vänster i en korsning?',
  180: 'Vad markerar en heldragen vit väjningslinje tvärs över körriktningen?',
  181: 'Varför bör du sakta ner i god tid inför en korsning?',
  182: 'Högerregeln gäller och inget fordon befinner sig till din höger i korsningen. Vad gäller?',
  185: 'Vad innebär streckade gula mittlinjer på en väg?',
  189: 'Är omkörning tillåtet i eller precis inför en korsning?',
  195: 'Vad innebär en gul rektangulär hastighetsskylt (till skillnad från ett runt vitt märke med röd kant)?',
  391: 'Det börjar brinna i din bil inne i en vägtunnel. Vad gör du?',
  397: 'Vad innebär ett rött X upplyst ovanför ett körfält på motorväg?',
  407: 'Vad händer om du kör ett fordon utan giltig trafikförsäkring i Sverige?',
  500: 'Vad är skillnaden mellan förbudsmärkena C35 och C39?',
  502: 'Vad innebär datumparkering i Sverige?',
  509: 'En parkeringsskylt anger förbudet måndag–fredag kl 8–17. När är parkering tillåten?',
  510: 'Vad innebär en parkeringsskylt märkt "P 2 tim"?',
  514: 'Vad innebär vägmärket E22?',
  517: 'Vilket märke är ett vitt runt märke med ett rött P och ett diagonalt rött streck?',
  521: 'Vad innebär en skylt med "P" och en myntsymbol vid en parkeringsplats?',
  522: 'Det råder stannande- och parkeringsförbud. Tilläggsskylten visar "Utom taxi". Gäller förbudet taxi?',
  526: 'Vad innebär en gul heldragen kantlinje längs vägkanten?',
  527: 'En parkeringsskylt visar "Förbjudet röda dagar". Gäller förbudet även söndagar?',
  528: 'Gäller parkeringsförbudet (10 m) även på sidan BAKOM ett övergångställe (i körens riktning)?',
  538: 'Var börjar en ny hastighetsbegränsning gälla?',
  541: 'Vad innebär en gul rektangulär hastighetsskylt — är det en lagstadgad gräns?',
  542: 'Gäller ett vägmärke placerat på en sida av vägen för trafik i båda riktningarna?',
  547: 'Om en hastighetsskylt är oläslig — vilken hastighet ska du hålla?',
  567: 'Vad gäller vid en heldragen gul mittlinje (spärrlinje) på din sida?',
  568: 'Trafikljuset visar blinkande gult. Hur ska du köra?',
  570: 'En fotgängare vid kanten av ett övergångställe verkar vilja gå ut. Vad gäller för dig?',
  574: 'Högerregeln gäller. Bil A är till din vänster, Bil B till din höger. Vem lämnar du företräde åt?',
};

function stripDuValjer(text) {
  if (typeof text !== 'string') return text;
  const stripped = text.replace(/^Du väljer:\s*/i, '');
  if (stripped === text) return text;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function cleanOptions(q) {
  const fields = ['option_a', 'option_b', 'option_c', 'option_d'];
  const letters = ['A', 'B', 'C', 'D'];
  const updated = { ...q };

  for (const field of fields) {
    if (updated[field]) updated[field] = stripDuValjer(updated[field]);
  }

  if (updated.options && typeof updated.options === 'object') {
    const newOpts = {};
    for (const letter of letters) {
      newOpts[letter] = updated.options[letter]
        ? stripDuValjer(updated.options[letter])
        : updated.options[letter];
    }
    updated.options = newOpts;
  }

  return updated;
}

function convertToText(q) {
  const newQuestion = QUESTION_REWRITES[q.id];
  if (!newQuestion) return q;

  let out = cleanOptions(q);
  out = {
    ...out,
    question: newQuestion,
    question_type: 'text',
    requiresImage: false,
    imageUrl: null,
    image_url: null,
    imageStatus: 'missing',
    sourceStatus: 'curated_text_question_needs_official_review',
    validation: {
      ...(out.validation || {}),
      qa_approved: 'NEEDS_REVIEW',
      text_conversion: 'converted_from_blocked_scenario_question',
    },
  };

  return out;
}

function markDuplicate(q) {
  return {
    ...q,
    sourceStatus: 'duplicate_removed_blocked',
    validation: {
      ...(q.validation || {}),
      qa_approved: 'DUPLICATE_BLOCKED',
      note: 'Duplicate question removed from active pool',
    },
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8'));

  let converted = 0;
  let markedDuplicate = 0;
  let skipped = 0;

  const questions = raw.questions.map((q) => {
    if (q.imageStatus !== 'needs_verified_image') return q;

    if (DUPLICATE_IDS.has(q.id)) {
      markedDuplicate++;
      return markDuplicate(q);
    }

    if (QUESTION_REWRITES[q.id]) {
      converted++;
      return convertToText(q);
    }

    skipped++;
    return q;
  });

  raw.questions = questions;
  raw.metadata = {
    ...raw.metadata,
    last_updated: new Date().toISOString().slice(0, 10),
    fix_blocked_applied: `converted ${converted}, duplicates ${markedDuplicate}, skipped ${skipped}`,
  };

  fs.writeFileSync(FINAL_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  console.log(`Converted to text: ${converted}`);
  console.log(`Marked duplicate (blocked): ${markedDuplicate}`);
  console.log(`Skipped (no rewrite): ${skipped}`);

  // Verify active count
  const BLOCKED = new Set(['ai_generated', 'irrelevant', 'broken', 'needs_verified_image']);
  const active = questions.filter((q) => !BLOCKED.has(q.imageStatus)).length;
  console.log(`Active questions now: ${active} / ${questions.length}`);
}

main();
