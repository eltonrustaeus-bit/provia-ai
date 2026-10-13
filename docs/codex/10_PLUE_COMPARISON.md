# Plue och ExGen: produktjämförelse

Första jämförelsesnapshot: 2026-10-12. Publika produkt- och funktionssidor kontrollerades på nytt 2026-10-13 utan konto eller personuppgifter. PLUE beskriver kursmaterial och begrepp, tutor och delad arbetsyta, interaktiva lektioner, adaptiv övning, spaced recall och provförberedelse. Funktionssidorna anger att exemplen är illustrativa och inte sparar kursprogress; de belägger därför produktens publika beskrivning, inte inloggad funktion eller faktisk sparning/synk. Startsidan anger "30,000+ learners" som PLUE:s eget marknadsföringspåstående. Jag hittade ingen verifierad prislista i de granskade publika sidorna.

Den publika interaktiva demonstrationen visar en liten beräkning, inte en generell kodmiljö eller grafritning i ett prov. Appens autentiserade flöden har inte granskats. Användarens egen upplevelse av att rita en graf i ett matteprov är fortsatt en separat användarobservation och har inte reproducerats i en publik vy.

Bedömningen skiljer mellan (1) Plues egna publika produktbeskrivningar, (2) Elton Rustaeus egen användarobservation av en grafuppgift och (3) verifierad ExGen-kod. Inloggade Plue-flöden och intern teknik har inte granskats.

## Vad som går att belägga

| Område | Publik Plue-beskrivning / användarobservation | ExGen nuläge | Produktimplikation |
|---|---|---|---|
| Kurs- och materialkontext | PLUE:s kursbeskrivning kopplar böcker/PDF:er till begrepp, förkunskaper och föreslagna nästa steg. Funktionssidornas vyer är uttryckligen illustrativa och sparar inte kursprogress; inloggad funktion är inte granskad. | ExGen utgår från elevens eget material för att skapa prov som sedan rättas mot en skyddad uppgift. | Behåll materialet som källa. Visa konkret vilket underlag stöder en fråga i stället för att utlova automatisk täckning av en hel kursplan. |
| Matematik och grafer | PLUE:s publika interaktiva demonstration visar en liten beräkning och illustrativa interaktiva lektionsbeskrivningar. De publika källorna verifierar inte grafritning i ett prov. Elton uppger separat att en grafuppgift i Plue kändes smidig; det är en användarobservation. | Den aktuella ExGen-branchen innehåller en deterministisk linjeuppgift i matematik och en separat naturvetenskaplig spridningsgraf från exakt en stödd tvåkolumnstabell med tre distinkta heltalspunkter. Elevens punkter kan sättas med pekare eller koordinatfält och poängsätts per punkt. Begränsningen är avsiktlig; ingen generell grafritare. Detta är kod på PR-branchen, inte verifierad livefunktion. | Behåll grafer som avgränsade svarssätt i provloopen. Utforskande simulering är en annan uppgiftstyp än säker poängsättning och kräver eget lärandemål, bedömningskontrakt och tillgänglighets-QA. |
| Interaktion och feedback | PLUE beskriver en tutor på delad arbetsyta som följer uppgiften, elevens försök och var eleven fastnat, samt ämnesspecifika lektionsytor. Exempelvyerna är illustrativa; inloggat beteende har inte granskats. | ExGen har serverstyrd, answer-free metodvägledning under aktivt prov. Efter inlämning kan P.E.R ge full förklaring först när servern verifierat inlämningsbevis och materialkontext. Den separata browser-självchecken räknar frågor där P.E.R-panelen inte öppnades; den ändrar inte provresultatet och är inte ett serververifierat mått på förståelse. | Följ uppgiften konkret, skilj ledtråd från facit och gör det transparent när P.E.R öppnats. Visa rättning och efterförklaring separat från officiellt provresultat; modellens följsamhet kräver fortfarande live-evaluering. |
| Repetition och progression | Startsidan beskriver nya kontroller där hintar räknas separat, nästa steg kan gå framåt eller tillbaka, senare spaced recall och provförberedelse med provdatum. Sparad och sammanlänkad progress är Plues egna påståenden; runtime har inte verifierats här. | ExGen-branchen har provhistorik, felbank, mastery och P.E.R-rekommendationer. Resultatvyn skiljer nu huvudpoäng från poäng/max på frågor där P.E.R inte öppnades; det senare är en lokal aktivitetsbaserad självcheck och ska inte behandlas som lärardiagnostik. Schemalagd repetition och hela elevloopens kvalitet är inte liveverifierad. | Behandla progression som träningssignaler, inte diagnostik. Bevara skillnaden mellan rättningspoäng, aktivitetssignaler och verifierat lärande; visa varför nästa övning rekommenderas. |
| Målgrupp och omfattning | Plue positionerar publikt produkten som tutor/kursmiljö för studier, nya färdigheter och arbete/liv, inte enbart prov inför skolan. | ExGen är smalare: elevens material → relevanta övningsfrågor → svar/rättning → träningsnästa steg. | ExGen bör vinna på tydlighet och förtroende inom sin skolspecifika kärnloop, inte försöka matcha hela Plues bredare kurs-/tutorprodukt inför första pilot. |

## Aktuell PLUE-lärdom — 2026-10-13

Plues publika produktbeskrivning presenterar en sammanhängande kursyta där material, tutor, interaktiva lektionsytor, självständiga kontroller och nästa steg hänger ihop. Eftersom demosidorna är illustrativa och inte sparar kursprogress är detta produktinriktning, inte verifierad effekt eller autentiserad beteende. De mest relevanta principerna för ExGen är därför inte visuella detaljer utan:

