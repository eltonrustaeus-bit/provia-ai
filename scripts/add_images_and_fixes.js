/**
 * Adds images to questions that lack them and fixes known text issues.
 * Run: node scripts/add_images_and_fixes.js
 * Apply: node scripts/add_images_and_fixes.js --apply
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function wikimediaUrl(filename, size = 200) {
  const md5 = crypto.createHash('md5').update(filename).digest('hex');
  const p = md5[0] + '/' + md5[0] + md5[1] + '/' + filename;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${p}/${size}px-${filename}.png`;
}

// ── Pre-computed URLs ─────────────────────────────────────────────────────────
const SIGNS = {
  // Speed limits
  E8_30:  { url: wikimediaUrl('Sweden_road_sign_E8-30.svg'),  desc: 'Hastighetsgräns 30 km/h', alt: 'Hastighetsgräns 30' },
  E8_45:  { url: wikimediaUrl('Sweden_road_sign_E8-45.svg'),  desc: 'Hastighetsgräns 45 km/h', alt: 'Hastighetsgräns 45' },
  E8_50:  { url: wikimediaUrl('Sweden_road_sign_E8-50.svg'),  desc: 'Hastighetsgräns 50 km/h', alt: 'Hastighetsgräns 50' },
  E8_70:  { url: wikimediaUrl('Sweden_road_sign_E8-70.svg'),  desc: 'Hastighetsgräns 70 km/h (landsväg utan märke)', alt: 'Hastighetsgräns 70' },
  E8_80:  { url: wikimediaUrl('Sweden_road_sign_E8-80.svg'),  desc: 'Hastighetsgräns 80 km/h', alt: 'Hastighetsgräns 80' },
  E8_90:  { url: wikimediaUrl('Sweden_road_sign_E8-90.svg'),  desc: 'Hastighetsgräns 90 km/h', alt: 'Hastighetsgräns 90' },
  E8_110: { url: wikimediaUrl('Sweden_road_sign_E8-110.svg'), desc: 'Hastighetsgräns 110 km/h (motorväg)', alt: 'Hastighetsgräns 110' },
  E10_30: { url: wikimediaUrl('Sweden_road_sign_E10-30.svg'), desc: 'Hastighetsgräns zon 30 km/h (rektangulär gul skylt)', alt: 'Zon 30' },
  E10_50: { url: wikimediaUrl('Swedish_traffic_sign_E10-50.svg'), desc: 'Hastighetsgräns zon 50 km/h (rektangulär gul skylt)', alt: 'Zon 50' },

  // Parking & stopping
  C35: { url: wikimediaUrl('Sweden_road_sign_C35.svg'), desc: 'Parkeringsförbud (runt märke med P och rött snedstreck)', alt: 'Parkeringsförbud C35' },
  C39: { url: wikimediaUrl('Sweden_road_sign_C39.svg'), desc: 'Förbud mot stannande och parkering', alt: 'Stannande och parkeringsförbud C39' },
  C20: { url: wikimediaUrl('Sweden_road_sign_C20.svg'), desc: 'Förbud mot att stanna', alt: 'Stopplikt C20' },
  C36: { url: wikimediaUrl('Sweden_road_sign_C36.svg'), desc: 'Datumparkering (runt märke med P och datum)', alt: 'Datumparkering C36' },
  E19: { url: wikimediaUrl('Sweden_road_sign_E19.svg'), desc: 'Parkering tillåten (blå skylt med vit P)', alt: 'Parkering E19' },
  E22: { url: wikimediaUrl('Sweden_road_sign_E22.svg'), desc: 'Parkeringstid med parkeringsskiva (E22)', alt: 'Parkeringstid E22' },

  // Overtaking
  C38: { url: wikimediaUrl('Sweden_road_sign_C38.svg'), desc: 'Omkörningsförbud (runt märke med två bilar)', alt: 'Omkörningsförbud C38' },
  C34: { url: wikimediaUrl('Sweden_road_sign_C34.svg'), desc: 'Omkörningsförbud upphör', alt: 'Omkörningsförbud upphör C34' },

  // Road hierarchy
  A8:  { url: wikimediaUrl('Sweden_road_sign_A8.svg'),  desc: 'Varning för rondell — cirkulär körning med pilsymbol', alt: 'Rondell A8' },
  B8:  { url: wikimediaUrl('Sweden_road_sign_B8.svg'),  desc: 'Huvudled (gul romb)', alt: 'Huvudled B8' },
  B3:  { url: wikimediaUrl('Sweden_road_sign_B3.svg'),  desc: 'Väjningsplikt mot mötande trafik', alt: 'Väjningsplikt mot mötande B3' },

  // Information/motorway
  F5: { url: wikimediaUrl('Sweden_road_sign_F5.svg'), desc: 'Motorväg börjar', alt: 'Motorväg F5' },
  F4: { url: wikimediaUrl('Sweden_road_sign_F4.svg'), desc: 'Motortrafikled börjar', alt: 'Motortrafikled F4' },

  // Cycle
  E14: { url: wikimediaUrl('Sweden_road_sign_E14.svg'), desc: 'Cykelöverfart (blå skylt med cykel)', alt: 'Cykelöverfart E14' },
  D1:  { url: wikimediaUrl('Sweden_road_sign_D1.svg'),  desc: 'Cykelväg (blå rund skylt med vit cykel)', alt: 'Cykelväg D1' },

  // Warning
  A20: { url: wikimediaUrl('Sweden_road_sign_A20.svg'), desc: 'Varning för trafiksignal (röd triangel med trafikljus)', alt: 'Varning trafiksignal A20' },

  // Zone / built-up area
  E6_50: { url: wikimediaUrl('Sweden_road_sign_E6-50.svg'), desc: 'Tättbebyggt område (hastighetsgräns 50)', alt: 'Tättbebyggt område E6-50' },
  E7:    { url: wikimediaUrl('Sweden_road_sign_E7.svg'),    desc: 'Slut på tättbebyggt område', alt: 'Slut tättbebyggt E7' },

  // Bus lane
  D4: { url: wikimediaUrl('Sweden_road_sign_D4.svg'), desc: 'Körfält för fordon i linjetrafik (bussfält)', alt: 'Bussfält D4' },

  // Traffic lights
  TRAFFIC_LIGHT: {
    url: wikimediaUrl('Traffic_lights_4_phases.svg'),
    desc: 'Trafikljus med röd, gul och grön signal',
    alt: 'Trafikljus'
  },
};

// ── Question-to-image mappings ────────────────────────────────────────────────
// Format: questionId => { sign, image_type, image_description_override? }
const IMAGE_MAP = {
  // === HASTIGHET ===
  29:  { sign: 'E8_50',  image_type: 'vägmärke', desc: 'Hastighetsgräns 50 km/h, standardgräns i tätort' },
  191: { sign: 'E8_50',  image_type: 'vägmärke', desc: 'Hastighetsgräns 50 km/h, standardgräns i tätort' },
  34:  { sign: 'E8_70',  image_type: 'vägmärke', desc: 'Hastighetsgräns 70 km/h — runt märke med röd kant' },
  33:  { sign: 'E8_70',  image_type: 'vägmärke', desc: 'Hastighetsgräns 70 km/h — grundhastighet på landsväg' },
  550: { sign: 'E8_70',  image_type: 'vägmärke', desc: 'Hastighetsgräns 70 km/h — grundhastighet landsväg utan skyltat märke' },
  30:  { sign: 'E8_110', image_type: 'vägmärke', desc: 'Hastighetsgräns 110 km/h — maxhastighet på motorväg' },
  193: { sign: 'E8_110', image_type: 'vägmärke', desc: 'Hastighetsgräns 110 km/h — motorväg' },
  113: { sign: 'E8_80',  image_type: 'vägmärke', desc: 'Hastighetsgräns 80 km/h — maxhastighet för tung lastbil på landsväg' },
  194: { sign: 'E8_80',  image_type: 'vägmärke', desc: 'Hastighetsgräns 80 km/h — tungt fordon på landsväg' },
  195: { sign: 'E10_50', image_type: 'vägmärke', desc: 'Hastighetsgräns zon — gul rektangulär skylt (E10), inte rund lagstadgad hastighetsgräns' },
  543: { sign: 'E10_30', image_type: 'vägmärke', desc: 'Zon 30 — gul rektangulär hastighetsskylt' },
  549: { sign: 'E8_50',  image_type: 'vägmärke', desc: 'Hastighetsgräns 50 km/h — gäller i tunnel om ingen annan hastighet skyltas' },
  548: { sign: 'E8_80',  image_type: 'vägmärke', desc: 'Hastighetsgräns 80 km/h — gäller på 2+1-väg om inget märke' },
  14:  { sign: 'E8_45',  image_type: 'vägmärke', desc: 'Hastighetsgräns 45 km/h — maxhastighet för moped klass I' },
  84:  { sign: 'E8_70',  image_type: 'vägmärke', desc: 'Hastighetsgräns 70 km/h — grundhastighet utanför tättbebyggt' },

  // === PARKERING ===
  500: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — ett av två förbudsmärken för parkering' },
  504: { sign: 'C39', image_type: 'vägmärke', desc: 'C39 Förbud mot stannande och parkering — det strängaste förbudet' },
  507: { sign: 'C39', image_type: 'vägmärke', desc: 'C39 Förbud mot stannande och parkering gäller alltid' },
  508: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — gäller även på trottoar och cykelbana' },
  510: { sign: 'E22', image_type: 'vägmärke', desc: 'E22 Parkeringstid med parkeringsskiva — "P 2 tim" innebär max 2 timmar med P-skiva' },
  511: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — förbjudet framför garageinfart' },
  512: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — parkering förbjuden på motorväg' },
  513: { sign: 'E22', image_type: 'vägmärke', desc: 'E22 Parkeringstid med parkeringsskiva — anger var P-skivan används' },
  514: { sign: 'E22', image_type: 'vägmärke', desc: 'E22 Parkeringstid med parkeringsskiva' },
  516: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — busshållplatser är förbudszon' },
  517: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — vitt runt märke med rött P och diagonalt streck' },
  519: { sign: 'E22', image_type: 'vägmärke', desc: 'E22 Parkeringstid med parkeringsskiva — du ställer in ankomsttid' },
  520: { sign: 'E19', image_type: 'vägmärke', desc: 'E19 Parkering — tilläggstavla visar rörelsehindrad-symbol' },
  525: { sign: 'C35', image_type: 'vägmärke', desc: 'C35 Parkeringsförbud — fordonet kan bötfällas och bogseras bort' },
  502: { sign: 'C36', image_type: 'vägmärke', desc: 'C36 Datumparkering — parkering tillåten varannan dag beroende på datum' },

  // === MÖTE & OMKÖRNING ===
  106: { sign: 'C38', image_type: 'vägmärke', desc: 'C38 Omkörningsförbud — märket visar bil som kör om ett annat fordon med rött kryss' },

  // === KORSNINGAR ===
  20:  { sign: 'E14',  image_type: 'vägmärke', desc: 'E14 Cykelöverfart — blå rektangulär skylt med vit cykel' },
  100: { sign: 'TRAFFIC_LIGHT', image_type: 'trafikljus', desc: 'Trafikljus — blinkande gult ljus signalerar varsamhet' },
  174: { sign: 'TRAFFIC_LIGHT', image_type: 'trafikljus', desc: 'Trafikljus — röd signal innebär stopp' },
  98:  { sign: 'B8',   image_type: 'vägmärke', desc: 'B8 Huvudled — gul romb visar att du kör på en väg med rätt att passera korsningar' },

  // === TRAFIKREGLER ===
  163: { sign: 'TRAFFIC_LIGHT', image_type: 'vägmärken', desc: 'Körfältsstyrning — rött kryss ovanför körfält innebär att körfältet är stängt' },
  165: { sign: 'D4',   image_type: 'vägmärke', desc: 'D4 Körfält för fordon i linjetrafik — bussfält' },
  8:   { sign: 'A8',   image_type: 'vägmärke', desc: 'Rondell — cirkulär korsning, trafik inne i rondellen har alltid företräde (märke A8)' },
  // Q94 (underbrutet linje) excluded — no road-marking diagram available in sign library

  // NOTE: Q6 (gula rektangulära vägvisningsskyltar) intentionally excluded — no accurate matching sign available in library
};

// ── Fix known text issues ─────────────────────────────────────────────────────
const TEXT_FIXES = {
  60: {
    question: 'Vad är aquaplaning och hur uppstår det?',
    explanation_note: null, // keep existing explanation
  },
};

// ── Apply changes ─────────────────────────────────────────────────────────────
const dataPath = path.join(__dirname, '../final_questions.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const questions = data.questions;

const changes = [];
let imageAddedCount = 0;
let textFixCount = 0;

questions.forEach(q => {
  let modified = false;

  // Apply text fixes
  if (TEXT_FIXES[q.id]) {
    const fix = TEXT_FIXES[q.id];
    if (fix.question && q.question !== fix.question) {
      changes.push({ id: q.id, type: 'TEXT_FIX', old: q.question, new: fix.question });
      if (process.argv.includes('--apply')) {
        q.question = fix.question;
      }
      textFixCount++;
      modified = true;
    }
  }

  // Apply image additions (only if question has no image)
  const hasImage = q.image_url || q.imageUrl;
  if (!hasImage && IMAGE_MAP[q.id]) {
    const mapping = IMAGE_MAP[q.id];
    const sign = SIGNS[mapping.sign];
    if (!sign) {
      console.warn('WARNING: Unknown sign key:', mapping.sign, 'for question', q.id);
      return;
    }

    const imageData = {
      image_url: sign.url,
      image_description: mapping.desc || sign.desc,
      image_alt: sign.alt,
      image_type: mapping.image_type || 'vägmärke',
      requiresImage: true,
      imageStatus: 'auto-added-2026-06-05',
      manualReview: {
        status: 'pending',
        note: 'Auto-added by add_images_and_fixes.js. Verify image matches question intent.',
      },
    };

    changes.push({
      id: q.id,
      type: 'IMAGE_ADDED',
      sign: mapping.sign,
      url: sign.url,
      q: q.question.slice(0, 70),
    });

    if (process.argv.includes('--apply')) {
      Object.assign(q, imageData);
    }
    imageAddedCount++;
    modified = true;
  }
});

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n=== IMAGE & FIX REPORT ===');
console.log('Text fixes:', textFixCount);
console.log('Images to add:', imageAddedCount);
console.log('Total changes:', changes.length);

console.log('\n--- TEXT FIXES ---');
changes.filter(c => c.type === 'TEXT_FIX').forEach(c =>
  console.log(`  Q${c.id}: "${c.old}" → "${c.new}"`)
);

console.log('\n--- IMAGES ADDED ---');
const byCategory = {};
changes.filter(c => c.type === 'IMAGE_ADDED').forEach(c => {
  const q = questions.find(x => x.id === c.id);
  const cat = q?.category || 'unknown';
  byCategory[cat] = (byCategory[cat] || 0) + 1;
  console.log(`  Q${c.id} [${cat}] — ${c.sign}: ${c.q}`);
});

console.log('\n--- BY CATEGORY ---');
Object.entries(byCategory).forEach(([cat, n]) => console.log(`  ${cat}: +${n}`));

if (process.argv.includes('--apply')) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('\n✅ Changes written to final_questions.json');
} else {
  console.log('\n--- DRY RUN — add --apply to save changes ---');
}
