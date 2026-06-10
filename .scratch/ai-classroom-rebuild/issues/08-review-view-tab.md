# Implement Concept-Based Review View

Status: done
Type: AFK

## What to build

Add Review View as a tab inside AI Classroom. Review View should organize study material by Concept, showing Core Content, Review Exposure State, Review Artifact Groups, retained Clarifications, Remediations, and Review Checks without replaying the full Live View timeline.

## Acceptance criteria

- [x] AI Classroom exposes Live View and Review View within the same experience.
- [x] Review View groups material by Concept and can show seen, skipped, and unseen Core Content distinctly from Concept Progress.
- [x] Review Artifact Groups merge Clarifications by concept/misconception theme and aggregate Remediations while preserving evidence links.
- [x] Review Checks can be created from Exercise Templates and update evidence/progress without automatically leaving Review View.
- [x] Tests cover concept grouping, exposure state display, retained item removal/hiding, Review Check success/failure, and no raw timeline replay.

## Blocked by

- `03-rebuilt-classroom-session-model.md`
- `05-live-view-content-reference-rendering.md`
- `06-template-backed-exercise-flow.md`
- `07-derived-concept-progress.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
