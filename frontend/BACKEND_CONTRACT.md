# ASAR frontend API integration

Source: docs/api-contract.md, docs/api-examples.md, and the implemented FastAPI routes/schemas in main at 8f93021.

The frontend uses one public client (src/api/client.ts) and native fetch in src/api/httpApi.ts.
VITE_API_URL defaults to http://localhost:8000. All task, catalog, team, rating and proposal data comes from FastAPI. The browser stores only the selected demo role as a UI preference.

## Operation mapping

| Frontend operation | Endpoint | Request | Backend response |
| --- | --- | --- | --- |
| createTask | POST /api/tasks | draft_text, topic | TaskDetail; frontend retains id |
| analyzeDraft | POST /api/ai/analyze-draft | draft, topic | known_fields, missing_fields, questions, source |
| buildTaskCard | POST /api/ai/build-card | draft, topic, questions, answers | card, source |
| confirmTaskCard | PUT /api/tasks/{id}/confirm | card | TaskDetail with score_breakdown |
| publishTask | POST /api/tasks/{id}/publish | no body | TaskDetail with published status |
| getCatalog | GET /api/tasks | status, topic, readiness, sort=score_desc | TaskSummary[] |
| getTask | GET /api/tasks/{id} | id | TaskDetail |
| getTeams | GET /api/teams | no body | Team[] |
| getTaskProposals | GET /api/tasks/{id}/proposals | task id | Proposal[] |
| createProposal | POST /api/tasks/{id}/proposals | team_id, idea, plan, estimated_duration, prototype_url | Proposal |
| updateProposalStatus | PATCH /api/proposals/{id} | accepted or rejected | Proposal |
| getTeamProposals | GET /api/proposals?team_id=... | team_id | Proposal[] |
| getMeta | GET /api/meta | no body | topics, readiness_levels |
| previewRating | POST /api/rating/preview | card | ScoreResult |

## Mapping decisions

- TaskSummary.context_preview maps to the existing catalog context field.
- Team proposal responses are flat: task_title and task_id map to the existing UI task reference.
- Proposal responses include team_name and updated_at.
- Confirm returns TaskDetail; score_breakdown maps to the score panel breakdown field.
- Score, readiness, breakdown and missing_fields are returned by the backend. The frontend only maps level labels.
- Catalog sorting is delegated to the backend; only score_desc is supported.
- An empty prototype URL is sent as null. A team may send multiple proposals on one task.
- PATCH only permits pending -> accepted/rejected and does not modify other proposals.

## AI and errors

The default request timeout is 10 seconds. Analyze-draft and build-card use a 60-second timeout after the reported AI timeout was reproduced.
Backend AI may take up to 20 seconds per generation attempt and retry validation once. The AI client deadline covers both attempts and transport overhead. User input is retained and the failed action can be retried.

Analyze can return source=fallback from the backend. Build-card has no fallback and returns 503 if OpenAI is unavailable.
A 409 INSUFFICIENT_MISSING_FIELDS response skips questions and builds the card with empty question/answer arrays.

ApiError keeps HTTP status, endpoint, server message/detail and validation errors when present.
HTTP failures remain failures; no local success response is substituted.

Runtime verification and the recorded end-to-end result are in PROGRESS.md.