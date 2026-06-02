const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FINAL_PATH = path.join(ROOT, 'final_questions.json');
const REPORT_PATH = path.join(ROOT, 'manual_text_review_report.md');

const NOW = () => new Date().toISOString();

const APPROVED = {
  6: {
    law: 'VMF vägvisningsmärken',
    explanation: 'Rätt svar är D. Gula rektangulära vägvisningsmärken används för vägvisning och orientering. De är inte varnings-, påbuds- eller förbudsmärken. Källa: Transportstyrelsens vägmärkesförteckning.',
  },
  9: {
    question: 'Hur nära före ett övergångsställe är det förbjudet att parkera?',
    option_a: '5 meter före övergångsstället',
    option_b: '10 meter före övergångsstället',
    option_c: '15 meter före övergångsstället',
    option_d: '20 meter före övergångsstället',
    law: 'TF 3 kap 53 §',
    explanation: 'Rätt svar är B. Du får inte parkera på ett övergångsställe eller närmare än 10 meter före det. Regeln finns för att sikten mot gående inte ska skymmas. Lagrum: TF 3 kap 53 §.',
  },
  12: {
    question: 'Vad ska du göra när en trafiksignal visar gult och du kan stanna utan fara?',
    option_a: 'Öka farten för att hinna över innan det blir rött',
    option_b: 'Köra vidare eftersom gult alltid betyder fri passage',
    option_c: 'Köra vidare om signalen nyss slog om',
    option_d: 'Stanna om det kan ske utan fara',
    law: 'VMF trafiksignaler',
    explanation: 'Rätt svar är D. Gul signal betyder att du ska stanna om det kan ske utan fara. Du får bara fortsätta om du är så nära signalen att en säker inbromsning inte är möjlig. Källa: Transportstyrelsen, trafiksignaler.',
  },
  17: {
    law: 'TF 3 kap 21 §',
    explanation: 'Rätt svar är D. När du kör ut från en parkeringsplats ska du lämna företräde åt trafiken på vägen du kör ut på. Lagrum: TF 3 kap 21 §.',
  },
  21: {
    question: 'Du har kört in i en korsning och signalen slår om till rött bakom dig. Vad ska du göra?',
    option_a: 'Backa tillbaka till stopplinjen',
    option_b: 'Fortsätta och lämna korsningen så säkert och snabbt som möjligt',
    option_c: 'Stanna mitt i korsningen',
    option_d: 'Vänta på grönt där du står',
    law: 'VMF trafiksignaler',
    explanation: 'Rätt svar är B. Om du redan befinner dig i korsningen ska du inte backa eller stanna mitt i korsningen. Lämna korsningen så säkert och snabbt som möjligt. Källa: Transportstyrelsen, trafiksignaler.',
  },
  34: {
    law: 'VMF C31',
    explanation: 'Rätt svar är B. Ett runt hastighetsmärke med röd kant är C31, hastighetsbegränsning. Det anger högsta tillåtna hastighet från märket. Lagrum: VMF C31.',
  },
  87: {
    law: 'TF 3 kap 21 §',
    explanation: 'Rätt svar är B. Trafiken på vägen du kör ut till behöver inte väja för dig. När du lämnar en parkeringsplats ska du lämna företräde åt trafiken på vägen. Lagrum: TF 3 kap 21 §.',
  },
  88: {
    question: 'Hur nära en vägkorsning är det förbjudet att parkera?',
    option_a: '5 meter från korsningen',
    option_b: '20 meter från korsningen',
    option_c: '15 meter från korsningen',
    option_d: '10 meter från korsningen',
    law: 'TF 3 kap 53 §',
    explanation: 'Rätt svar är D. Du får inte parkera i en vägkorsning eller närmare än 10 meter från den korsande körbanans närmaste ytterkant. Lagrum: TF 3 kap 53 §.',
  },
  97: {
    question: 'Vad bör du göra när ett körfält upphör och trafiken ska vävas samman?',
    option_a: 'Bromsa kraftigt och stanna även om trafiken flyter',
    option_b: 'Samarbeta och låta fordonen vävas in växelvis',
    option_c: 'Kräva företräde om du ligger längst fram',
    option_d: 'Aldrig byta körfält',
    law: 'TF 2 kap 1 §',
    explanation: 'Rätt svar är B. När körfält upphör ska du anpassa hastigheten, visa hänsyn och samarbeta så att trafiken kan vävas samman säkert. Lagrum: TF 2 kap 1 §.',
  },
  98: {
    law: 'VMF B4',
    explanation: 'Rätt svar är D. På huvudled har trafiken på korsande vägar normalt väjningsplikt. Du ska ändå vara uppmärksam och anpassa körningen om någon gör fel. Lagrum: VMF B4.',
  },
  99: {
    law: 'VMF trafiksignaler',
    explanation: 'Rätt svar är A. Vid röd signal ska du stanna vid stopplinjen eller, om stopplinje saknas, före signalen eller korsningen. Källa: Transportstyrelsen, trafiksignaler.',
  },
  100: {
    law: 'VMF trafiksignaler',
    explanation: 'Rätt svar är C. Blinkande gult ljus betyder att du ska vara särskilt försiktig. Du ska följa vägmärken och övriga väjningsregler på platsen. Källa: Transportstyrelsen, trafiksignaler.',
  },
  110: {
    option_a: '15 meter',
    option_b: '20 meter',
    option_c: '25 meter',
    option_d: '30 meter',
    law: 'Beräkningsfråga',
    explanation: 'Rätt svar är C. 90 km/h motsvarar 25 meter per sekund eftersom 90 / 3,6 = 25. Det är en beräkningsfråga om reaktionssträcka, inte en särskild paragraf.',
  },
  142: {
    law: 'TF 2 kap 1 §',
    explanation: 'Rätt svar är B. Håll större säkerhetsavstånd bakom tunga fordon. Du får bättre sikt och mer tid att reagera, och tunga fordon kan skymma hinder längre fram. Lagrum: TF 2 kap 1 §.',
  },
  164: {
    question: 'Får du parkera så att du hindrar in- eller utfart från en fastighet?',
    option_a: 'Ja, om du parkerar högst 30 minuter',
    option_b: 'Nej, du får inte parkera så att du hindrar in- eller utfart',
    option_c: 'Ja, om garaget inte används just då',
    option_d: 'Ja, om du lämnar kontaktuppgifter',
    law: 'TF 3 kap 49 §',
    explanation: 'Rätt svar är B. Du får inte parkera så att du hindrar in- eller utfart från en fastighet, till exempel framför en garageuppfart. Lagrum: TF 3 kap 49 §.',
  },
  174: {
    question: 'Får du svänga höger mot rött ljus om det inte finns någon särskild signal som tillåter svängen?',
    option_a: 'Ja, om det är fritt',
    option_b: 'Ja, efter att du har stannat helt',
    option_c: 'Nej, du får inte köra mot rött',
    option_d: 'Ja, om du blinkar och kör försiktigt',
    law: 'VMF trafiksignaler',
    explanation: 'Rätt svar är C. Röd signal betyder stopp. Du får inte svänga höger mot rött om det inte finns en särskild signal eller anvisning som tillåter det. Källa: Transportstyrelsen, trafiksignaler.',
  },
  175: {
    law: 'TF 3 kap 24 §',
    explanation: 'Rätt svar är B. Den som svänger vänster ska lämna företräde åt mötande trafik som kör rakt fram eller svänger höger. Lagrum: TF 3 kap 24 §.',
  },
  177: {
    law: 'TF 2 kap 5 §',
    explanation: 'Rätt svar är C. Du ska underlätta framkomligheten för utryckningsfordon, men inte skapa en ny fara. Lämna korsningen säkert och ge plats så snart det kan göras. Lagrum: TF 2 kap 5 §.',
  },
  179: {
    law: 'TF 3 kap 25 §',
    explanation: 'Rätt svar är A. Vid vänstersväng ska du placera fordonet nära körbanans mitt eller i lämpligt vänstersvängfält, så att svängen kan göras säkert. Lagrum: TF 3 kap 25 §.',
  },
  180: {
    option_a: 'Den markerar var du ska stanna om du måste lämna företräde',
    law: 'VMF vägmarkeringar',
    explanation: 'Rätt svar är A. En väjningslinje markerar var du ska stanna om du behöver lämna företräde. Till skillnad från stopplinje innebär den inte att du alltid måste stanna. Källa: Transportstyrelsens vägmärkes- och vägmarkeringsregler.',
  },
  181: {
    law: 'TF 2 kap 1 §',
    explanation: 'Rätt svar är A. Genom att sänka hastigheten i god tid får du bättre sikt, mer tid att bedöma korsningen och bättre möjlighet att undvika risker. Lagrum: TF 2 kap 1 §.',
  },
  195: {
    law: 'VMF E11',
    explanation: 'Rätt svar är B. En gul rektangulär hastighetsskylt är E11, rekommenderad lägre hastighet. Den anger en lämplig hastighet under normala förhållanden och är inte samma sak som en bindande C31-hastighetsbegränsning. Lagrum: VMF E11.',
  },
  352: {
    law: 'VMF A1-2',
    explanation: 'Rätt svar är A. Märket A1-2 varnar för farlig kurva åt vänster. Anpassa hastigheten innan kurvan så att du kan köra igenom den med kontroll. Lagrum: VMF A1-2.',
  },
  407: {
    question: 'Vad händer om ett trafikpliktigt fordon saknar trafikförsäkring?',
    option_a: 'Ingenting om fordonet inte orsakar en olycka',
    option_b: 'Ägaren får betala trafikförsäkringsavgift',
    option_c: 'Fordonet beslagtas alltid direkt',
    option_d: 'Endast körkortet återkallas',
    law: 'Trafikskadelagen (1975:1410)',
    explanation: 'Rätt svar är B. Trafikförsäkring är obligatorisk för trafikpliktiga motordrivna fordon. Om fordonet saknar trafikförsäkring rapporteras det till Trafikförsäkringsföreningen och ägaren får betala trafikförsäkringsavgift. Källa: Transportstyrelsen, trafikförsäkring.',
  }
};

