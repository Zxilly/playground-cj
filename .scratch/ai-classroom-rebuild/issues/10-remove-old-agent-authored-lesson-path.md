# Remove Old Agent-Authored Lesson Path

Status: done
Type: AFK

## What to build

Remove the old AI Mode path where the model authored lesson content directly. The rebuilt mainline should require validated content references and template-backed exercises throughout, with no compatibility mode for old persisted sessions because the feature has not shipped to mainline.

## Acceptance criteria

- [x] Old lesson authoring tools are removed or unreachable from lesson-generation.
- [x] Old session compatibility and migration paths are removed unless needed only by tests for explicit rejection.
- [x] Tests and snapshots no longer expect model-authored Core Content as the mainline path.
- [x] Documentation and prompts consistently describe the model as a Lesson Orchestrator, not a tutorial generator.
- [x] Full targeted AI Classroom tests, type checks, and lint pass after the old path is removed.

## Blocked by

- `04-lesson-orchestrator-tools.md`
- `05-live-view-content-reference-rendering.md`
- `06-template-backed-exercise-flow.md`
- `07-derived-concept-progress.md`
- `08-review-view-tab.md`
- `09-scoped-chat-and-retention.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
