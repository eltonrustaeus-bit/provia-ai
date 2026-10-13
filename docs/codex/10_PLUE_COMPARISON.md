# Plue och ExGen: produktjämförelse

Första jämförelsesnapshot: 2026-10-12. Senast omkontrollerad: 2026-10-13 mot Plues aktuella publika startsida. Startsidan presenterar nu "plue 2.0" med kursmaterial, tutor och delad arbetsyta, ämnesspecifika interaktiva lektioner, adaptiv övning där hintar räknas separat, spaced recall och provförberedelse kopplad till provdatum. Den marknadsför både webbläsare och macOS. Detta är Plues publika produktbeskrivningar, inte oberoende verifiering av appfunktioner.

Åtkomstbegränsning 2026-10-13: de länkade detaljsidorna och `app.plue.si` kunde inte hämtas i denna kontroll. Inget konto skapades, inga personuppgifter lämnades och inget inloggat flöde granskades. Den tidigare observationen att appen visade en inloggnings-/registreringsgräns gäller kontrollen 2026-10-12 och verifierades inte på nytt. Användarens egen upplevelse av att rita en graf i ett matteprov är fortsatt separat och har inte reproducerats i en publik demo.

Bedömningen skiljer mellan (1) Plues egna publika produktbeskrivningar, (2) Elton Rustaeus egen användarobservation av en grafuppgift och (3) verifierad ExGen-kod. Inloggade Plue-flöden och intern teknik har inte granskats.

## Vad som går att belägga

| Område | Publik Plue-beskrivning / användarobservation | ExGen nuläge | Produktimplikation |
|---|---|---|---|
| Kurs- och materialkontext | Aktuella startsidan beskriver böcker/PDF:er som grund för sammanlänkade lektioner och förkunskaper, med en kursöversikt som visar nästa steg. Det är Plues egen beskrivning och en publik exempelvy; inloggad funktion har inte granskats. | ExGen utgår från elevens eget material för att skapa prov som sedan rättas mot en skyddad uppgift. | Behåll materialet som källa. Visa konkret vilket underlag stöder en fråga i stället för att utlova automatisk täckning av en hel kursplan. |
| Matematik och grafer | Aktuella startsidan visar en fysik-tutorfråga och en körbar Python-lektion där värden ändras och resultatet visas. Den offentliga sidan verifierar inte grafritning. Elton uppger separat att en grafuppgift i Plue kändes smidig; den observationen är inte reproducerad i en publik vy. | ExGen stöder en avgränsad uppgift om en explicit rät linje. Eleven ritar två punkter eller anger koordinater; servern bedömer lutning och y-skärning deterministiskt. | Behåll graf som ett tydligt svarssätt i provloopen. Utforskande simulering är en annan uppgiftstyp än säker poängsättning och kräver eget bedömningskontrakt. |
| Interaktion och feedback | Plue beskriver i plue 2.0 en tutor på delad arbetsyta som följer uppgiften, elevens försök och var eleven fastnat, samt ämnesspecifika lektionsytor. Detta är produktpåståenden och exempel, inte granskning av inloggat beteende. | ExGen visar rättning per fråga och har ett separat grafomförsök på samma uppgift utan att skriva om provresultatet. | Visa bedömningskriterier före inlämning, ge begriplig uppgiftsspecifik återkoppling och låt omförsök vara övning, inte en omräkning av provpoäng. |
| Repetition och progression | Aktuella startsidan beskriver nya kontroller där hintar räknas separat, nästa steg som kan gå framåt eller tillbaka, senare spaced recall och provförberedelse med provdatum. Påståendena om sparad, sammanlänkad kursprogress kommer från Plue; deras faktiska runtime har inte verifierats här. | ExGen har provhistorik, felbank, mastery och P.E.R-rekommendationer. Schemalagd repetition och kvalitet i hela elevloopen är inte verifierad som stabilt skolflöde. | Behandla progression som träningssignaler, inte diagnostik. Prioritera tydlig åtskillnad mellan självständiga svar och P.E.R-hjälp samt visa varför nästa övning rekommenderas. |
| Målgrupp och omfattning | Plue positionerar publikt produkten som tutor/kursmiljö för studier, nya färdigheter och arbete/liv, inte enbart prov inför skolan. | ExGen är smalare: elevens material → relevanta övningsfrågor → svar/rättning → träningsnästa steg. | ExGen bör vinna på tydlighet och förtroende inom sin skolspecifika kärnloop, inte försöka matcha hela Plues bredare kurs-/tutorprodukt inför första pilot. |

