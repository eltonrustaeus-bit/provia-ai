# Bildfix rapport

Datum: 2026-06-01

## Sammanfattning

- Totalt frågor: 350
- Frågor med bild: 151
- Frågor utan bild: 199
- [OMFORMULERA]-frågor: 109 färdigställda
- [LÄGG TILL BILD]-frågor: 42 färdigställda
- [BEHÅLL]-frågor: 199 oförändrade
- Bildbeskrivningar uppgraderade: 151
- Lokala SVG-bilder skapade: 68

## Exempel före/efter

### [OMFORMULERA] fråga 1

Före:
```json
{
  "question": "Du kör mot en korsning och ser detta märke framför dig. Vad gör du?",
  "image_description": "Form: Åttakantig (oktagonal) skylt. Bakgrund: röd (#CC0000). Text: \"STOP\" i vitt (#FFFFFF), fetstil, centrerat i mitten. Kant: vit (#FFFFFF), bred (ca 7% av märkets storlek). Proportioner: texthöjd ca 40% av märkets diameter. VMF B1.",
  "option_a": "Saktar ner till under 30 km/h och kör igenom om det är fritt",
  "option_b": "Stannar vid stopplinjen och lämnar fri väg för korsande trafik",
  "correct": "B"
}
```

Efter:
```json
{
  "question": "Du kör mot en korsning och ser detta märke framför dig. Vad gör du?",
  "image_type": "vägmärke",
  "image_description": "Bilförarperspektiv från framrutan på en svensk väg med två tydliga körfält och normal högertrafik. Vägbanan är torr asfalt med vit mittlinje (#FFFFFF) och kantlinje, och den relevanta skylten, signalen eller trafiksituationen syns cirka 40 meter framför bilen. Avgörande detalj som ska ritas in: Du kör mot en korsning och ser detta märke framför dig. Vad gör du? Form: Åttakantig (oktagonal) skylt. Bakgrund: röd (#CC0000). Text: \"STOP\" i vitt (#FFFFFF), fetstil, centrerat i mitten. Kant: vit (#FFFFFF), bred (ca 7% av märkets storlek). Proportioner: texthöjd ca 40% av märkets diameter. VMF B1. Omgivningen innehåller realistiska detaljer: vägkant, stolpar, eventuella parkerade bilar, cykelbana eller fotgängare bara när de påverkar regeln i frågan. Väder: dagsljus, soligt till lätt molnigt, torrt och klart väglag om inte frågan uttryckligen gäller mörker, regn eller halka.",
  "option_a": "Du ska sakta ner till under 30 km/h och köra igenom om det är fritt",
  "option_b": "Du måste stanna vid stopplinjen och lämna fri väg för korsande trafik",
  "correct": "B"
}
```

### [LÄGG TILL BILD] fråga 10

Före:
```json
{
  "question_type": "scenario",
  "question": "Vad gäller i en korsning utan märken eller signaler?",
  "image_url": null,
  "image_description": null
}
```

Efter:
```json
{
  "question_type": "scenario",
  "question": "Du närmar dig denna korsning och ser trafiksituationen framför dig. Vad ska du göra?",
  "image_type": "korsning",
  "image_url": "/image/korkort/q_010.svg",
  "image_description": "Fågelperspektiv över en svensk fyrvägs- eller T-korsning där vägar, körfält och färdriktningar syns utan skymmande objekt. Vägbanan är torr asfalt med vit mittlinje (#FFFFFF) och kantlinje, och den relevanta skylten, signalen eller trafiksituationen syns cirka 40 meter framför bilen. Avgörande detalj som ska ritas in: Du närmar dig denna korsning och ser trafiksituationen framför dig. Vad ska du göra? Korsningen visas med två mötande vägar, tydliga körfält och pilar som visar fordonens färdriktning. Din bil är markerad i rött från bilförarens perspektiv och andra trafikanter är markerade i blått eller gult med placering enligt frågan. Omgivningen innehåller realistiska detaljer: vägkant, stolpar, eventuella parkerade bilar, cykelbana eller fotgängare bara när de påverkar regeln i frågan. Väder: dagsljus, soligt till lätt molnigt, torrt och klart väglag om inte frågan uttryckligen gäller mörker, regn eller halka."
}
```

## QA

- Alla bildbaserade frågor har `image_type`.
- Alla nya bildfrågor har `image_url` via lokal SVG i `/image/korkort/`.
- Alla bildbaserade frågor har detaljerad `image_description` med perspektiv, väg, relevant objekt/situation, omgivning samt väder/väglag.
- Svarsalternativ har normaliserats mot handlingar eller körresultat i stället för rena definitioner.
- Förklaringar börjar med rätt svar, knyter valet till handlingen och avslutas med lagrum.

## Supabase fallback

- Före sync: `driving_questions` hade 368 rader, 144 extra ID:n, 126 saknade lokala ID:n och 176 matchande ID:n med fältskillnader mot `final_questions.json`.
- Backup skapades lokalt i `supabase/backups/` innan skrivning.
- Efter sync: `driving_questions` har 350 rader, 0 extra rader och 0 mismatches mot `final_questions.json` för fälten som `korkortet.html` använder i fallbacken.
- Anon/RLS-kontroll efter sync returnerade `Content-Range: 0-0/350`, vilket visar att den publika fallbacken kan läsa de synkade frågorna.

## Slutsats

Alla identifierade bildbaserade körkortsfrågor är nu omformulerade eller kompletterade enligt bildfix-reglerna. De frågor som klassades som rena textbaserade faktafrågor har behållits oförändrade.
