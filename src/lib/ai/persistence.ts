import type { UIMessage } from 'ai'

const THREAD_PREFIX = 'tour-ai:thread3:'
const QUOTA_BYTES = 5 * 1024 * 1024

interface StoredThread<M extends UIMessage> {
  messages: M[]
  updatedAt: number
}

export function sectionKey(lang: string, chapterId: string, subChapterId: string, sectionId: string): string {
  return `${lang}:${chapterId}/${subChapterId}/${sectionId}`
}

export function globalThreadKey(lang: string): string {
  return `ai:global:${lang}`
}

function fullKey(sk: string): string {
  return `${THREAD_PREFIX}${sk}`
}

export function loadThread<M extends UIMessage = UIMessage>(sk: string): M[] {
  if (typeof window === 'undefined')
    return []
  try {
    const raw = window.localStorage.getItem(fullKey(sk))
    if (!raw)
      return []
    const parsed = JSON.parse(raw) as StoredThread<M>
    return Array.isArray(parsed.messages) ? parsed.messages : []
  }
  catch {
    return []
  }
}

interface OwnEntry {
  key: string
  size: number
  updatedAt: number
}

function collectOwnEntries(): OwnEntry[] {
  const entries: OwnEntry[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k || !k.startsWith(THREAD_PREFIX))
      continue
    const raw = window.localStorage.getItem(k)
    if (!raw)
      continue
    try {
      const parsed = JSON.parse(raw) as StoredThread<UIMessage>
      entries.push({ key: k, size: (k.length + raw.length) * 2, updatedAt: parsed.updatedAt ?? 0 })
    }
    catch {
      window.localStorage.removeItem(k)
    }
  }
  return entries
}

function evictUntilUnder(targetBytes: number) {
  const entries = collectOwnEntries()
  let used = entries.reduce((acc, e) => acc + e.size, 0)
  entries.sort((a, b) => a.updatedAt - b.updatedAt)
  while (used > targetBytes && entries.length > 0) {
    const e = entries.shift()!
    window.localStorage.removeItem(e.key)
    used -= e.size
  }
}

export function saveThread<M extends UIMessage>(sk: string, messages: readonly M[]): void {
  if (typeof window === 'undefined')
    return
  const payload: StoredThread<M> = { messages: messages as M[], updatedAt: Date.now() }
  const serialized = JSON.stringify(payload)
  try {
    window.localStorage.setItem(fullKey(sk), serialized)
  }
  catch {
    evictUntilUnder(QUOTA_BYTES * 0.8)
    try {
      window.localStorage.setItem(fullKey(sk), serialized)
    }
    catch {
      // give up silently
    }
  }
}

export function clearThread(sk: string): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage.removeItem(fullKey(sk))
  }
  catch {}
}
