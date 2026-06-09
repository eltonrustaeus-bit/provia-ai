// Fix confirmed broken image_url entries
// E8-50, E8-70 → C31 (current Swedish sign code), E10-30 → null, traffic light → null

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __dir = dirname(fileURLToPath(import.meta.url));
const SB_URL = 'https://mnmotdluigzeehdjbhbu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubW90ZGx1aWd6ZWVoZGpiaGJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMzNzA4NCwiZXhwIjoyMDg1OTEzMDg0fQ.Fn-8x3vlgyU8OP6D5Cz1jiA7qSjqnXV5Wx-hR3nl5cc';

function wikiThumbUrl(filename) {
  const fn = filename.replace(/ /g, '_');
  const md5 = crypto.createHash('md5').update(fn).digest('hex');
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5[0]}${md5[1]}/${fn}/330px-${fn.replace('.svg', '.svg.png')}`;
}

const C31_3 = wikiThumbUrl('Sweden road sign C31-3.svg'); // 30 km/h
const C31_5 = wikiThumbUrl('Sweden road sign C31-5.svg'); // 50 km/h
const C31_7 = wikiThumbUrl('Sweden road sign C31-7.svg'); // 70 km/h

const fixes = [
  {
    id: 29,
    image_url: C31_5,
    image_description: 'Hastighetsbegränsning C31-5 — 50 km/h, standardgräns i tätort',
    reason: 'E8-50 existerar inte på Wikimedia. Ersatt med C31-5 (50 km/h, korrekt nutida märkeskod).'
  },
  {
    id: 33,
    image_url: null,
    image_description: null,
    reason: 'Frågan handlar om standardhastighet UTAN märke — bilden med E8-70 togs bort.'
  },
  {
    id: 34,
    image_url: C31_7,
    image_description: 'Hastighetsbegränsning C31-7 — 70 km/h, runt märke med röd kant',
    reason: 'E8-70 existerar inte på Wikimedia. Ersatt med C31-7 (70 km/h, korrekt nutida märkeskod).'
  },
  {
    id: 163,
    image_url: null,
    image_description: null,
    reason: 'Traffic_lights_4_phases är fel bild för fråga om körfältsstyrning (rött kryss). Inget korrekt Wikimedia-alternativ hittades — bild borttagen.'
  },
  {
    id: 543,
    image_url: null,
    image_description: null,
    reason: 'E10-30 (zon 30-skylt) existerar inte på Wikimedia. Frågan behöver inte bild — bild borttagen.'
  }
];

async function patchSupabase(fix) {
  const body = { image_url: fix.image_url, image_description: fix.image_description };
  const r = await fetch(`${SB_URL}/rest/v1/driving_questions?id=eq.${fix.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PATCH id=${fix.id} failed: ${r.status} ${t}`);
  }
  return r.json();
}

function patchJson(path, fixes) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const qs = Array.isArray(raw) ? raw : raw.questions;
  let changed = 0;
  for (const fix of fixes) {
    const q = qs.find(q => q.id === fix.id);
    if (!q) { console.log(`  WARN: id=${fix.id} not found in ${path}`); continue; }
    q.image_url = fix.image_url;
    q.image_description = fix.image_description;
    changed++;
  }
  if (Array.isArray(raw)) writeFileSync(path, JSON.stringify(raw, null, 2));
  else { raw.questions = qs; writeFileSync(path, JSON.stringify(raw, null, 2)); }
  console.log(`  Patched ${changed} entries in ${path}`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'MODE: APPLY' : 'MODE: DRY-RUN (pass --apply to write)');
  console.log();

  for (const fix of fixes) {
    console.log(`ID ${fix.id}: ${fix.reason}`);
    console.log(`  image_url → ${fix.image_url ?? 'null'}`);
    if (apply) {
      try {
        await patchSupabase(fix);
        console.log('  Supabase: OK');
      } catch (e) {
        console.error('  Supabase ERROR:', e.message);
      }
    }
    console.log();
  }

  if (apply) {
    console.log('Patching JSON files...');
    const finalPath = join(__dir, '..', 'final_questions.json');
    patchJson(finalPath, fixes);
  }

  console.log('Done.');
}

main().catch(console.error);
