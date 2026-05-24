---
type: community
cohesion: 0.20
members: 11
---

# AI Grading & Exam Pipeline

**Cohesion:** 0.20 - loosely connected
**Members:** 11 nodes

## Members
- [[Course Specific Guide Selector]] - code - api/smart-tips.js
- [[Generate Exam Handler_1]] - code - api/generate-exam.js
- [[Grade Handler_1]] - code - api/grade.js
- [[MC Deterministic Grading]] - code - api/grade.js
- [[Math Detection looksLikeMath]] - code - api/generate-exam.js
- [[Mock Exam JSON Schema Builder]] - code - api/generate-exam.js
- [[Non-MC AI Grading]] - code - api/grade.js
- [[OpenAI v1 responses API]] - rationale - api/generate-exam.js
- [[Smart Tips Handler_1]] - code - api/smart-tips.js
- [[Teacher Report Handler_1]] - code - api/teacher-report.js
- [[Vercel Serverless Functions]] - rationale - vercel.json

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/AI_Grading__Exam_Pipeline
SORT file.name ASC
```
