-- Rollback för 20260721_knowledge_engine_corpus_seed.sql
-- Tar bort exakt de rader (via hårdkodade ID:n) som forward-migrationen seedade — rör inga andra
-- rader i dessa referenstabeller (de är annars tomma efter Fas 2, men detta är säkert oavsett).

delete from public.chunk_concepts where chunk_id in (
  'ff25a7c9-6e91-4df9-a814-6d11b77c8bf2', 'e93cdda5-df59-4c90-9a4e-fa5aab962da3',
  '870869fe-9a45-4b53-a962-b87138019b26', 'ffb5e1dd-d608-4a69-940b-edd7602dd2f8',
  '9a7eddf0-43d9-4ff5-b192-8c8f424b7f54', '74c177cd-d116-45ba-8653-171b87060966',
  '3e71e257-576e-4a0b-a5bc-358fb22c0787', 'f30973ed-a76c-4e71-a60b-f7b7c77d0651',
  '1f2d4949-a180-47d7-8b39-60f2325ac74b', '848807f5-79f7-4a46-9aec-7d94de14279d',
  'a98b3c76-eaee-4193-9d5b-1326e079fea8', 'c42e7145-61ee-47ae-96c9-0c279264449f',
  '71ce73fa-ae4e-446e-8db3-995deed36a4b', '253907ac-2c0f-4485-9287-4ed5af9ae76d',
  'ab8df1c0-b92c-43d0-8c6a-e607eeca05b5', '705e599c-3798-410d-9d33-f530098e7b93',
  '13e16dc7-f2af-4140-906f-3c2556be51df', '9ccc3440-8bfe-4a98-8db9-17e1ca029768',
  '03d46f90-9f96-481a-a40a-0a25e6c2a35d', '909fec45-8455-43ca-8627-bccaffcc6614'
);

delete from public.knowledge_chunks where id in (
  'ff25a7c9-6e91-4df9-a814-6d11b77c8bf2', 'e93cdda5-df59-4c90-9a4e-fa5aab962da3',
  '870869fe-9a45-4b53-a962-b87138019b26', 'ffb5e1dd-d608-4a69-940b-edd7602dd2f8',
  '9a7eddf0-43d9-4ff5-b192-8c8f424b7f54', '74c177cd-d116-45ba-8653-171b87060966',
  '3e71e257-576e-4a0b-a5bc-358fb22c0787', 'f30973ed-a76c-4e71-a60b-f7b7c77d0651',
  '1f2d4949-a180-47d7-8b39-60f2325ac74b', '848807f5-79f7-4a46-9aec-7d94de14279d',
  'a98b3c76-eaee-4193-9d5b-1326e079fea8', 'c42e7145-61ee-47ae-96c9-0c279264449f',
  '71ce73fa-ae4e-446e-8db3-995deed36a4b', '253907ac-2c0f-4485-9287-4ed5af9ae76d',
  'ab8df1c0-b92c-43d0-8c6a-e607eeca05b5', '705e599c-3798-410d-9d33-f530098e7b93',
  '13e16dc7-f2af-4140-906f-3c2556be51df', '9ccc3440-8bfe-4a98-8db9-17e1ca029768',
  '03d46f90-9f96-481a-a40a-0a25e6c2a35d', '909fec45-8455-43ca-8627-bccaffcc6614'
);

delete from public.knowledge_documents where id in (
  '01bbd7f5-9e8d-42cf-8f9e-30841946c3f7', '16abb89d-d31c-402a-929c-703bc69cb0ee',
  '453f9772-de5e-45da-9bdf-42952d09ee5a', '6b2bec72-4a85-4e64-829c-7a259eb035ed'
);

delete from public.concepts where id in (
  'd6b91831-5c79-4ea5-9873-47867d3e3b94', 'fdefaa54-0764-436f-b71c-3ae850f77667',
  'f5efa722-08c5-4712-87d7-14f919babf2c', '7b410904-2b1a-4ee4-99f2-8525b1dc4a6e',
  'bb5df550-7a26-4a4a-94b7-2e1aaff3c9cb', 'e4a370b2-1838-48fc-84eb-03bdceec30e1'
);

delete from public.knowledge_sources where id in (
  'c92f4043-82c0-4503-a6dc-5fbc519cb8e4', '3168d1e9-fe31-4d10-b089-c231a24d6c59',
  'bc7e2f30-b69e-4416-a222-9e6626ec2e28', 'dc26ee95-bcf5-457c-b0b6-d9bcfbce15c4'
);
