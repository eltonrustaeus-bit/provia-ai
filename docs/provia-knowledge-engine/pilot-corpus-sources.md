# Pilotkorpus — källmanifest (Fas 3)

Stödjer `13-fas3-results.md`. Fullständig lista över de källor/dokument/chunks som seedas av
`supabase/migrations/20260721_knowledge_engine_corpus_seed.sql`. UUID:er nedan är hårdkodade
(inte `gen_random_uuid()`) så att detta dokument och migrationsfilen samt gold-set-filen
(`tests/evals/legal-v1/gold-set.v1.json`) refererar exakt samma rader.

Pilotomfattning enligt `07-proposed-v1-architecture.md` §2: Juridik/Privatjuridik, delområde
Avtalsrätt och konsumenträtt, krympt till: anbud/accept, fullmakt, avtals ogiltighet/oskälighet,
underårigas rättshandlingsförmåga, konsumentköp (fel i varan), reklamation.

## Viktig kvalitetsprincip — review_status

**Samtliga chunks seedas med `review_status='pending'`** (kolumnens default), oavsett hur säker
källhämtningen var. Detta är ett medvetet beslut (bekräftat av produktägaren 2026-07-19, se
`13-fas3-results.md`): innehållet är juridiskt undervisningsmaterial för elever, och varken denna
sessions källhämtning (delvis via AI-sammanfattning av sökresultat, inte alltid direkt
dokumentcitat) eller Claude self räknas som en godkänd juridisk granskning. `review_status` styr
redan (per Fas 2-migrationens design, §18/§24) om en chunk får användas i **publicerad**
AI-generering — pending chunks kan användas för gold-set/eval-arbete (denna fas) men inte i
elevvänd generering förrän en människa satt `review_status='approved'`.

`chunk_type` markerar källkvalitet så en granskare vet var att lägga fokus:
- `lagtext_verbatim` — ordagrant citat bekräftat direkt från riksdagen.se eller lagen.nu i samma hämtning.
- `lagtext_sammanfattning` — innehållet är en AI-sammanfattning av sökresultat, inte ett bekräftat
  ordagrant citat. Kräver extra granskning mot fullständig, ograverad lagtext innan `approved`.
- `laroplan_utdrag` — utdrag ur Skolverkets ämnesplan (i sig sammanfattande till sin natur).

## Källor (`knowledge_sources`)

| id (kort) | Titel | Typ | Publisher | Källa (URL) | license_status | Anmärkning |
|---|---|---|---|---|---|---|
| `source_avtalslagen` | Lag (1915:218) om avtal och andra rättshandlingar på förmögenhetsrättens område (Avtalslagen) | lagtext | Sveriges riksdag / Svensk författningssamling | riksdagen.se/.../lag-1915218-om-avtal-och-andra-rattshandlingar_sfs-1915-218 | approved | Fri lagtext — undantagen upphovsrätt enligt 9 § lag (1960:729). |
| `source_foraldrabalken` | Föräldrabalk (1949:381), 9 kap (om omyndighet) | lagtext | Sveriges riksdag / Svensk författningssamling | riksdagen.se/.../foraldrabalk-1949381_sfs-1949-381 | approved | Samma grund. §3-formuleringen ("äge") ser ut att kunna vara en äldre lagtextvariant — flaggat i chunk-metadata, kräver verifiering mot gällande lydelse. |
| `source_konsumentkoplagen` | Konsumentköplag (2022:260) | lagtext | Sveriges riksdag / Svensk författningssamling | riksdagen.se/.../konsumentkoplag-2022260_sfs-2022-260 | approved | Samma grund. Ikraftträdandedatum (2022-05-01) angivet efter allmän kännedom, inte verifierat mot SFS-registret i denna session. |
| `source_skolverket_amnesplan` | Skolverkets ämnesplan, Privatjuridik (JURPRI0) | laroplan | Skolverket | syllabuswebb.skolverket.se (subjectCode=JUR) | approved | Myndighetsföreskrift (SKOLFS), fri att använda i undervisningssammanhang — beslutat i `10-open-questions.md` #2. Exakt SKOLFS-nummer ej verifierat i denna session. |

## Dokument (`knowledge_documents`)

