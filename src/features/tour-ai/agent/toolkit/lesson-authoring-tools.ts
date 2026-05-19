import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { lessonContentBlockSchema, markdownBodySchema, richTextSchema } from '@/lib/ai/classroom/schema'
import type { LessonContentBlock } from '@/lib/ai/classroom/types'
import { failWithRetryHint } from '../fail-with-retry-hint'
import { fail, ok } from './results'
import { requireClassroom } from './shared'

const SET_CURRENT_QUIZ_EXAMPLE = {
  conceptId: 'concept_id',
  prompt: 'Write a function that returns the sum of two integers.',
  starterCode: 'func add(a: Int64, b: Int64): Int64 { 0 }',
  expectedOutput: '7',
  matchMode: 'exact' as const,
}

const APPEND_HEADING_EXAMPLE = { text: 'Section title', level: 2 as const }
const APPEND_PARAGRAPH_EXAMPLE = { body: 'Cangjie supports **type inference** for most expressions; write `let x = 25` and the type is deduced.' }
const APPEND_CONCEPT_CARD_EXAMPLE = {
  conceptId: 'variables_constants',
  title: 'Variables and constants',
  body: 'Use `let` for immutable bindings and `var` when you need to reassign.',
}
const APPEND_CODE_EXAMPLE_EXAMPLE = { code: 'let x = 25', title: 'Declaring a variable', language: 'cangjie' }
const APPEND_CALLOUT_EXAMPLE = {
  tone: 'note' as const,
  title: 'Heads up',
  body: 'Type inference works for **most** expressions; explicit annotations are still useful for public APIs.',
}
const APPEND_STEPS_EXAMPLE = {
  title: 'How to declare',
  items: ['Choose `let` or `var`.', 'Provide an initializer.'],
}
const APPEND_COMPARE_EXAMPLE = {
  leftTitle: 'let',
  left: 'Immutable — cannot reassign after binding.',
  rightTitle: 'var',
  right: 'Mutable — can reassign.',
}

function appendOne(bridge: AIClassroomBridgeValue, block: LessonContentBlock) {
  requireClassroom(bridge).dispatch({
    type: 'APPEND_LESSON_CONTENT',
    blocks: [block],
    now: Date.now(),
  })
  return { ok: true as const, appended: 1 }
}

export function createLessonAuthoringTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    append_heading: {
      description: 'Append a heading block. text is the heading text. level is 2 (H2) or 3 (H3); default 2.',
      parameters: z.object({
        text: z.string(),
        level: z.union([z.literal(2), z.literal(3)]).optional(),
      }),
      execute: async ({ text, level }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'heading', text, level })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_HEADING_EXAMPLE)
        }
      },
    },

    append_paragraph: {
      description: 'Append a paragraph block. body is a markdown string — use **bold**, `inline code`, lists, and triple-backtick fences with a language tag for code blocks.',
      parameters: z.object({ body: markdownBodySchema }),
      execute: async ({ body }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'paragraph', body })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_PARAGRAPH_EXAMPLE)
        }
      },
    },

    append_concept_card: {
      description: 'Append a concept_card block. body is a markdown string.',
      parameters: z.object({
        conceptId: z.string(),
        title: z.string(),
        body: markdownBodySchema,
      }),
      execute: async ({ conceptId, title, body }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'concept_card', conceptId, title, body })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_CONCEPT_CARD_EXAMPLE)
        }
      },
    },

    append_code_example: {
      description: 'Append a code_example block. code is the source string. title is optional. language is a Shiki language id and defaults to cangjie.',
      parameters: z.object({
        code: z.string(),
        title: z.string().optional(),
        language: z.string().optional(),
      }),
      execute: async ({ code, title, language }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'code_example', code, title, language })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_CODE_EXAMPLE_EXAMPLE)
        }
      },
    },

    append_callout: {
      description: 'Append a callout block. tone is "note", "warning", or "tip". body is a markdown string.',
      parameters: z.object({
        tone: z.union([z.literal('note'), z.literal('warning'), z.literal('tip')]),
        title: z.string().optional(),
        body: markdownBodySchema,
      }),
      execute: async ({ tone, title, body }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'callout', tone, title, body })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_CALLOUT_EXAMPLE)
        }
      },
    },

    append_steps: {
      description: 'Append a steps block. items is an array of step strings — each step can be a plain string (with markdown inline formatting via **bold** / `code`) or a RichText array if you need finer control.',
      parameters: z.object({
        title: z.string().optional(),
        items: z.array(richTextSchema).min(1),
      }),
      execute: async ({ title, items }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'steps', title, items })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_STEPS_EXAMPLE)
        }
      },
    },

    append_compare: {
      description: 'Append a compare block (left vs right). Each side can be a plain string (with markdown inline formatting) or a RichText array. For side-by-side full-program code views send each side as a RichText array with a single {type:"code", code, lang} part.',
      parameters: z.object({
        leftTitle: z.string(),
        left: richTextSchema,
        rightTitle: z.string(),
        right: richTextSchema,
      }),
      execute: async ({ leftTitle, left, rightTitle, right }) => {
        try {
          const block = lessonContentBlockSchema.parse({ type: 'compare', leftTitle, left, rightTitle, right })
          return appendOne(bridge, block)
        }
        catch (e) {
          return failWithRetryHint(e, APPEND_COMPARE_EXAMPLE)
        }
      },
    },

    set_current_quiz: {
      description: 'Set the current active quiz. All parameters are top-level; do not wrap fields in a "quiz" key. prompt is a short plain-text instruction (one or two sentences, no markdown — it is rendered verbatim). starterCode is plain source code with real newlines.',
      parameters: z.object({
        conceptId: z.string(),
        prompt: markdownBodySchema,
        starterCode: z.string(),
        expectedOutput: z.string(),
        matchMode: z.union([z.literal('exact'), z.literal('contains'), z.literal('regex')]).optional(),
      }),
      execute: async ({ conceptId, prompt, starterCode, expectedOutput, matchMode }) => {
        try {
          const block = lessonContentBlockSchema.parse({
            type: 'quiz',
            conceptId,
            prompt,
            starterCode,
            expectedOutput,
            matchMode,
          })
          if (block.type !== 'quiz')
            return failWithRetryHint(new Error('expected quiz block after parse'), SET_CURRENT_QUIZ_EXAMPLE)
          requireClassroom(bridge).dispatch({
            type: 'SET_CURRENT_QUIZ',
            quiz: block,
            now: Date.now(),
          })
          return ok({ currentQuiz: block })
        }
        catch (e) {
          return failWithRetryHint(e, SET_CURRENT_QUIZ_EXAMPLE)
        }
      },
    },

    set_phase: {
      description: 'Set classroom phase to orient, teach, or practice.',
      parameters: z.object({
        phase: z.union([z.literal('orient'), z.literal('teach'), z.literal('practice')]),
      }),
      execute: async ({ phase }) => {
        try {
          requireClassroom(bridge).dispatch({ type: 'SET_PHASE', phase, now: Date.now() })
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    set_learning_notes: {
      description: 'Set concise learner notes for future lesson generation steps.',
      parameters: z.object({
        notes: z.string().max(500),
      }),
      execute: async ({ notes }) => {
        try {
          requireClassroom(bridge).dispatch({ type: 'SET_LEARNING_NOTES', notes, now: Date.now() })
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}