const BLOCK = {
  19: 'Heldragna gula mittlinjer beskrivs som absolut körförbud utan verifierad modern svensk källa i denna QA-runda.',
  22: 'Påståendet blandar fotgängare och cyklister vid grönt ljus för brett och kan bli fel beroende på passage/överfart.',
  91: 'Frågan använder gårdsgata/max 10 km/h på ett sätt som riskerar att blanda äldre begrepp med gångfartsområde.',
  123: 'Polisens provtagnings- och testbefogenheter kräver mer exakt juridisk verifiering än datan har.',
  159: 'Dubbla heldragna gula mittlinjer saknar säker verifierad formulering för livefråga.',
  163: 'Körfältssignal med gult X kan vara felaktigt/otydligt formulerad och blockeras tills signalbetydelsen verifieras.',
  165: 'Kollektivtrafikfält/taxi/cykel kan bero på lokal skyltning och tilläggstavlor; frågan är för generell.',
  171: 'Rådet vid felkörning på motorväg i fel riktning är potentiellt farligt och måste skrivas om med myndighetsstöd.',
  173: 'Frågan säger alltid och blandar fotgängare/cyklister/överfart för brett.',
  185: 'Streckade gula mittlinjer är inte tillräckligt verifierade som generell svensk livefråga.'
};

