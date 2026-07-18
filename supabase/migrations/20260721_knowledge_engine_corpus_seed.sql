-- Provia Knowledge & Learning Engine V1 — Fas 3: pilotkorpus (avtalsrätt/konsumenträtt).
-- Se docs/provia-knowledge-engine/pilot-corpus-sources.md för fullständigt källmanifest
-- (licensgrund per källa, chunk-för-chunk-lista, kända begränsningar) och
-- docs/provia-knowledge-engine/13-fas3-results.md för fasrapporten.
--
-- Rena INSERT-satser i tabeller skapade av 20260720_knowledge_engine_schema.sql — ingen DDL.
-- Alla ID:n är hårdkodade (inte gen_random_uuid()) så att denna fil,
-- docs/provia-knowledge-engine/pilot-corpus-sources.md och tests/evals/legal-v1/gold-set.v1.json
-- refererar exakt samma rader.
--
-- review_status = 'pending' på SAMTLIGA chunks (kolumnens default, satt explicit här för
-- tydlighet) — beslutat av produktägaren 2026-07-19: ingen chunk sätts till 'approved' av denna
-- ingestion, oavsett hur källhämtningen gick till. En människa måste granska och godkänna
-- juridiskt undervisningsinnehåll innan det får användas i publicerad AI-generering (§18/§24-
-- spärren i Fas 2-schemat gäller redan, detta ändrar den inte).

-- ── knowledge_sources ──
insert into public.knowledge_sources
  (id, title, source_type, authority_level, publisher, subject, course, canonical_url, valid_from, license_status, license_metadata, review_status, version)
values
  ('c92f4043-82c0-4503-a6dc-5fbc519cb8e4',
   'Lag (1915:218) om avtal och andra rättshandlingar på förmögenhetsrättens område (Avtalslagen)',
   'lagtext', 100, 'Sveriges riksdag / Svensk författningssamling', 'Privatjuridik', 'JURPRI0',
   'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1915218-om-avtal-och-andra-rattshandlingar_sfs-1915-218/',
   '1916-01-01', 'approved',
   '{"basis": "9 § lag (1960:729) om upphovsrätt till litterära och konstnärliga verk undantar författningar från upphovsrättsskydd", "decision_ref": "10-open-questions.md #2"}'::jsonb,
   'pending', 'v1'),
  ('3168d1e9-fe31-4d10-b089-c231a24d6c59',
   'Föräldrabalk (1949:381), 9 kap (om omyndighet)',
   'lagtext', 100, 'Sveriges riksdag / Svensk författningssamling', 'Privatjuridik', 'JURPRI0',
   'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/foraldrabalk-1949381_sfs-1949-381/',
   '1950-01-01', 'approved',
   '{"basis": "9 § lag (1960:729) om upphovsrätt till litterära och konstnärliga verk undantar författningar från upphovsrättsskydd", "decision_ref": "10-open-questions.md #2", "note": "9 kap 3 §-formuleringen (\"äge\") ser ålderdomlig ut - kräver verifiering mot gällande lydelse innan approved"}'::jsonb,
   'pending', 'v1'),
  ('bc7e2f30-b69e-4416-a222-9e6626ec2e28',
   'Konsumentköplag (2022:260)',
   'lagtext', 100, 'Sveriges riksdag / Svensk författningssamling', 'Privatjuridik', 'JURPRI0',
   'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/konsumentkoplag-2022260_sfs-2022-260/',
   '2022-05-01', 'approved',
   '{"basis": "9 § lag (1960:729) om upphovsrätt till litterära och konstnärliga verk undantar författningar från upphovsrättsskydd", "decision_ref": "10-open-questions.md #2", "note": "Ikraftträdandedatum efter allmän kännedom, ej verifierat mot SFS-registret i denna session"}'::jsonb,
   'pending', 'v1'),
  ('dc26ee95-bcf5-457c-b0b6-d9bcfbce15c4',
   'Skolverkets ämnesplan, Privatjuridik (JURPRI0)',
   'laroplan', 90, 'Skolverket', 'Privatjuridik', 'JURPRI0',
   'https://syllabuswebb.skolverket.se/syllabuscw/jsp/subject.htm?subjectCode=JUR&tos=gy',
   '2011-07-01', 'approved',
   '{"basis": "Myndighetsföreskrift (SKOLFS), fri att använda i utbildningssammanhang", "decision_ref": "10-open-questions.md #2", "note": "Exakt SKOLFS-nummer ej verifierat i denna session"}'::jsonb,
   'pending', 'v1')
