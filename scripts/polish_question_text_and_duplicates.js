const fs = require('fs');

const file = 'final_questions.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const signNames = {
  A1: 'Varning för farlig kurva',
  A3: 'Varning för nedförslutning',
  A5: 'Varning för avsmalnande väg',
  A6: 'Varning för bro',
  A7: 'Varning för kaj',
  A9: 'Varning för farthinder',
  A12: 'Varning för stenras',
  A13: 'Varning för övergångsställe',
  A15: 'Varning för barn',
  A17: 'Varning för skid- eller kabinbana',
  A20: 'Varning för vägarbete',
  A21: 'Slut på sträcka med vägarbete',
  A22: 'Varning för flerfärgssignal',
  A24: 'Varning för sidvind',
  A25: 'Varning för mötande trafik',
  A31: 'Varning för långsamtgående fordon',
  A33: 'Varning för terrängskotertrafik',
  A35: 'Varning för järnvägskorsning med bommar',
  A36: 'Varning för järnvägskorsning utan bommar',
  A37: 'Varning för korsning med spårväg',
  B1: 'Väjningsplikt',
  B2: 'Stopplikt',
  B4: 'Huvudled',
  B5: 'Huvudled upphör',
  B6: 'Väjningsplikt mot mötande trafik',
  B7: 'Mötande trafik har väjningsplikt',
  C1: 'Förbud mot infart med fordon',
  C2: 'Förbud mot trafik med fordon',
  C3: 'Förbud mot trafik med annat motordrivet fordon än moped klass II',
  C5: 'Förbud mot trafik med motorcykel och moped klass I',
  C11: 'Förbud mot trafik med moped klass II',
  C16: 'Begränsad fordonsbredd',
  C17: 'Begränsad fordonshöjd',
  C31: 'Hastighetsbegränsning',
  C35: 'Förbud mot att parkera fordon',
  C38: 'Datumparkering',
  C39: 'Förbud mot att stanna och parkera fordon',
  D1: 'Påbjuden körriktning',
  D3: 'Påbjuden cirkulationsplats',
  D4: 'Påbjuden cykelbana',
  D10: 'Påbjudet körfält för fordon i linjetrafik',
  D11: 'Slut på påbjuden bana, körfält, väg eller led',
  E1: 'Motorväg',
  E2: 'Motorväg upphör',
  E3: 'Motortrafikled',
  E4: 'Motortrafikled upphör',
  E5: 'Tättbebyggt område',
  E7: 'Gågata',
  E9: 'Gångfartsområde',
  E11: 'Rekommenderad lägre hastighet',
  E19: 'Parkering',
  E23: 'Taxi'
};

const distractors = {
  A: ['Varning för vägarbete', 'Varning för barn', 'Varning för farlig kurva', 'Varning för övergångsställe'],
  B: ['Väjningsplikt', 'Stopplikt', 'Huvudled', 'Mötande trafik har väjningsplikt'],
  C: ['Förbud mot trafik med fordon', 'Förbud mot infart med fordon', 'Förbud mot att parkera fordon', 'Hastighetsbegränsning'],
  D: ['Påbjuden cykelbana', 'Påbjuden cirkulationsplats', 'Påbjuden körriktning', 'Påbjudet körfält för fordon i linjetrafik'],
  E: ['Motorväg upphör', 'Motortrafikled', 'Gågata', 'Parkering']
};

