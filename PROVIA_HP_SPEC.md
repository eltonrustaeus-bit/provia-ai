# Provia HP — Architecture & Product Specification

> Status: **Design pass (no production code).** Brand = **Provia HP**. Files `provia-hp.html` + `js/hp-*.js`, tables `hp_*`, routes `api/hp-*.js`.
> Stack: static HTML/CSS/JS · Vercel serverless · Supabase (Postgres/Auth/RLS) · OpenAI gpt-4o-mini.
> This doc contains the architecture, the Codex adversarial review, and the revised final. Build slice-by-slice after sign-off.

---

## 0. Pre-flight findings (what the codebase dictates)

| Constraint discovered | Consequence for Provia HP |
|---|---|
| `consume_mock_exam_quota` RPC: `security definer`, `FOR UPDATE` row lock, REVOKE from public/anon/authenticated, GRANT service_role | Every `hp_` quota uses the identical RPC shape. Never read-then-write in JS. |
| OpenAI called via `/v1/responses` with `text.format = json_schema (strict)`; `callAI()` in `_per-core.js` | HP generation/diagnosis use `callAI()` + strict schemas. No new AI transport. |
| `generate-exam.js` does generate → `reviewExam()` → regenerate-once (best-effort, never blocks) | Reuse this exact 2-pass pattern as the HP question **novelty + quality gate**. |
| P.E.R engine = `_per-core.js` `buildPERSystemPrompt()` with `pageContext`, `weakAreas`, `helpLevel`, `recentMistakes`, `longMemory` | HP Coach is a new `intent`/`pageContext.page='hp'` path, NOT a parallel coach. |
| Auth = shared.js `pvModal` (`data-pv-auth`, `proviaOpenLogin`, `PROVIA_AUTH_REDIRECT`) | HP gates via pvModal only. `PROVIA_AUTH_REDIRECT='provia-hp.html'`. No new modal. |
| `profiles` holds role + `*_quota_count`/`*_quota_period`; `driving_progress` holds `xp, srs_data, wrong_ids, cat_prog` | HP progress mirrors `driving_progress` as `hp_progress`; XP/SRS reuse the shape. |
| **`PRODUCT.md` Anti-References: "we are not gamified"** | Direct conflict with Del 11. Resolved in §Codex review → "invisible progression", not Duolingo. |
| `korkortet.html` ≈ 4400-line monolith (flagged anti-pattern) | HP MUST be modular: thin `provia-hp.html` + `js/hp-*.js` ES modules. |
| `looksLikeMath()` + `OPENAI_MODEL_MATH` routing | Reused for kvant delprov (XYZ/KVA/NOG/DTK) → math model; verbal → base model. |
| CJS (`generate-exam`, `grade`) vs ESM (`_per-core`, `explain`) split | New `api/hp-*.js` are **ESM** (import `_per-core`, `_provia-rules`). Stated per file. |

---

## 1. Product concept & positioning

**Provia HP** is the third product leg beside **Provia Study** (skolämnen/mockprov) and **Provia Drive** (körkort). It is not "old tests in a viewer." It is a **diagnostic + adaptive coaching engine** for Högskoleprovet whose promise is a *delta*, not content:

> "Gå från 0.9 till 1.5 genom att plugga smartare — inte mer."

Three pillars that competitors (HPGuiden, Studi, Allakando PDF-packs, Hpskolan) lack as an integrated whole:
1. **Diagnos** — exactly *which concepts* cost you points and *why* (miss-type, not just %).
2. **Adaptiv generering** — endless *new* items in the real HP style, targeted at your weak nodes.
3. **Prediktion** — a calibrated skalpoäng estimate + the shortest path to your target.

Positioning line: *"Sveriges enda högskoleprov-AI som vet varför du tappar poäng — och bygger planen som tar dig dit du vill."*

