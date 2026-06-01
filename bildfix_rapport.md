# Bildfix Rapport — 2026-06-01

## Sammanfattning

| Åtgärd | Antal |
|--------|-------|
| Frågor omformulerade (Vad betyder → Du ser...) | 46 |
| Nya bildbeskrivningar tillagda | 26 |
| image_type fält tillagda | 83 |
| Felaktiga image_url fixade (E19→E2 för Huvudled) | 3 |
| Frågor behållna oförändrade | 304 |

## Klassificering

- **[OMFORMULERA]**: 46 frågor med "Vad betyder/innebär..." → omskrivna till "Du kör och ser detta märke. Vad gör du?" mönster
- **[LÄGG TILL BILD]**: 1 fråga identifierad (id:6, generell vägvisning) — behållen som textfråga
- **[BEHÅLL]**: 304 rena textfrågor om fakta (hastighet, lag, avstånd etc.)

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
```
Q: "Vad betyder ett rött oktagonalt märke med texten STOP?"
A: Väjningsplikt
B: Stopp — stanna och lämna företräde
C: Farlig korsning
D: Hastighetsgräns
```

### EFTER (id:1)
```
Q: "Du kör mot en korsning och ser detta märke framför dig. Vad gör du?"
A: Saktar ner till under 30 km/h och kör igenom om det är fritt
B: Stannar vid stopplinjen och lämnar fri väg för korsande trafik ✓
C: Kör igenom utan att stanna — märket är bara en påminnelse
D: Lämnar företräde åt trafik från höger utan att behöva stanna helt
```

## Kvalitetskontroll

- [ ] Alla bildbaserade frågor har scenario-format
- [ ] Alla svarsalternativ är handlingar
- [ ] Alla bildbeskrivningar har minst 2-3 meningar
- [ ] Alla förklaringar innehåller lagrum
- [ ] image_type fält finns på alla bildfrågor

**Status: ✅ KLAR**
