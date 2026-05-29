# Graph Report - C:/Users/elton/Desktop/ProvKlarUF  (2026-05-29)

## Corpus Check
- 56 files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 610 edges · 58 communities (45 shown, 13 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin & Role Management|Admin & Role Management]]
- [[_COMMUNITY_Agent Template Config|Agent Template Config]]
- [[_COMMUNITY_Exam Grading Engine|Exam Grading Engine]]
- [[_COMMUNITY_API Routes & Auth Middleware|API Routes & Auth Middleware]]
- [[_COMMUNITY_Serverless Handlers|Serverless Handlers]]
- [[_COMMUNITY_Exam Schema & Course Logic|Exam Schema & Course Logic]]
- [[_COMMUNITY_Claude Flow Hooks|Claude Flow Hooks]]
- [[_COMMUNITY_Vercel Function Config|Vercel Function Config]]
- [[_COMMUNITY_SRS & XP Learning System|SRS & XP Learning System]]
- [[_COMMUNITY_Admin Panel UI|Admin Panel UI]]
- [[_COMMUNITY_Train Material & Schema|Train Material & Schema]]
- [[_COMMUNITY_Performance Metrics|Performance Metrics]]
- [[_COMMUNITY_Claude Agents & Skills|Claude Agents & Skills]]
- [[_COMMUNITY_Environment Variables|Environment Variables]]
- [[_COMMUNITY_App Data Flow|App Data Flow]]
- [[_COMMUNITY_Daemon Config|Daemon Config]]
- [[_COMMUNITY_Security Audit|Security Audit]]
- [[_COMMUNITY_Task Scheduling|Task Scheduling]]
- [[_COMMUNITY_Category Selection UI|Category Selection UI]]
- [[_COMMUNITY_OCR & Image Processing|OCR & Image Processing]]
- [[_COMMUNITY_Agent Metrics A|Agent Metrics A]]
- [[_COMMUNITY_Agent Metrics B|Agent Metrics B]]
- [[_COMMUNITY_Agent Metrics C|Agent Metrics C]]
- [[_COMMUNITY_Agent Metrics D|Agent Metrics D]]
- [[_COMMUNITY_Agent Metrics E|Agent Metrics E]]
- [[_COMMUNITY_Codebase Map|Codebase Map]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Test Coverage Gaps|Test Coverage Gaps]]
- [[_COMMUNITY_Stripe Webhook|Stripe Webhook]]
- [[_COMMUNITY_Agent Metrics F|Agent Metrics F]]
- [[_COMMUNITY_Agent Metrics G|Agent Metrics G]]
- [[_COMMUNITY_Email Templates|Email Templates]]
- [[_COMMUNITY_Daemon State|Daemon State]]
- [[_COMMUNITY_Memory Consolidation|Memory Consolidation]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_User Notifications|User Notifications]]
- [[_COMMUNITY_Vercel & Supabase Deploy|Vercel & Supabase Deploy]]
- [[_COMMUNITY_UI Screenshots|UI Screenshots]]
- [[_COMMUNITY_Design Tokens|Design Tokens]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 57|Community 57]]

