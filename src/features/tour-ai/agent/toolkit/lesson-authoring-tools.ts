import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { lessonContentBlockSchema, richTextSchema } from '@/lib/ai/classroom/schema'
import type { LessonContentBlock } from '@/lib/ai/classroom/types'
import { failWithRetryHint } from '../fail-with-retry-hint'
import { fail, ok } from './results'
import { requireClassroom } from './shared'

const SET_CURRENT_QUIZ_EXAMPLE = {
  conceptId: 'concept_id',
  prompt: [{ text: 'Write a function that returns the sum of two integers.' }],
  starterCode: 'func add(a: Int64, b: Int64): Int64 { 0 }',
  expectedOutput: '7',
  matchMode: 'exact' as const,
}

const APPEND_HEADING_EXAMPLE = { text: 'Section title', level: 2 as const }
const APPEND_PARAGRAPH_EXAMPLE = { body: [{ text: 'Cangjie supports type inference.' }] }
const APPEND_CONCEPT_CARD_EXAMPLE = {
  conceptId: 'variables_constants',
  title: 'Variables and constants',
  body: [{ text: 'Use let for immutable bindings.' }],
}
const APPEND_CODE_EXAMPLE_EXAMPLE = { code: 'let x = 25', title: 'Declaring a variable', language: 'cangjie' }
const APPEND_CALLOUT_EXAMPLE = {
  tone: 'note' as const,
  title: 'Heads up',
  body: [{ text: 'Type inference works for most expressions.' }],
}
const APPEND_STEPS_EXAMPLE = {
  title: 'How to declare',
  items: [[{ text: 'Choose let or var.' }], [{ text: 'Provide an initializer.' }]],
}
const APPEND_COMPARE_EXAMPLE = {
  leftTitle: 'let',
  left: [{ text: 'Immutable.' }],
  rightTitle: 'var',
  right: [{ text: 'Mutable.' }],
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
      description: 'Append a paragraph block. body is a RichText array of {text}/{code, lang?}/{strong} objects. Use lang for non-Cangjie inline code.',
      parameters: z.object({ body: richTextSchema }),
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
      description: 'Append a concept_card block. body is a RichText array.',
      parameters: z.object({
        conceptId: z.string(),
        title: z.string(),
        body: richTextSchema,
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
      description: 'Append a callout block. tone is "note", "warning", or "tip". body is a RichText array.',
      parameters: z.object({
        tone: z.union([z.literal('note'), z.literal('warning'), z.literal('tip')]),
        title: z.string().optional(),
        body: richTextSchema,
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
      description: 'Append a steps block. items is an array of RichText arrays (one per step).',
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
      description: 'Append a compare block (left vs right). left and right are RichText arrays.',
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
      description: 'Set the current active quiz. All parameters are top-level; do not wrap fields in a "quiz" key, do not stringify nested objects. prompt is a RichText array of {text}/{code, lang?}/{strong} objects.',
      parameters: z.object({
        conceptId: z.string(),
        prompt: richTextSchema,
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
