import type { ConceptNode } from '@/lib/ai/concept-graph/types'
import { findChapterRefSections } from '@/lib/ai/concept-graph/loader'
import type { FlatSection } from '@/tour/types'
import type {
  ContentPackLanguage,
  CoreContentBlock,
  CourseContentPack,
  ExerciseTask,
  LearningSkill,
  SourceReference,
  SourceRequirement,
} from './content-packs'
import { hasDistinctAssessmentContract } from './content-packs'

export type { ContentPackLanguage } from './content-packs'

// The server replaces this non-publishable placeholder with a content-addressed
// version before a pack crosses the API boundary.
const UNVERSIONED_CONTENT_PLACEHOLDER = 'unversioned' as const
const DEFAULT_CODE_OUTPUT_MATCH_MODE = 'exact' as const

type UnversionedExerciseTemplate
  = Omit<CourseContentPack['exerciseTemplates'][number], 'version'>
    & { version: typeof UNVERSIONED_CONTENT_PLACEHOLDER }

export type UnversionedCourseContentPack
  = Omit<
    CourseContentPack,
    'exerciseTemplates' | 'learningContractVersion' | 'version'
  >
  & {
    exerciseTemplates: UnversionedExerciseTemplate[]
    learningContractVersion: typeof UNVERSIONED_CONTENT_PLACEHOLDER
    version: typeof UNVERSIONED_CONTENT_PLACEHOLDER
  }

type TourMdxElementName = 'Highlight' | 'Note' | 'CompareGroup' | 'CompareWith'

interface ParsedTag {
  attributes: string
  name: TourMdxElementName
}

