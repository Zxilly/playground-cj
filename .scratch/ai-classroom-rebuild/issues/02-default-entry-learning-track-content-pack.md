# Build Default Entry Learning Track Content Pack

Status: done
Type: AFK

## What to build

Create the first validated Course Content Pack from the Static Tour for the default entry Learning Track. This slice should cover only the smallest useful path through the beginning of AI Classroom while proving that Static Tour material can become reusable Core Content Blocks without creating a separate AI-only course.

## Acceptance criteria

- [x] The default entry Learning Track has validated Course Content Blocks for the initial Concepts needed to start AI Classroom.
- [x] Each Core Content Block traces back to Static Tour through Source References and carries a Content Version.
- [x] The pack includes Learning Skills and Exercise Templates for the Concepts that are intended to drive mainline tutoring.
- [x] Content Pack Validation passes for the default entry track and rejects intentionally malformed fixture data.
- [x] Tests prove the pack can be loaded, validated, and queried by Concept and Learning Skill.

## Blocked by

- `01-course-content-pack-schema-and-validation.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
