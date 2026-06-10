# AI Classroom Rebuild Decision Log

This file records the user's implementation direction for autonomous work.

## Execution Instruction

- The user asked the agent to execute fully autonomously until the AI Mode rebuild is complete.
- The user will leave the terminal; the agent should decide implementation details and continue without asking for more confirmation.
- After implementation, the agent must test the functionality with agent-browser.
- The agent should record the user's instructions and decisions.

## Current Implementation Direction

- Implement a complete AI Mode rebuild, not a phased migration.
- Do not preserve old persisted AI Classroom sessions because the feature has not shipped to mainline.
- Do not keep the old agent-authored lesson generation path as a compatibility mode.
- The rebuilt mainline must require validated Course Content References and template-backed Exercise Instances throughout.
- Lesson-generation tools must become orchestration tools, not Core Content authoring tools.
- Code Suggestion remains Chat assistance and only becomes evidence after the learner applies it and creates an observable attempt.
- Concept Progress is derived from Review Exposure State and Learning Evidence, not directly assigned by the model.
- Raw Chat history does not participate in long-term personalization unless converted into structured retained state by a Retention Decision.
- The rebuilt data model should support multiple Learning Tracks; the first UI can expose only the default track.

## Source Documents

- `CONTEXT.md`
- `docs/adr/0001-ai-classroom-content-and-review-model.md`
- `docs/adr/0002-progress-derived-from-learning-evidence.md`
- `.scratch/ai-classroom-rebuild/issues/`

## User Direction Transcript

- `$grill-with-docs 分析一下当前的 AI Mode 的整体设计，教程真的有必要每次重复生成吗？怎么在确保复用的同时做到个性化呢？`
- `我还有个问题，是应该做一整个连续的流还是每个章节开个新的页面？`
- `我是已经这么做了，但是我不清楚这么设计好不好。例如，用户对一个概念不清晰，应该在哪里解释？解释了以后是不是对于用户来说以后复习的时候看到这里是不是等于看了两遍？`
- `可行`
- `进 chat`
- `让模型自己决策要不要调用工具`
- The user repeatedly confirmed with `ok`; those confirmations were treated as permission to continue the chosen direction.
- `不对，要做完整重构，刚刚的那些先不做的都取消，一次性全部完成`
- `直接不管，还没合并到主线，在开发中`
- `加载 superpower 相关的 skill，准备开始实现`
- `用本地 markdown issue`
- `现在开始，全自主决定执行，直到完成重构为止，我离开终端了，你需要完全自己计划实现，直到完全实现再向我报告。实现后要 agent browser 测试功能。记录我说的所有内容。`

## Completion Verification

- `pnpm exec tsc --noEmit --pretty false` passed.
- `pnpm test:run` passed: 83 test files, 372 tests.
- `pnpm lint` passed with 0 errors; existing React rule warnings remain.
- Production-path scan found no old quiz / direct lesson-authoring tool names in `src/features/tour-ai`, `src/lib/ai`, `src/lib/monaco`, or `src/modules`.
- agent-browser tested `http://localhost:3000/zh/tour/ai`: page loaded, validated Course Content References rendered in Live View, Exercise Instance rendered, Review View grouped concepts and Core Content, Chat overlay opened, exercise run entered result state, and `agent-browser errors` reported no page errors.
