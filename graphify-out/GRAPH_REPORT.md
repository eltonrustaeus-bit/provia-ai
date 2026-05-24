# Graph Report - C:\Users\elton\Desktop\ProvKlarUF  (2026-05-24)

## Corpus Check
- 34 files · ~160,687 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 212 nodes · 211 edges · 36 communities (19 shown, 17 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Grading Logic Internals|Grading Logic Internals]]
- [[_COMMUNITY_Exam Generation Logic|Exam Generation Logic]]
- [[_COMMUNITY_API Endpoints|API Endpoints]]
- [[_COMMUNITY_Train Material API|Train Material API]]
- [[_COMMUNITY_Vercel Serverless Config|Vercel Serverless Config]]
- [[_COMMUNITY_Auth & Admin Handlers|Auth & Admin Handlers]]
- [[_COMMUNITY_Product Context & Commands|Product Context & Commands]]
- [[_COMMUNITY_AI Grading & Exam Pipeline|AI Grading & Exam Pipeline]]
- [[_COMMUNITY_OCR Image Processing|OCR Image Processing]]
- [[_COMMUNITY_Role & Auth System|Role & Auth System]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Smart Tips API|Smart Tips API]]
- [[_COMMUNITY_Brand & Visual Identity|Brand & Visual Identity]]
- [[_COMMUNITY_Check Role API|Check Role API]]
- [[_COMMUNITY_Delete Exams API|Delete Exams API]]
- [[_COMMUNITY_Explain API|Explain API]]
- [[_COMMUNITY_Notify New User API|Notify New User API]]
- [[_COMMUNITY_Signup API|Signup API]]
- [[_COMMUNITY_Teacher Report API|Teacher Report API]]
- [[_COMMUNITY_Vercel & Supabase Infrastructure|Vercel & Supabase Infrastructure]]
- [[_COMMUNITY_Cleanup Command|Cleanup Command]]
- [[_COMMUNITY_Grade Handler Core|Grade Handler Core]]
- [[_COMMUNITY_Generate Exam Core|Generate Exam Core]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]

