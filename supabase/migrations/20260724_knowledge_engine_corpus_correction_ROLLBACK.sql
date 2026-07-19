-- Rollback för 20260724_knowledge_engine_corpus_correction.sql
-- Återställer samtliga 20 chunks till review_status='pending', och de 2 innehållskorrigerade
-- chunksen till sitt ursprungliga (ofullständiga/sammanfattade) innehåll från
-- 20260721_knowledge_engine_corpus_seed.sql. Användning: bara om den mänskliga granskningen
-- av något skäl behöver göras om från grunden — inte förväntat att någonsin behövas.

update public.knowledge_chunks
set
  content = 'Rättshandling, som eljest vore att såsom giltig anse, må ej göras gällande, där omständigheterna vid dess tillkomst voro sådana, att det skulle strida mot tro och heder att med vetskap om dem åberopa rättshandlingen. [Ofullständigt citat — sista ledet om mottagarens onda tro ej bekräftat ordagrant i denna hämtning, se pilot-corpus-sources.md.]',
  chunk_type = 'lagtext_sammanfattning',
  review_status = 'pending',
  metadata = '{"fetch_source": "riksdagen.se (delvis citat)", "verbatim_confirmed": false, "note": "Kräver komplettering/verifiering mot fullständig lagtext innan approved"}'::jsonb,
  updated_at = now()
where id = 'c42e7145-61ee-47ae-96c9-0c279264449f';

update public.knowledge_chunks
set
  content = 'Sammanfattning (ej ordagrant citat): avtalsvillkor får jämkas eller lämnas utan avseende om villkoret är oskäligt med hänsyn till avtalets innehåll, omständigheterna vid avtalets tillkomst, senare inträffade förhållanden och omständigheterna i övrigt. Vid bedömningen ska särskild hänsyn tas till behovet av skydd för den som i egenskap av konsument eller annars intar en underlägsen ställning i avtalsförhållandet. Gäller även villkor utanför egentligt avtal.',
  chunk_type = 'lagtext_sammanfattning',
  review_status = 'pending',
  metadata = '{"fetch_source": "AI-sammanfattning av sökresultat, ej dokumentcitat", "verbatim_confirmed": false, "note": "Kräver verifiering mot fullständig lagtext innan approved"}'::jsonb,
  updated_at = now()
where id = '71ce73fa-ae4e-446e-8db3-995deed36a4b';

update public.knowledge_chunks
set review_status = 'pending', updated_at = now()
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
