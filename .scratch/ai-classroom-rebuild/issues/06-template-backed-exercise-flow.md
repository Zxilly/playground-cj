# Replace Practice Flow With Template-Backed Exercise Instances

Status: done
Type: AFK

## What to build

Replace the current concept-level practice flow with Exercise Templates and Exercise Instances. Exercise Instances should anchor attempts, run/submission results, Aided Evidence, Remediations, Review Checks, Placement Checks, and skill-level Learning Evidence.

## Acceptance criteria

- [x] Every mainline practice task is created from an Exercise Template and records template identity, version, Personalization Inputs summary, generated task, and creation time.
- [x] Run/submission attempts attach to Exercise Instances and produce skill-level Learning Evidence rather than direct Concept Progress updates.
- [x] Code Suggestions are tracked as assistance and successful submissions after meaningful assistance create Aided Evidence.
- [x] Placement Checks and Review Checks are represented as Exercise Instances with distinct intent.
- [x] Tests cover independent success, aided success, failure/remediation, skipped/abandoned attempts, placement checks, review checks, and reproducibility metadata.

## Blocked by

- `02-default-entry-learning-track-content-pack.md`
- `03-rebuilt-classroom-session-model.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