| id (kort) | source | Titel |
|---|---|---|
| `doc_avtalslagen` | source_avtalslagen | Avtalslagen kap 1–3 (utdrag: anbud/accept, fullmakt, ogiltighet) |
| `doc_foraldrabalken` | source_foraldrabalken | Föräldrabalken 9 kap (utdrag: underårigs rättshandlingsförmåga) |
| `doc_konsumentkoplagen` | source_konsumentkoplagen | Konsumentköplagen 4–5 kap (utdrag: fel i varan, reklamation) |
| `doc_amnesplan` | source_skolverket_amnesplan | Ämnesplan Privatjuridik — centralt innehåll (utdrag: avtalsrätt, konsumenträtt) |

## Concepts

| id (kort) | slug | name | curriculum_ref |
|---|---|---|---|
| `concept_anbud_accept` | anbud-accept | Anbud och accept (avtals ingående) | Avtalslagen 1 kap; Skolverket JURPRI0 — Avtalsrätt |
| `concept_fullmakt` | fullmakt | Fullmakt och behörighet | Avtalslagen 2 kap; Skolverket JURPRI0 — Avtalsrätt |
| `concept_avtals_ogiltighet` | avtals-ogiltighet | Avtals ogiltighet och oskäliga avtalsvillkor | Avtalslagen 3 kap (33 §, 36 §); Skolverket JURPRI0 — Avtalsrätt |
| `concept_underarig_rhf` | underarigas-rattshandlingsformaga | Underårigas rättshandlingsförmåga | Föräldrabalken 9 kap; Skolverket JURPRI0 — Avtalsrätt |
| `concept_konsumentkop_fel` | konsumentkop-fel | Fel i varan (konsumentköp) | Konsumentköplagen 4 kap; Skolverket JURPRI0 — Konsumenträtt och köprätt |
| `concept_reklamation` | reklamation | Reklamationsrätt och reklamationsfrist | Konsumentköplagen 5 kap; Skolverket JURPRI0 — Konsumenträtt och köprätt |

## Chunks (`knowledge_chunks`) — 20 st

**Mänsklig granskning slutförd 2026-07-19** (produktägaren, se `17-fas8-results.md` och
`dagbok.md` på Desktop): samtliga 20 chunks genomlästa och godkända. Två av dem (33 §/36 §) hade
dessutom **innehållsfel** som korrigerades under granskningen — se korrigeringsmigrationen
`20260724_knowledge_engine_corpus_correction.sql`. review_status-kolumnen nedan är live
databasstatus, inte ett ursprungligt seedvärde.

| chunk | dokument | section_ref | chunk_type | review_status | Innehåll (fullt citat i migrationsfilen) |
|---|---|---|---|---|---|
| chunk_01 | Avtalslagen | 1 kap 1 § | lagtext_verbatim | **approved** | Anbud/svar bindande för avgivaren |
| chunk_02 | Avtalslagen | 1 kap 2 § | lagtext_verbatim | **approved** | Svarsfrist vid bestämd tid; beräkning från brevdatum/telegram |
| chunk_03 | Avtalslagen | 1 kap 3 § | lagtext_verbatim | **approved** | Skälig tid vid odaterat anbud; muntligt anbud kräver omedelbar accept |
| chunk_04 | Avtalslagen | 1 kap 4 § | lagtext_verbatim | **approved** | Sent svar = nytt anbud, undantag vid god tro |
| chunk_05 | Avtalslagen | 1 kap 5 § | lagtext_verbatim | **approved** | Avslaget anbud är förfallet |
| chunk_06 | Avtalslagen | 1 kap 6 § | lagtext_verbatim | **approved** | Oren accept = avslag + nytt anbud |
| chunk_07 | Avtalslagen | 1 kap 7 § | lagtext_verbatim | **approved** | Återkallelse måste komma fram före/samtidigt med anbudet/svaret |
| chunk_08 | Avtalslagen | 2 kap 10 § | lagtext_verbatim | **approved** | Fullmäktigens rättshandling inom fullmaktens gränser binder huvudmannen |
| chunk_09 | Avtalslagen | 2 kap 11 § | lagtext_verbatim | **approved** | Överskriden befogenhet ej gällande vid tredje mans onda tro |
| chunk_10 | Avtalslagen | 2 kap 18 § | lagtext_verbatim | **approved** | Återkallelse av fullmakt gäller när meddelande når fullmäktigen |
| chunk_11 | Avtalslagen | 2 kap 25 § | lagtext_verbatim | **approved** | Fullmäktigens skadeståndsansvar utan fullmakt (falsus procurator) |
| chunk_12 | Avtalslagen | 3 kap 33 § | lagtext_verbatim ⟲ | **approved** | Tro och heder — **innehåll korrigerat 2026-07-19**, fullständig lydelse inkl. motpartens onda tro |
| chunk_13 | Avtalslagen | 3 kap 36 § | lagtext_verbatim ⟲ | **approved** | Jämkning av oskäliga avtalsvillkor — **innehåll korrigerat 2026-07-19**, samtliga 4 stycken |
| chunk_14 | Föräldrabalken | 9 kap 1 § | lagtext_verbatim | **approved** | Underårig är omyndig, får ej råda över egendom/åta förbindelser (utdrag) |
| chunk_15 | Föräldrabalken | 9 kap 3 § | lagtext_verbatim | **approved** | 16-årsregeln — ålderdomlig formulering bekräftad genuint gällande lydelse |
| chunk_16 | Konsumentköplagen | 4 kap 1 § | lagtext_verbatim | **approved** | Varan ska stämma överens med avtalet |
| chunk_17 | Konsumentköplagen | 4 kap 2 § | lagtext_verbatim | **approved** | Varans avsedda egenskaper när avtalet inte reglerar allt |
| chunk_18 | Konsumentköplagen | 5 kap 2 § | lagtext_verbatim | **approved** | Reklamation inom skälig tid; tvåmånadersregeln |
| chunk_19 | Ämnesplan | Avtalsrätt | laroplan_utdrag | **approved** | Bekräftat ordagrant matchande Skolverkets centrala innehåll |
| chunk_20 | Ämnesplan | Konsumenträtt och köprätt | laroplan_utdrag | **approved** | Bekräftat ordagrant matchande Skolverkets centrala innehåll |

