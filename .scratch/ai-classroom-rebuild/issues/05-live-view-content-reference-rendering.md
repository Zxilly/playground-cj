# Render Live View From Content References

Status: done
Type: AFK

## What to build

Update Live View so it renders the Classroom Stream from Core Content References and learner-specific stream entries rather than copied or model-authored lesson text. The view should resolve Content Reference Groups against Course Content Packs, render Bridge Notes around them, show Exercise Instances, and preserve clear boundaries between reusable Core Content and personalization.

## Acceptance criteria

- [x] Live View renders Content Reference Groups by resolving Core Content References from validated Course Content Packs.
- [x] Bridge Notes, Skip Markers, Retention Markers, and Exercise Instances render as distinct stream items with clear semantics.
- [x] Core Content text is not duplicated into session state.
- [x] Skipped Core Content can be explained with a Skip Marker when needed and remains available for Review View later.
- [x] Tests cover reference resolution, missing/invalid references, content version display, Bridge Note placement, and no copied Core Content in persisted session snapshots.

## Blocked by

- `02-default-entry-learning-track-content-pack.md`
- `03-rebuilt-classroom-session-model.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