const OPEN_TAG_RE = /^<(Highlight|Note|CompareGroup|CompareWith)\b([^>]*)>/
const CLOSE_TAG_RE = /^<\/(Highlight|Note|CompareGroup|CompareWith)\s*>/
const RAW_TAG_RE = /^<\/?[a-z][^>]*>/i
const LANGUAGE_ATTRIBUTE_RE = /\blang\s*=\s*(["'])([A-Za-z0-9#+.-]+)\1/

const LANGUAGE_LABELS: Record<string, string> = {
  'c': 'C',
  'c#': 'C#',
  'go': 'Go',
  'java': 'Java',
  'kotlin': 'Kotlin',
  'python': 'Python',
  'rust': 'Rust',
  'scala': 'Scala',
}

export const VALIDATED_CONTENT_CONCEPT_IDS = [
  'cj.program.main',
  'cj.io.println',
  'cj.var.immutable',
  'cj.var.mutable',
] as const

const STATIC_TOUR_CODE_SNIPPET_REFS = new Set([
  // Requires a separately linked native `increment` symbol.
  '09-ffi-unsafe/02-c-types/04',
  // Macro package fragments are compiled as part of a macro package, not as
  // standalone programs.
  '10-macros/01-intro/02',
  '10-macros/01-intro/03',
  '10-macros/02-tokens-quote/02',
  '10-macros/02-tokens-quote/03',
])

type ValidatedContentConceptId = typeof VALIDATED_CONTENT_CONCEPT_IDS[number]

interface LocalizedText {
  en: string
  zh: string
}

interface DefaultExerciseDefinition {
  expectedOutput: string
  hints: LocalizedText[]
  prompt: LocalizedText
  purpose: 'placement' | 'practice' | 'review'
  referenceSolution: string
  sourceRequirements: SourceRequirement[]
  starterCode: string
}

interface DefaultValidatedContentDefinition {
  exercises: [
    DefaultExerciseDefinition,
    DefaultExerciseDefinition,
    DefaultExerciseDefinition,
  ]
  sourceRefs: [string, ...string[]]
  skillDescription: LocalizedText
  skillTitle: LocalizedText
}

const DEFAULT_VALIDATED_CONTENT: Record<
  ValidatedContentConceptId,
  DefaultValidatedContentDefinition
> = {
  'cj.program.main': {
    sourceRefs: ['01-welcome/01-intro/01'],
    skillTitle: {
      zh: '构建并运行 main 入口',
      en: 'Build and run a main entry point',
    },
    skillDescription: {
      zh: '能够识别顶层 main 函数，并运行一个最小仓颉程序。',
      en: 'Can identify the top-level main function and run a minimal Cangjie program.',
    },
    exercises: [{
      purpose: 'practice',
      prompt: {
        zh: '补全代码：定义顶层 main，使程序只输出 `Hello from main`。',
        en: 'Complete the code with a top-level main that prints only `Hello from main`.',
      },
      starterCode: '// TODO: Define the top-level entry point and print the requested line.',
      expectedOutput: 'Hello from main',
      referenceSolution: [
        'main() {',
        '    println("Hello from main")',
        '}',
      ].join('\n'),
      sourceRequirements: [{ type: 'top_level_main' }],
      hints: [{
        zh: 'main 应定义在顶层，不需要 func 关键字。',
        en: 'Define main at the top level without the func keyword.',
      }],
    }, {
      purpose: 'review',
      prompt: {
        zh: '重新编写一个 main：创建消息并只输出 `main is the entry point`。',
        en: 'Write a fresh main that stores and prints only `main is the entry point`.',
      },
      starterCode: '// TODO: Define main, store the requested message, and print it.',
      expectedOutput: 'main is the entry point',
      referenceSolution: [
        'main() {',
        '    let message = "main is the entry point"',
        '    println(message)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'top_level_main' },
        { type: 'binding', binding: 'let', name: 'message' },
        { type: 'call_identifier', functionName: 'println', argumentName: 'message' },
      ],
      hints: [{
        zh: '执行从 main 函数体的第一条语句开始。',
        en: 'Execution begins with the first statement in the main body.',
      }],
    }, {
      purpose: 'placement',
      prompt: {
        zh: 'Placement Check：从空白开始定义顶层 main，并只输出 `entry ready`。',
        en: 'Placement Check: define a top-level main from scratch and print only `entry ready`.',
      },
      starterCode: '// TODO: Demonstrate that you can define the program entry point.',
      expectedOutput: 'entry ready',
      referenceSolution: [
        'main() {',
        '    println("entry ready")',
        '}',
      ].join('\n'),
      sourceRequirements: [{ type: 'top_level_main' }],
      hints: [],
    }],
  },
  'cj.io.println': {
    sourceRefs: ['01-welcome/01-intro/01'],
    skillTitle: {
      zh: '使用 println 输出值',
      en: 'Print values with println',
    },
    skillDescription: {
      zh: '能够使用 println 将字符串和值写到标准输出。',
      en: 'Can use println to write strings and values to standard output.',
    },
    exercises: [{
      purpose: 'practice',
      prompt: {
        zh: '补全程序，用 println 只输出 `Cangjie`。',
        en: 'Complete the program so println writes only `Cangjie`.',
      },
      starterCode: [
        'main() {',
        '    let language = "Cangjie"',
        '    // TODO: Print language on its own line.',
        '}',
      ].join('\n'),
      expectedOutput: 'Cangjie',
      referenceSolution: [
        'main() {',
        '    let language = "Cangjie"',
        '    println(language)',
        '}',
      ].join('\n'),
      sourceRequirements: [{
        type: 'call_identifier',
        functionName: 'println',
        argumentName: 'language',
      }],
      hints: [{
        zh: '把要输出的值放在 println 的括号中。',
        en: 'Place the value to print inside the println parentheses.',
      }],
    }, {
      purpose: 'review',
      prompt: {
        zh: '补全程序，使用两次 println，按顺序输出 `first` 和 `second`。',
        en: 'Complete the program with two println calls that write `first` and `second` in order.',
      },
      starterCode: [
        'main() {',
        '    let first = "first"',
        '    let second = "second"',
        '    // TODO: Print first, then second.',
        '}',
      ].join('\n'),
      expectedOutput: 'first\nsecond',
      referenceSolution: [
        'main() {',
        '    let first = "first"',
        '    let second = "second"',
        '    println(first)',
        '    println(second)',
        '}',
      ].join('\n'),
      sourceRequirements: [{
        type: 'call_identifier',
        functionName: 'println',
        argumentName: 'first',
      }, {
        type: 'call_identifier',
        functionName: 'println',
        argumentName: 'second',
      }],
      hints: [{
        zh: '每次 println 调用都会在输出末尾换行。',
        en: 'Each println call ends its output with a newline.',
      }],
    }, {
      purpose: 'placement',
      prompt: {
        zh: 'Placement Check：用 println 输出已有的 `value` 绑定，使程序只输出 `7`。',
        en: 'Placement Check: use println with the existing `value` binding so the program prints only `7`.',
      },
      starterCode: [
        'main() {',
        '    let value = 7',
        '    // TODO: Demonstrate printing the bound value.',
        '}',
      ].join('\n'),
      expectedOutput: '7',
      referenceSolution: [
        'main() {',
        '    let value = 7',
        '    println(value)',
        '}',
      ].join('\n'),
      sourceRequirements: [{
        type: 'call_identifier',
        functionName: 'println',
        argumentName: 'value',
      }],
      hints: [],
    }],
  },
  'cj.var.immutable': {
    sourceRefs: ['02-basics/01-bindings/01'],
    skillTitle: {
      zh: '声明并使用 let 绑定',
      en: 'Declare and use a let binding',
    },
    skillDescription: {
      zh: '能够用 let 声明不可变绑定，并在表达式中读取它。',
      en: 'Can declare an immutable binding with let and read it in expressions.',
    },
    exercises: [{
      purpose: 'practice',
      prompt: {
        zh: '补全程序：用 let 声明值为 42 的 answer，并输出它。',
        en: 'Complete the program: declare answer as 42 with let, then print it.',
      },
      starterCode: [
        'main() {',
        '    // TODO: Declare the immutable answer and print it.',
        '}',
      ].join('\n'),
      expectedOutput: '42',
      referenceSolution: [
        'main() {',
        '    let answer = 42',
        '    println(answer)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'binding', binding: 'let', name: 'answer' },
        { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
      ],
      hints: [{
        zh: 'let 绑定必须在读取前完成初始化。',
        en: 'A let binding must be initialized before it is read.',
      }],
    }, {
      purpose: 'review',
      prompt: {
        zh: '使用两个 let 绑定计算 24 的两倍并输出结果。',
        en: 'Use two let bindings to double 24 and print the result.',
      },
      starterCode: [
        'main() {',
        '    let base = 24',
        '    // TODO: Declare doubled with let and print it.',
        '}',
      ].join('\n'),
      expectedOutput: '48',
      referenceSolution: [
        'main() {',
        '    let base = 24',
        '    let doubled = base * 2',
        '    println(doubled)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'binding', binding: 'let', name: 'doubled' },
        { type: 'integer_binding', binding: 'let', name: 'base', value: 24 },
        {
          type: 'binary_integer_binding',
          binding: 'let',
          name: 'doubled',
          leftName: 'base',
          operator: '*',
          rightValue: 2,
        },
        { type: 'call_identifier', functionName: 'println', argumentName: 'doubled' },
      ],
      hints: [{
        zh: '创建新的 let 绑定保存计算结果，不要重新赋值。',
        en: 'Store the result in a new let binding instead of reassigning.',
      }],
    }, {
      purpose: 'placement',
      prompt: {
        zh: 'Placement Check：用 let 声明 `greeting` 为 `known`，并通过该绑定输出它。',
        en: 'Placement Check: declare `greeting` as `known` with let and print through that binding.',
      },
      starterCode: [
        'main() {',
        '    // TODO: Demonstrate declaring and using an immutable binding.',
        '}',
      ].join('\n'),
      expectedOutput: 'known',
      referenceSolution: [
        'main() {',
        '    let greeting = "known"',
        '    println(greeting)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'binding', binding: 'let', name: 'greeting' },
        { type: 'call_identifier', functionName: 'println', argumentName: 'greeting' },
      ],
      hints: [],
    }],
  },
  'cj.var.mutable': {
    sourceRefs: ['02-basics/01-bindings/02'],
    skillTitle: {
      zh: '声明并更新 var 绑定',
      en: 'Declare and update a var binding',
    },
    skillDescription: {
      zh: '能够用 var 声明需要变化的绑定，并进行类型一致的重新赋值。',
      en: 'Can declare a changing binding with var and reassign a value of the same type.',
    },
    exercises: [{
      purpose: 'practice',
      prompt: {
        zh: '把可变计数器加一并输出更新后的值。',
        en: 'Increment a mutable counter and print the updated value.',
      },
      starterCode: [
        'main() {',
        '    var count = 1',
        '    // TODO: Increment count once.',
        '    println(count)',
        '}',
      ].join('\n'),
      expectedOutput: '2',
      referenceSolution: [
        'main() {',
        '    var count = 1',
        '    count = count + 1',
        '    println(count)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'binding', binding: 'var', name: 'count' },
        { type: 'integer_binding', binding: 'var', name: 'count', value: 1 },
        { type: 'reassignment', name: 'count' },
        { type: 'add_integer_reassignment', name: 'count', amount: 1 },
        { type: 'call_identifier', functionName: 'println', argumentName: 'count' },
      ],
      hints: [{
        zh: '需要重新赋值的绑定应使用 var。',
        en: 'Use var for a binding that must be reassigned.',
      }],
    }, {
      purpose: 'review',
      prompt: {
        zh: '更新可变的 total 绑定并输出最终结果。',
        en: 'Update a mutable total binding and print the final result.',
      },
      starterCode: [
        'main() {',
        '    var total = 10',
        '    // TODO: Add 5 to total by reassigning it.',
        '    println(total)',
        '}',
      ].join('\n'),
      expectedOutput: '15',
      referenceSolution: [
        'main() {',
        '    var total = 10',
        '    total = total + 5',
        '    println(total)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'binding', binding: 'var', name: 'total' },
        { type: 'integer_binding', binding: 'var', name: 'total', value: 10 },
        { type: 'reassignment', name: 'total' },
        { type: 'add_integer_reassignment', name: 'total', amount: 5 },
        { type: 'call_identifier', functionName: 'println', argumentName: 'total' },
      ],
      hints: [{
        zh: '重新赋值不会创建新的绑定。',
        en: 'Reassignment updates the existing binding; it does not declare a new one.',
      }],
    }, {
      purpose: 'placement',
      prompt: {
        zh: 'Placement Check：把可变的 `score` 从 3 增加 4，并通过该绑定输出最终值。',
        en: 'Placement Check: increase mutable `score` from 3 by 4 and print the final value through that binding.',
      },
      starterCode: [
        'main() {',
        '    var score = 3',
        '    // TODO: Demonstrate reassignment before printing score.',
        '}',
      ].join('\n'),
      expectedOutput: '7',
      referenceSolution: [
        'main() {',
        '    var score = 3',
        '    score = score + 4',
        '    println(score)',
        '}',
      ].join('\n'),
      sourceRequirements: [
        { type: 'binding', binding: 'var', name: 'score' },
        { type: 'integer_binding', binding: 'var', name: 'score', value: 3 },
        { type: 'reassignment', name: 'score' },
        { type: 'add_integer_reassignment', name: 'score', amount: 4 },
        { type: 'call_identifier', functionName: 'println', argumentName: 'score' },
      ],
      hints: [],
    }],
  },
}

function renderNote(content: string, lang: ContentPackLanguage): string {
  const label = lang === 'zh' ? '提示：' : 'Note:'
  const lines = content.trim().split('\n')
  const [first = '', ...rest] = lines
  return [
    `> **${label}** ${first}`,
    ...rest.map(line => line ? `> ${line}` : '>'),
  ].join('\n')
}

function renderElement(
  tag: ParsedTag,
  content: string,
  lang: ContentPackLanguage,
): string {
  switch (tag.name) {
    case 'Highlight':
      return `**${content.trim()}**`
    case 'Note':
      return `\n${renderNote(content, lang)}\n`
    case 'CompareGroup':
      return `\n### ${lang === 'zh' ? '与其他语言对比' : 'Language comparison'}\n${content.trim()}\n`
    case 'CompareWith': {
      const language = LANGUAGE_ATTRIBUTE_RE.exec(tag.attributes)?.[2]
      if (!language)
        throw new Error('CompareWith requires a literal lang attribute')
      const label = LANGUAGE_LABELS[language.toLowerCase()] ?? language
      return `\n#### ${label}\n\n${content.trim()}\n`
    }
  }
}

function escapeRawTag(tag: string): string {
  return tag.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * Convert the four interactive components used by the Static Tour into plain,
 * deterministic Markdown. Code spans and fences are copied byte-for-byte, and
 * any other HTML-looking tag is escaped instead of being handed to a runtime
 * raw-HTML renderer.
 */
export function mdxToSafeMarkdown(
  source: string,
  lang: ContentPackLanguage,
): string {
  const input = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  let offset = 0

  function parseChildren(endTag?: TourMdxElementName): string {
    let output = ''

    while (offset < input.length) {
      const remainder = input.slice(offset)

      if (input[offset] === '`') {
        let delimiterLength = 1
        while (input[offset + delimiterLength] === '`')
          delimiterLength++
        const delimiter = '`'.repeat(delimiterLength)
        const end = input.indexOf(delimiter, offset + delimiterLength)
        if (end === -1) {
          output += input.slice(offset)
          offset = input.length
          break
        }
        output += input.slice(offset, end + delimiterLength)
        offset = end + delimiterLength
        continue
      }

      if (remainder.startsWith('~~~')) {
        let delimiterLength = 3
        while (input[offset + delimiterLength] === '~')
          delimiterLength++
        const delimiter = '~'.repeat(delimiterLength)
        const end = input.indexOf(delimiter, offset + delimiterLength)
        if (end === -1) {
          output += input.slice(offset)
          offset = input.length
          break
        }
        output += input.slice(offset, end + delimiterLength)
        offset = end + delimiterLength
        continue
      }

      const closeTag = CLOSE_TAG_RE.exec(remainder)
      if (closeTag) {
        const name = closeTag[1] as TourMdxElementName
        if (name !== endTag)
          throw new Error(`Unexpected closing MDX tag </${name}>`)
        offset += closeTag[0].length
        return output
      }

      const openTag = OPEN_TAG_RE.exec(remainder)
      if (openTag) {
        const tag: ParsedTag = {
          name: openTag[1] as TourMdxElementName,
          attributes: openTag[2],
        }
        offset += openTag[0].length
        output += renderElement(tag, parseChildren(tag.name), lang)
        continue
      }

      const rawTag = RAW_TAG_RE.exec(remainder)
      if (rawTag) {
        output += escapeRawTag(rawTag[0])
        offset += rawTag[0].length
        continue
      }

      output += input[offset]
      offset++
    }

    if (endTag)
      throw new Error(`Missing closing MDX tag </${endTag}>`)
    return output
  }

  return parseChildren().trim()
}

function compareStableIds(a: string, b: string): number {
  if (a < b)
    return -1
  if (a > b)
    return 1
  return 0
}

function sourceRef(section: FlatSection): string {
  return `${section.chapterId}/${section.subChapterId}/${section.sectionId}`
}

function localized(
  values: { en?: string, zh?: string },
  lang: ContentPackLanguage,
  context: string,
): string {
  const value = values[lang]?.trim()
  if (!value)
    throw new Error(`Missing ${lang} Static Tour content for ${context}`)
  return value
}

function sourceReference(
  section: FlatSection,
  lang: ContentPackLanguage,
): SourceReference {
  return {
    sourceId: 'static-tour',
    ref: sourceRef(section),
    title: localized(section.sectionName, lang, `${sourceRef(section)} title`),
  }
}

function coreContentBlocks(
  conceptId: string,
  sections: FlatSection[],
  lang: ContentPackLanguage,
): CoreContentBlock[] {
  const blocks: CoreContentBlock[] = []

  for (const section of sections) {
    const ref = sourceRef(section)
    const reference = sourceReference(section, lang)
    const markdown = localized(section.markdown, lang, `${ref} markdown`)
    blocks.push({
      id: `block:${conceptId}:${ref}:prose`,
      type: 'prose',
      markdown: mdxToSafeMarkdown(markdown, lang),
      sourceReferences: [reference],
    })

    const code = section.code[lang]?.trim()
    if (code) {
      blocks.push({
        id: `block:${conceptId}:${ref}:code`,
        type: 'code_sample',
        code,
        language: 'cangjie',
        sampleType: STATIC_TOUR_CODE_SNIPPET_REFS.has(ref)
          ? 'snippet'
          : 'program',
        sourceReferences: [reference],
      })
    }
  }

  return blocks
}

function validatedEvidenceLoop(
  conceptId: string,
  lang: ContentPackLanguage,
): {
  exerciseTemplates: UnversionedExerciseTemplate[]
  learningSkills: LearningSkill[]
} {
  const definition = defaultValidatedContent(conceptId)
  if (!definition)
    return { exerciseTemplates: [], learningSkills: [] }

  const learningSkillId = `skill:${conceptId}:core`
  const exerciseTemplates: UnversionedExerciseTemplate[] = definition.exercises
    .map(exercise => ({
      id: `template:${conceptId}:${exercise.purpose}`,
      version: UNVERSIONED_CONTENT_PLACEHOLDER,
      learningSkillId,
      purpose: exercise.purpose,
      task: {
        type: 'code_output',
        prompt: exercise.prompt[lang],
        starterCode: exercise.starterCode,
        expectedOutput: exercise.expectedOutput,
        matchMode: DEFAULT_CODE_OUTPUT_MATCH_MODE,
        sourceRequirements: exercise.sourceRequirements,
        hints: exercise.hints.map(hint => hint[lang]),
      },
    }))
  const priorAssessments = exerciseTemplates.filter(template =>
    template.purpose !== 'review')
  const reviewAssessments = exerciseTemplates.filter(template =>
    template.purpose === 'review')
  for (const [reviewIndex, review] of reviewAssessments.entries()) {
    const comparisons = [
      ...priorAssessments,
      ...reviewAssessments.slice(0, reviewIndex),
    ]
    for (const prior of comparisons) {
      if (!hasDistinctAssessmentContract(
        { templateId: prior.id, task: prior.task },
        { templateId: review.id, task: review.task },
      )) {
        throw new Error(
          `Review Exercise Template ${review.id} repeats assessment contract ${prior.id}`,
        )
      }
    }
  }

  return {
    learningSkills: [{
      id: learningSkillId,
      conceptId,
      title: definition.skillTitle[lang],
      description: definition.skillDescription[lang],
      key: true,
    }],
    exerciseTemplates,
  }
}

function defaultValidatedContent(
  conceptId: string,
): DefaultValidatedContentDefinition | undefined {
  if (!VALIDATED_CONTENT_CONCEPT_IDS.includes(conceptId as ValidatedContentConceptId))
    return undefined
  return DEFAULT_VALIDATED_CONTENT[conceptId as ValidatedContentConceptId]
}

export interface ContentPackReferenceValidationCase {
  conceptId: ValidatedContentConceptId
  expectedOutput: string
  matchMode: Extract<
    ExerciseTask,
    { type: 'code_output' }
  >['matchMode']
  referenceSolution: string
  sourceRequirements: SourceRequirement[]
  starterCode: string
  taskType: 'code_output'
  templateId: string
}

/** Reference solutions are generation-only and never enter browser artifacts. */
export function getContentPackReferenceValidationCases(): ContentPackReferenceValidationCase[] {
  return VALIDATED_CONTENT_CONCEPT_IDS.flatMap((conceptId) => {
    const definition = DEFAULT_VALIDATED_CONTENT[conceptId]
    return definition.exercises.map(exercise => ({
      conceptId,
      expectedOutput: exercise.expectedOutput,
      matchMode: DEFAULT_CODE_OUTPUT_MATCH_MODE,
      referenceSolution: exercise.referenceSolution,
      sourceRequirements: structuredClone(exercise.sourceRequirements),
      starterCode: exercise.starterCode,
      taskType: 'code_output' as const,
      templateId: `template:${conceptId}:${exercise.purpose}`,
    }))
  })
}

/**
 * Project Static Tour sections onto the Concept Graph. Stable filesystem ids,
 * rather than the presentation-only chapterStep, define Source References and
 * Core Content Block identity.
 */
export function buildCourseContentPacks(
  sections: readonly FlatSection[],
  concepts: readonly ConceptNode[],
  lang: ContentPackLanguage,
): UnversionedCourseContentPack[] {
  const sectionIds = new Set<string>()
  for (const section of sections) {
    const ref = sourceRef(section)
    if (sectionIds.has(ref))
      throw new Error(`Duplicate Static Tour Source Reference ${ref}`)
    sectionIds.add(ref)
  }

  return concepts.flatMap((concept): UnversionedCourseContentPack[] => {
    const matchedByRef = new Map<string, FlatSection>()
    const definition = defaultValidatedContent(concept.conceptId)
    const contentRefs = definition?.sourceRefs ?? concept.chapterRefs
    if (definition && contentRefs.some(ref =>
      !concept.chapterRefs.some(chapterRef =>
        ref === chapterRef || ref.startsWith(`${chapterRef}/`)))) {
      throw new Error(
        `Validated Content source is outside Concept Graph refs for ${concept.conceptId}`,
      )
    }
    if (contentRefs.length === 0)
      return []

    for (const chapterRef of contentRefs) {
      const matched = findChapterRefSections(chapterRef, [...sections])
      if (matched.length === 0) {
        throw new Error(
          `Concept ${concept.conceptId} has no Static Tour content for ${chapterRef}`,
        )
      }
      for (const section of matched)
        matchedByRef.set(sourceRef(section), section)
    }
    const matchedSections = [...matchedByRef.values()]
      .sort((a, b) => compareStableIds(sourceRef(a), sourceRef(b)))

    const evidenceLoop = validatedEvidenceLoop(concept.conceptId, lang)
    return [{
      id: `pack:${concept.conceptId}`,
      version: UNVERSIONED_CONTENT_PLACEHOLDER,
      learningContractVersion: UNVERSIONED_CONTENT_PLACEHOLDER,
      concept: {
        id: concept.conceptId,
        title: localized(concept.title, lang, `${concept.conceptId} title`),
        summary: localized(concept.summary, lang, `${concept.conceptId} summary`),
        prerequisites: [...concept.prerequisites],
      },
      blocks: coreContentBlocks(concept.conceptId, matchedSections, lang),
      learningSkills: evidenceLoop.learningSkills,
      exerciseTemplates: evidenceLoop.exerciseTemplates,
      review: {
        status: 'pending',
      },
    }]
  })
}