on conflict (id) do nothing;

-- ── knowledge_documents ──
insert into public.knowledge_documents (id, source_id, title, document_type, status, corpus_version)
values
  ('01bbd7f5-9e8d-42cf-8f9e-30841946c3f7', 'c92f4043-82c0-4503-a6dc-5fbc519cb8e4',
   'Avtalslagen kap 1–3 (utdrag: anbud/accept, fullmakt, ogiltighet)', 'lagtext_utdrag', 'pending', 'v1'),
  ('16abb89d-d31c-402a-929c-703bc69cb0ee', '3168d1e9-fe31-4d10-b089-c231a24d6c59',
   'Föräldrabalken 9 kap (utdrag: underårigs rättshandlingsförmåga)', 'lagtext_utdrag', 'pending', 'v1'),
  ('453f9772-de5e-45da-9bdf-42952d09ee5a', 'bc7e2f30-b69e-4416-a222-9e6626ec2e28',
   'Konsumentköplagen 4–5 kap (utdrag: fel i varan, reklamation)', 'lagtext_utdrag', 'pending', 'v1'),
  ('6b2bec72-4a85-4e64-829c-7a259eb035ed', 'dc26ee95-bcf5-457c-b0b6-d9bcfbce15c4',
   'Ämnesplan Privatjuridik — centralt innehåll (utdrag: avtalsrätt, konsumenträtt)', 'laroplan_utdrag', 'pending', 'v1')
on conflict (id) do nothing;

-- ── concepts ──
insert into public.concepts (id, subject, course, topic, name, slug, definition, curriculum_ref, review_status)
values
  ('d6b91831-5c79-4ea5-9873-47867d3e3b94', 'Privatjuridik', 'JURPRI0', 'Avtalsrätt',
   'Anbud och accept (avtals ingående)', 'anbud-accept',
   'Reglerna för hur ett bindande avtal uppstår genom anbud och accept, inklusive svarsfrister, sena svar, oren accept och återkallelse.',
   'Avtalslagen 1 kap (1-7 §§); Skolverket JURPRI0 — Avtalsrätt', 'pending'),
  ('fdefaa54-0764-436f-b71c-3ae850f77667', 'Privatjuridik', 'JURPRI0', 'Avtalsrätt',
   'Fullmakt och behörighet', 'fullmakt',
   'Reglerna för hur en fullmäktig binder en huvudman gentemot tredje man, gränserna för fullmaktens befogenhet, återkallelse och fullmäktigens ansvar utan giltig fullmakt.',
   'Avtalslagen 2 kap (10, 11, 18, 25 §§); Skolverket JURPRI0 — Avtalsrätt', 'pending'),
  ('f5efa722-08c5-4712-87d7-14f919babf2c', 'Privatjuridik', 'JURPRI0', 'Avtalsrätt',
   'Avtals ogiltighet och oskäliga avtalsvillkor', 'avtals-ogiltighet',
   'Grunder för att en rättshandling inte får göras gällande (tro och heder, 33 §) och för jämkning av oskäliga avtalsvillkor med särskild hänsyn till konsumenter (36 §).',
   'Avtalslagen 3 kap (33, 36 §§); Skolverket JURPRI0 — Avtalsrätt', 'pending'),
  ('7b410904-2b1a-4ee4-99f2-8525b1dc4a6e', 'Privatjuridik', 'JURPRI0', 'Avtalsrätt',
   'Underårigas rättshandlingsförmåga', 'underarigas-rattshandlingsformaga',
   'Huvudregeln att underåriga (under 18 år) är omyndiga och inte själva får råda över sin egendom eller åta sig förbindelser, samt undantaget för eget arbete efter 16 års ålder.',
   'Föräldrabalken 9 kap (1, 3 §§); Skolverket JURPRI0 — Avtalsrätt', 'pending'),
  ('bb5df550-7a26-4a4a-94b7-2e1aaff3c9cb', 'Privatjuridik', 'JURPRI0', 'Konsumenträtt och köprätt',
   'Fel i varan (konsumentköp)', 'konsumentkop-fel',
   'Vad som krävs för att en vara ska anses avtalsenlig och vilka egenskaper varan ska ha när avtalet inte reglerar allt.',
   'Konsumentköplagen 4 kap (1, 2 §§); Skolverket JURPRI0 — Konsumenträtt och köprätt', 'pending'),
  ('e4a370b2-1838-48fc-84eb-03bdceec30e1', 'Privatjuridik', 'JURPRI0', 'Konsumenträtt och köprätt',
   'Reklamationsrätt och reklamationsfrist', 'reklamation',
   'Konsumentens skyldighet att reklamera fel inom skälig tid, samt tvåmånadersregeln som alltid räknas som i rätt tid.',
   'Konsumentköplagen 5 kap (2 §); Skolverket JURPRI0 — Konsumenträtt och köprätt', 'pending')