const actionText = {
  A1: 'Du ska anpassa hastigheten innan kurvan och vara beredd på sämre sikt.',
  A3: 'Du ska anpassa farten och använda rätt växel så att du behåller kontrollen i nedförslutningen.',
  A5: 'Du ska sänka farten och vara beredd på möte eller sidoförflyttning.',
  A6: 'Du ska vara uppmärksam på bron och anpassa farten efter väg- och mötesförhållanden.',
  A7: 'Du ska vara särskilt uppmärksam eftersom vägen går nära kaj eller vatten.',
  A9: 'Du ska sänka farten i god tid för att passera farthindret säkert.',
  A12: 'Du ska vara beredd på sten eller ras på vägbanan.',
  A13: 'Du ska vara beredd på ett övergångsställe och på gående som kan korsa vägen.',
  A15: 'Du ska vara extra uppmärksam på barn och anpassa farten.',
  A17: 'Du ska vara uppmärksam på skidåkare eller kabinbana i närheten.',
  A20: 'Du ska anpassa farten och vara beredd på vägarbetare, hinder och ändrad vägledning.',
  A21: 'Vägarbetssträckan upphör, men du ska fortsätta köra efter de märken och förhållanden som gäller.',
  A22: 'Du ska vara beredd på trafiksignal längre fram.',
  A24: 'Du ska hålla stadigt i ratten och vara beredd på kraftig sidvind.',
  A25: 'Du ska vara beredd på mötande trafik på en sträcka där det annars kan ha varit enkelriktat eller separerat.',
  A31: 'Du ska vara beredd på långsamtgående fordon och anpassa avstånd och hastighet.',
  A33: 'Du ska vara uppmärksam på terrängskotrar som kan korsa vägen.',
  A35: 'Du ska vara beredd på en järnvägskorsning med bommar och följa signaler och bommar.',
  A36: 'Du ska vara beredd på en järnvägskorsning utan bommar och kontrollera noga innan du passerar.',
  A37: 'Du ska vara beredd på spårvagnstrafik och anpassa körningen.',
  B1: 'Du ska lämna företräde åt trafiken på den korsande vägen och stanna bara om det behövs.',
  B2: 'Du måste stanna helt och därefter lämna företräde innan du kör vidare.',
  B4: 'Du kör på huvudled, men ska fortfarande anpassa körningen och vara uppmärksam.',
  B5: 'Huvudleden upphör och därefter avgörs företrädet av andra märken eller grundregler.',
  C1: 'Du får inte köra in från detta håll.',
  C2: 'Du får inte köra in på vägen eftersom trafik med fordon är förbjuden.',
  C3: 'Förbudet gäller annat motordrivet fordon än moped klass II.',
  C5: 'Förbudet gäller motorcykel och moped klass I.',
  C11: 'Förbudet gäller trafik med moped klass II.',
  C16: 'Fordon som är bredare än angivet på märket får inte passera.',
  C17: 'Fordon som är högre än angivet på märket får inte passera.',
  C31: 'Du får inte köra fortare än den hastighet som anges på märket.',
  C35: 'Du får inte parkera på den sida där märket gäller.',
  C38: 'Datumparkering gäller enligt reglerna för udda och jämna datum.',
  C39: 'Du får varken stanna eller parkera där märket gäller.',
  D1: 'Du måste köra i den riktning pilen visar.',
  D3: 'Du måste köra runt cirkulationsplatsen i angiven riktning.',
  D10: 'Körfältet är påbjudet för fordon i linjetrafik.',
  D11: 'Den påbjudna banan, vägen, leden eller körfältet upphör.',
  E2: 'Motorvägen upphör och du ska anpassa körningen till de regler som gäller efter märket.',
  E3: 'Vägen är motortrafikled.',
  E4: 'Motortrafikleden upphör.',
  E5: 'Du kör in i tättbebyggt område.',
  E7: 'Vägen är gågata och fordonstrafik är starkt begränsad.',
  E11: 'Märket anger en rekommenderad lägre hastighet.',
  E19: 'Märket anger plats eller område där parkering är tillåten enligt villkoren på platsen.',
  E23: 'Märket anger plats för taxi.'
};

