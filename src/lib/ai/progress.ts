import { writeJSON } from '@/lib/storage'

const PREFIX = 'tour-ai:progress:'

export type ProgressStatus = 'started' | 'completed' | 'skipped'

export interface ProgressEntry {
  sectionKey: string
  status: ProgressStatus
  note?: string
  updatedAt: number
}

export function recordProgress(sectionKey: string, status: ProgressStatus, note?: string): ProgressEntry {
  const entry: ProgressEntry = { sectionKey, status, note, updatedAt: Date.now() }
  writeJSON(`${PREFIX}${sectionKey}`, entry)
  return entry
}

export function listProgress(): ProgressEntry[] {
  if (typeof window === 'undefined')
    return []
  const out: ProgressEntry[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k || !k.startsWith(PREFIX))
      continue
    try {
      const raw = window.localStorage.getItem(k)
      if (!raw)
        continue
      out.push(JSON.parse(raw) as ProgressEntry)
    }
    catch {}
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out
}
