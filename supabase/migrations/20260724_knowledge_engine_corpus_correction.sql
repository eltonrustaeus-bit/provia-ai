-- Provia Knowledge & Learning Engine V1 — mänsklig granskning av pilotkorpusen slutförd
-- (2026-07-19). Se docs/provia-knowledge-engine/17-fas8-results.md,
-- docs/provia-knowledge-engine/pilot-corpus-sources.md och den delade dagboken på
-- ~/Desktop/ExGen Sweden AB/dagbok.md för fullständig bakgrund.
--
-- Denna fil REDIGERAR INTE 20260721_knowledge_engine_corpus_seed.sql i efterhand (historiska
-- migrationer skrivs inte om — samma princip som redan etablerad i detta repo, t.ex.
-- 20260719_fix_hp_mastery_race.sql som egen uppföljning istället för att ändra
-- 20260701_hp_fixes.sql). Ren datauppdatering, ingen DDL.
--
-- Resultat av granskningen: samtliga 20 chunks från Fas 3-seedningen godkända
-- (review_status='approved'). 2 av dem (Avtalslagen 3 kap 33 § och 36 §) hade dessutom
-- INNEHÅLLSFEL som korrigerades: de var ursprungligen seedade som ofullständigt citat
-- respektive AI-sammanfattning (dokumenterat som svagast källverifierade i
-- pilot-corpus-sources.md), och ersätts här med fullständig lagtext, korsverifierad mot två
-- oberoende auktoritativa källor (riksdagen.se + lagen.nu, exakt matchande text).

-- ── Avtalslagen 3 kap 33 § — innehållskorrigering ──
-- Ursprungligt innehåll saknade sista ledet om motpartens onda tro.
update public.knowledge_chunks
set
  content = 'Rättshandling, som eljest vore att såsom giltig anse, må ej göras gällande, där omständigheterna vid dess tillkomst voro sådana, att det skulle strida mot tro och heder att med vetskap om dem åberopa rättshandlingen, och den, gentemot vilken rättshandlingen företogs, måste antagas hava ägt sådan vetskap.',
  chunk_type = 'lagtext_verbatim',
  review_status = 'approved',
  metadata = '{"fetch_source": "riksdagen.se + lagen.nu (två oberoende källor, korsverifierat)", "verbatim_confirmed": true, "note": "Fullständig lydelse hämtad och korrigerad 2026-07-19 (tidigare ofullständigt citat, saknade sista ledet om motpartens onda tro)"}'::jsonb,
  updated_at = now()
where id = 'c42e7145-61ee-47ae-96c9-0c279264449f';

-- ── Avtalslagen 3 kap 36 § — innehållskorrigering ──
-- Ursprungligt innehåll var en AI-sammanfattning, inte lagtext. Ersatt med samtliga 4 stycken.
update public.knowledge_chunks
set
  content = E'Avtalsvillkor får jämkas eller lämnas utan avseende, om villkoret är oskäligt med hänsyn till avtalets innehåll, omständigheterna vid avtalets tillkomst, senare inträffade förhållanden och omständigheterna i övrigt. Har villkoret sådan betydelse för avtalet att det icke skäligen kan krävas att detta i övrigt skall gälla med oförändrat innehåll, får avtalet jämkas även i annat hänseende eller i sin helhet lämnas utan avseende.\n\nVid prövning enligt första stycket skall särskild hänsyn tagas till behovet av skydd för den som i egenskap av konsument eller eljest intager en underlägsen ställning i avtalsförhållandet.\n\nFörsta och andra styckena äga motsvarande tillämpning i fråga om villkor vid annan rättshandling än avtal.\n\nI fråga om jämkning av vissa avtalsvillkor i konsumentförhållanden gäller dessutom 11 § lagen (1994:1512) om avtalsvillkor i konsumentförhållanden.',
  chunk_type = 'lagtext_verbatim',
  review_status = 'approved',
  metadata = '{"fetch_source": "riksdagen.se + lagen.nu (två oberoende källor, korsverifierat)", "verbatim_confirmed": true, "note": "Fullständig lydelse (alla 4 stycken) hämtad och korrigerad 2026-07-19 (tidigare AI-sammanfattning, inte ordagrant citat)"}'::jsonb,
  updated_at = now()
where id = '71ce73fa-ae4e-446e-8db3-995deed36a4b';

-- ── Övriga 18 chunks — godkännande utan innehållsändring ──
-- Runda 1 (4 st): Föräldrabalken 9:1, Konsumentköplagen 4:1, 4:2, 5:2.
-- Runda 2 (11 st): Avtalslagen 1 kap 1-7 §§ (anbud/accept), 2 kap 10/11/18/25 §§ (fullmakt).
-- Runda 3 (3 st): Föräldrabalken 9:3 (ålderdomlig men bekräftat gällande lydelse), 2
-- läroplans-utdrag (bekräftat ordagrant matchande Skolverkets centrala innehåll).
update public.knowledge_chunks
set review_status = 'approved', updated_at = now()
where id in (
  '253907ac-2c0f-4485-9287-4ed5af9ae76d', '705e599c-3798-410d-9d33-f530098e7b93',
  '13e16dc7-f2af-4140-906f-3c2556be51df', '9ccc3440-8bfe-4a98-8db9-17e1ca029768',
  'ff25a7c9-6e91-4df9-a814-6d11b77c8bf2', 'e93cdda5-df59-4c90-9a4e-fa5aab962da3',
  '870869fe-9a45-4b53-a962-b87138019b26', 'ffb5e1dd-d608-4a69-940b-edd7602dd2f8',
  '9a7eddf0-43d9-4ff5-b192-8c8f424b7f54', '74c177cd-d116-45ba-8653-171b87060966',
  '3e71e257-576e-4a0b-a5bc-358fb22c0787', 'f30973ed-a76c-4e71-a60b-f7b7c77d0651',
  '1f2d4949-a180-47d7-8b39-60f2325ac74b', '848807f5-79f7-4a46-9aec-7d94de14279d',
  'a98b3c76-eaee-4193-9d5b-1326e079fea8',
  'ab8df1c0-b92c-43d0-8c6a-e607eeca05b5',
  '03d46f90-9f96-481a-a40a-0a25e6c2a35d', '909fec45-8455-43ca-8627-bccaffcc6614'
);