on conflict (id) do nothing;

-- ── knowledge_chunks ──
insert into public.knowledge_chunks (id, document_id, content, chunk_type, section_ref, valid_from, review_status, metadata)
values
  ('ff25a7c9-6e91-4df9-a814-6d11b77c8bf2', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Anbud om slutande av avtal och svar å sådant anbud vare, efter ty här nedan i 2–9 §§ sägs, bindande för den, som avgivit anbudet eller svaret.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 1 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('e93cdda5-df59-4c90-9a4e-fa5aab962da3', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Har anbudsgivaren bestämt viss tid för svar, skall han anses hava föreskrivit, att svaret skall inom den tid komma honom till handa. Är i brev eller telegram, vari anbud göres, viss tidrymd utsatt för svaret, skall denna räknas från den dag brevet är dagtecknat eller den tid på dagen telegrammet är inlämnat för befordran.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 2 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('870869fe-9a45-4b53-a962-b87138019b26', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Göres anbud i brev eller telegram utan att tid för svar däri utsättes, måste antagande svar komma anbudsgivaren till handa inom den tid, som vid anbudets avgivande skäligen kunde av honom beräknas åtgå. Anbud, som göres muntligen utan att anstånd med svaret medgives, måste omedelbart antagas.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 3 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('ffb5e1dd-d608-4a69-940b-edd7602dd2f8', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Antagande svar, som för sent kommer anbudsgivaren till handa, skall gälla såsom nytt anbud. Vad nu är sagt äge dock icke tillämpning, där den, som avsänt svaret, utgår från att det framkommit i rätt tid och mottagaren måste inse detta.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 4 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('9a7eddf0-43d9-4ff5-b192-8c8f424b7f54', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Avslås anbud, vare det förfallet, ändå att den tid, varunder det eljest skolat gälla, ej gått till ända.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 5 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se / lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('74c177cd-d116-45ba-8653-171b87060966', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Svar, som innehåller, att anbud antages, men som på grund av tillägg, inskränkning eller förbehåll icke överensstämmer med anbudet, skall gälla såsom avslag i förening med nytt anbud.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 6 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('3e71e257-576e-4a0b-a5bc-358fb22c0787', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Anbud eller svar, som återkallas, vare ej gällande, där återkallelsen kommer den, till vilken anbudet eller svaret är riktat, till handa innan han tager del av detta eller samtidigt därmed.',
   'lagtext_verbatim', 'Avtalslagen 1 kap 7 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se / lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('f30973ed-a76c-4e71-a60b-f7b7c77d0651', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Den, som åt annan givit fullmakt att sluta avtal eller eljest företaga rättshandlingar, varder omedelbart berättigad och förpliktad i förhållande till tredje man genom rättshandling, som fullmäktigen inom fullmaktens gränser företager i fullmaktsgivarens namn.',
   'lagtext_verbatim', 'Avtalslagen 2 kap 10 §', '1916-01-01', 'pending',
   '{"fetch_source": "lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('1f2d4949-a180-47d7-8b39-60f2325ac74b', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Har fullmäktigen vid företagande av rättshandling handlat i strid mot särskilda inskränkande föreskrifter av fullmaktsgivaren, vare rättshandlingen ej gällande mot denne, såframt tredje man insåg eller bort inse, att fullmäktigen sålunda överskred sin befogenhet.',
   'lagtext_verbatim', 'Avtalslagen 2 kap 11 §', '1916-01-01', 'pending',
   '{"fetch_source": "lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('848807f5-79f7-4a46-9aec-7d94de14279d', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Fullmakt, som grundar sig allenast å fullmaktsgivarens meddelande till fullmäktigen, är återkallad, när meddelande från fullmaktsgivaren, att fullmakten icke vidare skall gälla, kommit fullmäktigen till handa.',
   'lagtext_verbatim', 'Avtalslagen 2 kap 18 §', '1916-01-01', 'pending',
   '{"fetch_source": "lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('a98b3c76-eaee-4193-9d5b-1326e079fea8', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Den, som uppträder såsom fullmäktig för annan, ansvarar för att han har erforderlig fullmakt och är förty, där han ej förmår styrka, att han handlat efter fullmakt eller att den rättshandling, varom fråga är, blivit godkänd av den uppgivne huvudmannen eller ändock är gällande mot honom, pliktig att ersätta tredje man all skada, som denne lider därigenom att han icke kan göra rättshandlingen gällande mot huvudmannen.',
   'lagtext_verbatim', 'Avtalslagen 2 kap 25 §', '1916-01-01', 'pending',
   '{"fetch_source": "lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('c42e7145-61ee-47ae-96c9-0c279264449f', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Rättshandling, som eljest vore att såsom giltig anse, må ej göras gällande, där omständigheterna vid dess tillkomst voro sådana, att det skulle strida mot tro och heder att med vetskap om dem åberopa rättshandlingen. [Ofullständigt citat — sista ledet om mottagarens onda tro ej bekräftat ordagrant i denna hämtning, se pilot-corpus-sources.md.]',
   'lagtext_sammanfattning', 'Avtalslagen 3 kap 33 §', '1916-01-01', 'pending',
   '{"fetch_source": "riksdagen.se (delvis citat)", "verbatim_confirmed": false, "note": "Kräver komplettering/verifiering mot fullständig lagtext innan approved"}'::jsonb),
  ('71ce73fa-ae4e-446e-8db3-995deed36a4b', '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7',
   'Sammanfattning (ej ordagrant citat): avtalsvillkor får jämkas eller lämnas utan avseende om villkoret är oskäligt med hänsyn till avtalets innehåll, omständigheterna vid avtalets tillkomst, senare inträffade förhållanden och omständigheterna i övrigt. Vid bedömningen ska särskild hänsyn tas till behovet av skydd för den som i egenskap av konsument eller annars intar en underlägsen ställning i avtalsförhållandet. Gäller även villkor utanför egentligt avtal.',
   'lagtext_sammanfattning', 'Avtalslagen 3 kap 36 §', '1916-01-01', 'pending',
   '{"fetch_source": "AI-sammanfattning av sökresultat, ej dokumentcitat", "verbatim_confirmed": false, "note": "Kräver verifiering mot fullständig lagtext innan approved"}'::jsonb),
  ('253907ac-2c0f-4485-9287-4ed5af9ae76d', '16abb89d-d31c-402a-929c-703bc69cb0ee',
   'Den som är under arton år (underårig) är omyndig och får inte själv råda över sin egendom eller åta sig förbindelser. [Utdrag — paragrafens undantag (t.ex. gåva/testamente/förmånstagarförordnande) ej bekräftade ordagrant i denna hämtning.]',
   'lagtext_verbatim', 'Föräldrabalken 9 kap 1 §', '1950-01-01', 'pending',
   '{"fetch_source": "riksdagen.se (utdrag)", "verbatim_confirmed": true, "note": "Endast huvudregelns första mening bekräftad, ej hela paragrafen"}'::jsonb),
  ('ab8df1c0-b92c-43d0-8c6a-e607eeca05b5', '16abb89d-d31c-402a-929c-703bc69cb0ee',
   'Underårig äge själv råda över vad han genom eget arbete förvärvat efter det han fyllt sexton år. Detsamma gäller avkastningen av sådan egendom och vad som trätt i egendomens ställe.',
   'lagtext_verbatim', 'Föräldrabalken 9 kap 3 §', '1950-01-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true, "note": "Ordalydelsen (\"äge\") ser ålderdomlig ut - kräver verifiering mot gällande lydelse/paragrafnumrering innan approved"}'::jsonb),
  ('705e599c-3798-410d-9d33-f530098e7b93', '453f9772-de5e-45da-9bdf-42952d09ee5a',
   'Varan ska i fråga om art, beskrivning, mängd, kvalitet, funktionalitet, kompatibilitet, driftskompatibilitet och i övrigt stämma överens med vad som följer av avtalet.',
   'lagtext_verbatim', 'Konsumentköplagen 4 kap 1 §', '2022-05-01', 'pending',
   '{"fetch_source": "lagen.nu", "verbatim_confirmed": true}'::jsonb),
  ('13e16dc7-f2af-4140-906f-3c2556be51df', '453f9772-de5e-45da-9bdf-42952d09ee5a',
   'Varan ska, utöver vad som följer av 1 §, 1. vara ägnad för de ändamål för vilka varor av samma slag i allmänhet används, 2. stämma överens med kvaliteten på och näringsidkarens beskrivning av ett prov eller en modell som har gjorts tillgänglig för konsumenten före köpet, 3. ha den mängd och de egenskaper och andra särdrag i fråga om hållbarhet, funktionalitet, kompatibilitet, säkerhet och särdrag i övrigt, som är normalt förekommande för varor av samma slag och som konsumenten med fog kan förutsätta med hänsyn till varans art, 4. stämma överens med sådana uppgifter om varans egenskaper och andra särdrag eller användning som näringsidkaren eller någon i ett tidigare säljled eller för näringsidkarens räkning har lämnat vid marknadsföringen av varan eller annars före köpet, och 5. åtföljas av den förpackning och andra tillbehör samt anvisningar för installation, montering, användning, förvaring och skötsel som konsumenten med fog kan förutsätta.',
   'lagtext_verbatim', 'Konsumentköplagen 4 kap 2 §', '2022-05-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('9ccc3440-8bfe-4a98-8db9-17e1ca029768', '453f9772-de5e-45da-9bdf-42952d09ee5a',
   'Konsumenten får åberopa att varan är felaktig endast om han eller hon lämnar näringsidkaren ett meddelande om felet inom skälig tid efter det att konsumenten borde ha märkt felet (reklamation). En reklamation som görs inom två månader efter det att konsumenten märkt felet ska alltid anses ha gjorts i rätt tid.',
   'lagtext_verbatim', 'Konsumentköplagen 5 kap 2 §', '2022-05-01', 'pending',
   '{"fetch_source": "riksdagen.se", "verbatim_confirmed": true}'::jsonb),
  ('03d46f90-9f96-481a-a40a-0a25e6c2a35d', '6b2bec72-4a85-4e64-829c-7a259eb035ed',
   'Avtalsrätt: Hur avtal sluts samt deras rättsverkan.',
   'laroplan_utdrag', 'Skolverket JURPRI0 — Centralt innehåll: Avtalsrätt', '2011-07-01', 'pending',
   '{"fetch_source": "betygskriterier.se (sammanfattning av Skolverkets ämnesplan)", "verbatim_confirmed": false}'::jsonb),
  ('909fec45-8455-43ca-8627-bccaffcc6614', '6b2bec72-4a85-4e64-829c-7a259eb035ed',
   'Konsumenträtt och köprätt: Regler som rör köp mellan konsument och näringsidkare, konsumentkrediter samt köp mellan privatpersoner.',
   'laroplan_utdrag', 'Skolverket JURPRI0 — Centralt innehåll: Konsumenträtt och köprätt', '2011-07-01', 'pending',
   '{"fetch_source": "betygskriterier.se (sammanfattning av Skolverkets ämnesplan)", "verbatim_confirmed": false}'::jsonb)
on conflict (id) do nothing;

-- ── chunk_concepts ──
insert into public.chunk_concepts (chunk_id, concept_id, relation_type, relevance)
values
  ('ff25a7c9-6e91-4df9-a814-6d11b77c8bf2', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('e93cdda5-df59-4c90-9a4e-fa5aab962da3', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('870869fe-9a45-4b53-a962-b87138019b26', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('ffb5e1dd-d608-4a69-940b-edd7602dd2f8', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('9a7eddf0-43d9-4ff5-b192-8c8f424b7f54', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('74c177cd-d116-45ba-8653-171b87060966', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('3e71e257-576e-4a0b-a5bc-358fb22c0787', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'covers', 1.0),
  ('f30973ed-a76c-4e71-a60b-f7b7c77d0651', 'fdefaa54-0764-436f-b71c-3ae850f77667', 'covers', 1.0),
  ('1f2d4949-a180-47d7-8b39-60f2325ac74b', 'fdefaa54-0764-436f-b71c-3ae850f77667', 'covers', 1.0),
  ('848807f5-79f7-4a46-9aec-7d94de14279d', 'fdefaa54-0764-436f-b71c-3ae850f77667', 'covers', 1.0),
  ('a98b3c76-eaee-4193-9d5b-1326e079fea8', 'fdefaa54-0764-436f-b71c-3ae850f77667', 'covers', 1.0),
  ('c42e7145-61ee-47ae-96c9-0c279264449f', 'f5efa722-08c5-4712-87d7-14f919babf2c', 'covers', 1.0),
  ('71ce73fa-ae4e-446e-8db3-995deed36a4b', 'f5efa722-08c5-4712-87d7-14f919babf2c', 'covers', 1.0),
  ('253907ac-2c0f-4485-9287-4ed5af9ae76d', '7b410904-2b1a-4ee4-99f2-8525b1dc4a6e', 'covers', 1.0),
  ('ab8df1c0-b92c-43d0-8c6a-e607eeca05b5', '7b410904-2b1a-4ee4-99f2-8525b1dc4a6e', 'covers', 1.0),
  ('705e599c-3798-410d-9d33-f530098e7b93', 'bb5df550-7a26-4a4a-94b7-2e1aaff3c9cb', 'covers', 1.0),
  ('13e16dc7-f2af-4140-906f-3c2556be51df', 'bb5df550-7a26-4a4a-94b7-2e1aaff3c9cb', 'covers', 1.0),
  ('9ccc3440-8bfe-4a98-8db9-17e1ca029768', 'e4a370b2-1838-48fc-84eb-03bdceec30e1', 'covers', 1.0),
  ('03d46f90-9f96-481a-a40a-0a25e6c2a35d', 'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'curriculum_context', 0.6),
  ('03d46f90-9f96-481a-a40a-0a25e6c2a35d', 'fdefaa54-0764-436f-b71c-3ae850f77667', 'curriculum_context', 0.6),
  ('03d46f90-9f96-481a-a40a-0a25e6c2a35d', 'f5efa722-08c5-4712-87d7-14f919babf2c', 'curriculum_context', 0.6),
  ('03d46f90-9f96-481a-a40a-0a25e6c2a35d', '7b410904-2b1a-4ee4-99f2-8525b1dc4a6e', 'curriculum_context', 0.6),
  ('909fec45-8455-43ca-8627-bccaffcc6614', 'bb5df550-7a26-4a4a-94b7-2e1aaff3c9cb', 'curriculum_context', 0.6),
  ('909fec45-8455-43ca-8627-bccaffcc6614', 'e4a370b2-1838-48fc-84eb-03bdceec30e1', 'curriculum_context', 0.6)
on conflict (chunk_id, concept_id) do nothing;