⟲ = innehållet ändrades under granskningen (inte bara statusändring) — se
`20260724_knowledge_engine_corpus_correction.sql` för fullständig historik.

**Status: 20/20 chunks `approved`.** Samtliga 6 koncept har nu fullt godkänt källmaterial —
produktionsvägen (`includePending=false`, `api/knowledge.js` och `api/explain.js`s `legalMode`)
kan hitta godkänt källmaterial för alla koncept, inklusive `avtals-ogiltighet` som tidigare saknade
allt godkänt innehåll.

**Granskningsresultat i detalj:**
- **Avtalslagen 3 kap 33 §**: den seedade texten var **ofullständig** (saknade sista ledet om att
  motparten måste antas ha haft vetskap om de otillbörliga omständigheterna). Fullständig lydelse
  hämtad och korsverifierad mot två oberoende källor (riksdagen.se + lagen.nu, exakt matchande) —
  korrigerad i databasen, `chunk_type` uppgraderad från `lagtext_sammanfattning` till
  `lagtext_verbatim`.
- **Avtalslagen 3 kap 36 §**: den seedade texten var en **AI-sammanfattning**, inte lagtext (2
  meningar istället för paragrafens faktiska 4 stycken). Fullständig lydelse hämtad och
  korsverifierad på samma sätt, korrigerad i databasen.
- **Föräldrabalken 9 kap 3 §**: den ålderdomliga formuleringen ("äge") bekräftades vara **genuint
  gällande lydelse** direkt från riksdagen.se, inte en föråldrad version — paragrafen har aldrig
  omformulerats sedan 1949 till skillnad från 9 kap 1 § som moderniserades separat. Godkänd utan
  innehållsändring.
- **Skolverkets läroplansutdrag** (båda): bekräftade ordagrant matchande (verifierat mot
  betygskriterier.se och en oberoende sökning) — endast skiftlägesskillnad ("Hur"/"hur"), ingen
  saklig avvikelse. Godkända utan ändring.

## Kända begränsningar

- Embedding saknas fortfarande inte längre relevant här — alla 20 chunks embeddades i Fas 4,
  oberoende av review_status.
- Endast paragrafer relevanta för pilotens fyra delområden är ingesterade — inte hela lagarna.
- Ingen ytterligare mänsklig granskning krävs för pilotkorpusen i sin nuvarande, avgränsade
  omfattning (20 chunks, 6 koncept) — om korpusen utökas med fler paragrafer/ämnesområden i en
  framtida fas gäller samma granskningsprincip på nytt innehåll.
