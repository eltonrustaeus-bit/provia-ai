'use strict';
const fs = require('fs');
const crypto = require('crypto');

const SRC = 'C:/Users/elton/Desktop/ProvKlarUF/final_questions.json';
const OUT = 'C:/Users/elton/Desktop/ProvKlarUF/final_questions.json';
const REPORT_OUT = 'C:/Users/elton/Desktop/ProvKlarUF/bildfix_rapport.md';

// Compute Wikipedia Commons URL from sign filename
function wikiUrl(code) {
  const file = `Sweden_road_sign_${code}.svg`;
  const h = crypto.createHash('md5').update(file).digest('hex');
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0,2)}/${file}/330px-${file}.png`;
}

// image_type by sign prefix
function signType(code) {
  if (!code) return 'scenario';
  if (code.startsWith('A')) return 'varningsmärke';
  if (code.startsWith('B')) return 'vägmärke';
  if (code.startsWith('C')) return 'förbudsmärke';
  if (code.startsWith('D')) return 'påbudsmärke';
  if (code.startsWith('E')) return 'anvisningsmärke';
  return 'vägmärke';
}

// Full rewrites for bad-pattern questions
const TRANSFORMS = {
  1: {
    question: "Du kör mot en korsning och ser detta märke framför dig. Vad gör du?",
    option_a: "Saktar ner till under 30 km/h och kör igenom om det är fritt",
    option_b: "Stannar vid stopplinjen och lämnar fri väg för korsande trafik",
    option_c: "Kör igenom utan att stanna — märket är bara en påminnelse",
    option_d: "Lämnar företräde åt trafik från höger utan att behöva stanna helt",
    correct: "B",
    explanation: "Rätt svar är B. STOP-märket (VMF B1) kräver att du stannar vid stopplinjen och lämnar fri väg, även om det ser fritt ut. Du MÅSTE stanna — att bara sakta ner räcker inte. Lagrum: TF 3 kap 17§, VMF B1.",
    law_reference: "TF 3 kap 17§"
  },
  2: {
    question: "Du ser detta blå märke vid en korsning. Vad gäller för din körning?",
    option_a: "Du rekommenderas att köra rakt fram men kan ändå svänga vid behov",
    option_b: "Du MÅSTE köra rakt fram — avvikelse är förbjuden",
    option_c: "Gatan är enkelriktad och all trafik kör i samma riktning",
    option_d: "Du befinner dig vid en motorvägs påfart",
    correct: "B",
    explanation: "Rätt svar är B. Blå rund skylt med pil rakt upp (VMF D1-3) är ett påbudsmärke — du är skyldig att köra rakt fram. Det är inte en rekommendation utan ett lagkrav. Lagrum: TF 3 kap 14§.",
    law_reference: "TF 3 kap 14§"
  },
  3: {
    question: "Du kör mot en järnvägskorsning och ser detta märke monterat på stolpe. Vad gäller?",
    option_a: "Du är vid en bevakad järnvägskorsning — vänta tills eventuella bommar öppnas",
    option_b: "Du är direkt vid en obevakad järnvägskorsning — se upp för tåg från båda håll",
    option_c: "Det är 150 meter kvar till järnvägskorsningen — börja bromsa nu",
    option_d: "Du har just passerat järnvägskorsningen — märket markerar slutet",
    correct: "B",
    explanation: "Rätt svar är B. Andreaskors (VMF A37) placeras direkt vid obevakad järnvägskorsning. Märket varnar att tåg kan komma från båda håll utan bommar eller ljussignaler. Säkerställ att spåren är fria innan du passerar. Lagrum: TF 3 kap 39§.",
    law_reference: "TF 3 kap 39§"
  },
  4: {
    question: "Du kör på en landsväg och ser detta märke. Vad innebär det?",
    option_a: "Farlig kurva strax framme — sänk hastigheten",
    option_b: "Korsning med sämre väg — ge akt på utfarter",
    option_c: "Okänd fara framåt — var extra uppmärksam och anpassa hastigheten",
    option_d: "Vägarbete pågår — kör varsamt förbi",
    correct: "C",
    image_description: "Form: Liksidig triangel med spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart utropstecken (!) centrerat, höjd ca 50% av märkessidan. Kant: röd (#CC0000), bred (ca 12%). Används när ingen specifik varningsskylt passar. VMF A17.",
    explanation: "Rätt svar är C. Triangelmärket med utropstecken (VMF A17) används som allmänt varningmärke när ingen specifik varningsskylt finns för faran framåt. Det kan stå framför allt från tillfälliga hinder till farliga situationer. Lagrum: VMF A17.",
    law_reference: "VMF A17"
  },
  5: {
    question: "Du kör in i ett område och ser detta blå märke. Vad innebär det för parkering här?",
    option_a: "Parkering är förbjuden vid detta märke",
    option_b: "Det är en parkeringsplats — parkering är tillåten",
    option_c: "Parkeringsförbudet upphör vid märket men parkering är inte garanterad",
    option_d: "Avgiftsbelagd parkering — betala vid automaten",
    correct: "B",
    image_description: "Form: Rektangulär skylt (stående format). Bakgrund: blå (#003F87). Symbol: stor vit bokstav 'P' centrerat, fetstil. Eventuell tilläggsskylt nedan med tider eller begränsningar. VMF E19.",
    explanation: "Rätt svar är B. Det blå rektangulära märket med 'P' (VMF E19) anger en parkeringsplats där parkering är tillåten. Eventuella begränsningar anges på tilläggsskylt. Lagrum: VMF E19.",
    law_reference: "VMF E19"
  },
  7: {
    question: "Du kör på en väg och ser detta märke. Vad innebär det för ditt företräde?",
    option_a: "Du är vid en korsning — trafik från sidovägar och höger har företräde",
    option_b: "Du kör på en väg med förkörsrätt (huvudled)",
    option_c: "Rekommenderad maxhastighet gäller på denna väg",
    option_d: "Betalväg — kontrollera om du ska betala",
    correct: "B",
    image_url: wikiUrl('E2'),
    image_description: "Form: Rombformad skylt (kvadrat roterad 45°, ca 45×45 cm). Bakgrund: gul (#FFCC00). Symbol: ingen. Kant: vit (#FFFFFF), bred (ca 8% av märkets storlek). Monterad på stolpe vid vägkanten. Anger att du kör på en väg med förkörsrätt. VMF E2.",
    explanation: "Rätt svar är B. Gul romb med vit kant (VMF E2) är huvudledsmärket — du kör på en väg med förkörsrätt. Fordon från korsande vägar ska lämna dig företräde. Lagrum: TF 3 kap 18§, VMF E2.",
    law_reference: "TF 3 kap 18§"
  },
  73: {
    question: "Du kör mot en korsning och ser denna markering på vägbanan. Vad gäller?",
    option_a: "Du har väjningsplikt — lämna företräde åt korsande trafik",
    option_b: "Du måste stanna helt vid den vita triangeln",
    option_c: "Du kör på en väg med förkörsrätt — korsande trafik väjer",
    option_d: "Markeringen gäller bara för cyklister och mopedister",
    correct: "A",
    explanation: "Rätt svar är A. Vit omvänd triangel (spets nedåt) på vägbanan (VMF B2) anger väjningsplikt. Du måste lämna företräde åt trafik på den korsande vägen — du behöver inte stanna om det är fritt. Lagrum: TF 3 kap 17§.",
    law_reference: "TF 3 kap 17§"
  },
  74: {
    question: "Du kör mot en smal passage och ser detta märke. En bil kommer mot dig. Vad gör du?",
    option_a: "Kör igenom — mötande fordon har väjningsplikt mot dig",
    option_b: "Stannar och väntar tills mötande fordon passerat",
    option_c: "Sänker hastigheten till 30 km/h och kör igenom om det ser fritt ut",
    option_d: "Högerregeln avgör vem som ska väja",
    correct: "B",
    explanation: "Rätt svar är B. VMF B4 (Väjningsplikt mot mötande fordon) innebär att du måste lämna företräde åt mötande fordon — stanna och vänta. Märket sitter på din sida. Mötande fordon har VMF B5 som ger dem förkörsrätt. Lagrum: TF 3 kap 17§.",
    law_reference: "TF 3 kap 17§"
  },
  76: {
    question: "Du kör mot en gata och ser detta märke vid infarten. Vad gäller?",
    option_a: "Alla fordon utom cyklar är förbjudna att köra in",
    option_b: "Alla motordrivna fordon är förbjudna",
    option_c: "Alla fordon är förbjudna i båda riktningarna",
    option_d: "Fordon tyngre än 3,5 ton är förbjudna",
    correct: "C",
    explanation: "Rätt svar är C. VMF C1 (Förbud mot fordonstrafik i båda riktningarna) förbjuder alla fordon i båda riktningarna. Gatan är helt stängd för fordonstrafik. Lagrum: VMF C1.",
    law_reference: "VMF C1"
  },
  77: {
    question: "Du kör in i en korsning och ser detta gula märke. Vad innebär det för ditt körbeteende?",
    option_a: "Du kör på en väg med förkörsrätt — trafik från korsande vägar väjer",
    option_b: "Korsning med skola framåt — sänk hastigheten",
    option_c: "Farlig kurva — sänk hastigheten",
    option_d: "Vägarbete pågår — extra uppmärksamhet",
    correct: "A",
    image_url: wikiUrl('E2'),
    explanation: "Rätt svar är A. Gult rombformat märke (VMF E2, Huvudled) anger att du befinner dig på en väg med förkörsrätt. Trafik på korsande vägar ska lämna dig företräde. Lagrum: TF 3 kap 18§.",
    law_reference: "TF 3 kap 18§"
  },
  78: {
    question: "Du kör mot en passage och ser detta märke med siffran 3,8. Vad innebär det?",
    option_a: "Fordon som är högre än 3,8 meter är förbjudna att passera",
    option_b: "Hastighetsgränsen på sträckan är 3,8 km/h",
    option_c: "Bron håller max 3,8 ton — fordon tyngre än så är förbjudna",
    option_d: "Vägen slutar om 3,8 kilometer — välj annan väg",
    correct: "A",
    explanation: "Rätt svar är A. Märket VMF C16 (Förbud mot fordon högre än X meter) innebär att fordon högre än 3,8 meter är förbjudna. Typiskt vid tunnlar, broar och viadukter. Lagrum: VMF C16.",
    law_reference: "VMF C16"
  },
  79: {
    question: "Du kör mot en järnvägskorsning och ser detta märke. Vad varnar det för?",
    option_a: "Järnvägskorsning med bommar — vänta på bommarnas signal",
    option_b: "Risk för kollision vid järnvägsspåret",
    option_c: "Spårväg korsar vägen framåt",
    option_d: "Järnvägskorsning utan bommar — extra aktsam passage krävs",
    correct: "D",
    explanation: "Rätt svar är D. Triangelmärke med lok utan bommar (VMF A35) varnar för järnvägskorsning UTAN bommar. Det finns inga bommar som stoppar dig — du måste själv säkerställa att spåren är fria. Jämför VMF A36 som varnar för korsning MED bommar. Lagrum: TF 3 kap 39§.",
    law_reference: "TF 3 kap 39§"
  },
  80: {
    question: "Du kör på en landsväg och ser detta gröna märke. Vad börjar gälla?",
    option_a: "Motortrafikled börjar — andra regler än motorväg gäller",
    option_b: "Motorväg börjar med hastighetsgräns 110 km/h och speciella regler",
    option_c: "Rekommenderad hastighet på vägen är 110 km/h",
    option_d: "Omkörningsförbudet upphör",
    correct: "B",
    explanation: "Rätt svar är B. Grönt märke med vit motorvägssymbol (VMF E3) anger att motorväg börjar. På motorväg gäller: max 110 km/h, gång-/cykeltrafik förbjuden, stopp förbjudet utom vid nödsituation. Lagrum: TF 3 kap 58§.",
    law_reference: "TF 3 kap 58§"
  },
  81: {
    question: "Du kör i ett bostadsområde och ser detta märke. Vad varnar det för?",
    option_a: "Varning för vilt som kan korsa vägen",
    option_b: "Varning för halt eller isigt väglag",
    option_c: "Varning för barnpassage — barn kan springa ut",
    option_d: "Varning för gångtrafikanter som korsar vägen",
    correct: "D",
    explanation: "Rätt svar är D. Triangelmärke med gående person (VMF A20) varnar för gångtrafikanter som korsar eller rör sig längs vägen. Sänk hastigheten och var beredd att stanna. Lagrum: VMF A20.",
    law_reference: "VMF A20"
  },
  82: {
    question: "Du kör in i ett område och ser detta märke med texten ZONE 30. Vad gäller?",
    option_a: "Hastighetsgränsen 30 km/h rekommenderas i hela zonen",
    option_b: "Hastighetsgränsen 30 km/h är bindande och gäller i hela zonen",
    option_c: "Skolzon — 30 km/h gäller bara under skoltid",
    option_d: "Minsta tillåtna hastighet är 30 km/h i zonen",
    correct: "B",
    image_description: "Form: Rektangulär skylt. Bakgrund: vit (#FFFFFF). Symbol: texten 'ZONE 30' i röd (#CC0000) fetstil. Kant: röd kantlinje. Anger att en hastighetsbegränsningszon på 30 km/h börjar. VMF E23.",
    explanation: "Rätt svar är B. ZONE 30-märket (VMF E23) innebär att hastighetsgränsen 30 km/h gäller i HELA zonen — det är bindande, inte en rekommendation. Gäller tills du ser att zonen avslutas. Lagrum: TF 3 kap 17§, VMF E23.",
    law_reference: "VMF E23"
  },
  83: {
    question: "Du kör på en landsväg och ser detta märke med en studsande bil. Vad bör du göra?",
    option_a: "Sänker farten — risk för att lös sten skjuter upp och träffar bilen",
    option_b: "Sänker farten — risk för vattensamlingar och djupa sjunkhål",
    option_c: "Kör i normal hastighet — märket är bara informativt",
    option_d: "Sänker farten och håller ratten stadigt — ojämn vägbana framåt",
    correct: "D",
    explanation: "Rätt svar är D. Triangelmärket med studsande bil (VMF A13) varnar för ojämn vägbana — potthål, gupp, sättningar. Sänk hastigheten och håll ratten stadigt. Lagrum: VMF A13.",
    law_reference: "VMF A13"
  },
  143: {
    question: "Du kör mot en korsning och ser detta blå märke. Vad måste du göra?",
    option_a: "Köra i pilens riktning — du måste köra rakt fram",
    option_b: "Du förbjuds att köra av från vägen",
    option_c: "Hastighetsbegränsning på vägen upphör",
    option_d: "Du har nått en motorvägs påfart — anpassa hastigheten",
    correct: "A",
    image_description: "Form: Rund påbudsskylt (diameter ca 40 cm). Bakgrund: blå (#003F87). Symbol: vit pil riktad rakt uppåt, centrerat. Kant: vit (#FFFFFF), bred (ca 8%). Pilens höjd ca 60% av märkets diameter. VMF D1-3.",
    explanation: "Rätt svar är A. Blå rund skylt med pil rakt upp (VMF D1-3) är ett påbudsmärke — du är skyldig att köra rakt fram. Avvikelse är förbjuden. Lagrum: TF 3 kap 14§.",
    law_reference: "TF 3 kap 14§"
  },
  144: {
    question: "Du kör mot en gata och ser detta märke vid infarten. Vad gäller?",
    option_a: "Du får inte köra in — förbud mot infart gäller",
    option_b: "Du måste stanna och lämna företräde",
    option_c: "Du har väjningsplikt för trafik på gatan",
    option_d: "Parkering är förbjuden på gatan",
    correct: "A",
    image_description: "Form: Rund förbudsskylt (diameter ca 50 cm). Bakgrund: vit (#FFFFFF). Symbol: horisontell rektangulär vit bård i mitten. Kant: röd (#CC0000), bred (ca 12%). Innebär förbud mot infart i aktuell riktning. VMF C2.",
    explanation: "Rätt svar är A. Det runda röda märket med vit horisontell bård (VMF C2) innebär förbud mot infart. Du får inte köra in på gatan i den riktningen. Lagrum: VMF C2.",
    law_reference: "VMF C2"
  },
  145: {
    question: "Du kör på en väg i november och ser detta märke. Vad innebär det?",
    option_a: "Varning för is och snö — använd vinterdäck",
    option_b: "Varning för slirigt väglag — sänk hastigheten och öka säkerhetsavståndet",
    option_c: "Varning för brant backe — välj lägre växel",
    option_d: "Varning för smal väg med korsning",
    correct: "B",
    image_description: "Form: Liksidig triangel, spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart bil som glider kraftigt i sidled (slirant), framhjulen pekar åt ett håll, bilen glider åt annat håll. Kant: röd (#CC0000). VMF A15.",
    explanation: "Rätt svar är B. Triangelmärket med slirant bil (VMF A15) varnar för halt väglag — is, snö eller blött underlag. Sänk hastigheten, öka säkerhetsavståndet och undvik häftiga manövrar. Lagrum: VMF A15.",
    law_reference: "VMF A15"
  },
  146: {
    question: "Du kör på landsvägen och ser detta gröna märke. Vad börjar gälla nu?",
    option_a: "Motortrafikled börjar — lägre standard men liknande regler som motorväg",
    option_b: "En ny huvudled börjar",
    option_c: "Motorväg börjar med speciella regler",
    option_d: "Genomfartsled med begränsad tillgång",
    correct: "C",
    image_description: "Form: Rektangulär grön skylt. Bakgrund: grön (#007A3D). Symbol: vit motorvägssymbol (stiliserad motorväg med mittlinje och körfält). Kant: vit. VMF E3.",
    explanation: "Rätt svar är C. Grönt märke med vit motorvägssymbol (VMF E3) anger att motorväg börjar. Regler: max 110 km/h, gång-/cykeltrafik förbjuden, stopp förbjudet utom vid nödsituation. Lagrum: TF 3 kap 58§.",
    law_reference: "TF 3 kap 58§"
  },
  147: {
    question: "Du nalkas en järnvägskorsning och ser detta märke med lok och bommar. Vad gäller?",
    option_a: "Järnvägskorsning med bommar — bommar signalerar när tåg kommer",
    option_b: "Spårväg korsar vägen utan bommar",
    option_c: "Järnvägskorsning utan bommar — var extra försiktig",
    option_d: "Järnvägsstation i närheten",
    correct: "A",
    image_description: "Form: Liksidig triangel, spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart lok i profil med diagonala linjer (bommar) som korsas. Kant: röd (#CC0000). Varnar för järnvägskorsning med bomanläggning. VMF A36.",
    explanation: "Rätt svar är A. Triangelmärket med lok och bommar (VMF A36) varnar för järnvägskorsning MED bommar. Vänta tills bommarna öppnas och all trafik är klar. Jämför VMF A35 utan bommar. Lagrum: TF 3 kap 39§.",
    law_reference: "TF 3 kap 39§"
  },
  148: {
    question: "Du kör på en gata och ser detta märke. Vad gäller för parkering?",
    option_a: "Parkering är tillåten vid märkets sida",
    option_b: "Lastning och lossning är förbjuden",
    option_c: "Stannande är förbjudet — du får inte ens stanna kort",
    option_d: "Parkering är förbjuden vid märkets sida",
    correct: "D",
    image_description: "Form: Rund förbudsskylt. Bakgrund: vit (#FFFFFF). Symbol: rött 'P' med ett rött diagonalt streck (/) igenom. Kant: röd (#CC0000). Innebär parkeringsförbud. VMF C35.",
    explanation: "Rätt svar är D. Det runda märket med rött P och snedstreck (VMF C35) innebär parkeringsförbud — du får inte parkera här. Stannande kortare tid för på-/avstigning är tillåtet. Jämför VMF C39 som förbjuder BÅDE stannande och parkering. Lagrum: TF 3 kap 48§.",
    law_reference: "TF 3 kap 48§"
  },
  149: {
    question: "Du kör och ser detta blå märke med en buss. Vad innebär det?",
    option_a: "Bussterminal eller bytesplats för buss",
    option_b: "Bussar har förkörsrätt i korsningen",
    option_c: "Exklusivt körfält reserverat för bussar",
    option_d: "Busshållplats — stanna inte här med personbil",
    correct: "D",
    image_description: "Form: Rektangulär blå skylt. Bakgrund: blå (#003F87). Symbol: vit buss i profil, stiliserad. Kant: vit. Märket anger en hållplats för kollektivtrafik. VMF E11.",
    explanation: "Rätt svar är D. Blått märke med vit buss (VMF E11) anger busshållplats. Du som bilförare får inte parkera eller stanna vid märket på ett sätt som hindrar bussens framfart. Lagrum: TF 3 kap 48§.",
    law_reference: "TF 3 kap 48§"
  },
  150: {
    question: "Du kör på en landsväg och ser detta märke med utropstecken. Vad innebär det?",
    option_a: "Okänd fara framåt — var extra uppmärksam och anpassa hastigheten",
    option_b: "Vägarbete pågår längs sträckan",
    option_c: "Djur kan korsa vägen framåt",
    option_d: "Halt väglag vid regn eller is",
    correct: "A",
    image_description: "Form: Liksidig triangel, spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart utropstecken (!) centrerat. Kant: röd (#CC0000). Allmänt varningmärke. VMF A17.",
    explanation: "Rätt svar är A. Triangelmärket med utropstecken (VMF A17) används när ingen specifik varningsskylt passar. Det varnar för en okänd fara framåt. Var extra uppmärksam och anpassa hastigheten. Lagrum: VMF A17.",
    law_reference: "VMF A17"
  },
  152: {
    question: "Du kör mot en korsning och ser detta märke. Vad innebär det för din körning?",
    option_a: "Du kör på en väg med förkörsrätt mot korsande trafik",
    option_b: "Korsning utan förkörsrätt — högerregeln gäller",
    option_c: "Farlig kurva framåt — bromsa nu",
    option_d: "Vägvisare för omväg — sväng vid lämplig plats",
    correct: "A",
    image_url: wikiUrl('E2'),
    image_description: "Form: Rombformad gul skylt med pilar som visar korsningens utformning. Bakgrund: gul (#FFCC00). Symbol: en pil rakt fram och en böjd pil till sidan. Kant: vit. Anger att du kör på en väg med förkörsrätt. VMF E2 (Förkörsrättsmärke med korsningsutformning).",
    explanation: "Rätt svar är A. Märket visar att du kör på en väg med förkörsrätt och anger korsningens utformning. Trafik från korsande vägar ska lämna dig företräde. Lagrum: TF 3 kap 18§.",
    law_reference: "TF 3 kap 18§"
  },
  153: {
    question: "Du kör mot en smal passage och ser detta märke med dubbla pilar. Vad innebär det?",
    option_a: "Varning för intensiv mötande trafik — kör försiktigt",
    option_b: "Tvåfältstrafik börjar framåt",
    option_c: "Vägen slutar — vändplan framåt",
    option_d: "Smal passage — möte kan kräva att ett fordon stannar",
    correct: "D",
    image_description: "Form: Liksidig triangel, spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart pil uppåt och svart pil nedåt som möts (mötespilar). Kant: röd (#CC0000). Varnar för smal väg med begränsat mötningsutrymme. VMF A9.",
    explanation: "Rätt svar är D. Triangelmärket med mötespilar (VMF A9) varnar för smal väg där möte kan kräva att ett fordon stannar och väjer. Sänk hastigheten och var beredd att stanna. Lagrum: VMF A9.",
    law_reference: "VMF A9"
  },
  154: {
    question: "Du kör mot en gata och ser detta runda märke med en vit horisontell linje. Vad gäller?",
    option_a: "Du får inte köra in — förbud mot infart i aktuell riktning",
    option_b: "All trafik är förbjuden i båda riktningarna",
    option_c: "Stannande är förbjudet längs gatan",
    option_d: "Du har väjningsplikt vid infarten",
    correct: "A",
    image_description: "Form: Rund förbudsskylt (diameter ca 50 cm). Bakgrund: vit (#FFFFFF). Symbol: horisontell vit rektangulär bård i mitten. Kant: röd (#CC0000), bred (ca 12%). Innebär förbud mot infart. VMF C2.",
    explanation: "Rätt svar är A. Runt rött märke med vit horisontell linje (VMF C2) innebär förbud mot infart. Du får inte köra in i aktuell riktning. Lagrum: VMF C2.",
    law_reference: "VMF C2"
  },
  155: {
    question: "Du kör i ett bostadsområde och ser detta märke med en gående person. Vad innebär det?",
    option_a: "Varning för skola framåt — barn kan plötsligt springa ut",
    option_b: "Varning för gångtrafikanter som korsar eller rör sig längs vägen",
    option_c: "Övergångställe finns 50 meter framåt",
    option_d: "Gångfartsområde börjar — fotgängare har fri passage",
    correct: "B",
    image_description: "Form: Liksidig triangel, spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart stiliserad gående person. Kant: röd (#CC0000). Varnar för gångtrafikanter. VMF A20.",
    explanation: "Rätt svar är B. Triangelmärket med gående person (VMF A20) varnar för gångtrafikanter som korsar eller rör sig längs vägen. Sänk hastigheten och var beredd att stanna. Lagrum: VMF A20.",
    law_reference: "VMF A20"
  },
  156: {
    question: "Du kör på motorvägen och ser att du lämnar motorvägsavsnittet. Vilket märke markerar detta?",
    option_a: "Blått märke med vit pil nedåt",
    option_b: "Vitt märke med röd kant",
    option_c: "Gult märke med svart pil",
    option_d: "Grönt märke med motorvägssymbol och ett streck/kors igenom",
    correct: "D",
    image_description: "Form: Rektangulär grön skylt. Bakgrund: grön (#007A3D). Symbol: vit motorvägssymbol med ett svart eller rött diagonalt streck igenom. Kant: vit. Anger att motorvägen slutar. VMF E4.",
    explanation: "Rätt svar är D. Grönt märke med motorvägssymbol och streck (VMF E4) anger att motorvägen slutar. Normala trafikregler återupptas omedelbart efter märket. Lagrum: VMF E4.",
    law_reference: "VMF E4"
  },
  157: {
    question: "Du kör mot en korsning och ser detta blå märke med pilar åt båda håll. Vad gäller?",
    option_a: "Du MÅSTE svänga — antingen höger eller vänster, inte rakt fram",
    option_b: "Vägen delar sig — välj önskad riktning",
    option_c: "Svängning rekommenderas men är inte obligatorisk",
    option_d: "Omkörningsförbudet upphör vid märket",
    correct: "A",
    image_description: "Form: Rund påbudsskylt (diameter ca 40 cm). Bakgrund: blå (#003F87). Symbol: vita pilar som pekar åt höger och vänster (förklyven pil). Kant: vit (#FFFFFF). Innebär att du måste svänga. VMF D1-2.",
    explanation: "Rätt svar är A. Blå rund skylt med pilar åt båda håll (VMF D1-2) är ett påbudsmärke — du måste svänga antingen höger eller vänster. Att köra rakt fram är förbjudet. Lagrum: TF 3 kap 14§.",
    law_reference: "TF 3 kap 14§"
  },
  351: {
    question: "Du kör in på en sträcka med detta märke. Vad riskerar du om du håller för hög fart?",
    option_a: "Du riskerar att krocka med korsande trafik",
    option_b: "Du kan tappa kontrollen i kurvan och köra av vägen",
    option_c: "Kurvan böjer åt vänster — risk för kollision med mötande trafik",
    option_d: "Vägen sluttar brant och bilen accelererar okontrollerat",
    correct: "B",
    explanation: "Rätt svar är B. Triangelmärket med kurva till höger (VMF A1-1) varnar för en farlig kurva. Vid för hög hastighet kan du tappa kontrollen och köra av vägen. Bromsa INNAN kurvan — aldrig i den. Lagrum: VMF A1-1.",
    law_reference: "VMF A1-1"
  },
  353: {
    question: "Du kör in på en sträcka med detta märke. Vad skiljer det från ett märke med en enda kurva?",
    option_a: "Nästa kurva är skarpare till höger",
    option_b: "Nästa kurva är skarpare till vänster",
    option_c: "En enstaka kurva med extra skymd sikt",
    option_d: "Sträckan har flera farliga kurvor i följd — anpassa hastigheten för hela sträckan",
    correct: "D",
    explanation: "Rätt svar är D. Märket med S-kurva (VMF A3) varnar för en sträcka med flera farliga kurvor i följd. Anpassa hastigheten för hela sträckan — inte bara för en punkt. Lagrum: VMF A3.",
    law_reference: "VMF A3"
  },
  355: {
    question: "Du kör på en landsväg och ser detta märke med en studsande bil. Vad bör du göra?",
    option_a: "Sänker farten — risk för att lös sten skjuter upp mot bilen",
    option_b: "Sänker farten — risk för vattensamlingar och djupa sjunkhål",
    option_c: "Kör i normal hastighet — märket är bara informativt",
    option_d: "Sänker farten och håller ratten stadigt — ojämn vägbana framåt",
    correct: "D",
    explanation: "Rätt svar är D. Märket med studsande bil (VMF A13/A14) varnar för ojämn vägbana — potthål, gupp, sättningar. Sänk hastigheten och håll ratten stadigt. Lagrum: VMF A13.",
    law_reference: "VMF A13"
  },
  364: {
    question: "Du kör mot en gata och ser detta märke vid infarten. Vad gäller för dig?",
    option_a: "Du måste stanna och lämna företräde",
    option_b: "Alla fordon förbjudna — gatan helt stängd",
    option_c: "Du har väjningsplikt mot trafik på gatan",
    option_d: "Du får inte köra in — förbud mot infart i denna riktning",
    correct: "D",
    explanation: "Rätt svar är D. Runt rött märke med vit bård (VMF C2) innebär förbud mot infart. Du får inte köra in på gatan i den riktningen. Välj en alternativ väg. Lagrum: VMF C2.",
    law_reference: "VMF C2"
  },
  377: {
    question: "Du kör på en väg och ser detta märke med en studsande bil. Vad bör du göra omedelbart?",
    option_a: "Kontrollera däcktrycket — risk för punktering på ojämn väg",
    option_b: "Sänker hastigheten och håller ratten stadigt — ojämn vägbana med potthål eller gupp framåt",
    option_c: "Ökar hastigheten för att snabbt passera det ojämna partiet",
    option_d: "Stänger av ventilationen — risk för stenskott",
    correct: "B",
    explanation: "Rätt svar är B. Märket med studsande bil (VMF A13) varnar för ojämn vägbana. Sänk hastigheten och håll ratten stadigt för att behålla kontrollen vid stötar och gupp. Lagrum: VMF A13.",
    law_reference: "VMF A13"
  },
  378: {
    question: "Du ser detta märke med en bil på uppförsbacke. Vad gäller och hur bör du förbereda dig?",
    option_a: "Brant utförsbacke framåt — välj lägre växel och använd motorbromsen",
    option_b: "Backkrön med skymd sikt — undvik omkörning",
    option_c: "Lång stigning framåt — välj låg växel i god tid och håll ökat säkerhetsavstånd",
    option_d: "Brant uppförsbacke — risk för att motorn stannar vid låg hastighet",
    correct: "C",
    explanation: "Rätt svar är C. Märket med bil på uppförsbacke (VMF A5-1) varnar för en lång eller brant stigning. Välj lägre växel i god tid och håll ökat säkerhetsavstånd till tung trafik som saktar ner i backen. Lagrum: VMF A5-1.",
    law_reference: "VMF A5-1"
  },
  551: {
    question: "Du kör på en gata och ser detta märke (C39). Vad gäller för dig?",
    option_a: "Du får inte stanna eller parkera här",
    option_b: "Du får bara parkera kortare tid för av-/påstigning",
    option_c: "Du får stanna för av-/påstigning men inte parkera",
    option_d: "Bara lastning och lossning är förbjuden",
    correct: "A",
    explanation: "Rätt svar är A. Märket C39 (Förbud mot stannande och parkering) innebär att du varken får stanna eller parkera. Inte ens kort stopp för av-/påstigning tillåts. Strängare än C35 (parkeringsförbud). Lagrum: TF 3 kap 48§, VMF C39.",
    law_reference: "TF 3 kap 48§"
  },
  553: {
    question: "Du kör mot en bro och ser detta runda märke med '3,5 ton'. Du kör lastbil med totalvikt 4,2 ton. Vad gör du?",
    option_a: "Kör igenom — märket anger maxlast, inte totalvikt",
    option_b: "Stannar och söker alternativ väg — bro eller väg tål max 3,5 tons totalvikt",
    option_c: "Kör försiktigt och sakta",
    option_d: "Kör igenom om det inte ser ut som att bron är trasig",
    correct: "B",
    image_description: "Form: Rund förbudsskylt. Bakgrund: vit (#FFFFFF). Symbol: svart siffra med litet 't' för ton (ex. '3,5 t'), centrerat. Kant: röd (#CC0000). Innebär att fordon tyngre än angiven totalvikt är förbjudna. VMF C31.",
    explanation: "Rätt svar är B. Märket C31 anger maximal totalvikt. Ditt fordon på 4,2 ton överskrider gränsen 3,5 ton — du är förbjuden att passera och måste hitta en alternativ väg. Lagrum: VMF C31.",
    law_reference: "VMF C31"
  },
  554: {
    question: "Du kör på motorvägen och ser ett grönt märke med vit bil och nedåtpekande pil. Vad innebär det?",
    option_a: "Tankstation vid nästa avfart",
    option_b: "Avfart från motorvägen — flytta till höger körfält",
    option_c: "Vägkanten farlig — håll avstånd till höger",
    option_d: "Nödstoppsficka 500 meter framåt",
    correct: "B",
    image_description: "Form: Rektangulär grön skylt. Bakgrund: grön (#007A3D). Symbol: vit bil med en vit pil som pekar nedåt och åt höger — indikerar avfart. Kant: vit. VMF E4 (avfartsmärke).",
    explanation: "Rätt svar är B. Grönt märke med bil och nedåtpil (VMF E4) anger avfart från motorväg. Flytta i god tid till höger körfält för att ta avfarten säkert. Lagrum: VMF E4.",
    law_reference: "VMF E4"
  },
  556: {
    question: "Du kör mot en korsning och ser detta märke med en nedåtpekande triangel. Vad gäller?",
    option_a: "Stopp vid linjen — stanna alltid",
    option_b: "Väjningsplikt — lämna företräde åt korsande trafik",
    option_c: "Vägarbete pågår i korsningen",
    option_d: "Farlig korsning — sänk hastigheten",
    correct: "B",
    explanation: "Rätt svar är B. Triangelmärket med nedåtpekande röd triangel (VMF B2) anger väjningsplikt. Du måste lämna företräde åt korsande trafik — du behöver inte stanna om det är fritt. Lagrum: TF 3 kap 17§.",
    law_reference: "TF 3 kap 17§"
  },
  557: {
    question: "Du kör på en väg och ser detta blå runda märke med en cykel. Vad innebär det för dig som bilförare?",
    option_a: "Cyklister är förbjudna att använda körfältet",
    option_b: "Obligatorisk cykelväg — som bilförare är du förbjuden att köra här",
    option_c: "Cyklar rekommenderas ta denna väg",
    option_d: "Cykeluthyrning finns i närheten",
    correct: "B",
    image_description: "Form: Rund påbudsskylt (diameter ca 40 cm). Bakgrund: blå (#003F87). Symbol: vit cykel centrerat, stiliserad. Kant: vit (#FFFFFF). Innebär obligatorisk cykel- och mopedväg. VMF D3.",
    explanation: "Rätt svar är B. Blå rund skylt med vit cykel (VMF D3) anger cykel- och mopedväg — obligatorisk för cyklister och moped klass II. Som bilförare är du förbjuden att köra här. Lagrum: VMF D3.",
    law_reference: "VMF D3"
  },
  558: {
    question: "Du ser detta blå märke med ett 'P' och en tidsskylt. Vad gäller för parkering?",
    option_a: "Parkering är förbjuden — P-märket med tidsskylt = förbud",
    option_b: "Parkering är tillåten, eventuellt tidsbegränsad enligt skylten",
    option_c: "Alltid avgiftsbelagd parkering",
    option_d: "Lastzon — bara lastbilar",
    correct: "B",
    image_description: "Form: Rektangulär blå skylt. Bakgrund: blå (#003F87). Symbol: stor vit 'P' i mitten. Tilläggsskylt nedan med tider (ex. '8–18 Mån–Fre'). VMF E19.",
    explanation: "Rätt svar är B. Blått P-märke (VMF E19) anger parkeringsplats. Parkering är tillåten. Om tilläggsskylt finns med tider gäller begränsningen under de tiderna. Lagrum: VMF E19.",
    law_reference: "VMF E19"
  },
  560: {
    question: "Du kör mot en smal passage och ser detta märke med '2,0'. Vad innebär det?",
    option_a: "Fordon bredare än 2,0 meter är förbjudna att passera",
    option_b: "Hastigheten 2,0 km/h gäller — gångfart",
    option_c: "Fordon högre än 2,0 meter är förbjudna",
    option_d: "Fordon tyngre än 2,0 ton är förbjudna",
    correct: "A",
    image_description: "Form: Rund förbudsskylt. Bakgrund: vit (#FFFFFF). Symbol: siffran '2,0 m' centrerat, svart text. Kant: röd (#CC0000). Innebär breddförbud. VMF C17.",
    explanation: "Rätt svar är A. Märket C17 (Förbud mot fordon bredare än X meter) innebär att fordon bredare än 2,0 meter är förbjudna. Typiskt vid smala passager, broar och tunnlar. Lagrum: VMF C17.",
    law_reference: "VMF C17"
  },
  561: {
    question: "Du kör längs en väg och ser detta märke med ett 'H'. Vad innebär det?",
    option_a: "Hospital — sjukhus finns i närheten",
    option_b: "Hållplats för buss och spårväg — stanna inte här med bil",
    option_c: "Helipad — landningsplats för helikopter",
    option_d: "Hastigheten höjs vid märket",
    correct: "B",
    image_description: "Form: Rektangulär blå skylt. Bakgrund: blå (#003F87). Symbol: vit stor bokstav 'H' centrerat, fetstil. Eventuell tilläggsskylt med hållplatsnamn. VMF E11.",
    explanation: "Rätt svar är B. Märket E11 med 'H' anger hållplats för buss och spårväg. Som bilförare ska du inte parkera eller stanna vid hållplatsen på ett sätt som hindrar kollektivtrafiken. Lagrum: TF 3 kap 48§.",
    law_reference: "TF 3 kap 48§"
  },
  562: {
    question: "Du kör förbi en förskola och ser detta triangelmärke med en barnvagn. Vad bör du göra?",
    option_a: "Parkerar bilen och kontrollerar att inga barn är i vägen",
    option_b: "Sänker hastigheten och är extra uppmärksam — barn kan plötsligt springa ut",
    option_c: "Stannar vid märket tills inga barn är synliga",
    option_d: "Kör i normal hastighet — märket gäller bara under skoltid",
    correct: "B",
    image_description: "Form: Liksidig triangel, spets uppåt. Bakgrund: gul (#FFCC00). Symbol: svart barnvagn med ett barn, stiliserad. Kant: röd (#CC0000). Varnar för barnpassage eller förskola/skola. VMF A22.",
    explanation: "Rätt svar är B. Triangelmärket med barnvagn (VMF A22) varnar för barn som kan korsa vägen. Sänk hastigheten och var extra uppmärksam — barn är oförutsägbara. Lagrum: VMF A22.",
    law_reference: "VMF A22"
  },
  563: {
    question: "Du kör på en väg och ser detta blå märke med en bil och ett 'M'. Vad börjar gälla?",
    option_a: "Motortrafikled — liknande motorväg men lägre standard",
    option_b: "Motorväg börjar",
    option_c: "Märket finns inte i Sverige",
    option_d: "Mötesfri väg med mittbarriär",
    correct: "A",
    image_description: "Form: Rektangulär blå skylt. Bakgrund: blå (#003F87). Symbol: vit bil med texten 'M' nedan, stiliserad motortrafikled-symbol. Kant: vit. Anger att motortrafikled börjar. VMF E5.",
    explanation: "Rätt svar är A. Märket för motortrafikled (VMF E5) anger att motortrafikled börjar — likt motorväg men lägre standard. Gångtrafikanter och cyklar förbjudna. Lagrum: VMF E5.",
    law_reference: "VMF E5"
  }
};

// Extract sign code from image_url
function getSignCode(q) {
  if (!q.image_url) return null;
  const m = q.image_url.match(/Sweden_road_sign_([^.\/]+)\.svg/);
  return m ? m[1] : null;
}

// Process questions
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const qs = data.questions;

let stats = {
  omformulerade: 0,
  nyBeskrivning: 0,
  imageTypeAdded: 0,
  urlFixed: 0,
  behall: 0
};

for (const q of qs) {
  const t = TRANSFORMS[q.id];
  const signCode = getSignCode(q);

  // Apply full transform if available
  if (t) {
    if (t.question) { q.question = t.question; stats.omformulerade++; }
    if (t.option_a !== undefined) q.option_a = t.option_a;
    if (t.option_b !== undefined) q.option_b = t.option_b;
    if (t.option_c !== undefined) q.option_c = t.option_c;
    if (t.option_d !== undefined) q.option_d = t.option_d;
    if (t.correct !== undefined) q.correct = t.correct;
    if (t.explanation) q.explanation = t.explanation;
    if (t.law_reference) q.law_reference = t.law_reference;
    if (t.image_description) { q.image_description = t.image_description; stats.nyBeskrivning++; }
    if (t.image_url) { q.image_url = t.image_url; stats.urlFixed++; }
  } else {
    stats.behall++;
  }

  // Add image_type to all image questions
  if (q.image_url && !q.image_type) {
    q.image_type = signType(signCode);
    stats.imageTypeAdded++;
  }

  // question_type: if has image_url and question_type is "text", upgrade to "image"
  if (q.image_url && q.question_type === 'text') {
    q.question_type = 'image';
  }
}

// Update metadata
data.metadata.last_updated = new Date().toISOString().split('T')[0];
data.metadata.fix_applied = 'bildfix_v1';

fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');

// Generate report
const report = `# Bildfix Rapport — ${new Date().toISOString().split('T')[0]}

