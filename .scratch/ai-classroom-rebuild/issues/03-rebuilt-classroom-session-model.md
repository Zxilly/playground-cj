# Replace Classroom Session With Rebuilt Model

Status: done
Type: AFK

## What to build

Replace the current AI Classroom session model with the rebuilt domain model. The session should store Classroom Stream entries as Content Reference Groups, Bridge Notes, Skip Markers, Retention Markers, Exercise Instances, run/submission attempts, Learning Evidence, Review Artifacts, Review Exposure State, and enough track state to support the default Learning Track now and multiple tracks later.

## Acceptance criteria

- [x] New sessions start from the rebuilt model and do not preserve old persisted session compatibility.
- [x] Classroom Stream can store Content Reference Groups, Exercise Instances, Bridge Notes, Skip Markers, Retention Markers, and system markers without embedding copied Core Content text.
- [x] Learning Evidence is skill-level and can represent independent evidence, Aided Evidence, Self-Report Evidence, Mastery Evidence, Stale Evidence, and failed attempts.
- [x] Review Artifacts are separate from learner progress state and can reference Concepts, evidence, and retained content.
- [x] Tests cover creation, persistence, schema validation, reduction/transition behavior, and rejection of old session shape.

## Blocked by

- `01-course-content-pack-schema-and-validation.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
