# ADR 0005 — Embedding-modell, pgvector-indextyp och hybrid retrieval

Status: Beslutad (2026-07-20)

## Kontext

Fas 2 skapade `knowledge_chunks` medvetet utan embedding-kolumn (`pgvector`-extensionen var inte
installerad, ingen modell vald, se `12-fas2-results.md`). Fas 3 seedade 20 chunks med
`content_tsv` (Postgres full-text, redan indexerat via `idx_knowledge_chunks_tsv`) men ingen
vektorrepresentation. Fas 4 (`09-migration-and-rollback-plan.md` steg 6, "Retrieval") kräver ett
konkret val innan en hybrid sök-modul kan byggas.

ADR 0002 låste redan **OpenAI-only** för alla AI-anrop i detta projekt (ingen ny leverantör,
ingen ny abstraktion). Samma princip gäller embedding-modellen.

## Beslut

1. **Embedding-modell: `text-embedding-3-small`** (OpenAI), dimension **1536**.
   - Inte `text-embedding-3-large` (3072 dim): pilotens 20 chunks och pilotens smala ämnesomfång
     (07 §2) gör inte den högre kvaliteten/kostnaden motiverad. Matchar samma
     billig-modell-som-default-princip som `gpt-4o-mini` (ADR 0002).
   - Modellnamnet loggas per anrop i `ai_usage_events.model` (redan existerande kolumn) så ett
     senare byte till `-large` är spårbart och inte tyst.
2. **pgvector-indextyp: HNSW**, inte IVFFlat.
   - IVFFlat kräver ett representativt antal rader för att träna listorna meningsfullt (praktisk
     tumregel: `rows >= lists`) — med pilotens 20 rader skulle ett IVFFlat-index vara i praktiken
     verkningslöst. HNSW bygger inkrementellt utan träningssteg och fungerar korrekt oavsett
     tabellstorlek, vilket är det enda alternativet som ger ett meningsfullt index redan i piloten.
3. **Avståndsmått: cosine** (`vector_cosine_ops`, `<=>`-operatorn) — OpenAIs egen dokumentation
   rekommenderar cosine-likhet för `text-embedding-3-*`-familjen.
4. **Hybrid retrieval, inte enbart vektorsökning:** kombinera det befintliga `content_tsv`
   (svensk full-text, redan indexerat) med vektor-likhet. Ren vektorsökning på en så liten,
   paragraf-tät korpus (många chunks delar samma juridiska terminologi) ger sämre precision än att
   låta exakta paragrafhänvisningar/nyckeltermer (t.ex. "36 §", "reklamation") vikta högt via
   full-text, med vektorsökning som primärt återhämtar semantiskt närliggande innehåll utan exakt
   ordmatchning. Enkel linjär kombination (`score = w_tsv * ts_rank + w_vec * (1 - cosine_distance)`)
   i Fas 4 — ingen reranker-modell (uppdragets §8-avgränsning, `07 §8`, bekräftar att ingen
   reranker-infrastruktur finns eller ska byggas).

## Konsekvenser

- Ny migration krävs (`create extension if not exists vector`, `alter table knowledge_chunks add
  column embedding vector(1536)`, HNSW-index) — Fas 2:s schema ändras additivt, ingen brytande ändring.
- Ett backfill-script (`scripts/knowledge-embed-chunks.mjs`, Fas 4.5) måste anropa OpenAIs
  embeddings-API för de 20 redan seedade chunksen — den första fasen i detta uppdrag med en faktisk,
  om än försumbar, AI-API-kostnad (20 korta textstycken × text-embedding-3-small-pris). Loggas i
  `ai_usage_events` (`pipeline_step='embed'`, redan en giltig enum-post i Fas 2:s schema).
- Retrieval-modulen (Fas 4.6) är en fristående funktion, INTE en del av `api/knowledge.js` (som
  enligt ADR 0001/`08-file-impact-map.md` byggs i Fas 5) — testas direkt mot databasen, inte via HTTP.
- Om pilotens korpus växer avsevärt (hundratals/tusentals chunks) bör IVFFlat omprövas för
  minnesfotavtryck — inte relevant i nuvarande skala.
