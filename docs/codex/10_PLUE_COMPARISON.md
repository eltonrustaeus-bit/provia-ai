# Plue och ExGen: produktjämförelse

Första jämförelsesnapshot: 2026-10-12. Publika produkt- och funktionssidor kontrollerades på nytt 2026-10-14 utan konto eller personuppgifter. Startsidan presenterar nu "plue 2.0" som en kursyta med material, frågor och progression, en tutor som följer uppgift och försök på en delad arbetsyta, samt interaktioner för bland annat fysik, kod, musik och schack. Funktionssidorna visar små illustrativa exempel; de anger uttryckligen att dessa demos inte sparar kursprogress. Det verifierar aktuell publik produktpositionering och exempel, inte autentiserat runtime-beteende, beständig sparning/synk eller läranderesultat. Startsidan anger "30,000+ learners" som PLUE:s eget marknadsföringspåstående. Jag hittade ingen verifierad prislista i de granskade publika sidorna.

Den publika interaktionsdemon visar en avgränsad fysikberäkning där användaren ändrar massa och ser kraft delat med massa; PLUE skriver att den inte är en generell Pythonmiljö. Den publika handledardemon ändrar förklaring och arbetsyta för två givna massor. Källorna visar inte grafritning i ett prov. Appens autentiserade flöden har inte granskats. Användarens egen upplevelse av att rita en graf i ett matteprov är fortsatt en separat användarobservation och har inte reproducerats i en publik vy.

Bedömningen skiljer mellan (1) Plues egna publika produktbeskrivningar, (2) Elton Rustaeus egen användarobservation av en grafuppgift och (3) verifierad ExGen-kod. Inloggade Plue-flöden och intern teknik har inte granskats.

## Offentlig integritetsinformation — kontrollerad 2026-10-14