## God Nodes (most connected - your core abstractions)
1. `Grade Handler` - 9 edges
2. `Project Architecture Doc` - 8 edges
3. `functions` - 7 edges
4. `Generate Exam Handler` - 7 edges
5. `Vercel Serverless Config` - 6 edges
6. `Train Material Handler` - 6 edges
7. `Smart Tips Handler` - 5 edges
8. `Supabase Table: profiles` - 5 edges
9. `Generate Exam Handler` - 5 edges
10. `ProviaAI Product Context` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Generate Exam Handler` --produces_data_for--> `Supabase Table: user_exams`  [INFERRED]
  api/generate-exam.js → CLAUDE.md
- `Grade Handler` --produces_data_for--> `Supabase Table: user_exams`  [INFERRED]
  api/grade.js → CLAUDE.md
- `Notify New User Handler` --reads--> `Supabase Table: profiles`  [INFERRED]
  api/notify-new-user.js → CLAUDE.md
- `Signup Handler` --triggers_create--> `Supabase Table: profiles`  [INFERRED]
  api/signup.js → CLAUDE.md
- `Project Architecture Doc` --documents--> `Generate Exam Handler`  [EXTRACTED]
  CLAUDE.md → api/generate-exam.js

## Hyperedges (group relationships)
- **AI Exam Generation and Grading Pipeline** — generate_exam_handler, grade_handler, smart_tips_handler, openai_responses_endpoint [INFERRED 0.95]
- **Authentication and Role Management** — signup_handler, check_role_handler, admin_approve_handler, supabase_profiles_table, role_system [INFERRED 0.90]
- **Frontend Pages** — page_index, page_app, page_korkortet, page_pricing, page_forbattring, page_admin, page_live_demo [EXTRACTED 1.00]
- **Claude Admin Commands** — cmd_cleanup, cmd_deploy, cmd_grant, cmd_users [EXTRACTED 1.00]

## Communities (36 total, 17 thin omitted)

### Community 0 - "Grading Logic Internals"
Cohesion: 0.05
Nodes (24): answerMap, byId, chosenIndex, chosenLetter, chunks, errorTags, got, history (+16 more)

### Community 1 - "Exam Generation Logic"
Cohesion: 0.09
Nodes (13): course, isMath, lang, level, model, numQuestions, numQuestionsRaw, pastedText (+5 more)

### Community 2 - "API Endpoints"
Cohesion: 0.20
Nodes (19): Delete Exams Handler, Explain Handler, Generate Exam Handler, Grade Handler, OCR Handler, Smart Tips Handler, Teacher Report Handler, Train Material Handler (+11 more)

### Community 3 - "Train Material API"
Cohesion: 0.14
Nodes (8): chunks, lang, last, model, payload, raw, responseFormat, userPayload

### Community 4 - "Vercel Serverless Config"
Cohesion: 0.14
Nodes (13): maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, maxDuration, functions, api/explain.js (+5 more)

### Community 5 - "Auth & Admin Handlers"
Cohesion: 0.23
Nodes (14): Admin HTML Page, Admin Approve Handler, Check Role Handler, Notify New User Handler, Signup Handler, User Role System (gratis/basic/premium/admin), Supabase Table: driving_questions, Supabase Table: profiles (+6 more)

### Community 6 - "Product Context & Commands"
Cohesion: 0.22
Nodes (11): App Data Flow (app.html to APIs), Grant Role Command, Users Command, 350 Curated Korkortet Questions, Admin Panel (admin.html), Core App Page (app.html), Feedback/Improvement Page (forbattring.html), Driver License Quiz Page (korkortet.html) (+3 more)

### Community 7 - "AI Grading & Exam Pipeline"
Cohesion: 0.20
Nodes (11): Mock Exam JSON Schema Builder, Generate Exam Handler, Math Detection looksLikeMath, Grade Handler, MC Deterministic Grading, Non-MC AI Grading, OpenAI v1 responses API, Course Specific Guide Selector (+3 more)

### Community 8 - "OCR Image Processing"
Cohesion: 0.25
Nodes (5): chunks, imageDataUrl, model, payload, raw

### Community 9 - "Role & Auth System"
Cohesion: 0.33
Nodes (6): Admin Approve Handler, Check Role Handler, Role System gratis basic premium admin, Signup Handler, Resend Email Notification, Supabase Profiles Table

### Community 10 - "NPM Dependencies"
Cohesion: 0.33
Nodes (5): dependencies, @supabase/supabase-js, name, private, version

### Community 11 - "Smart Tips API"
Cohesion: 0.70
Nodes (4): handler(), normalizeCourse(), pickCourseGuide(), safeString()

### Community 12 - "Brand & Visual Identity"
Cohesion: 0.67
Nodes (4): Brand Identity (ProviaAI / ProvKlar), ProviaAI Hero Image, ProviaAI Logo, ProvKlar Logo

### Community 19 - "Vercel & Supabase Infrastructure"
Cohesion: 0.67
Nodes (3): Vercel Serverless Architecture, Supabase Schema (profiles, user_exams), Deploy Command

### Community 20 - "Cleanup Command"
Cohesion: 0.67
Nodes (3): Green Accent #1bff8c, Design Tokens (color, typography), Brand Tone (Sharp, Focused, Swedish)

## Knowledge Gaps
- **89 isolated node(s):** `name`, `version`, `private`, `@supabase/supabase-js`, `maxDuration` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Project Architecture Doc` connect `API Endpoints` to `Auth & Admin Handlers`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Grade Handler` (e.g. with `Supabase Table: user_exams` and `Smart Tips Handler`) actually correct?**
  _`Grade Handler` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Generate Exam Handler` (e.g. with `Supabase Table: user_exams` and `Train Material Handler`) actually correct?**
  _`Generate Exam Handler` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Grading Logic Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Exam Generation Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Train Material API` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._