- håll elevens källmaterial nära frågan och återkopplingen;
- hjälp utifrån det aktuella svaret och visa nästa användbara steg;
- visa om en ledtråd öppnades och skilj den lokala självchecken från serververifierad rättning och lärardiagnostik;
- håll interaktiva ämnesytor och deras rättningsregler tydligt avgränsade;
- skilj användning/progression från verifierade läranderesultat.

För ExGen är den närmaste produktåtgärden att stärka kedjan försök → P.E.R-hjälp → självständigt nytt försök → rekommenderad repetition, med proven fortsatt skyddade från facitläckage. Delad whiteboard, breda kursgenererade lektioner och spaced-recall-system ska inte kopieras som paket innan elevnytta, dataskydd, kostnad och pilotens stödbehov är verifierade.

## Vad som är ändrat i ExGen

- Grafuppgiften anger nu ekvationen direkt och talar om att lutning och y-skärning bedöms, på svenska och engelska.
- Konstantfunktioner som `y = 3` känns igen utan att vanliga lutande linjer feltolkas som konstanter.
- Ofärdiga koordinater serialiseras och kan återställas; ofullständiga svar fortsätter att räknas som obesvarade vid rättning.
- Minustecken i koordinatfält överlever tangentbordsinmatning tecken för tecken.
- Efter första rättningen kan eleven göra ett separat grafomförsök. Omförsöket går genom serverns krypterade, användar- och materialbundna rättningsuppgift, avslöjar inte facit förrän svaret är rätt och skriver inte om provpoäng, mastery, felbank eller provhistorik.
- Modellsvar får inte bestämma frågans maxpoäng. Rättningen använder det krypterade underlagets poängtak.
- Under aktivt prov ger P.E.R en serverstyrd metodhint utan exakt svar; efter inlämning krävs signerad completion proof innan full frågeförklaring.
- Resultatvyn skiljer huvudresultatet från en självcheck på frågor där P.E.R inte öppnades. Självchecken ändrar inte huvudpoängen eller mastery.
- Naturvetenskaplig spridningsgraf är en begränsad separat uppgiftstyp; den kräver en unik tvåkolumnstabell med tre distinkta heltalspunkter inom rutnätet. Den ska inte beskrivas som allmän graf- eller simuleringsfunktion.

## Prioritering för ExGen

1. **Materialnära interaktion först.** Behåll de två snäva grafkontrakten; utöka endast ämnestyp när källa, uppgift och deterministisk bedömning går att validera.
2. **Separera aktivitet från kunskapsmått.** En öppnad hint markeras som aktivitet; självchecken ska inte påstå vad eleven skulle ha fått utan hjälp eller ersätta officiell rättning.
3. **Nästa grafutökning först efter ämnesgranskning.** Kurvor, funktioners förlopp, simulering och andra diagram kräver eget schema, deterministiskt facit, elevnytta och tillgänglighets-QA.
4. **Behåll ExGens materialnära provloop.** Bredare flashcards, inspelning och planering är inte automatiskt bättre för ExGen eller rätt första steg för en skolpilot.

## Avgränsningar

Nuvarande grafuppgift är inte en generell grafritare. Den bedömer två punkter på en rät linje utifrån lutning och skärning med y-axeln. Den bedömer inte kurvor, funktioners förlopp, extremvärden, skärningspunkter mellan grafer eller grafens visuella noggrannhet utanför den definierade punktmodellen. Frågetypen aktiveras bara när källmaterialet innehåller exakt en stödd linjär funktion. Koordinatfälten är ett textbaserat och tangentbordsvänligt alternativ till pekinteraktionen; full skärmläsar-QA återstår.

Plues publika exempel verifierar inte användarens observerade grafuppgift och kan inte användas som belägg för hur Plues inloggade prov- eller rättningsflöde fungerar. Den aktuella startsidan beskriver en sparad och sammanlänkad arbetsyta, men det påståendet har inte verifierats genom konto eller runtime. Exempelvyer visar därför inte i sig att progressionen faktiskt sparas eller påverkar nästa steg.

## Källor

- [Plues publika startsida](https://plue.si/) och [interaktiv demo](https://plue.si/). Kontrollerade 2026-10-13; publik positionering och beräkningsexempel utan inloggning. Startsidan anger 30,000+ learners; egen uppgift från PLUE, inte oberoende verifierad.
- [Your course](https://plue.si/features/your-course/), [Interactive lessons](https://plue.si/features/interactive-lessons/) och [Adaptive practice](https://plue.si/features/adaptive-practice/). Kontrollerade 2026-10-13; publika funktionsbeskrivningar och illustrativa exempel, inte verifierad sparad kursprogress eller inloggat beteende.
- [Exam preparation](https://plue.si/features/exam-preparation/), [Tutor & shared board](https://plue.si/features/tutor-shared-board/) och [Spaced recall](https://plue.si/features/spaced-recall/). Kontrollerade 2026-10-13; publika produktbeskrivningar, inloggade funktioner ej verifierade.
- [Plues integritetspolicy](https://plue.si/privacy/). Kontrollerad 2026-10-13; PLUE:s egen beskrivning av datahantering, inte en oberoende säkerhetsgranskning.
- [Plues app](https://app.plue.si/). Inloggade flöden, sparning och synk har inte granskats.
- Direkt användarobservation: Elton provade Plue och upplevde det enkelt att rita en graf i ett matteprov. Detta är inte en reproducerad extern testning.