Free/paid split (mirrors körkort's free-daily / paid-monthly logic, extends `_provia-rules.js`):

| Tier | HP entitlement |
|---|---|
| Gratis | 1 full diagnostic + 15 adaptive frågor/dag + Mastery readout (read-only) |
| Basic (29) | 60 adaptive frågor/dag + 4 AI-genererade delprov/mån + Study Planner |
| Premium (79) | Obegränsat + obegränsade fullsimuleringar + Prediction Engine + P.E.R HP-coach obegränsat |

---

## 2. Information architecture & UX flow

Single page `provia-hp.html`, hash-routed views (mirrors korkortet `setMode`), thin shell + modules:

```
Entry (logged-out) → pvModal (register-first) → Onboarding
   → Diagnostic (45–60 adaptiv frågor, ~25 min) ─┐
                                                  ▼
                          ┌──────── HP Dashboard ────────┐
                          │ Mastery map · Prediction gauge │
                          │ "Nästa pass" · streak · plan   │
                          └───┬───────┬────────┬──────────┘
                  Träna (adaptiv) │  Simulera (full)  │  Coach (P.E.R)
                          │       │        │           │
                          ▼       ▼        ▼           ▼
                   Adaptive loop  Timed prov  Result+normering  Chat/förklaring
                          └────────────── feeds Diagnostic Engine ──────────────┘
```

Views (each a `js/hp-views/*.js` render fn): `onboarding`, `diagnostic`, `dashboard`, `train`, `simulate`, `result`, `coach`, `planner`, `stats`. Design tokens verbatim (#08100d / #1bff8c / radius 5px / DM Sans+Mono). Mobile-first; reduced-motion honored (reuse `intro-splash.js` pattern).

---

## 3. Knowledge Graph design (Del 2)

All 8 delprov as a 3-level concept DAG with prerequisite edges. Stored as **two static JSON files** (versioned in repo, served statically — no DB round-trip on load) + one DB table for per-user mastery.

**Taxonomy (delprov → område → koncept):**

```
KVANT
 ├─ XYZ (matematisk problemlösning) → algebra, ekvationer, funktioner, potens/rot
 ├─ KVA (kvantitativa jämförelser)  → storleksordning, andelar, geometri-jämförelse
 ├─ NOG (kvantitativa resonemang)   → tillräcklig info, logisk slutledning, villkor
 └─ DTK (diagram/tabeller/kartor)   → avläsning, proportion, enhetsbyte, trend
VERBAL
 ├─ ORD (ordförståelse)             → latinska rötter, synonymer, kontextledtråd
 ├─ LÄS (svensk läsförståelse)      → huvudtes, inferens, författarattityd, struktur
 ├─ MEK (meningskomplettering)      → koherens, konnektiv, register
 └─ ELF (engelsk läsförståelse)     → vocabulary-in-context, gist, detail, inference
```

Cross-delprov prerequisite edges (the "smart" part — e.g. `DTK:proportion` requires `XYZ:bråk_procent`; `NOG:logisk_slutledning` shares `KVA:villkor`). Edge types: `prereq`, `shares_skill`, `harder_variant`.

**Node schema** (`public/hp/graph_nodes.json`):
```json
{ "id":"xyz.procent", "delprov":"XYZ", "area":"algebra",
  "label":"Procent & förändringsfaktor", "level":2,
  "difficulty_band":[0.3,0.8], "skill_tags":["procent","faktor"] }
```
**Edge schema** (`public/hp/graph_edges.json`):
```json
{ "from":"xyz.procent", "to":"dtk.proportion", "type":"prereq", "weight":0.7 }
```

Built/queried with the `/graphify` skill (already in repo). The graph drives: adaptive selection (traverse to weakest unmet prereq), diagnostic root-causing, and the stats "concept map" visualization.

---

## 4. Database design (`hp_*` schema)

All tables RLS deny-by-default, per-user `auth.uid()` policies. Migration `supabase/migrations/2026XXXX_hp_schema.sql` (+ matching `_ROLLBACK.sql`).

```sql
-- hp_questions: AI-generated item bank (cached, reusable across users)
CREATE TABLE public.hp_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  , delprov         TEXT NOT NULL          -- ORD|LAS|ELF|MEK|XYZ|KVA|NOG|DTK
  , node_id         TEXT NOT NULL          -- FK→graph_nodes.json id
  , stem            TEXT NOT NULL
  , options         JSONB NOT NULL         -- ["A","B","C","D"] (ORD/KVA = 4, others vary)
  , correct_index   SMALLINT NOT NULL
  , explanation     TEXT NOT NULL
  , difficulty      REAL NOT NULL          -- 0..1 (IRT b-param seed)
  , passage_id      UUID                   -- FK hp_passages (LÄS/ELF share a text)
  , source_hash     TEXT NOT NULL          -- novelty guard (see §6)
  , quality         TEXT NOT NULL DEFAULT 'pending'  -- pending|good|flagged
  , created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hp_questions_node ON public.hp_questions(node_id, difficulty);
CREATE UNIQUE INDEX idx_hp_questions_hash ON public.hp_questions(source_hash);

-- hp_passages: shared reading texts for LÄS/ELF/MEK
CREATE TABLE public.hp_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  , delprov TEXT NOT NULL, lang TEXT NOT NULL, body TEXT NOT NULL
  , word_count INT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- hp_attempts: every answer event (the diagnostic signal stream)
CREATE TABLE public.hp_attempts (
    id              BIGSERIAL PRIMARY KEY
  , user_id         UUID NOT NULL REFERENCES auth.users(id)
  , question_id     UUID NOT NULL REFERENCES public.hp_questions(id)
  , node_id         TEXT NOT NULL
  , delprov         TEXT NOT NULL
  , chosen_index    SMALLINT          -- NULL = skipped/timeout
  , is_correct      BOOLEAN NOT NULL
  , response_ms     INT NOT NULL
  , confidence      SMALLINT          -- 1..4 self-report (optional)
  , session_id      UUID NOT NULL     -- groups a train/sim session
  , context         TEXT NOT NULL     -- diagnostic|train|simulate
  , created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX idx_hp_attempts_user_node ON public.hp_attempts(user_id, node_id, created_at DESC);

-- hp_mastery: derived per-user-per-node score (0..100), recency-decayed
CREATE TABLE public.hp_mastery (
    user_id UUID NOT NULL REFERENCES auth.users(id)
  , node_id TEXT NOT NULL
  , mastery REAL NOT NULL DEFAULT 0      -- 0..100
  , attempts INT NOT NULL DEFAULT 0
  , last_seen TIMESTAMPTZ
  , updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  , PRIMARY KEY (user_id, node_id));

-- hp_progress: gamification + planner state (mirrors driving_progress)
CREATE TABLE public.hp_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id)
  , xp INT NOT NULL DEFAULT 0
  , streak_days INT NOT NULL DEFAULT 0
  , last_active DATE
  , target_score REAL                    -- e.g. 1.7
  , plan JSONB                           -- generated study plan
  , achievements JSONB NOT NULL DEFAULT '[]'
  , predicted_score REAL
  , predicted_at TIMESTAMPTZ);

-- hp_sessions: full simulations for normering + comparison
CREATE TABLE public.hp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  , user_id UUID NOT NULL REFERENCES auth.users(id)
  , kind TEXT NOT NULL                   -- diagnostic|full_sim|delprov_sim
  , raw_correct INT, raw_total INT
  , scaled_score REAL                    -- normerad 0.0..2.0
  , per_delprov JSONB                    -- {XYZ:0.8, ORD:1.4, ...}
  , started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ);
```

**RLS (every user-owned table):**
```sql
ALTER TABLE public.hp_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY hp_attempts_owner ON public.hp_attempts
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- identical for hp_mastery, hp_progress, hp_sessions
-- hp_questions/hp_passages: SELECT to authenticated (shared bank), INSERT service_role only
```

**Quota RPC (clone of `consume_mock_exam_quota`):**
```sql
CREATE OR REPLACE FUNCTION public.consume_hp_gen_quota(
    p_user_id UUID, p_period_key TEXT, p_limit INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- ... identical body to consume_mock_exam_quota using hp_gen_quota_count/period cols ...
$$;
REVOKE EXECUTE ON FUNCTION public.consume_hp_gen_quota(uuid,text,integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_hp_gen_quota(uuid,text,integer) TO service_role;
```
Add cols `hp_gen_quota_count INT DEFAULT 0, hp_gen_quota_period TEXT` to `profiles`. Same for `consume_hp_sim_quota`. **If you ever recreate these, re-apply the REVOKE** — else IDOR (a user griefs another's quota via `/rest/v1/rpc/...`), exactly the hole the 2026-06-27 audit closed.

---

## 5. File structure (anti-monolith)

```
provia-hp.html                 # thin shell: <head> tokens, view containers, module imports
js/hp-app.js                   # router (hash → view), session bootstrap, auth gate
js/hp-graph.js                 # loads + queries graph_nodes/edges.json (BFS to weakest prereq)
js/hp-engine.js                # adaptive next-question, mastery update (client mirror)
js/hp-diagnostic.js            # diagnostic flow + initial mastery seeding
js/hp-simulate.js              # timed full prov, normering, comparison
js/hp-coach.js                 # P.E.R HP chat (calls api/hp-coach.js / explain.js)
js/hp-planner.js               # target → daily/weekly plan render
js/hp-stats.js                 # interactive charts (canvas, no heavy dep)
js/hp-gamify.js                # XP/streak/achievement (invisible progression)
public/hp/graph_nodes.json
public/hp/graph_edges.json
api/hp-generate.js   (ESM)     # AI item generation + novelty/quality gate + quota
api/hp-diagnose.js   (ESM)     # ingest attempts → recompute mastery → diagnosis
api/hp-predict.js    (ESM)     # skalpoäng prediction + gap-to-target
api/hp-coach.js      (ESM)     # P.E.R HP coach via _per-core buildPERSystemPrompt
supabase/migrations/2026XXXX_hp_schema.sql  (+ _ROLLBACK)
```
Every file <800 lines, every fn <50. No raw `innerHTML` with model output (sanitize). All AI keys server-only.

---

## 6. AI architecture

**Generation (`api/hp-generate.js`)** — extends `generate-exam.js`:
- Input: `{ delprov, node_id, difficulty_band, n }`. Auth required → `consume_hp_gen_quota`.
- Model routing: kvant delprov → `OPENAI_MODEL_MATH`; verbal → `OPENAI_MODEL` (reuse `pickModel`).
- Strict `json_schema` per delprov (ORD=4 opts, KVA=4 fixed relational opts, LÄS/ELF=passage+items). Schema **forbids** leaking the answer in the stem and enforces option count.
- **Novelty + quality gate** (the 2-pass pattern): after generation → `reviewExam`-style call scores (a) ambiguity, (b) correct_index correctness, (c) **style-fidelity to real HP**, (d) **novelty** = reject if `source_hash` (normalized stem shingle hash) collides with an existing row or a known historical item → regenerate once. `quality='good'` items cached in `hp_questions` for reuse across users (cost amortization).
- Server guards (like `generate-exam.js` lines 456–473): validate type/options/correct_index before insert; reject malformed.

**Diagnosis (`api/hp-diagnose.js`)**: ingests a batch of `hp_attempts`, recomputes `hp_mastery`, returns a structured diagnosis (strict schema): `{ weak_nodes:[{node,mastery,miss_type}], root_causes:[node], next_focus:[node] }`. `miss_type` ∈ `concept_gap | careless | too_slow | guessing` (derived from response_ms + confidence + pattern, not from the model alone — model only labels, math decides).

**Coach (`api/hp-coach.js`)**: thin ESM wrapper → `buildPERSystemPrompt({ pageContext:{page:'hp', delprov, currentQuestion, weakAreas }, helpLevel, recentMistakes, longMemory })` → `callAI`. Reuses existing P.E.R voice/help-levels (0=ledtråd…3=full lösning) and the `förbättring` 24h cache pattern. No new persona.

**Caching:** static graph JSON (CDN). `hp_questions` is itself the generation cache (generate once, serve many). P.E.R coach answers cached 24h client-side (`proviaai_hp_coach_cache`), mirroring `förbättring.html`.

**Cost envelope (gpt-4o-mini):** ~1.5k tok/generated item incl. review pass ≈ $0.0004/item; cached reuse drives marginal cost →0. Budget target: < $0.15 / active Premium user / month. Stated for build-time verification.

---

## 7. Diagnostic Engine (Del 3) — signals captured

Per attempt: correct/incorrect, `response_ms`, self-reported `confidence`, chosen distractor (which wrong option → reveals the misconception), node, session context. Derived signals:
- **miss_type** = math rules over the model: fast+wrong+low-conf → `guessing`; slow+wrong → `concept_gap`; fast+wrong+high-conf → `misconception` (distractor analysis); correct+very-slow → `fragile`.
- **kunskapslucka** = node with mastery <40 whose *prereqs* are also weak → root cause; weak node with strong prereqs → `careless`/practice gap.
- Distractor fingerprinting: each generated MC option tagged with the misconception it represents → choosing it is a labeled diagnostic event.

---

## 8. Mastery Score (Del 4)

Per node 0–100. Update on each attempt with **recency-weighted Elo-style** rule (not naive %):
```
expected   = 1 / (1 + 10^((difficulty*100 - mastery)/40))
mastery_new = clamp(mastery + K * (correct - expected), 0, 100)
K           = 24 if attempts<10 else 12        // faster early convergence
decay: mastery -= 2 per 14 idle days (floor at last_confident)
```
Delprov score = prereq-weighted aggregate of its nodes (weak foundational nodes pull harder). Surfaced as the §UX mastery map + the weakest-3 callout.

---

## 9. Adaptive Learning (Del 5)

Next-question selector (`js/hp-engine.js` + server validation):
1. Candidate pool = nodes with mastery in the "zone of proximal development" (40–75) **and** whose prereqs are ≥60 (graph traversal — don't drill a node whose foundation is missing; drill the foundation first).
2. Weight toward weakest eligible node (mirrors körkort's 40% wrong-answer boost).
3. Difficulty target = `mastery/100` band → escalates as mastery rises (always ~70% success rate = optimal challenge).
4. Pull from `hp_questions` cache at that node+difficulty; if none, trigger `hp-generate`.
Anti-frustration: 3 wrongs in a row on a node → drop difficulty + inject a worked example (P.E.R helpLevel 2).

---

## 10. AI-generated exams (Del 6) & 11. Simulation engine (Del 7)

Full HP structure: 2 kvant + 2 verbal pass (real HP = 4 timed sections, 80 frågor, ~3h; offer 1-section and full modes). Generator assembles from `hp_questions` matching the real delprov distribution + difficulty curve; gaps filled by `hp-generate`. Timer per section (real limits). Auto-grade on submit → `hp_sessions`.

**Normering (raw → skalpoäng 0.0–2.0):** seed with the official Trafikverket/UHR historical raw→scaled tables (these tables are public facts, not copyrighted items) stored in `public/hp/norm_tables.json`; interpolate. Comparison vs the user's prior `hp_sessions` (trend) and vs target. Post-sim P.E.R analysis call summarizes performance + 3 actions (reuse `buildPERCoachSystemPrompt`).

---

## 12. Prediction Engine (Del 9)

Method: **weighted mastery → scaled-score regression**, calibrated on simulation outcomes.
```
predicted_scaled = Σ(delprov_weight * mastery_delprov) mapped through norm_tables
confidence_interval widens when: few attempts, high mastery variance, no full sim yet
```
Output: `"Skriver du idag: ~1.45 (±0.2, låg säkerhet — gör en fullsimulering för en skarpare siffra)"`. Gap-to-target: for 1.6/1.8/2.0 show *which nodes* must rise and by how much (graph-aware shortest path: cheapest mastery gains first). **Never** show false precision on thin data — wide interval + explicit low-confidence label (adversarial requirement). Calibration improves as `hp_sessions` accumulate (compare predicted vs actual, store residual).

---

## 13. Study Planner (Del 10)

Input: target score + provdatum + minutes/day. Output `hp_progress.plan` JSON: daily node targets (weakest-cheapest first via graph), spaced repetition slots (reuse `srs_data` SM-2 logic from körkort), weekly mini-sim, full sim cadence. Re-plans weekly from updated mastery. Renders as a checklist dashboard.

---

## 14. Gamification (Del 11) — **"invisible progression"** (see Codex §)

XP per quality attempt (harder node = more XP), streaks (`streak_days`), achievements (e.g. "Procent-mästare: xyz.procent ≥85"), daily goal ring. Stored in `hp_progress`. **Restrained** to honor PRODUCT.md's anti-Duolingo stance: no mascots, no push-nag, no confetti spam — progression is felt through the mastery map filling in and the prediction gauge climbing, with XP/streak as quiet reinforcement. Resolves the documented brand conflict.

---

## 15. Statistics (Del 12)

Interactive (canvas, no heavy chart dep — keep bundle <80kb microsite budget): mastery map (graph viz), score trend line, response-time-by-delprov, strongest/weakest bars, predicted trajectory with CI band, recommended-next list. All from `hp_attempts`/`hp_mastery`/`hp_sessions` aggregates.

---

## 16. ≥20 innovations (each: why it wins)

1. **Concept-graph root-causing** — drills the *prereq* that's actually failing, not the symptom. Competitors drill surface delprov.
2. **Distractor-fingerprinting** — each wrong option is a labeled misconception; choosing it teaches the system *why* you erred.
3. **Calibrated prediction with honest uncertainty** — a credible skalpoäng estimate, not a vanity number.
4. **Shortest-path-to-target** — names the cheapest mastery gains to hit 1.7. Nobody else quantifies the path.
5. **Generative endless bank** — never run out of *new* on-style items; no memorizing leaked PDFs.
6. **Style-fidelity gate** — AI self-review scores how "HP-äkta" each item feels before it's served.
7. **Novelty hash guard** — provably never serves a copy of a real/past item (also the legal shield).
8. **miss_type engine** (concept vs careless vs slow vs guess) — turns a wrong answer into a diagnosis.
9. **Zone-of-proximal-difficulty** — auto-tunes to ~70% success = fastest learning, never demoralizing.
10. **Cross-delprov transfer hints** — "din DTK-svaghet är egentligen XYZ-procent." Unique to the graph.
11. **Confidence-calibration training** — pairs self-reported confidence with correctness → fixes overconfidence (a real HP score killer).
12. **Speed-under-pressure mode** — trains pacing per delprov (HP is brutally timed); flags "rätt men för långsam."
13. **One-section micro-sims** — full-sim realism in 12 min for bus-studying (matches PRODUCT.md mobile-first).
14. **P.E.R inline coach** — context-aware help levels (ledtråd→full lösning) already proven in körkort.
15. **Adaptive Feynman** — student explains a concept, P.E.R finds the gap (reuses `feynman` mode in `_per-core`).
16. **ORD root-builder** — latin/greek morpheme graph so one root unlocks many words (compounding ROI).
17. **Prediction-vs-actual calibration loop** — the engine grades *itself* against sims and tightens.
18. **Goal-reverse planner** — start from "1.7 by May", get today's exact 20-min task.
19. **Mistake-replay** — re-serves *generated variants* of your past misses, not the same item (no answer-memorizing).
20. **Invisible progression** — motivation without gamification kitsch (brand-safe differentiation).
21. **Multi-test-ready graph schema** — same engine extends to SAT/IELTS later (strategic moat).
22. **Cohort-anonymous percentile** (deferred) — "your XYZ is top 30% of Provia HP users."

---

## 17. Prioritized build plan

**MVP boundary = one delprov end-to-end vertical slice (ORD chosen: simplest items, no math render, fastest to value).**

| Phase | Scope | Depends on |
|---|---|---|
| **P0** | Migration `hp_schema` + RLS + 2 quota RPCs (+ROLLBACK); seed `graph_nodes/edges.json` for ORD; `provia-hp.html` shell + `hp-app.js` router + pvModal gate | — |
| **P1 (MVP)** | ORD slice: `hp-generate` (ORD schema+novelty gate), `hp-diagnostic`, `hp-engine` adaptive loop, `hp_mastery` update, basic dashboard | P0 |
| **P2** | Mastery map + stats charts + invisible gamification (`hp-gamify`, `hp-stats`) | P1 |
| **P3** | Expand to all 8 delprov (schemas + math routing for kvant) + passages for LÄS/ELF/MEK | P1 |
| **P4** | Simulation engine + normering + comparison (`hp-simulate`, `norm_tables.json`) | P3 |
| **P5** | Prediction Engine + calibration loop (`hp-predict`) | P4 |
| **P6** | Study Planner + P.E.R HP coach polish + Stripe entitlement wiring | P5 |
| **P7** | Hardening: security review, RLS pgTAP, Playwright E2E, perf/bundle, mobile QA | all |

Commit before each phase. Test RLS after the migration. Each phase independently shippable behind a soft launch.

---

## 18. Risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Upphovsrätt** — real HP items are protected | HIGH | Generate-only + novelty hash guard (#7); never store/serve verbatim past items; norm tables are public facts only. |
| **AI hallucination** — wrong correct_index / ambiguous item | HIGH | 2-pass review gate + server validation + distractor rules; `quality='flagged'` items never served. |
| **Prediction miscalibration** — false "1.45" erodes trust | MED | Honest CI + low-confidence labels + self-calibration loop; gate precise numbers behind ≥1 full sim. |
| **OpenAI cost blowout** | MED | `hp_questions` cache (generate once/serve many) + quota RPCs + anon rate-limit on any unauth path. |
| **IDOR via quota RPC** | HIGH | REVOKE from public/anon/authenticated; service_role only (the audited pattern). |
| **Brand conflict** — gamification vs "not gamified" | MED | "Invisible progression" design; sign-off needed. |
| **Scope/XL burnout** | MED | Strict MVP (ORD only) ships value before the other 7 delprov. |
| **Monolith regression** | LOW | Modular `js/hp-*.js`, 800-line ceiling enforced. |

---

## 19. CODEX REVIEW (adversarial) — findings & required changes

> Reviewer stance: assume the above is wrong until proven; attack the weakest joints.

**C1 — Mastery Elo cold-start is unstable.** With `attempts<10`, K=24 + a 45-item diagnostic spread across ~40 nodes means most nodes get **0–1 attempts** → mastery is noise, yet Prediction consumes it.
→ **Fix:** diagnostic must be **adaptive and node-budgeted** — seed mastery at the *area* level first (8 areas, ~5 items each), then refine nodes during training. Prediction uses area-mastery until a node has ≥4 attempts. *(Revised in §8/§12.)*

**C2 — Generation novelty hash is too weak.** A shingle hash catches near-duplicates of *our own* bank but cannot prove non-infringement of real HP items we don't have in a DB.
→ **Fix:** add a **style-template, not content-copy** generation constraint: the model is given the *abstract skill + format*, explicitly **never** a real passage/stem. Add a periodic human-spot-check queue (`quality='pending'` sampling) before mass serve. Legal posture = "inspired-by format, original content," documented. *(Revised §6/§18.)*

**C3 — Caching shared `hp_questions` across users leaks the adaptive signal.** If everyone draws from the same cached pool, strong users exhaust easy items and the bank skews; also a user could enumerate the bank.
→ **Fix:** cache is a *pool*, selection is per-user by node+difficulty+unseen (`NOT IN user's hp_attempts`); cap bank reads, generate fresh when a user has seen >70% of a node's pool. RLS already blocks enumeration of *other users'* attempts; `hp_questions` SELECT is fine (no answers exposed beyond what a paying user sees anyway — **but** `correct_index`/`explanation` must NOT be sent to client until after answer submit). *(Critical change: split `hp-generate` response — serve stem+options; reveal correct_index/explanation only via a separate post-answer call. Revised §4/§6.)*

**C4 — `response_ms` is trivially spoofable from the client** → corrupts miss_type + prediction.
→ **Fix:** timestamp server-side at item-serve and at answer-submit; client ms is advisory only. Reject implausible (<300ms) as `guessing`. *(Revised §7.)*

**C5 — Normering with stale public tables drifts** (UHR re-norms each administration).
→ **Fix:** version `norm_tables.json` with the administration date; show "baserat på HT-norm" caveat; treat predicted scaled score as a band, never a guarantee. *(Revised §11/§12.)*

**C6 — Prediction without a full sim is barely better than guessing.** Mapping mastery→scaled has no ground truth until the user sims.
→ **Fix:** two-tier prediction — *pre-sim* = wide "indikativt intervall" derived from area mastery; *post-sim* = calibrated point + tighter CI using their actual residual. Never label pre-sim as a real prediction. *(Revised §12.)*

**C7 — Free-tier abuse on generation.** Even logged-in free users could drain OpenAI by spamming `hp-generate`.
→ **Fix:** free tier draws from cache only (no on-demand generation); generation quota is Basic+; anon path (if any preview) uses `consume_anon_rate`. *(Revised §1/§6.)*

**C8 — Engine duplicated client+server invites divergence.** `hp-engine.js` mastery math + server mastery math will drift.
→ **Fix:** **server is source of truth.** Client computes an optimistic preview only; `api/hp-diagnose` recomputes authoritatively and the client reconciles. No mastery write from client. *(Revised §5/§8.)*

**C9 — KVA/DTK/math rendering.** Spec ignores how equations/diagrams render in plain HTML.
→ **Fix:** lightweight KaTeX (CDN, lazy-loaded, kvant views only) for math; DTK diagrams as generated inline SVG (model returns structured data → client draws), never raster. Stays within bundle budget by lazy-loading. *(Added to §5/§10.)*

**C10 — Achievements JSON in `hp_progress` unbounded.** Grows forever.
→ **Fix:** achievements are a fixed enum; store earned-ids + timestamp only. *(Revised §4/§14.)*

---

## 20. REVISED FINAL — what changed vs the first version

The architecture above is updated in place; the material deltas Codex forced:

1. **Diagnostic is adaptive + area-first node-budgeted** (C1) — kills cold-start noise.
2. **Two-tier prediction**: indicative pre-sim band vs calibrated post-sim point (C6) — no false precision.
3. **Answer key never sent pre-submit** — `hp-generate` returns stem+options; `correct_index`/`explanation` via separate post-answer endpoint (C3) — closes a real cheat/scrape vector.
4. **Server is the single source of truth for mastery + timing** (C4, C8) — client is optimistic-preview only.
5. **Free tier = cache-only, generation is Basic+** (C7) — caps OpenAI abuse.
6. **Generation constrained to abstract skill+format, human spot-check queue, documented legal posture** (C2) — strengthens the upphovsrätt shield.
7. **Versioned norm tables with administration-date caveat** (C5).
8. **KaTeX-lazy + structured-SVG for kvant/DTK** (C9) — was an unhandled gap.
9. **Fixed-enum achievements** (C10).

Net: the revised design is more *honest* (prediction), more *secure* (answer-key handling, server-authority, abuse caps), and more *defensible* (legal). These are the changes that move it from "impressive demo" to "production-ready."

---

## 21. Strategic proposal — Provia HP as an ecosystem leg

Provia HP completes the **Study / Drive / HP** triad and proves a reusable spine: **graph → diagnose → adapt → predict**. The `hp_*` schema and the graph engine are deliberately test-agnostic — the same machinery extends to:
- **Provia HP → other Swedish antagningsprov** (SI, läkar-/juristtester) by swapping the graph + norm tables.
- **International** (SAT/IELTS/GRE) via new graphs — the engine, RLS, quota, P.E.R coach, and prediction loop are unchanged.

Recommendation: build HP on a **`provia-aptitude-core`** mental model (generic engine, test-specific graph+norm data) from day one — costs nothing extra now, and turns each future test from "a rebuild" into "a data pack." This is the moat: competitors sell content; Provia sells a *diagnostic engine* that gets smarter with every attempt across every test.

---

## Phase-1 MVP ship checklist (build next)

- [ ] `hp_schema.sql` migration + `_ROLLBACK.sql`; RLS verified with a 2nd test user (cannot read other's rows)
- [ ] `consume_hp_gen_quota` + REVOKE verified (direct RPC call as authenticated → denied)
- [ ] `graph_nodes/edges.json` for ORD
- [ ] `provia-hp.html` shell + `hp-app.js` router + pvModal gate (`PROVIA_AUTH_REDIRECT='provia-hp.html'`)
- [ ] `api/hp-generate.js` (ESM): ORD strict schema + novelty gate + 2-pass review; answer key withheld pre-submit
- [ ] Adaptive ORD loop + server-authoritative mastery update via `api/hp-diagnose.js`
- [ ] Dashboard mastery readout; design tokens verbatim; mobile 320–375 QA; reduced-motion honored
- [ ] No file >800 lines, no fn >50, no client-side secret, no raw innerHTML of model output
- [ ] Playwright E2E: register → diagnostic → first mastery readout
```
