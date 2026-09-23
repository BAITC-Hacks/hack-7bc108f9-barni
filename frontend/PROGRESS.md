# Frontend Progress

## Time
- Task: 2026-09-23 16:41-17:02 +05:00, approximately 21 minutes.
- Budget: 45 minutes; verification and report completed within budget.
- Remaining hackathon time: not supplied in the current task.
- Start: clean main at 8f93021. During verification HEAD became ef778af via an external commit.
- This work did not execute fetch/pull/merge/rebase/checkout/switch/reset/commit/push.

## Completed
- DONE: Real FastAPI integration, 12/12 operations.
- DONE: Mock removal; one public API client; native fetch with 10-second default and 60-second AI timeout (see hotfix below).
- DONE: Explicit backend task ID, retry without losing draft/answers/card.
- DONE: Backend catalog filters and score_desc sorting, real teams and proposals.
- DONE: Backend score/readiness/breakdown/missing_fields are displayed unchanged.
- DONE: Decision status comes from backend; stale submission banner clears on role/task change.
- DONE: Existing ASAR design and routes retained.

## Contract
- docs/api-contract.md and docs/api-examples.md read; routes and schemas checked.
- 12/12 operation formats matched. No request/response schema mismatch found.
- context_preview maps to catalog context; flat task_title/team_name proposal responses mapped for UI.
- getTaskProposals is exposed by the existing public client name getProposals.

| Operation | Status | Live evidence |
| --- | --- | --- |
| createTask | DONE | POST /api/tasks -> 201 |
| analyzeDraft | DONE | POST /api/ai/analyze-draft -> 200; source=model, 5 questions |
| buildTaskCard | DONE | POST /api/ai/build-card -> 200; source=model |
| confirmTaskCard | DONE | PUT /api/tasks/{id}/confirm -> 200; edited card, score=30 |
| publishTask | DONE | POST /api/tasks/{id}/publish -> 200 |
| getCatalog | DONE | GET /api/tasks -> 200; published low-score task visible |
| getTask | DONE | GET /api/tasks/{id} -> 200, also after reload |
| getTeams | DONE | GET /api/teams -> 200; 3 real teams |
| getTaskProposals | DONE | GET /api/tasks/{id}/proposals -> 200 |
| createProposal | DONE | POST /api/tasks/{id}/proposals -> 201; pending |
| updateProposalStatus | DONE | PATCH /api/proposals/{id} -> 200; accepted |
| getTeamProposals | DONE | GET /api/proposals?team_id=... -> 200; accepted, also after reload |

## Mock removal
- DONE: mockApi.ts and mockStore.ts deleted.
- DONE: Runtime frontend seeds, fake IDs/delays, mock/http switch removed.
- DONE: VITE_USE_MOCK_API removed; only VITE_API_URL remains.
- DONE: Business localStorage removed. Only role type/team_id preference is stored; team name comes from API.
- DONE: Frontend rating calculation removed. ScorePanel only totals server potential_points for display.

## Verification
- Local Windows workspace, Docker Desktop and browser were used.
- docker compose up -d --build: PASS; backend running, PostgreSQL healthy.
- After the user added the key, backend was recreated. Only OPENAI_CONFIGURED=yes was checked; no secret value was read or printed.
- API GET smoke: health, meta, teams, empty catalog -> 200 before browser. Detail -> 200 after creation.
- CORS preflight for http://localhost:5173 -> allowed.
- npm run build: PASS after final code fix; TypeScript and Vite production build passed.
- git diff --check: PASS.
- Static checks: no any in integration code, runtime mocks, direct page fetch, direct OpenAI calls, detected secret patterns, or added dependencies.
- Backend, root README, normative docs, Compose and package/lock files unchanged relative to task-start revision.
- Adapter in-memory checks: 12 operations + meta, 422 detail/validation, 404, empty 204 and malformed JSON -> PASS. No extra live mutations.
- Browser console after reload: 0 errors, 0 warnings.
- No screenshots, visual regression, Playwright suite or backend pytest run.
- Rejected decision, multiple simultaneous proposals, slow-network timeout and 2-minute presentation timing were not exercised live.
- Preview remains available at http://localhost:5173; FastAPI at http://localhost:8000.

## End-to-end
- PASS: one scenario; one task and one proposal created.
- Draft: Хотим улучшить обработку заявок клиентов.
- Topic: education.
- Analyze: 5 questions, source=model. Build: source=model.
- No invented contact, deadline or interaction format appeared.
- Edited title and cleared three explicitly unknown fields before final confirmation.
- Final server score: 30/100; readiness=draft; published successfully with 6 missing fields.
- Catalog query checks: status=published, sort=score_desc, topic=education, readiness=draft; reset restored base query.
- Task ID: af45ed39-bf13-400c-b12b-792926ae1e70.
- Team: Team Alpha, 00000000-0000-4000-8000-000000000001.
- Proposal ID: 4ae99447-0ae2-41c2-9e47-777d5c888654.
- Final proposal status: accepted.
- After reload, task, score, proposal and accepted status were fetched again and visible.
- Fixed during smoke: stale pending success banner after role switch. Rebuilt and verified final persisted state.
- CLI empty-string argument issue was resolved by clearing the same fields through Playwright; no second full scenario or additional AI calls.

## Remaining
- BLOCKED: none for frontend integration.
- P0: none found in the exercised flow.
- P1, AI owner: explicit answers such as "Пока неизвестно, доступ к данным не согласован" were copied into card strings, not null. Backend then counted these as filled by its existing word rule (80 before manual clearing, 30 after). Preserve unknowns as null in AI output; frontend did not alter the formula or silently normalize semantics.
- RESOLVED: premature 10-second AI timeout; AI endpoints now allow 60 seconds, normal requests remain at 10 seconds.
- Optional: rehearse the 2-minute demo; not measured by this diagnostic smoke.
- DROPPED: redesign, new dependencies/features, extra test records and repeated AI/full browser runs.

## Design update after integration
- User requested a fast visual refresh: DONE.
- Added Motion and Lucide React; existing dependency versions unchanged.
- Increased spacing, removed decorative section dividers, softened surfaces and enlarged the proposal icon to 28px.
- Added 300ms link/button interactions and three slow ambient shapes with reduced-motion support.
- Kept API client, backend, task/proposal logic and routes unchanged.
- npm run build and git diff --check: PASS.
- Visually checked create/catalog at desktop 1440px and mobile 390px; no horizontal overflow at 390px.
- Browser console: no errors. No AI requests or new business records during design verification.
- Design screenshots: frontend/output/playwright/design-*.png.


## AI timeout hotfix
- User-reported failure: analyze aborted after 10 seconds.
- Root cause: backend AI allows 20 seconds per attempt and a validation retry.
- Fixed only frontend: per-request deadline, 60 seconds for analyze/build; 10 seconds for ordinary calls. Added waiting text; existing retry/data retention preserved.
- Live browser verification: "Нужно автоматизировать поиск клиник в тугисе", topic automation -> HTTP 200, source=model, 5 questions, 15,270 ms through UI.
- In-memory regression checks: analyze/build accept a response after 11 seconds; AI timeout=60,000 ms; create/meta timeout=10,000 ms; errors report correct duration; timers cleared.
- npm run build and git diff --check: PASS. Backend and secrets untouched.
- Rebuilt preview at http://localhost:5173; existing browser tabs need a hard reload.
