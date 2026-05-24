---
type: community
cohesion: 0.20
members: 19
---

# API Endpoints

**Cohesion:** 0.20 - loosely connected
**Members:** 19 nodes

## Members
- [[Delete Exams Handler]] - code - api/delete-exams.js
- [[Deterministic MC Grading]] - concept - api/grade.js
- [[Explain Handler]] - code - api/explain.js
- [[Generate Exam Handler]] - code - api/generate-exam.js
- [[Grade Handler]] - code - api/grade.js
- [[Math Detection Logic]] - concept - api/generate-exam.js
- [[OCR Handler]] - code - api/ocr.js
- [[OpenAI v1responses Endpoint]] - concept
- [[Project Architecture Doc]] - concept - CLAUDE.md
- [[Smart Tips Handler]] - code - api/smart-tips.js
- [[Supabase Table user_exams]] - concept - CLAUDE.md
- [[Teacher Report Handler]] - code - api/teacher-report.js
- [[Train Material Handler]] - code - api/train-material.js
- [[Train Material from Mistakes]] - concept - api/train-material.js
- [[Vercel Serverless Config]] - concept - vercel.json
- [[buildMockExamSchema() Function]] - code - api/generate-exam.js
- [[buildNonMcGradeSchema() Function]] - code - api/grade.js
- [[looksLikeMath() Function]] - code - api/generate-exam.js
- [[pickCourseGuide() Function]] - code - api/smart-tips.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/API_Endpoints
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Auth & Admin Handlers]]

## Top bridge nodes
- [[Project Architecture Doc]] - degree 8, connects to 1 community
- [[Delete Exams Handler]] - degree 2, connects to 1 community