function updateOptions(q) {
  q.options = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
  q.correctAnswer = q.correctAnswer || q.correct;
}

function approve(q, patch) {
  Object.assign(q, patch);
  if (patch.correct) q.correctAnswer = patch.correct;
  updateOptions(q);
  q.law_reference = patch.law;
  q.sourceStatus = 'manual_text_review_approved';
  q.manualReview = {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedBy: 'Codex manual QA',
    evidence: ['Transportstyrelsen official pages', 'Transportstyrelsen vägmärkesaffisch when applicable'],
    note: 'Generic law placeholder replaced or factual wording corrected.',
  };
}

function block(q, reason) {
  q.imageStatus = 'needs_verified_image';
  q.imageUrl = null;
  q.image_url = null;
  q.requiresImage = false;
  q.sourceStatus = 'blocked_manual_text_review_uncertain';
  q.manualReview = {
    status: 'blocked',
    reviewedAt: new Date().toISOString(),
    reviewedBy: 'Codex manual QA',
    evidence: ['Manual QA found uncertainty or over-broad rule statement'],
    note: reason,
  };
  q.validation = {
    ...(q.validation || {}),
    qa_approved: 'NEEDS_REVIEW',
    manual_text_review: 'blocked',
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8'));
  const approved = [];
  const blocked = [];

  for (const q of raw.questions) {
    if (APPROVED[q.id]) {
      approve(q, APPROVED[q.id]);
      approved.push(q.id);
    }
    if (BLOCK[q.id]) {
      block(q, BLOCK[q.id]);
      blocked.push(q.id);
    }
  }

  const active = raw.questions.filter(q => !['ai_generated', 'irrelevant', 'broken', 'needs_verified_image'].includes(q.imageStatus)).length;
  raw.metadata = {
    ...(raw.metadata || {}),
    last_updated: new Date().toISOString().slice(0, 10),
    active_questions: active,
    blocked_questions: raw.questions.length - active,
    manual_text_review: {
      approved: approved.length,
      blocked: blocked.length,
      reviewed: approved.length + blocked.length,
    },
  };

  fs.writeFileSync(FINAL_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  const report = [
    '# Manual Text Review Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Approved / Corrected',
    approved.map(id => `- ID ${id}: approved/corrected`).join('\n') || 'None',
    '',
    '## Blocked',
    blocked.map(id => `- ID ${id}: ${BLOCK[id]}`).join('\n') || 'None',
    '',
    `Active questions after manual text review: ${active}`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'manual_text_review_report.md'), report, 'utf8');

  console.log(JSON.stringify({ approved, blocked, active }, null, 2));
}

main();
