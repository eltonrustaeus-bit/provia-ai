#!/usr/bin/env node
// Generates SVG diagrams for körkortsmodulen questions
// Run: node scripts/generate-svgs.js

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../image/korkort');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// --- SVG primitives ---
const C = {
  road: '#6b6b6b',
  roadLight: '#8a8a8a',
  bg: '#f0f0f0',
  lane: '#ffffff',
  dash: '#ffdd00',
  carRed: '#e63946',    // Du (your vehicle)
  carBlue: '#1d7dc1',   // Annat fordon
  carGray: '#888888',
  cyclist: '#2a9d8f',
  ped: '#f4a261',
  arrow: '#ffffff',
  stopLine: '#ffffff',
  yieldLine: '#ffffff',
  sign: '#cc0000',
  text: '#1a1a1a',
  prio: '#f4d35e',
};

function svg(content, w = 400, h = 400) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:${C.bg}">
${content}
</svg>`;
}

// Draw a top-down car (rect with rounded corners + windshield hint)
// cx,cy = center, w,h = dims, color, angle (degrees, 0=up)
function car(cx, cy, color, angle = 0, w = 22, h = 36) {
  return `<g transform="rotate(${angle},${cx},${cy})">
  <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="5" ry="5" fill="${color}" />
  <rect x="${cx - w / 2 + 3}" y="${cy - h / 2 + 4}" width="${w - 6}" height="7" rx="2" fill="rgba(255,255,255,0.4)" />
</g>`;
}

// Direction arrow
function arrow(x1, y1, x2, y2, color = C.arrow, width = 3) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const ax = x2 - ux * 12, ay = y2 - uy * 12;
  const px = -uy * 6, py = ux * 6;
  return `<line x1="${x1}" y1="${y1}" x2="${ax}" y2="${ay}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>
<polygon points="${x2},${y2} ${ax + px},${ay + py} ${ax - px},${ay - py}" fill="${color}"/>`;
}

// Road: horizontal band
function hRoad(y, w = 400, laneW = 60) {
  return `<rect x="0" y="${y - laneW}" width="${w}" height="${laneW * 2}" fill="${C.road}"/>
<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${C.lane}" stroke-width="2" stroke-dasharray="18,12"/>`;
}

// Road: vertical band
function vRoad(x, h = 400, laneW = 60) {
  return `<rect x="${x - laneW}" y="0" width="${laneW * 2}" height="${h}" fill="${C.road}"/>
<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${C.lane}" stroke-width="2" stroke-dasharray="18,12"/>`;
}

// Crossroad at cx,cy
function crossroad(cx = 200, cy = 200, laneW = 55) {
  const L = laneW;
  return `
  <rect x="${cx - L}" y="${cy - L}" width="${L * 2}" height="${L * 2}" fill="${C.road}"/>
  ${hRoad(cy, 400, L)}
  ${vRoad(cx, 400, L)}
  `;
}

// Cyclist icon (simple circle + rect)
function cyclist(cx, cy, color = C.cyclist, angle = 0) {
  return `<g transform="rotate(${angle},${cx},${cy})">
  <circle cx="${cx}" cy="${cy - 12}" r="6" fill="${color}"/>
  <rect x="${cx - 8}" y="${cy - 6}" width="16" height="24" rx="4" fill="${color}" opacity="0.85"/>
</g>`;
}

// Pedestrian (stick figure simplified)
function ped(cx, cy, color = C.ped) {
  return `<circle cx="${cx}" cy="${cy - 10}" r="5" fill="${color}"/>
<line x1="${cx}" y1="${cy - 5}" x2="${cx}" y2="${cy + 10}" stroke="${color}" stroke-width="3"/>
<line x1="${cx - 7}" y1="${cy + 2}" x2="${cx + 7}" y2="${cy + 2}" stroke="${color}" stroke-width="3"/>
<line x1="${cx}" y1="${cy + 10}" x2="${cx - 6}" y2="${cy + 22}" stroke="${color}" stroke-width="3"/>
<line x1="${cx}" y1="${cy + 10}" x2="${cx + 6}" y2="${cy + 22}" stroke="${color}" stroke-width="3"/>`;
}