const scenarioText = {
  A1: 'Du närmar dig en kurvig vägsträcka och ser märket på bilden',
  A3: 'Du kör mot en brant nedförsbacke och ser märket på bilden',
  A5: 'Vägbanan smalnar av längre fram och du ser märket på bilden',
  A6: 'Du närmar dig en bro och ser märket på bilden',
  A7: 'Vägen går nära kaj eller vatten och du ser märket på bilden',
  A9: 'Du ser märket innan ett farthinder på vägen',
  A12: 'Du kör längs en sträcka där sten kan rasa ned på vägen',
  A13: 'Du närmar dig en plats där gående kan korsa vägen',
  A15: 'Du kör i ett område där barn ofta rör sig nära vägen',
  A17: 'Du närmar dig en plats där skidåkare eller kabinbana kan förekomma',
  A20: 'Du kommer fram mot en sträcka med arbete på eller vid vägen',
  A21: 'Du passerar märket i slutet av en vägarbetssträcka',
  A22: 'Du närmar dig trafiksignaler och ser märket på bilden',
  A24: 'Du kör på en öppen sträcka där sidvind kan påverka bilen',
  A25: 'Du kör på en sträcka där mötande trafik kan förekomma',
  A31: 'Du kör på en väg där långsamtgående fordon kan finnas längre fram',
  A33: 'Du kör där terrängskotrar kan korsa vägen',
  A35: 'Du närmar dig en järnvägskorsning med bommar',
  A36: 'Du närmar dig en järnvägskorsning utan bommar',
  A37: 'Du kör mot en korsning där spårvagnstrafik kan förekomma',
  B1: 'Du kommer fram till en korsning med märket på bilden',
  B2: 'Du kommer fram till en korsning där märket på bilden sitter före korsningen',
  B4: 'Du kör in på en väg där märket på bilden sitter vid början av sträckan',
  B5: 'Du passerar märket på bilden efter att ha kört på huvudled',
  C1: 'Du ser märket vid en infart från ditt håll',
  C2: 'Du ser märket vid början av en väg där fordonstrafik begränsas',
  C3: 'Du ser märket vid en väg där motordrivna fordon begränsas',
  C5: 'Du ser märket vid en väg där tvåhjuliga motordrivna fordon begränsas',
  C11: 'Du ser märket vid en väg där mopedtrafik begränsas',
  C16: 'Du kör mot en passage där fordonsbredden är begränsad',
  C17: 'Du kör mot en passage där fordonshöjden är begränsad',
  C31: 'Du passerar ett runt hastighetsmärke med röd kant',
  C35: 'Du ser märket vid sidan av vägen där du funderar på att parkera',
  C38: 'Du ser märket på en gata med datumparkering',
  C39: 'Du ser märket där du funderar på att stanna kort',
  D1: 'Du kommer fram till en plats där en blå pil visar tillåten färdväg',
  D3: 'Du kommer fram till en cirkulationsplats med märket på bilden',
  D10: 'Du ser märket ovanför eller vid ett körfält för linjetrafik',
  D11: 'Du passerar märket när en påbjuden bana eller ett körfält tar slut',
  E2: 'Du lämnar en motorvägssträcka och ser märket på bilden',
  E3: 'Du kör in på en väg som anges med märket på bilden',
  E4: 'Du passerar märket när en motortrafikled tar slut',
  E5: 'Du kör in i ett område där tätortsliknande regler kan gälla',
  E7: 'Du kör fram mot en gata där gående har en särskild ställning',
  E11: 'Du ser ett blått märke som rekommenderar en lägre hastighet',
  E19: 'Du letar efter en plats att parkera och ser märket på bilden',
  E23: 'Du ser märket vid en plats avsedd för taxitrafik'
};

const questionTemplates = [
  (context) => `${context}. Vad betyder vägmärket?`,
  (context) => `${context}. Vilket alternativ beskriver märket korrekt?`,
  (context) => `${context}. Vad gäller för dig som förare?`,
  (context) => `${context}. Hur ska du tolka märket?`,
  (context) => `${context}. Vilket påstående är rätt?`
];

function signCode(q) {
  const fromUrl = (q.image_url || q.imageUrl || '').match(/Sweden_road_sign_([^./]+)\./);
  const fromQuestion = (q.question || '').match(/\(([A-Z][0-9]+(?:-[0-9]+)?)\)/);
  const raw = (fromUrl && fromUrl[1]) || (fromQuestion && fromQuestion[1]) || '';
  return raw.replace(/-\d+$/, '');
}

function letterForIndex(i) {
  return ['A', 'B', 'C', 'D'][i];
}

function groupFor(code) {
  return code.charAt(0);
}

function uniqueOptions(code, id) {
  const group = groupFor(code);
  const correct = signNames[code];
  const pool = [
    ...distractors.A,
    ...distractors.B,
    ...distractors.C,
    ...distractors.D,
    ...distractors.E
  ].filter((x) => x !== correct);
  const preferred = (distractors[group] || []).filter((x) => x !== correct);
  const chosen = [];
  for (const item of [...preferred, ...pool]) {
    if (!chosen.includes(item) && item !== correct) chosen.push(item);
    if (chosen.length === 3) break;
  }
  const correctIndex = id % 4;
  const opts = [];
  let distractorIndex = 0;
  for (let i = 0; i < 4; i += 1) {
    opts.push(i === correctIndex ? correct : chosen[distractorIndex++]);
  }
  return {
    option_a: opts[0],
    option_b: opts[1],
    option_c: opts[2],
    option_d: opts[3],
    correct: letterForIndex(correctIndex)
  };
}