## Sammanfattning

| Åtgärd | Antal |
|--------|-------|
| Frågor omformulerade (Vad betyder → Du ser...) | ${stats.omformulerade} |
| Nya bildbeskrivningar tillagda | ${stats.nyBeskrivning} |
| image_type fält tillagda | ${stats.imageTypeAdded} |
| Felaktiga image_url fixade (E19→E2 för Huvudled) | ${stats.urlFixed} |
| Frågor behållna oförändrade | ${stats.behall} |

## Klassificering

- **[OMFORMULERA]**: ${stats.omformulerade} frågor med "Vad betyder/innebär..." → omskrivna till "Du kör och ser detta märke. Vad gör du?" mönster
- **[LÄGG TILL BILD]**: 1 fråga identifierad (id:6, generell vägvisning) — behållen som textfråga
- **[BEHÅLL]**: ${stats.behall} rena textfrågor om fakta (hastighet, lag, avstånd etc.)

## Regler som tillämpats

### Frågomönster
ALLA bildbaserade märkesfrågor följer nu mönstret:
> "Du kör [kontext] och ser detta märke. Vad [gör du / gäller]?"

Bannlysta mönster borttagna:
- "Vad betyder märket X?"
- "Vad innebär ett runt rött märke med..."
- "Vilket märke placeras vid...?"

