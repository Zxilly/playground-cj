# Rebuild Lesson Orchestrator Tools

Status: done
Type: AFK

## What to build

Rebuild lesson-generation around the Lesson Orchestrator role. Remove tools that let the model author Core Content directly and replace them with tools that can only select validated content, append Content Reference Groups, create Bridge Notes, create template-backed Exercise Instances, save Clarifications, save Remediations, and emit Retention Markers.

## Acceptance criteria

- [x] The Lesson Orchestrator cannot append arbitrary Core Content paragraphs, concept cards, code examples, or ad hoc exercises.
- [x] Content reference tools only accept validated Core Content Blocks and preserve Course Content Pack ordering unless an explicit Track Adjustment is represented.
- [x] Exercise tools require a selected Exercise Template before creating an Exercise Instance.
- [x] Retention tools create structured Clarifications, Read-Only Clarifications, Remediations, and Retention Markers without storing raw Chat history.
- [x] Tests cover rejected invalid references, rejected unvalidated Concepts, rejected untemplate-backed exercises, valid orchestration paths, and tool prompt/surface constraints.

## Blocked by

- `01-course-content-pack-schema-and-validation.md`
- `03-rebuilt-classroom-session-model.md`
## Completion

Implemented in the AI Classroom full rebuild. Verified with pnpm exec tsc --noEmit --pretty false, pnpm test:run, pnpm lint, and agent-browser smoke testing on http://localhost:3000/zh/tour/ai.
