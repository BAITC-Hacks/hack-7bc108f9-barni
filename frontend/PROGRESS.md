# Frontend Progress

## Time
- Updated: 2026-09-23 15:20 +05:00.
- Hackathon time remaining: ≈185 minutes (200 minutes reported earlier; live countdown unavailable).
- Reserved for finalization: 30 minutes.
- Available development time: ≈155 minutes.
- Current task budget: 30 minutes; spent: ≈3 minutes since the request to retrieve backend.
- Estimated remaining P0: frontend ≈35–45 minutes after required backend routes exist; backend implementation time is unknown.

## Done
- DONE — `/create`, `/catalog`, `/tasks/:id` and their calls through `TaskApi` are present in code.
- DONE — Mock API and versioned store have five seed tasks, five teams and five proposals.
- DONE — Mock mode remains the default unless `VITE_USE_MOCK_API=false`.
- DONE — Updated `origin/main` and copied only `backend/` from commit `8ade4fe` into this working tree; existing frontend changes were preserved.
- DONE — Compared actual FastAPI routes and Pydantic schemas with frontend usage. The documented contract includes routes absent from the code.

## In Progress
- BLOCKED — Full HTTP adapter requires missing FastAPI routes and agreement on topic and build-card payloads.

## Remaining P0 — обязательно для сдачи
- BLOCKED — Backend developer implements and registers catalog, confirm, publish and proposal routes (estimate: backend owner must provide ETA).
- BLOCKED — Agree on `topic` slug handling and `build-card.questions` in the frontend/backend contract (estimate: 10 minutes with backend owner).
- BLOCKED — Map `TaskApi` to verified routes and response shapes (frontend estimate: 30–40 minutes after backend completion).
- TODO — Build and static integration checks (estimate: 5 minutes).

## Remaining P1 — желательно
- TODO — Add timeout, JSON/error validation and input-preserving HTTP failures when the complete backend is available (estimate: 10 minutes).

## Dropped P2
- DROPPED — API client generation, caching and new interface features (estimate: 45+ minutes).

## Blockers
- Problem: the copied backend registers only task creation/detail, AI analyze/build, metadata and teams; owner: backend developer; required: implement and register catalog, confirm, publish and proposal routes; demo impact: the real end-to-end flow cannot run.
- Problem: `TaskCreate.topic` accepts only six slugs, while `/create` supplies free text; owner: frontend and backend developers; required: agree on a slug mapping or adjust the backend contract; demo impact: real draft creation can return 422.
- Problem: `BuildCardRequest` requires `questions` and `answers`, while the frontend `TaskApi` call supplies only `draft`, `topic`, `answers`; owner: frontend developer after contract agreement; required: pass the questions from analysis; demo impact: real card building returns 422.

## Frontend/backend contract

Statuses describe code in `origin/main` commit `8ade4fe`, not the aspirational document `docs/api-contract.md`.

| Operation | Frontend expects | Backend provides | Status |
|-----------|------------------|------------------|--------|
| Get catalog | Published tasks with topic/readiness filters and rating/date sorting; full card data for current page | No `GET /api/tasks`; only task detail route exists | MISSING |
| Get task | `PublishedTask` with non-null score, breakdown, missing fields and readiness label | `GET /api/tasks/{task_id}` → `TaskOut`; score fields nullable, no readiness label | MISMATCH |
| Get teams | `Team[]` with ID, name, interests, skills and technologies | `GET /api/teams` → same fields plus `points` | MATCH |
| Get proposals | Task ID → `Proposal[]` including team name | No proposal route | MISSING |
| Create proposal | Task ID + team ID, idea, plan, duration, URL → saved `Proposal` | No proposal route | MISSING |
| Update proposal status | Proposal ID + accepted/rejected → updated proposal | No proposal route | MISSING |
| Create draft | Free-text topic and draft → stable task ID | `POST /api/tasks` accepts `draft_text` and `TopicSlug|null`, returns `TaskOut` | MISMATCH |
| Analyze draft | Draft and topic → known fields, missing fields, 3–5 questions | `POST /api/ai/analyze-draft` with matching fields; response has those fields | MATCH |
| Build card | Draft, topic and answers → `TaskCard` | `POST /api/ai/build-card` also requires `questions[]` matching answer IDs | MISMATCH |
| Confirm card | Confirmed card → score and missing fields | No `PUT /api/tasks/{task_id}/confirm` | MISSING |
| Publish task | Confirmed task → published ID and status | No `POST /api/tasks/{task_id}/publish` | MISSING |

## Next

| Priority | Task | Estimate | Dependency |
|----------|------|----------|------------|
| P0 | Backend owner completes and registers missing routes; supplies ETA and example responses | ETA from backend owner | Backend owner |
| P0 | Agree on topic slug and build-card questions, then map the HTTP adapter | 35–45 minutes | Complete backend contract |
| P0 | Run build and static contract checks | 5 minutes | HTTP adapter |
