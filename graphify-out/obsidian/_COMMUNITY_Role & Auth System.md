---
type: community
cohesion: 0.33
members: 6
---

# Role & Auth System

**Cohesion:** 0.33 - loosely connected
**Members:** 6 nodes

## Members
- [[Admin Approve Handler_1]] - code - api/admin-approve.js
- [[Check Role Handler_1]] - code - api/check-role.js
- [[Resend Email Notification]] - code - api/signup.js
- [[Role System gratis basic premium admin]] - rationale - api/check-role.js
- [[Signup Handler_1]] - code - api/signup.js
- [[Supabase Profiles Table]] - rationale - api/check-role.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Role__Auth_System
SORT file.name ASC
```
