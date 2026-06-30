---
captured_at: 2026-06-21T00:00:00Z
author: Elton
contributor: Claude Sonnet 4.6
---

# Session 2026-06-21: korkortet.html Övning-mode Removal

## Beslut

Övning-mode (4:e mode) borttaget från korkortet.html. Kvar: Kurser (default), Teoriprov, Repetition, Admin (hidden).

**Motivering:** Övning och Kurser var för lika → förvirrande UX. Fokus på Kurser → Teoriprov → Repetition-flödet.

## Commits

### 61d9cab — refactor(korkortet): remove Övning mode, make Kurser default

Borttaget:
- `#tab-ovning` (tab-knapp)
- `#configView` (hela blocket ~50 rader): `#focusCard`, `#focusBody`, `#catGrid`, `#numQSel`, `#diffSel`, `#startBtn`, `#startHint`, `#historySection`, `#historyBody`
- `#sameBtn` från resultView
- Funktioner: `buildCats()`, `loadHistory()`, `buildFocusRecs()`, `updateHint()`
- `lastN`, `lastDiff` variabler
- 4 `$("startBtn").disabled` rader i `refreshQuotaUI()`

Ändrat:
- `currentMode = "ovning"` → `"kurser"`
- `#tab-kurser` fick `active` class
- Mode-map i `setMode()`: `ovning:"configView"` borttagen
- `driving_results.insert`: `category:selCat` → `category:activeCourse||selCat`
- Repetition-text: "Fortsätt öva i Kurser eller Övning." → "Fortsätt öva i Kurser."

### 015a86f — fix(korkortet): restore init flow and hero stats

**Bug 1 (KRITISK):** `showConfig()` anropades aldrig i init efter övning-borttagning.
- Orsak: Tidigare var `#configView` alltid synlig (ingen `display:none`). `#kurserView` har `display:none` → ingenting visades.
- Fix: `try { showConfig(); } catch(_) {}` i slutet av `init()`

**Bug 2:** Hero stat pills visade alltid "—" (frågor/kategorier).
- Orsak: `buildCats()` uppdaterade BÅDE `#catGrid` OCH hero stat pills — dold sidoeffekt.
- Fix: Fristående hero stat-uppdatering tillagd i init() efter questions[] laddats:
```js
const statVals = document.querySelectorAll(".heroStatVal");
if(statVals[0]) statVals[0].textContent = questions.length;
const uniqueCats = [...new Set(questions.map(q => q.category))].filter(Boolean);
if(statVals[1]) statVals[1].textContent = uniqueCats.length;
```

**Bug 3:** Text refererade borttagen mode.
- Fix: "Fortsätt öva i Kurser eller Övning." → "Fortsätt öva i Kurser."

## Arkitektur körkortsteorin (ny state)

### 3 aktiva modes (+ hidden admin)

| Tab ID | Mode | View ID | Default |
|--------|------|---------|---------|
| `#tab-kurser` | kurser | `#kurserView` | JA — `active` class |
| `#tab-teoriprov` | teoriprov | `#teoriView` | Nej |
| `#tab-repetition` | repetition | `#repetitionView` | Nej |
| `#tab-admin` | admin | `#adminView` | Hidden, role=admin |

### Quota-system

- **gratis**: `PRACTICE_LIMIT=10` kursfrågor/dag (localStorage: `proviaai_kk_pq_{uid}_{date}`)
  - `isPracticeExhausted()`, `bumpPracticeQ()`, `readPracticeQ()`
  - Teoriprov: `cap=0` → uppgradera-modal
- **basic**: 30 teoriprov/mån (server-tracked via `bump_kk` i `api/check-role.js`)
- **premium/admin**: allt obegränsat

### Init-kedja (kritisk)

```
init()
  → fetch driving_questions → set questions[]
  → loadProgressFromSupabase()
  → updateXpBar()
  → refreshQuotaUI()
  → update heroStatVal (questions.length, uniqueCats.length)  ← TILLAGD 015a86f
  → showConfig()  ← TILLAGD 015a86f
    → setMode('kurser')
      → buildCourseGrid()  → #courseGrid i #kurserView
```

### Nyckel-variabler

- `currentMode = "kurser"` (aldrig "ovning")
- `selCat = "Alla kategorier"` (aldrig satt av kurser-flow)
- `activeCourse` — satt av kurser-flow, `null` annars
- DB-insert: `category: activeCourse||selCat` (inte bara selCat)

## Workflow-lärdomar

### EltonOPT + Codex-handoff

EltonOPT v3.1 byggde 18-punkts checklista → Codex-agent tog bort bulk. Codex missade 5 av 17 items:
1. `loadHistory()` funktionskropp fortfarande kvar
2. `loadHistory()` anrop i init kvar
3. `buildCats()` try/catch i init kvar
4. `$("configView").style.display = ""` i popstate-handler kvar
5. `category:selCat` ej fixad → behövde `activeCourse||selCat`

**Lärdom:** Alltid köra manuell grep-verifiering efter Codex-edits på stora filer.

### Init-kedja — borttagning av default-mode

**Varning:** När en mode som är startup-default tas bort:
1. Kontrollera att ny default-view aktiveras explicit (via `showConfig()`)
2. Hitta ALLA sidoeffekter i borttagen funktion (t.ex. `buildCats()` → hero stats)
3. Flytta dessa sidoeffekter till init eller ny funktion

### selCat vs activeCourse

- `selCat` sätts ALDRIG av kurser-flödet — sätts bara av övning (nu borttaget)
- Kurser-flödet sätter `activeCourse` istället
- DB-insert MÅSTE använda `activeCourse||selCat` för korrekt kategoriloggning

## Supabase-tabeller

- `driving_results`: `{user_id, category: activeCourse||selCat, num_questions, num_correct, percent, passed}`
- `driving_progress`: `{user_id, srs_data, xp, wrong_ids, cat_prog, bookmarks}`
- `profiles`: `{role, kk_quota_count, kk_quota_week, stripe_customer_id, ...}`

## Nyckel-funktioner

- `setMode(mode)` — visar rätt view, kallar `buildCourseGrid()` för kurser
- `showConfig()` — återgå till startvy, kallar `setMode(currentMode)` + `refreshQuotaUI()`
- `buildCourseGrid()` — bygger `#courseGrid` i `#kurserView` (10 kurser)
- `startCourseQuiz(stage)` — startar quiz för `activeCourse`
- `runExam(cat, n, diff)` — kör generellt prov (teoriprov + retryBtn)
- `handleAns()` — svarar på fråga, bumpar quota för gratis

## Filer ändrade

- `korkortet.html` (~4400 rader): 210 rader borttagna (61d9cab) + 15 rader tillagda (015a86f)
- `CLAUDE.md`: ny sektion "körkortsteorin — modes (uppdaterad 2026-06-21)"
- `memory/project_korkortet.md`: ny minnesfil skapad
- `memory/MEMORY.md`: ny rad tillagd för project_korkortet
