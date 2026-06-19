#!/usr/bin/env node
// Patches final_questions.json with image_url + image_description for new SVG diagrams
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '../final_questions.json');
const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const questions = raw.questions;

const patches = {
  16: {
    image_url: '/image/korkort/q_016.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil (du) kör norrut och svänger vänster. Grön cyklist kör rakt västerut. Gul checkmark visar cyklisten har företräde.',
  },
  18: {
    image_url: '/image/korkort/q_018.svg',
    image_description: 'Fågelperspektiv korsning med cykelfil (grön remsa) längs höger kant. Röd bil svänger höger, teal cyklist kör rakt fram i cykelfil. Cyklisten markerad med företräde.',
  },
  95: {
    image_url: '/image/korkort/q_095.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil svänger vänster, blå mötande bil kör rakt fram. Gul checkmark på mötande bil = mötande har företräde.',
  },
  96: {
    image_url: '/image/korkort/q_096.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil (du) kör österut. Blå bil kör norrut, kommer från din vänstra sida. Du har företräde (högerregeln — fordon till höger om den blå bilen = du).',
  },
  175: {
    image_url: '/image/korkort/q_175.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil kör rakt fram österut. Blå mötande bil svänger vänster söderut. Röd bil (rakt) har företräde markerat.',
  },
  22: {
    image_url: '/image/korkort/q_022.svg',
    image_description: 'Fågelperspektiv korsning med trafikljus (grönt) och övergångsställe norr om korsningen. Röd bil svänger mot övergångsstället. Gående (orange) på övergångsstället med företräde markerat.',
  },
  17: {
    image_url: '/image/korkort/q_017.svg',
    image_description: 'Fågelperspektiv. Grå parkeringsplats uppan, utfart nedåt mot gatan. Röd bil kör ut från parkering. Blå bil kör på gatan med företräde markerat.',
  },
  23: {
    image_url: '/image/korkort/q_023.svg',
    image_description: 'Uppifrån-vy av väg med heldragna mittstreckslinjer och ett backkrön markerat. Grå bil framför, röd bil bakom. Förbudsskylt för omkörning till höger.',
  },
  25: {
    image_url: '/image/korkort/q_025.svg',
    image_description: 'Smal bro sedd uppifrån. Blå bil kör på bron österut. Röd bil (du) väntar på vänster sida med väjningsskylt. Vatten under bron.',
  },
  27: {
    image_url: '/image/korkort/q_027.svg',
    image_description: 'Uppifrån-vy av väg. Röd bil kör om cyklist. Gul streckad linje visar sidoavståndet 1,5 meter mellan bil och cyklist.',
  },
  505: {
    image_url: '/image/korkort/q_505.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil parkerad på gatan. Gul streckad linje visar 10 meters avstånd från korsningen. Förbudsskylt för parkering.',
  },
  503: {
    image_url: '/image/korkort/q_503.svg',
    image_description: 'Vy framifrån av väg med två bilar. Blå bil (stanna) = kort stopp med förare kvar. Röd bil (parkera) = längre uppehåll, föraren borta.',
  },
  501: {
    image_url: '/image/korkort/q_501.svg',
    image_description: 'Fågelperspektiv väg med övergångsställe (zebra). Röd bil parkerad inom 10 meter före övergångsstället. Förbudsskylt. Gula gående på övergångsstället.',
  },
  97: {
    image_url: '/image/korkort/q_097.svg',
    image_description: 'Uppifrån-vy av väg där höger körfält upphör. Röda bilar i vänster fil, blå bil i höger fil. Gul pil visar blixtlåsningsmanöver (en i taget fogar in).',
  },
  179: {
    image_url: '/image/korkort/q_179.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil (du) positionerad nära mittlinjen inför vänstersvång. Gul linje visar korrekt position längs mittlinjen.',
  },
  574: {
    image_url: '/image/korkort/q_574.svg',
    image_description: 'Fågelperspektiv korsning. Röd bil (du) kör norrut. Grå Bil A till vänster (kör västerut). Blå Bil B till höger (kör österut). Gul checkmark på Bil B = B har företräde (högerregeln).',
  },
};

let patched = 0;
for (const q of questions) {
  if (patches[q.id]) {
    const p = patches[q.id];
    if (!q.image_url) {
      q.image_url = p.image_url;
      q.image_description = p.image_description;
      patched++;
    }
  }
}

// Update metadata
raw.metadata.fixes_applied = (raw.metadata.fixes_applied || '') + ' | svg_patch_2026-06-19: added ' + patched + ' SVG diagrams';

fs.writeFileSync(DATA, JSON.stringify(raw, null, 2), 'utf8');
console.log(`Patched ${patched} questions with SVG image_url`);
