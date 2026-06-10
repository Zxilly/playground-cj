# Define Course Content Pack Schema And Validation

Status: done
Type: AFK

## What to build

Define the reusable Course Content Pack model that AI Classroom will use as the source of Core Content. The slice should make Course Content Packs, Core Content Blocks, Source References, Content Versions, Validated Content, Validated Concepts, Read-Only Concepts, Learning Skills, Exercise Templates, and Content Pack Validation concrete enough that later slices can load and trust them.

## Acceptance criteria

- [x] Course Content Pack data can represent concept-organized Core Content Blocks with stable identity, Content Version, Source References, and default block ordering.
- [x] Validation distinguishes Validated Concepts, Read-Only Concepts, and invalid/draft concepts based on required content, Learning Skill, Exercise Template, and source metadata.
- [x] Validation fails fast with actionable diagnostics for missing links, duplicate ids, invalid content shape, missing Source References, and non-runnable examples that are not explicitly marked.
- [x] Tests cover valid packs, read-only concepts, invalid packs, duplicate ids, missing source metadata, and block ordering.
- [x] ADR-0001 terminology is reflected in public type and test names.

## Blocked by

None - can start immediately.
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
