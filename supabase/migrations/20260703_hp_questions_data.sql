-- Provia HP — structured data payload for DTK items, 2026-07-03.
-- DTK (diagram/tabeller/kartor) questions read from a data source. MVP supports tables;
-- the column is generic jsonb ({type:'table', title, headers[], rows[][]}) so charts/maps
-- (SVG specs) can be added later without another migration. Rendered XSS-safe on the
-- client via createElement/textContent — never innerHTML.
alter table public.hp_questions
  add column if not exists data jsonb;
