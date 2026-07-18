# 06 — Quality Baseline (syntes)

Fullständigt underlag: `docs/current-system/quality-baseline.md`. Allt underlag är redan de-identifierat, kuraterat frågeinnehåll (körkortsteori) — ingen elevdata användes eller samlades in.

## Vad som redan finns
7 befintliga QA-/audit-rapporter i repo-roten visar en genuin, fungerande **iterativ QA-pipeline**: validering → automatiserad audit → manuell bild-/textgranskning → reparation → bildbeskrivnings-uppgradering. Detta är precis den typen av process- och kvalitetsdisciplin uppdragets §6/§25/§35 efterfrågar för juridik-piloten — teamet har redan byggt och kört motsvarande arbetsflöde för ett annat ämne.

## 7 manuellt granskade exempel (ur `final_questions.json`, 356 frågor)
- **Formatfel:** 0 funna.
- **Fel facit:** 0 funna i själva svarsnyckeln (fel som hittades låg i förklaringstext eller bildmatchning, inte facit).
- **Tvetydighet:** huvudkategorin av kvarstående problem — 10 frågor medvetet blockerade för detta, en policy att hålla kvar osäkert innehåll i datasetet för granskning snarare än att antingen radera eller publicera.
- **Läroplansförankring:** samtliga granskade frågor har `law_reference`-fält.
- **Svårighetsfördelning:** 28/49/23 (easy/normal/hard) mot mål 30/50/20 — nära men inte exakt.
- **Duplicering:** 20 flaggade textdubbletter, delvis städade sedan (kräver ett fullständigt nytt dublett-scan för 100% bekräftelse).

## Relevans för V1-piloten
Denna baslinje visar att **kvalitetsmålen i uppdragets Gate B (§35)** är realistiska att nå — teamet har redan demonstrerat förmågan att hålla 0% felaktigt-facit-rate och systematiskt fånga tvetydighet, om än manuellt. V1:s automatiserade verifieringsmotor (§25) ska göra samma sak snabbare, inte uppfinna kvalitetskraven från grunden.

## Vad som INTE gjordes
Ingen ny data samlades in eller genererades. Inget elevmaterial (riktiga provsvar, personnamn, kontouppgifter) förekommer i något av de granskade underlagen.
