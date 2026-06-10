# Scope Chat To Live And Review Contexts With Retention Decisions

Status: done
Type: AFK

## What to build

Update Chat so raw conversation history remains temporary and long-term personalization only comes from structured Retention Decisions. Chat should understand whether it is operating in Live View or Review View, scope Review View Chat to the active reviewed Concept, and retain Clarifications or Remediations only through structured tools.

## Acceptance criteria

- [x] Raw Chat history is not stored as long-term personalization state.
- [x] Review View Chat reads the active reviewed Concept, Core Content, Review Artifacts, and evidence summaries instead of the full Live View timeline.
- [x] Retention Decisions save structured Clarifications, Read-Only Clarifications, Remediations, or Retention Markers according to Concept validation state.
- [x] Retained Item Control removes review content and personalization indexes without deleting unrelated Learning Evidence.
- [x] Tests cover Live View Chat, Review View Chat, Out-of-Pack Help, retained Clarification, Read-Only Clarification, Remediation Content removal, and Code Suggestion evidence boundaries.

## Blocked by

- `03-rebuilt-classroom-session-model.md`
- `08-review-view-tab.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
