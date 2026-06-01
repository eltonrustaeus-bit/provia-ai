# Validation Report — Körkortsfrågsdatabas
Genererad: 2026-06-01T20:08:13.559Z

## Källfiler analyserade
- **scripts/questions.json**: 225 frågor (gammal schema, saknade subcategory/image_description/law_reference/commonly_failed)
- **scripts/q_351_390.json**: 40 frågor (ny schema, hade brief image_descriptions)
- Överlappande IDs: 0
- Dubbletter borttagna: 0

## Vad var fel i questions.json
- ❌ Saknade fält: subcategory, question_type, image_description, law_reference, commonly_failed
- ❌ Inga image_descriptions på de 13 frågor med image_url
- ❌ Inga law_references
- ✅ Alla 225 frågor hade explanation (>20 tecken)
- ✅ Alla frågor hade 4 svarsalternativ och korrekt svar

## Vad var fel i q_351_390.json
- ⚠️ Image_descriptions var korta/vaga (under VMF-standard, t.ex. "Rödrandad triangel med en kurva åt höger")
- ✅ Hade subcategory, question_type, law_reference (null), commonly_failed
- ✅ Alla förklaringar var fullständiga

## Åtgärder vidtagna
- ✅ 225 subcategories tillagda
- ✅ 13 image_descriptions skapade (för kända VMF-skyltar)
- ✅ 35 image_descriptions förbättrade (q_351_390)
- ✅ 48 law_references tillagda (Trafiklagen/VMF)
- ✅ 18 frågor flaggade som commonly_failed

## QA-flaggor
✅ Inga kritiska QA-flaggor

## Kategoribalans (faktisk vs mål)
| Kategori | Faktisk | Mål | Status |
|----------|---------|-----|--------|
| Vägmärken | 84 | ~100 | ✅ |
| Trafikregler+Korsningar | 87 | ~100 | ✅ |
| Hastighet | 36 | ~40 | ✅ |
| Parkering | 30 | ~30 | ✅ |
| Alkohol & Droger | 14 | ~20 | ✅ |
| Säkerhet & Utrustning | 17 | ~20 | ✅ |
| Mörker & Sikt | 15 | ~15 | ✅ |
| Väglag & Bromssträcka | 15 | ~15 | ✅ |
| Övrigt | 52 | — | ℹ️ |

## Svårighetsfördelning
| Nivå | Antal | Procent | Mål |
|------|-------|---------|-----|
| easy | 98 | 28% | ~30% |
| normal | 170 | 49% | ~50% |
| hard | 82 | 23% | ~20% |

## Slutresultat
- **Total frågor sparade**: 350
- **Dubbletter borttagna**: 0
- **Frågor förbättrade**: 96
- **Redo för produktion**: ✅ JA