// Label text
function label(x, y, text, color = C.text, size = 13, anchor = 'middle') {
  return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="bold">${text}</text>`;
}

// Yield triangle
function yieldSign(x, y, size = 18) {
  const h = size * 0.866;
  return `<polygon points="${x},${y - h * 0.67} ${x - size / 2},${y + h * 0.33} ${x + size / 2},${y + h * 0.33}" fill="white" stroke="red" stroke-width="2.5"/>
<text x="${x}" y="${y + 4}" font-family="Arial" font-size="${size * 0.55}" fill="red" text-anchor="middle" font-weight="bold">▽</text>`;
}

// Stop line
function stopLine(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.stopLine}" stroke-width="4" stroke-linecap="round"/>`;
}

// Zebra crossing (simplified)
function zebra(x, y, w = 50, stripes = 4) {
  const sw = w / (stripes * 2 - 1);
  let out = '';
  for (let i = 0; i < stripes; i++) {
    out += `<rect x="${x + i * sw * 2}" y="${y - 10}" width="${sw}" height="20" fill="white" opacity="0.9"/>`;
  }
  return out;
}

// --- Diagram definitions ---
const diagrams = {

  // #16: Du svänger vänster — cyklist kommer rakt fram. Vem har företräde?
  'q_016': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      ${stopLine(cx - L, cy, cx, cy)}
      <!-- Your car: coming from south, turning left (east→west) -->
      ${car(cx - 15, cy + 30, C.carRed, 0)}
      ${arrow(cx - 15, cy + 10, cx - 80, cy - 30, C.carRed, 2.5)}
      <!-- Cyclist: coming from east going west (straight) -->
      ${cyclist(cx + 90, cy - 18, C.cyclist, 270)}
      ${arrow(cx + 80, cy - 18, cx - 80, cy - 18, C.cyclist, 2)}
      <!-- Priority marker on cyclist -->
      <circle cx="${cx + 90}" cy="${cy - 40}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx + 90, cy - 35, '✓', '#1a1a1a', 16)}
      ${label(cx - 15, cy + 80, 'DU', C.carRed, 12)}
      ${label(cx + 100, cy - 18, 'Cyklist', C.cyclist, 11, 'start')}
      ${label(200, 390, 'Cyklisten har företräde — du svänger in i deras väg', C.text, 11)}
    `);
  },

  // #18: Du svänger höger — cyklist i cykelfil kör rakt fram. Vad gäller?
  'q_018': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Cycle lane: right side of road -->
      <rect x="${cx + L}" y="0" width="20" height="${cy - L}" fill="#3a7d44" opacity="0.5"/>
      <rect x="${cx + L}" y="${cy + L}" width="20" height="200" fill="#3a7d44" opacity="0.5"/>
      ${label(cx + L + 10, 30, '🚲', C.cyclist, 14, 'middle')}
      <!-- Your car: from south, turning right -->
      ${car(cx + 20, cy + 40, C.carRed, 0)}
      ${arrow(cx + 20, cy + 20, cx + L + 5, cy - 40, C.carRed, 2.5)}
      <!-- Cyclist: straight from south (in cycle lane) -->
      ${cyclist(cx + L + 10, cy + 100, C.cyclist, 0)}
      ${arrow(cx + L + 10, cy + 80, cx + L + 10, cy - 80, C.cyclist, 2)}
      <circle cx="${cx + L + 30}" cy="${cy + 100}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx + L + 30, cy + 105, '✓', '#1a1a1a', 16)}
      ${label(cx + 20, cy + 80, 'DU', C.carRed, 12)}
      ${label(200, 390, 'Cyklisten i cykelfil har företräde', C.text, 11)}
    `);
  },

  // #95: Du svänger vänster — mötande bil kör rakt fram. Vem har företräde?
  'q_095': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Your car: from south, turning left -->
      ${car(cx - 20, cy + 40, C.carRed, 0)}
      ${arrow(cx - 20, cy + 18, cx - 90, cy - 20, C.carRed, 2.5)}
      <!-- Oncoming car: from north, going straight south -->
      ${car(cx + 20, cy - 90, C.carBlue, 180)}
      ${arrow(cx + 20, cy - 70, cx + 20, cy + 80, C.carBlue, 2.5)}
      <circle cx="${cx + 45}" cy="${cy - 90}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx + 45, cy - 85, '✓', '#1a1a1a', 16)}
      ${label(cx - 20, cy + 80, 'DU', C.carRed, 12)}
      ${label(cx + 35, cy - 110, 'Mötande', C.carBlue, 11)}
      ${label(200, 390, 'Mötande bil kör rakt — har företräde vid vänstersvång', C.text, 11)}
    `);
  },

  // #96: Högerregeln — fordon till vänster om dig. Vem har företräde?
  'q_096': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Your car: from west going east -->
      ${car(cx - 90, cy - 20, C.carRed, 90)}
      ${arrow(cx - 70, cy - 20, cx + 80, cy - 20, C.carRed, 2.5)}
      <!-- Car from south (to your left) going north -->
      ${car(cx + 20, cy + 90, C.carBlue, 0)}
      ${arrow(cx + 20, cy + 70, cx + 20, cy - 80, C.carBlue, 2.5)}
      <!-- Priority to you (car from south is to YOUR LEFT) -->
      <circle cx="${cx - 90}" cy="${cy - 50}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx - 90, cy - 45, '✓', '#1a1a1a', 16)}
      ${label(cx - 90, cy + 10, 'DU', C.carRed, 12)}
      ${label(cx + 35, cy + 90, 'Till din vänster', C.carBlue, 10)}
      ${label(200, 390, 'Högerregeln: fordon till höger har företräde', C.text, 11)}
    `);
  },

  // #175: Du kör rakt fram — mötande svänger vänster. Vem har företräde?
  'q_175': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Your car: going straight through (east) -->
      ${car(cx - 90, cy + 18, C.carRed, 90)}
      ${arrow(cx - 70, cy + 18, cx + 90, cy + 18, C.carRed, 2.5)}
      <!-- Oncoming: from east, turning left (going south) -->
      ${car(cx + 90, cy - 18, C.carBlue, 270)}
      ${arrow(cx + 70, cy - 18, cx + 10, cy + 80, C.carBlue, 2.5)}
      <circle cx="${cx - 90}" cy="${cy - 15}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx - 90, cy - 10, '✓', '#1a1a1a', 16)}
      ${label(cx - 90, cy + 50, 'DU', C.carRed, 12)}
      ${label(cx + 90, cy - 40, 'Svänger vänster', C.carBlue, 10)}
      ${label(200, 390, 'Du kör rakt — har alltid företräde mot vänstersvängande', C.text, 11)}
    `);
  },

  // #22: Grön signal, svänger, gående på övergångsställe
  'q_022': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Zebra crossing north of intersection -->
      ${zebra(cx - L + 5, cy - L - 5, L * 2 - 10, 5)}
      <!-- Traffic light (green) -->
      <rect x="${cx - L - 30}" y="${cy - 50}" width="20" height="50" rx="4" fill="#333"/>
      <circle cx="${cx - L - 20}" cy="${cy - 35}" r="7" fill="#22c55e"/>
      <!-- Your car: turning right/left across crosswalk -->
      ${car(cx - 20, cy + 40, C.carRed, 0)}
      ${arrow(cx - 20, cy + 18, cx - 20, cy - L - 20, C.carRed, 2.5)}
      <!-- Pedestrians on crosswalk -->
      ${ped(cx - 20, cy - L + 5, C.ped)}
      ${ped(cx + 10, cy - L + 5, C.ped)}
      <circle cx="${cx + 30}" cy="${cy - L - 15}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx + 30, cy - L - 10, '✓', '#1a1a1a', 16)}
      ${label(cx - 20, cy + 80, 'DU', C.carRed, 12)}
      ${label(200, 390, 'Gående på övergångsstället har alltid företräde', C.text, 11)}
    `);
  },

  // #17: Du lämnar parkeringsplats — vem har företräde?
  'q_017': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      <!-- Main road (horizontal) -->
      ${hRoad(cy, 400, L)}
      <!-- Parking area (top) -->
      <rect x="80" y="30" width="240" height="80" fill="#aaa" rx="4" opacity="0.7"/>
      ${label(200, 80, 'PARKERING', '#555', 13)}
      <!-- Exit from parking -->
      <rect x="170" y="100" width="60" height="50" fill="${C.road}"/>
      <!-- Your car: exiting parking -->
      ${car(200, 130, C.carRed, 180)}
      ${arrow(200, 148, 200, cy - L + 5, C.carRed, 2.5)}
      <!-- Car on main road (right of way) -->
      ${car(320, cy + 18, C.carBlue, 270)}
      ${arrow(300, cy + 18, 80, cy + 18, C.carBlue, 2.5)}
      <circle cx="320" cy="${cy - 30}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(320, cy - 25, '✓', '#1a1a1a', 16)}
      ${label(200, 175, 'DU', C.carRed, 12)}
      ${label(200, 390, 'Trafik på gatan har alltid företräde mot utfartstrafik', C.text, 11)}
    `);
  },

  // #23: Var är omkörning alltid förbjuden?
  'q_023': () => {
    return svg(`
      <!-- Road going north (top-down) -->
      <rect x="100" y="0" width="200" height="400" fill="${C.road}"/>
      <line x1="200" y1="0" x2="200" y2="400" stroke="${C.lane}" stroke-width="2" stroke-dasharray="18,12"/>
      <!-- Solid line = no overtaking zone -->
      <line x1="175" y1="150" x2="175" y2="400" stroke="${C.lane}" stroke-width="3.5" stroke-dasharray="none"/>
      <line x1="225" y1="150" x2="225" y2="400" stroke="${C.lane}" stroke-width="3.5"/>
      <!-- Hill / bend symbol -->
      <path d="M130 200 Q200 100 270 200" fill="none" stroke="#f4d35e" stroke-width="3" stroke-dasharray="6,4"/>
      ${label(200, 130, '⛰', C.text, 28)}
      ${label(200, 170, 'Backkrön', '#f4d35e', 12)}
      <!-- Car behind (you), car ahead -->
      ${car(185, 330, C.carRed, 0)}
      ${car(215, 240, C.carGray, 0)}
      <!-- No overtaking sign -->
      <circle cx="310" cy="300" r="22" fill="white" stroke="red" stroke-width="3"/>
      <circle cx="300" cy="298" r="6" fill="red"/>
      <circle cx="320" cy="298" r="6" fill="#1d7dc1"/>
      <line x1="295" y1="306" x2="325" y2="290" stroke="red" stroke-width="2.5"/>
      ${label(200, 390, 'Förbjudet: backkrön, kurva, korsning, övergångsställe…', C.text, 11)}
    `);
  },

  // #25: Smal bro utan mötesplats — vad gäller?
  'q_025': () => {
    return svg(`
      <!-- Road -->
      <rect x="80" y="170" width="240" height="60" fill="${C.road}"/>
      <!-- Bridge narrowing -->
      <rect x="130" y="180" width="140" height="40" fill="${C.roadLight}" rx="2"/>
      <!-- Water under bridge -->
      <rect x="130" y="220" width="140" height="30" fill="#1d7dc1" opacity="0.3" rx="2"/>
      ${label(200, 238, '〰 Vatten 〰', '#1d7dc1', 11)}
      <!-- Waiting car (you) from left -->
      ${car(95, 200, C.carRed, 90)}
      <!-- Oncoming car on bridge -->
      ${car(240, 200, C.carBlue, 270)}
      ${arrow(220, 200, 120, 200, C.carBlue, 2.5)}
      <!-- Wait sign for you -->
      ${yieldSign(60, 200, 20)}
      ${label(95, 240, 'DU', C.carRed, 12)}
      ${label(200, 390, 'Den som kan backa eller har plats ger företräde', C.text, 11)}
    `);
  },

  // #27: Sidoavstånd till cyklist
  'q_027': () => {
    return svg(`
      <!-- Road -->
      <rect x="60" y="0" width="280" height="400" fill="${C.road}"/>
      <line x1="200" y1="0" x2="200" y2="400" stroke="${C.lane}" stroke-width="2" stroke-dasharray="18,12"/>
      <!-- Your car (overtaking) -->
      ${car(225, 220, C.carRed, 0)}
      <!-- Cyclist being passed -->
      ${cyclist(115, 220, C.cyclist, 0)}
      <!-- Distance indicator -->
      <line x1="140" y1="200" x2="212" y2="200" stroke="${C.prio}" stroke-width="2" stroke-dasharray="4,3"/>
      <line x1="140" y1="195" x2="140" y2="205" stroke="${C.prio}" stroke-width="2"/>
      <line x1="212" y1="195" x2="212" y2="205" stroke="${C.prio}" stroke-width="2"/>
      ${label(176, 192, '1,5 m', C.prio, 12)}
      ${label(225, 260, 'DU', C.carRed, 12)}
      ${label(200, 390, 'Håll minst 1,5 meter sidoavstånd till cyklist', C.text, 11)}
    `);
  },

  // #505: Parkering nära korsning — hur nära?
  'q_505': () => {
    return svg(`
      <!-- Main road (horizontal) -->
      ${hRoad(250, 400, 50)}
      <!-- Cross street (vertical, right side) -->
      <rect x="280" y="0" width="100" height="200" fill="${C.road}"/>
      <!-- Distance marker -->
      <line x1="180" y1="200" x2="275" y2="200" stroke="${C.prio}" stroke-width="2.5" stroke-dasharray="5,3"/>
      <line x1="180" y1="195" x2="180" y2="205" stroke="${C.prio}" stroke-width="2.5"/>
      <line x1="275" y1="195" x2="275" y2="205" stroke="${C.prio}" stroke-width="2.5"/>
      ${label(228, 192, '10 m', C.prio, 14)}
      <!-- Parked car (too close) -->
      ${car(140, 215, C.carRed, 90)}
      <!-- No parking sign -->
      <circle cx="145" cy="170" r="16" fill="white" stroke="red" stroke-width="3"/>
      <line x1="133" y1="158" x2="157" y2="182" stroke="red" stroke-width="3"/>
      <rect x="135" y="170" width="20" height="8" rx="2" fill="#e63946"/>
      ${label(200, 390, 'Parkering förbjuden inom 10 m från korsning', C.text, 11)}
    `);
  },

  // #503: Stanna vs parkera — vad är skillnaden?
  'q_503': () => {
    return svg(`
      <!-- Road -->
      <rect x="50" y="150" width="300" height="100" fill="${C.road}"/>
      <line x1="50" y1="200" x2="350" y2="200" stroke="${C.lane}" stroke-width="2" stroke-dasharray="18,12"/>
      <!-- Car stopping briefly (left) -->
      ${car(130, 215, C.carBlue, 90)}
      <rect x="95" y="260" width="70" height="28" rx="5" fill="${C.carBlue}" opacity="0.85"/>
      ${label(130, 279, 'STANNA', 'white', 11)}
      ${label(130, 300, '≤ kort tid / av/på', C.text, 10)}
      <!-- Car parked (right) -->
      ${car(270, 215, C.carRed, 90)}
      <rect x="235" y="260" width="70" height="28" rx="5" fill="${C.carRed}" opacity="0.85"/>
      ${label(270, 279, 'PARKERA', 'white', 11)}
      ${label(270, 300, '> kort tid / föraren borta', C.text, 10)}
      ${label(200, 390, 'Stanna = kort uppehåll med föraren kvar. Parkera = längre.', C.text, 11)}
    `);
  },

  // #501: Förbjudet parkera nära övergångsställe
  'q_501': () => {
    return svg(`
      <!-- Road -->
      ${hRoad(220, 400, 50)}
      <!-- Zebra crossing -->
      ${zebra(240, 220, 80, 5)}
      ${label(280, 185, 'Övergångsställe', C.text, 11)}
      <!-- Distance 10m before -->
      <line x1="155" y1="185" x2="238" y2="185" stroke="${C.prio}" stroke-width="2.5" stroke-dasharray="5,3"/>
      <line x1="155" y1="180" x2="155" y2="190" stroke="${C.prio}" stroke-width="2.5"/>
      <line x1="238" y1="180" x2="238" y2="190" stroke="${C.prio}" stroke-width="2.5"/>
      ${label(196, 178, '10 m', C.prio, 14)}
      <!-- Parked car (forbidden zone) -->
      ${car(110, 188, C.carRed, 90)}
      <!-- No parking -->
      <circle cx="110" cy="145" r="15" fill="white" stroke="red" stroke-width="3"/>
      <line x1="99" y1="134" x2="121" y2="156" stroke="red" stroke-width="3"/>
      <!-- Pedestrians -->
      ${ped(265, 220, C.ped)}
      ${ped(285, 220, C.ped)}
      ${label(200, 390, 'Parkering förbjuden 10 m FÖRE övergångsställe (sikt!)', C.text, 11)}
    `);
  },

  // #97: Körfält upphör — väva samman (zipper merge)
  'q_097': () => {
    return svg(`
      <!-- Two lanes merging to one -->
      <rect x="50" y="0" width="300" height="400" fill="${C.road}"/>
      <!-- Left lane -->
      <rect x="50" y="0" width="150" height="400" fill="${C.road}"/>
      <rect x="200" y="0" width="150" height="400" fill="${C.road}"/>
      <!-- Center dashes upper half -->
      <line x1="200" y1="0" x2="200" y2="180" stroke="${C.lane}" stroke-width="2" stroke-dasharray="18,12"/>
      <!-- Solid merge line lower half -->
      <path d="M200,180 Q200,280 125,400" fill="none" stroke="${C.lane}" stroke-width="3"/>
      <!-- Cars in left lane -->
      ${car(165, 280, C.carRed, 0)}
      ${car(165, 150, C.carRed, 0)}
      <!-- Cars in right lane (your lane?) -->
      ${car(235, 220, C.carBlue, 0)}
      <!-- Zipper arrow -->
      ${arrow(235, 200, 170, 330, C.prio, 2.5)}
      ${label(165, 320, 'Blixtlås', C.prio, 12)}
      ${label(200, 390, 'Blixtlåsning: en bil i taget turas om att foga in', C.text, 11)}
    `);
  },

  // #179: Position i körfältet vid vänstersvång
  'q_179': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Your car correctly positioned: right side of left-turn lane -->
      ${car(cx - 18, cy + 40, C.carRed, 0)}
      <!-- Arrow showing left turn -->
      ${arrow(cx - 18, cy + 20, cx - 80, cy - 20, C.carRed, 2.5)}
      <!-- Position indicator: keep to center line -->
      <line x1="${cx}" y1="${cy + L + 20}" x2="${cx}" y2="${cy + L + 60}" stroke="${C.prio}" stroke-width="2" stroke-dasharray="5,3"/>
      ${label(cx + 15, cy + L + 45, 'Håll dig nära', C.prio, 10)}
      ${label(cx + 15, cy + L + 57, 'mittenlinjen', C.prio, 10)}
      ${label(cx - 18, cy + 80, 'DU', C.carRed, 12)}
      ${label(200, 390, 'Vid vänstersvång: håll dig nära mittlinjen / vänster körfält', C.text, 11)}
    `);
  },

  // #574: Högerregeln — Bil A till vänster, Bil B till höger
  'q_574': () => {
    const cx = 200, cy = 200, L = 55;
    return svg(`
      ${crossroad(cx, cy, L)}
      <!-- Your car: from south going north -->
      ${car(cx + 18, cy + 90, C.carRed, 0)}
      ${arrow(cx + 18, cy + 72, cx + 18, cy - 80, C.carRed, 2.5)}
      <!-- Car A: from east (to your left) going west -->
      ${car(cx + 90, cy - 18, C.carGray, 270)}
      ${arrow(cx + 72, cy - 18, cx - 80, cy - 18, C.carGray, 2.5)}
      <!-- Car B: from west (to your right) going east -->
      ${car(cx - 90, cy + 18, C.carBlue, 90)}
      ${arrow(cx - 72, cy + 18, cx + 80, cy + 18, C.carBlue, 2.5)}
      <!-- B has priority (to your right) -->
      <circle cx="${cx - 90}" cy="${cy - 15}" r="14" fill="${C.prio}" opacity="0.9"/>
      ${label(cx - 90, cy - 10, '✓', '#1a1a1a', 16)}
      ${label(cx + 18, cy + 130, 'DU', C.carRed, 12)}
      ${label(cx + 115, cy - 18, 'A (vänster)', C.carGray, 10, 'start')}
      ${label(cx - 115, cy + 18, 'B (höger)', C.carBlue, 10, 'end')}
      ${label(200, 390, 'Bil B till din höger → B har företräde (högerregeln)', C.text, 11)}
    `);
  },

};

// Write all SVGs
let count = 0;
for (const [name, fn] of Object.entries(diagrams)) {
  const filePath = path.join(OUT_DIR, `${name}.svg`);
  const content = fn();
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ ${name}.svg`);
  count++;
}
console.log(`\nGenerated ${count} SVG diagrams → image/korkort/`);
