---
type: community
cohesion: 0.23
members: 14
---

# Auth & Admin Handlers

**Cohesion:** 0.23 - loosely connected
**Members:** 14 nodes

## Members
- [[Add Questions Batch2 Script]] - code - scripts/add_questions_batch2.py
- [[Admin Approve Handler]] - code - api/admin-approve.js
- [[Admin HTML Page]] - concept - admin.html
- [[Check Role Handler]] - code - api/check-role.js
- [[Insert Questions Script]] - code - scripts/insert_questions.py
- [[Notify New User Handler]] - code - api/notify-new-user.js
- [[ProviaAI Package]] - concept - package.json
- [[Questions JSON Data]] - concept - scripts/questions.json
- [[Resend Email API]] - concept
- [[Signup Handler]] - code - api/signup.js
- [[Supabase Backend]] - concept
- [[Supabase Table driving_questions]] - concept - scripts/insert_questions.py
- [[Supabase Table profiles]] - concept - CLAUDE.md
- [[User Role System (gratisbasicpremiumadmin)]] - concept - CLAUDE.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Auth__Admin_Handlers
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_API Endpoints]]

## Top bridge nodes
- [[Supabase Backend]] - degree 9, connects to 1 community
- [[Supabase Table profiles]] - degree 5, connects to 1 community
- [[User Role System (gratisbasicpremiumadmin)]] - degree 3, connects to 1 community