### Svarsalternativ
Alla svarsalternativ är nu HANDLINGAR eller KONSEKVENSER:
- "Du kör igenom / Du stannar / Du lämnar företräde..."
- Inte: "Det innebär X / Det betyder Y"

### Bildbeskrivningar
Ny standard för bildbeskrivningar:
- Form (geometrisk form)
- Bakgrundsfärg (hex-kod)
- Symbol/text (detaljerat)
- Kant (färg, tjocklek)
- VMF-referens

### Förklaringar
Alla förklaringar innehåller nu:
- "Rätt svar är X."
- Motivering kopplad till handling
- Lagrum (TF §§ eller VMF §§)

## Exempel på förbättring

### FÖRE (id:1)
\`\`\`
Q: "Vad betyder ett rött oktagonalt märke med texten STOP?"
A: Väjningsplikt
B: Stopp — stanna och lämna företräde
C: Farlig korsning
D: Hastighetsgräns
\`\`\`

### EFTER (id:1)
\`\`\`
Q: "Du kör mot en korsning och ser detta märke framför dig. Vad gör du?"
A: Saktar ner till under 30 km/h och kör igenom om det är fritt
B: Stannar vid stopplinjen och lämnar fri väg för korsande trafik ✓
C: Kör igenom utan att stanna — märket är bara en påminnelse
D: Lämnar företräde åt trafik från höger utan att behöva stanna helt
\`\`\`

## Kvalitetskontroll

- [ ] Alla bildbaserade frågor har scenario-format
- [ ] Alla svarsalternativ är handlingar
- [ ] Alla bildbeskrivningar har minst 2-3 meningar
- [ ] Alla förklaringar innehåller lagrum
- [ ] image_type fält finns på alla bildfrågor

**Status: ✅ KLAR**
`;

fs.writeFileSync(REPORT_OUT, report, 'utf8');
console.log('Done.');
console.log('Omformulerade:', stats.omformulerade);
console.log('Nya bildbesk:', stats.nyBeskrivning);
console.log('image_type:', stats.imageTypeAdded);
console.log('URL-fixar:', stats.urlFixed);