## God Nodes (most connected - your core abstractions)
1. `App Page / Exam Wizard (app.html)` - 27 edges
2. `API Route: /api/grade` - 16 edges
3. `claudeFlow` - 14 edges
4. `Generate Exam Handler` - 12 edges
5. `functions` - 10 edges
6. `map` - 9 edges
7. `audit` - 9 edges
8. `optimize` - 9 edges
9. `consolidate` - 9 edges
10. `testgaps` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Generate Exam Handler` --semantically_similar_to--> `API Route: /api/grade`  [INFERRED] [semantically similar]
  api/generate-exam.js → .claude/ARCHITECTURE_MAP.md
- `Admin Approve Handler` --shares_data_with--> `Supabase Table: profiles`  [INFERRED]
  api/admin-approve.js → CLAUDE.md
- `Generate Exam Handler` --produces_data_for--> `Supabase Table: user_exams`  [INFERRED]
  api/generate-exam.js → CLAUDE.md
- `API Route: /api/grade` --calls--> `buildNonMcGradeSchema() Function`  [EXTRACTED]
  .claude/ARCHITECTURE_MAP.md → api/grade.js
- `API Route: /api/grade` --implements--> `Deterministic MC Grading`  [EXTRACTED]
  .claude/ARCHITECTURE_MAP.md → api/grade.js

## Hyperedges (group relationships)
- **Core Exam Flow: Material → Generate → Grade → Mistake Bank** — app_page, api_generate_exam, api_grade, feature_exam_wizard, feature_mistake_bank, openai_integration [EXTRACTED 1.00]
- **Auth & Role System: Supabase Auth + profiles table + role-gated features** — supabase_db, supabase_profiles_table, api_check_role, role_gratis, role_basic, role_premium, role_admin, feature_quota_system [EXTRACTED 1.00]
- **All Frontend Pages** — index_page, app_page, forbattring_page, korkortet_page, pricing_page, live_demo_page, admin_page [EXTRACTED 1.00]
- **Premium-only Features** — feature_improvement_coach, api_smart_tips, api_explain, role_premium [EXTRACTED 1.00]
- **Developer Documentation Set** — claude_md, architecture_map_md, common_mistakes_md, quick_start_md [EXTRACTED 1.00]
- **All Supabase Tables** — supabase_profiles_table, supabase_user_exams_table, supabase_user_profiles_table, supabase_driving_questions_table [EXTRACTED 1.00]
- **Improvement Loop: Exam → Mistakes → Train Mode → Exam** — app_page, feature_mistake_bank, feature_train_mode, forbattring_page, feature_improvement_coach [INFERRED 0.90]

## Communities (58 total, 13 thin omitted)

### Community 0 - "Admin & Role Management"
Cohesion: 0.07
Nodes (43): Admin Action: list-users, Admin Action: set-role, Admin Page (admin.html), API Route: /api/check-approved, API Route: /api/check-role, API Route: /api/smart-tips (Premium only), API Route: /api/teacher-report, API Route: /api/train-material (+35 more)

### Community 1 - "Agent Template Config"
Cohesion: 0.05
Nodes (44): autoGenerate, directory, template, enabled, claudeFlow, adr, ddd, enabled (+36 more)

### Community 2 - "Exam Grading Engine"
Cohesion: 0.05
Nodes (26): answerMap, byId, chosenIndex, chosenLetter, chunks, errorTags, got, history (+18 more)

### Community 3 - "API Routes & Auth Middleware"
Cohesion: 0.12
Nodes (31): API Route: /api/admin, API Middleware: api/_auth.js, Delete Exams Handler, API Route: /api/explain (Premium only), API Route: /api/generate-exam, Generate Exam Handler, API Route: /api/grade, API Route: /api/ocr (+23 more)

### Community 4 - "Serverless Handlers"
Cohesion: 0.10
Nodes (19): handler(), requireAdmin(), supabase, VALID_ROLES, requireAuth(), supabase, supabase, PRICE_IDS (+11 more)

### Community 5 - "Exam Schema & Course Logic"
Cohesion: 0.09
Nodes (15): course, isMath, json(), lang, level, model, numQuestions, numQuestionsRaw (+7 more)

### Community 6 - "Claude Flow Hooks"
Cohesion: 0.11
Nodes (19): coordination, enabled, hooks, mailboxEnabled, taskListEnabled, teammateMode, agentTeams, autoAssignOnIdle (+11 more)

### Community 7 - "Vercel Function Config"
Cohesion: 0.13
Nodes (18): maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, maxDuration (+10 more)

### Community 8 - "SRS & XP Learning System"
Cohesion: 0.20
Nodes (14): addXP(), DAILY_KEY(), detectMemorization(), getDailyProgress(), getDueCount(), getDueQuestions(), getSeenToday(), getSrs() (+6 more)

### Community 9 - "Admin Panel UI"
Cohesion: 0.19
Nodes (16): Admin HTML Page, Admin Approve Handler, Check Role Handler, Notify New User Handler, API Route: /api/signup, User Role System (gratis/basic/premium/admin), Supabase Table: driving_questions, Supabase Table: profiles (+8 more)

### Community 10 - "Train Material & Schema"
Cohesion: 0.14
Nodes (8): chunks, lang, last, model, payload, raw, responseFormat, userPayload

### Community 11 - "Performance Metrics"
Cohesion: 0.14
Nodes (13): memoryUsage, arrayBuffers, external, heapTotal, heapUsed, rss, mode, note (+5 more)

### Community 12 - "Claude Agents & Skills"
Cohesion: 0.18
Nodes (13): RuFlo V3 CAPABILITIES — 60+ agents, 26 CLI commands, 140+ subcommands, 27 hooks, HNSW vector search, SONA neural learning, Byzantine fault tolerance, RuFlo V3 config.yaml — mesh topology, max 5 agents, memory backend, HNSW/neural/learningBridge disabled, hooks enabled, MCP port 3000, Skill Builder — creates Claude Code Skills with YAML frontmatter and progressive disclosure structure, Skill Builder Spec — 3-level progressive disclosure (metadata/body/referenced files), directory layout, validation checklist, SPARC Methodology — Specification-Pseudocode-Architecture-Refinement-Completion development framework with 17 modes and multi-agent orchestration, SPARC Modes — orchestrator, coder, architect, tdd, reviewer, researcher, analyzer, optimizer, designer, documenter, debugger, memory-manager, Stream-Chain — multi-step sequential workflows where each agent output feeds the next; supports custom chains and predefined pipelines, Stream-Chain Pipelines — built-in pipelines: analysis, refactor, test, optimize; configurable via .claude-flow/config.json (+5 more)

### Community 13 - "Environment Variables"
Cohesion: 0.18
Nodes (10): env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, CLAUDE_FLOW_HOOKS_ENABLED, CLAUDE_FLOW_V3_ENABLED, permissions, allow, deny, statusLine (+2 more)

### Community 14 - "App Data Flow"
Cohesion: 0.22
Nodes (11): App Data Flow (app.html to APIs), Grant Role Command, Users Command, 350 Curated Korkortet Questions, Admin Panel (admin.html), Core App Page (app.html), Feedback/Improvement Page (forbattring.html), Driver License Quiz Page (korkortet.html) (+3 more)

### Community 15 - "Daemon Config"
Cohesion: 0.20
Nodes (10): config, autoStart, logDir, maxConcurrent, resourceThresholds, stateFile, workers, workerTimeoutMs (+2 more)

### Community 16 - "Security Audit"
Cohesion: 0.20
Nodes (9): checks, envFilesProtected, gitIgnoreExists, noHardcodedSecrets, mode, note, recommendations, riskLevel (+1 more)

### Community 17 - "Task Scheduling"
Cohesion: 0.20
Nodes (10): interval, priority, daemon, autoStart, schedules, workers, interval, priority (+2 more)

### Community 18 - "Category Selection UI"
Cohesion: 0.20
Nodes (8): catSelect, countText, found, NEW_CATS, nodOption, optBtns, startBtn, tunnelOption

### Community 19 - "OCR & Image Processing"
Cohesion: 0.25
Nodes (7): chunks, imageDataUrl, json(), model, payload, raw, requireAuth()

### Community 20 - "Agent Metrics A"
Cohesion: 0.22
Nodes (9): averageDurationMs, failureCount, isRunning, lastRun, lastStartedAt, nextRun, runCount, successCount (+1 more)

### Community 21 - "Agent Metrics B"
Cohesion: 0.22
Nodes (9): averageDurationMs, failureCount, isRunning, lastRun, lastStartedAt, nextRun, runCount, successCount (+1 more)

### Community 22 - "Agent Metrics C"
Cohesion: 0.22
Nodes (9): averageDurationMs, failureCount, isRunning, lastRun, lastStartedAt, nextRun, runCount, successCount (+1 more)

### Community 23 - "Agent Metrics D"
Cohesion: 0.22
Nodes (9): averageDurationMs, failureCount, isRunning, lastRun, lastStartedAt, nextRun, runCount, successCount (+1 more)

### Community 24 - "Agent Metrics E"
Cohesion: 0.22
Nodes (9): averageDurationMs, failureCount, isRunning, lastRun, lastStartedAt, nextRun, runCount, successCount (+1 more)

### Community 25 - "Codebase Map"
Cohesion: 0.22
Nodes (8): projectRoot, scannedAt, structure, hasClaudeConfig, hasClaudeFlow, hasPackageJson, hasTsConfig, timestamp

### Community 26 - "Package Dependencies"
Cohesion: 0.25
Nodes (7): dependencies, @supabase/supabase-js, devDependencies, playwright, name, private, version

### Community 27 - "Test Coverage Gaps"
Cohesion: 0.29
Nodes (6): estimatedCoverage, gaps, hasTestDir, mode, note, timestamp

### Community 28 - "Stripe Webhook"
Cohesion: 0.47
Nodes (5): handler(), PLAN_ROLES, readRawBody(), supabase, verifyStripeSignature()

### Community 29 - "Agent Metrics F"
Cohesion: 0.33
Nodes (6): averageDurationMs, failureCount, isRunning, runCount, successCount, document

### Community 30 - "Agent Metrics G"
Cohesion: 0.33
Nodes (6): averageDurationMs, failureCount, isRunning, runCount, successCount, predict

### Community 31 - "Email Templates"
Cohesion: 0.60
Nodes (4): buildWelcomeHtml(), escapeHtml(), handler(), supabase

### Community 32 - "Daemon State"
Cohesion: 0.40
Nodes (4): running, savedAt, startedAt, workers

### Community 34 - "Memory Consolidation"
Cohesion: 0.40
Nodes (4): duplicatesRemoved, memoryCleaned, patternsConsolidated, timestamp

### Community 35 - "Brand Identity"
Cohesion: 0.67
Nodes (4): Brand Identity (ProviaAI / ProvKlar), ProviaAI Hero Image, ProviaAI Logo, ProvKlar Logo

### Community 37 - "Vercel & Supabase Deploy"
Cohesion: 0.67
Nodes (3): Vercel Serverless Architecture, Supabase Schema (profiles, user_exams), Deploy Command

### Community 38 - "UI Screenshots"
Cohesion: 0.67
Nodes (3): UI: Provia category selector — 'Vägtunnlar' category highlighted (green border), dark luxury theme, 416-question pool across 16+ categories, UI: Provia full category page — category grid + provkonfiguration panel (10 frågor, Alla nivåer) + 'Starta körkortstest' CTA button, UI: Provia category page with 'Alla kategorier' selected (green border) — full category grid loaded, 416 total questions visible

### Community 39 - "Design Tokens"
Cohesion: 0.67
Nodes (3): Green Accent #1bff8c, Design Tokens (color, typography), Brand Tone (Sharp, Focused, Swedish)

## Knowledge Gaps
- **275 isolated node(s):** `name`, `version`, `private`, `@supabase/supabase-js`, `supabase` (+270 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App Page / Exam Wizard (app.html)` connect `Admin & Role Management` to `Admin Panel UI`, `API Routes & Auth Middleware`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `API Route: /api/grade` connect `API Routes & Auth Middleware` to `Admin & Role Management`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `App Page / Exam Wizard (app.html)` (e.g. with `API Route: /api/ocr` and `Landing Page (index.html)`) actually correct?**
  _`App Page / Exam Wizard (app.html)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `API Route: /api/grade` (e.g. with `Generate Exam Handler` and `Supabase Table: user_exams`) actually correct?**
  _`API Route: /api/grade` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `Generate Exam Handler` (e.g. with `Supabase Table: user_exams` and `Train Material Handler`) actually correct?**
  _`Generate Exam Handler` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _293 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin & Role Management` be split into smaller, more focused modules?**
  _Cohesion score 0.07188160676532769 - nodes in this community are weakly interconnected._