## Aktuell PLUE-lärdom — 2026-10-13

Plues publika produktbeskrivning har rört sig från fristående studiehjälp mot en sammanhängande kursyta där material, tutor, övningsbevis och nästa steg presenteras tillsammans. De mest relevanta principerna för ExGen är därför inte visuella detaljer utan:

- håll elevens källmaterial nära frågan och återkopplingen;
- hjälp utifrån det aktuella svaret och visa nästa användbara steg;
- räkna hintad övning separat från självständigt visad kunskap;
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

## Prioritering för ExGen

1. **Svarsyta i provet först.** Grafen har punktplacering och koordinatfält, synliga kriterier, deterministisk rättning och ett separat omförsök.
2. **Nästa säkra matteutökning: avläsning av punkt, lutning eller y-skärning.** Varje deltyp ska få ett eget schema och deterministiskt facit innan generatorn kan skapa den.
3. **Dynamisk grafutforskning senare.** Ändra parametrar och se grafen reagera kan stödja förståelse, men kräver separat lektionsläge och egen pedagogisk/tillgänglighets-QA.
4. **Behåll ExGens materialnära provloop.** Bredare flashcards, inspelning och planering är inte automatiskt bättre för ExGen eller rätt första steg för en skolpilot.

## Avgränsningar

Nuvarande grafuppgift är inte en generell grafritare. Den bedömer två punkter på en rät linje utifrån lutning och skärning med y-axeln. Den bedömer inte kurvor, funktioners förlopp, extremvärden, skärningspunkter mellan grafer eller grafens visuella noggrannhet utanför den definierade punktmodellen. Frågetypen aktiveras bara när källmaterialet innehåller exakt en stödd linjär funktion. Koordinatfälten är ett textbaserat och tangentbordsvänligt alternativ till pekinteraktionen; full skärmläsar-QA återstår.

Plues publika exempel verifierar inte användarens observerade grafuppgift och kan inte användas som belägg för hur Plues inloggade prov- eller rättningsflöde fungerar. Den aktuella startsidan beskriver en sparad och sammanlänkad arbetsyta, men det påståendet har inte verifierats genom konto eller runtime. Exempelvyer visar därför inte i sig att progressionen faktiskt sparas eller påverkar nästa steg.

## Källor

- [Plues publika startsida](https://plue.si/). Kontrollerad 2026-10-13; aktuell publika positionering och exempel på plue 2.0, utan inloggning.
- [Your course](https://plue.si/features/your-course/), [Interactive lessons](https://plue.si/features/interactive-lessons/) och [Adaptive practice](https://plue.si/features/adaptive-practice/). Länkade från startsidan; detaljsidorna kunde inte hämtas 2026-10-13, så aktuell bedömning använder endast startsidans sammanfattningar och exempel.
- [Exam preparation](https://plue.si/features/exam-preparation/), [Tutor & shared board](https://plue.si/features/tutor-shared-board/) och [Spaced recall](https://plue.si/features/spaced-recall/). Länkade från startsidan; produktbeskrivningar verifierade där, inloggade beteenden ej verifierade.
- [Plues app](https://app.plue.si/). Utloggad start kontrollerad 2026-10-12: visade sign-in/create-account-gräns. Den gick inte att hämta i kontrollen 2026-10-13; inga autentiserade funktioner har granskats.
- Direkt användarobservation: Elton provade Plue och upplevde det enkelt att rita en graf i ett matteprov. Detta är inte en reproducerad extern testning.
