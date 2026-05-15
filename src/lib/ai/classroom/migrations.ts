import type { ChatIntentKind } from './types'

const CHAT_INTENTS = new Set<ChatIntentKind>([
  'advance',
  'go_deeper',
  'slow_down',
  'change_topic',
  'explain_error',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normaliseChatIntent(event: unknown) {
  if (!isRecord(event) || event.type !== 'chat_intent')
    return
  if (typeof event.intent !== 'string' || !CHAT_INTENTS.has(event.intent as ChatIntentKind))
    event.intent = 'change_topic'
}

function quizFallbackId(item: Record<string, unknown>, index: number): string {
  if (typeof item.id === 'string')
    return item.id
  const createdAt = typeof item.createdAt === 'number' ? item.createdAt : 0
  return `quiz:${createdAt}:${index}`
}

export function migrateClassroomRecord(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.session))
    return raw

  const record = cloneJson(raw)
  if (!isRecord(record) || !isRecord(record.session))
    return raw
  const session = record.session
  if (session.version !== 2)
    return record

  const quizIdsByCreatedAt = new Map<number, string>()
  const stream = Array.isArray(session.stream) ? session.stream : []
  for (const [index, item] of stream.entries()) {
    if (!isRecord(item))
      continue
    if (item.type === 'quiz' && isRecord(item.quiz)) {
      const id = typeof item.quiz.id === 'string' ? item.quiz.id : quizFallbackId(item, index)
      item.quiz.id = id
      if (typeof item.quiz.createdAt === 'number')
        quizIdsByCreatedAt.set(item.quiz.createdAt, id)
    }
    if (item.type === 'system_event')
      normaliseChatIntent(item.event)
  }

  if (isRecord(session.currentQuiz) && typeof session.currentQuiz.id !== 'string') {
    const createdAt = session.currentQuiz.createdAt
    session.currentQuiz.id = typeof createdAt === 'number'
      ? quizIdsByCreatedAt.get(createdAt) ?? `quiz:${createdAt}:current`
      : 'quiz:0:current'
  }

  const eventQueue = Array.isArray(session.eventQueue) ? session.eventQueue : []
  for (const event of eventQueue)
    normaliseChatIntent(event)

  return record
}
