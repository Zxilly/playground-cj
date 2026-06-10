# Derive Concept Progress From Evidence And Exposure

Status: done
Type: AFK

## What to build

Implement Concept Progress as a derived state from Review Exposure State and Learning Evidence across Learning Skills. The model must not directly assign progress. The derived states should include unseen, seen, practicing, demonstrated, mastered, blocked, and stale.

## Acceptance criteria

- [x] Concept Progress is computed from Review Exposure State, Learning Evidence, Mastery Evidence, Aided Evidence, Self-Report Evidence, Stale Evidence, and Blocked State rules.
- [x] A single same-context success can demonstrate but cannot master a Concept.
- [x] Aided Evidence is weaker than independent evidence and does not by itself prove mastery.
- [x] Blocked State is triggered by repeated observable failure rules, not model opinion.
- [x] Tests cover every Concept Progress state and the rule boundaries from ADR-0002.

## Blocked by

- `03-rebuilt-classroom-session-model.md`
- `06-template-backed-exercise-flow.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