function polish(text) {
  return String(text || '')
    .replace(/\bForbud\b/g, 'Förbud')
    .replace(/\bforbud\b/g, 'förbud')
    .replace(/\bfor\b/g, 'för')
    .replace(/\bVag\b/g, 'Väg')
    .replace(/\bvag\b/g, 'väg')
    .replace(/\bMotorvag\b/g, 'Motorväg')
    .replace(/\bmotorvag\b/g, 'motorväg')
    .replace(/\bPabjud/g, 'Påbjud')
    .replace(/\bpabjud/g, 'påbjud')
    .replace(/\bkorbana\b/g, 'körbana')
    .replace(/\bkorfalt\b/g, 'körfält')
    .replace(/\bstracka\b/g, 'sträcka')
    .replace(/\blagre\b/g, 'lägre')
    .replace(/\bTattbebyggt\b/g, 'Tättbebyggt')
    .replace(/\btattbebyggt\b/g, 'tättbebyggt')
    .replace(/\bGagata\b/g, 'Gågata')
    .replace(/\bgagata\b/g, 'gågata')
    .replace(/\bBegransad\b/g, 'Begränsad')
    .replace(/\bbegransad\b/g, 'begränsad')
    .replace(/\bfordonshojd\b/g, 'fordonshöjd')
    .replace(/\bfordonsbredd\b/g, 'fordonsbredd')
    .replace(/\bHastighetsbegransning\b/g, 'Hastighetsbegränsning')
    .replace(/\bNedforlutning\b/g, 'Nedförslutning')
    .replace(/\bnedforlutning\b/g, 'nedförslutning')
    .replace(/\bovergangsstalle\b/g, 'övergångsställe')
    .replace(/\bOvergangsstalle\b/g, 'Övergångsställe')
    .replace(/\bjarnvag/g, 'järnväg')
    .replace(/\bJarnvag/g, 'Järnväg')
    .replace(/\bmotande\b/g, 'mötande')
    .replace(/\bMotande\b/g, 'Mötande')
    .replace(/\blangsamtgaende\b/g, 'långsamtgående')
    .replace(/\bterrangskotertrafik\b/g, 'terrängskotertrafik')
    .replace(/\bTerrangskotertrafik\b/g, 'Terrängskotertrafik')
    .replace(/\bspårvag\b/g, 'spårväg')
    .replace(/\bsparvag\b/g, 'spårväg')
    .replace(/\bSparvag\b/g, 'Spårväg')
    .replace(/\bskid- eller kabrant\b/g, 'skid- eller kabinbana')
    .replace(/\bflerfargssignal\b/g, 'flerfärgssignal')
    .replace(/\bFlerfargssignal\b/g, 'Flerfärgssignal')
    .replace(/\bsidvind\b/g, 'sidvind')
    .replace(/\bSlut pa\b/g, 'Slut på')
    .replace(/\bslut pa\b/g, 'slut på')
    .replace(/\bupphor\b/g, 'upphör')
    .replace(/\bUpphor\b/g, 'Upphör')
    .replace(/\s+/g, ' ')
    .trim();
}

let roadSignChanged = 0;
let polishedFields = 0;
const seenSignQuestion = new Map();

for (const q of data.questions) {
  const code = signCode(q);
  const hasVerifiedImage = q.imageStatus === 'verified' || q.image_status === 'verified';
  if (q.category === 'Vägmärken' && hasVerifiedImage && signNames[code]) {
    const count = seenSignQuestion.get(code) || 0;
    seenSignQuestion.set(code, count + 1);
    const name = signNames[code];
    const template = questionTemplates[count % questionTemplates.length];
    const opts = uniqueOptions(code, q.id);
    q.question = template(scenarioText[code] || 'Du ser vägmärket på bilden');
    q.option_a = opts.option_a;
    q.option_b = opts.option_b;
    q.option_c = opts.option_c;
    q.option_d = opts.option_d;
    q.correct = opts.correct;
    q.correctAnswer = opts.correct;
    q.expectedConcept = name;
    q.legalTopic = 'Vägmärken och anvisningar';
    q.sourceStatus = 'verified';
    q.image_description = `Svenskt vägmärke ${code}: ${name}.`;
    q.image_alt = name;
    q.imageDescription = q.image_description;
    q.explanation = `Rätt svar är ${opts.correct}. Märket betyder ${name.toLowerCase()}. ${actionText[code] || 'Du ska följa den anvisning som märket anger.'} Lagrum: VMF ${code}.`;
    roadSignChanged += 1;
  }

  for (const key of ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'explanation', 'expectedConcept', 'legalTopic', 'image_description', 'imageDescription', 'image_alt']) {
    const before = q[key];
    if (typeof before === 'string') {
      const after = polish(before);
      if (after !== before) {
        q[key] = after;
        polishedFields += 1;
      }
    }
  }
}

data.metadata.last_updated = '2026-06-02';
data.metadata.validation_status = 'TEXT_POLISHED_NEEDS_EXPERT_SPOTCHECK';
data.metadata.text_polish = {
  road_sign_questions_rewritten: roadSignChanged,
  fields_polished: polishedFields,
  duplicate_question_text_policy: 'verified road-sign questions use varied natural Swedish templates without sign codes in question text'
};

fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify(data.metadata.text_polish, null, 2));