PLUE:s egen [integritetspolicy](https://plue.si/privacy/) uppger att den nya tjänsten behandlar bland annat kursmaterial, AI-meddelanden och studieresultat, anger Cloudflare, Clerk och Anthropic som tjänsteleverantörer, säger att data inte används för att träna AI-modeller och beskriver krav på vårdnadshavares samtycke för elever under 16. Detta är en sammanfattning av leverantörens publika policytext, inte en oberoende säkerhets- eller juridisk bedömning och inte belägg för hur enskilda dataflöden fungerar i runtime. Uppgifterna kan vara relevanta som jämförelsepunkter när ExGen och pilotskolan fastställer egna leverantörer, ålder, rättslig grund, dataminimering och information till elever/vårdnadshavare; de kan inte ersätta de besluten.

## Vad som går att belägga

| Område | Publik Plue-beskrivning / användarobservation | ExGen nuläge | Produktimplikation |
|---|---|---|---|
| Kurs- och materialkontext | PLUE:s kursbeskrivning kopplar böcker/PDF:er till begrepp, förkunskaper och föreslagna nästa steg. Funktionssidornas vyer är uttryckligen illustrativa och sparar inte kursprogress; inloggad funktion är inte granskad. | ExGen utgår från elevens eget material för att skapa prov som sedan rättas mot en skyddad uppgift. | Behåll materialet som källa. Visa konkret vilket underlag stöder en fråga i stället för att utlova automatisk täckning av en hel kursplan. |
| Matematik, naturvetenskap och grafer | PLUE:s publika exempel visar en liten fysikberäkning där massan ändras och resultatet följer den valda siffran. PLUE säger att kodexemplet inte är en generell Pythonmiljö. De publika källorna verifierar inte grafritning i ett prov. Elton uppger separat att en grafuppgift i Plue kändes smidig; det är en användarobservation. | Den aktuella ExGen-branchen innehåller två separata deterministiska grafkontrakt: en linjeuppgift från en stödd linjär funktion och ett punktdiagram från exakt en stödd tvåkolumnstabell med tre distinkta heltalspunkter. Punktdiagrammet är tillåtet i naturvetenskapliga och samhällsvetenskapliga bedömningsprofiler. Punkter kan anges med pekare eller koordinatfält och bedöms per punkt. Begränsningen är avsiktlig; ingen generell grafritare. Detta är kod på PR-branchen, inte verifierad livefunktion. | Behåll grafer som avgränsade svarssätt i provloopen. En liten fysikinteraktion kan vara värdefull när eleven först förutsäger utfallet, ändrar en variabel och förklarar observationen; bygg den bara med källanknytning, deterministiskt svarskontrakt och tangentbords-/touch-QA. |
| Interaktion och feedback | PLUE beskriver en tutor som följer uppgift, försök och var eleven fastnat, med förklaring på en delad arbetsyta. En publik illustration växlar mellan två förinställda massor; texten kallar demon illustrativ och säger att den inte sparar progression. Public copy listar fysik, kod, musik och schack som ämnesytor, men autentiserad funktion har inte granskats. | ExGen har serverstyrd, answer-free metodvägledning under aktivt prov. Efter inlämning kan P.E.R ge full förklaring först när servern verifierat inlämningsbevis och materialkontext. Den separata browser-självchecken räknar frågor där P.E.R-panelen inte öppnades; den ändrar inte provresultatet och är inte ett serververifierat mått på förståelse. | Följ den aktuella uppgiften och elevens försök i hjälpen. En delad skriv-/rityta är ett större bygge än den nuvarande chatthjälpen; validera först om den minskar friktion i ExGens faktiska material→prov→återkopplingsloop. Håll ledtråd, facit och officiell bedömning åtskilda. |
| Repetition och progression | Startsidan beskriver nya kontroller där hintar räknas separat, nästa steg kan gå framåt eller tillbaka, senare spaced recall och provförberedelse med provdatum. Sparad och sammanlänkad progress är Plues egna påståenden; runtime har inte verifierats här. | ExGen-branchen har provhistorik, felbank, mastery och P.E.R-rekommendationer. Resultatvyn skiljer nu huvudpoäng från poäng/max på frågor där P.E.R inte öppnades; det senare är en lokal aktivitetsbaserad självcheck och ska inte behandlas som lärardiagnostik. Schemalagd repetition och hela elevloopens kvalitet är inte liveverifierad. | Behandla progression som träningssignaler, inte diagnostik. Bevara skillnaden mellan rättningspoäng, aktivitetssignaler och verifierat lärande; visa varför nästa övning rekommenderas. |
| Målgrupp och omfattning | Plue positionerar publikt produkten som tutor/kursmiljö för studier, nya färdigheter och arbete/liv, inte enbart prov inför skolan. | ExGen är smalare: elevens material → relevanta övningsfrågor → svar/rättning → träningsnästa steg. | ExGen bör vinna på tydlighet och förtroende inom sin skolspecifika kärnloop, inte försöka matcha hela Plues bredare kurs-/tutorprodukt inför första pilot. |

## Aktuell PLUE-lärdom — 2026-10-14

Plues aktuella publika produktbeskrivning presenterar en sammanhängande kursyta där material, tutor, ämnesspecifika interaktioner, självständiga kontroller och nästa steg hänger ihop. Exempelvyerna är uttryckligen illustrativa och sparar inte kursprogress; detta är därför produktinriktning och publik copy, inte verifierad effekt eller autentiserat beteende. De mest relevanta principerna för ExGen är därför inte visuella detaljer utan:

- håll elevens källmaterial nära frågan och återkopplingen;
- hjälp utifrån det aktuella svaret och visa nästa användbara steg;
- visa om en ledtråd öppnades och skilj den lokala självchecken från serververifierad rättning och lärardiagnostik;
- bygg interaktiva ämnesytor runt en prediktion, en kontrollerad ändring och elevens egen förklaring; håll deras rättningsregler tydligt avgränsade;
- skilj användning/progression från verifierade läranderesultat.

Vid en direkt genomgång av de publika interaktionsdemon ändrades fysikexemplet från 2 kg till 4 kg; både beräkningen och den anslutna förklaringen ändrades till 1,5 m/s². I den adaptiva övningsdemon gav valen "On my own", "With a hint" och "Not yet" olika synliga nästa-steg-statusar. Sidorna anger samtidigt att exemplen inte sparar kursprogress eller graderar en riktig kurs. Det här verifierar de publika demonstrationernas reaktion, inte autentiserad sparning, faktisk adaptiv kvalitet eller läranderesultat.

För ExGen är den konkreta principen att bevara skillnaden mellan att öppna P.E.R, få en ledtråd, svara självständigt och klara en ny kontroll. En rekommendation efter prov bör visa sin grund, exempelvis "träna detta eftersom svaret missade sambandet", och inte låta aktivitet eller en hjälpt prestation ändra provpoängen. Naturvetenskaplig grafträning kan utvecklas mot tolkning av mönster först när tolkningen härleds ur de signerade källvärdena och dess bedömning är entydig.

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
- Punktdiagrammet är en begränsad separat uppgiftstyp; det kräver en unik tvåkolumnstabell med tre distinkta heltalspunkter inom rutnätet och är aktiverat i naturvetenskapliga och samhällsvetenskapliga bedömningsprofiler. Det ska inte beskrivas som allmän graf- eller simuleringsfunktion.

## Prioritering för ExGen

1. **Materialnära interaktion först.** Behåll de två snäva grafkontrakten; utöka endast ämnestyp när källa, uppgift och deterministisk bedömning går att validera.
2. **Separera aktivitet från kunskapsmått.** En öppnad hint markeras som aktivitet; självchecken ska inte påstå vad eleven skulle ha fått utan hjälp eller ersätta officiell rättning.
3. **Nästa grafutökning först efter ämnesgranskning.** Kurvor, funktioners förlopp, simulering och andra diagram kräver eget schema, deterministiskt facit, elevnytta och tillgänglighets-QA.
4. **Behåll ExGens materialnära provloop.** Bredare flashcards, inspelning och planering är inte automatiskt bättre för ExGen eller rätt första steg för en skolpilot.

## Avgränsningar

ExGens två grafkontrakt är inte en generell grafritare. Linjeuppgiften bedömer två punkter på en rät linje utifrån lutning och skärning med y-axeln; punktdiagrammet bedömer tre tabellvärden som separata koordinater. Inget av kontrakten bedömer kurvor, funktioners förlopp, extremvärden, skärningspunkter mellan grafer eller grafens visuella noggrannhet utanför sina definierade punkter. Linjeuppgiften kräver en entydigt stödd linjär funktion i materialet; punktdiagrammet kräver exakt en stödd tvåkolumnstabell med tre distinkta heltalspunkter. Koordinatfälten är ett textbaserat och tangentbordsvänligt alternativ till pekinteraktionen; full skärmläsar-QA återstår.

Plues publika exempel verifierar inte användarens observerade grafuppgift och kan inte användas som belägg för hur Plues inloggade prov- eller rättningsflöde fungerar. Den aktuella startsidan beskriver en sparad och sammanlänkad arbetsyta, men det påståendet har inte verifierats genom konto eller runtime. Exempelvyer visar därför inte i sig att progressionen faktiskt sparas eller påverkar nästa steg.

## Källor

- [Plues publika startsida](https://plue.si/). Kontrollerad 2026-10-14; PLUE 2.0-positionering, publik demo, produktpåståendet "30,000+ learners" samt länkar till webbläsare och macOS. Antal användare är PLUE:s egen uppgift, inte oberoende verifierad.
- [Your course](https://plue.si/features/your-course/), [Interactive lessons](https://plue.si/features/interactive-lessons/) och [Adaptive practice](https://plue.si/features/adaptive-practice/). Kontrollerade 2026-10-14; publika funktionsbeskrivningar och illustrativa exempel. Interactive lessons säger uttryckligen att kodexemplet inte kör godtycklig Python eller sparar konto-progress; exempelvyerna spelar inte in kursprogress.
- [Tutor & shared board](https://plue.si/features/tutor-shared-board/). Kontrollerad 2026-10-14; publikt fysikexempel med två massval och kopplad beräkning/förklaring; demon markerad illustrativ och inloggat beteende ej verifierat.
- [Exam preparation](https://plue.si/features/exam-preparation/) och [Spaced recall](https://plue.si/features/spaced-recall/). Kontrollerade 2026-10-14; publika produktbeskrivningar, inloggade funktioner ej verifierade.
- [Plues integritetspolicy](https://plue.si/privacy/). Kontrollerad 2026-10-14; PLUE:s egen beskrivning av datahantering, inte en oberoende säkerhetsgranskning.
- [Plues app](https://app.plue.si/). Inloggade flöden, sparning och synk har inte granskats.
- Direkt användarobservation: Elton provade Plue och upplevde det enkelt att rita en graf i ett matteprov. Detta är inte en reproducerad extern testning.
